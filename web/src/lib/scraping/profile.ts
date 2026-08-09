import { load as loadYaml, JSON_SCHEMA } from "js-yaml";
import { z } from "zod";

import type { ScrapedJob } from "./types";

const shortText = z.string().trim().min(1).max(80);
const experienceRangeSchema = z
  .object({
    min_years: z.number().int().min(0).max(50).optional(),
    max_years: z.number().int().min(0).max(50).optional(),
  })
  .strict()
  .refine(
    (range) =>
      range.min_years === undefined ||
      range.max_years === undefined ||
      range.min_years <= range.max_years,
    { message: "경력 최솟값은 최댓값보다 클 수 없습니다." },
  );

const searchProfileSchema = z
  .object({
    roles: z.array(shortText).max(30).default([]),
    skills: z.array(shortText).max(50).default([]),
    discovery_skills: z.array(shortText).max(30).default([]),
    locations: z.array(shortText).max(30).default([]),
    experience: experienceRangeSchema.optional(),
    experience_by_role: z
      .array(
        experienceRangeSchema.extend({
          role: shortText,
        }),
      )
      .max(20)
      .default([]),
    exclude_keywords: z.array(shortText).max(50).default([]),
  })
  .strict();

export type SearchProfile = z.infer<typeof searchProfileSchema>;

export function parseSearchProfile(source: string): SearchProfile {
  const loaded = loadYaml(source, { schema: JSON_SCHEMA });
  return searchProfileSchema.parse(loaded);
}

export function getProfileKeywords(profile: SearchProfile): string[] {
  return [...new Set([...profile.roles, ...profile.skills])];
}

function getRoleDiscoveryAliases(roles: string[]): string[] {
  const roleText = normalized(roles.join(" "));
  const aliases: string[] = [];

  if (roleText.includes("프론트") || roleText.includes("frontend") || roleText.includes("front-end")) {
    aliases.push("프론트엔드", "프론트 엔드", "프론트", "Front-end", "FE 개발", "FE Developer", "웹개발", "웹 개발");
  }
  if (roleText.includes("퍼블리")) {
    aliases.push("웹퍼블리셔", "웹 퍼블리셔", "퍼블리셔", "퍼블리싱", "UI 개발");
  }

  return aliases;
}

export function getProfileDiscoveryKeywords(profile: SearchProfile): string[] {
  const skills = profile.discovery_skills.length > 0 ? profile.discovery_skills : profile.skills;
  return [...new Set([...profile.roles, ...getRoleDiscoveryAliases(profile.roles), ...skills])];
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko");
}

function includesTerm(value: string, term: string): boolean {
  return normalized(value).includes(normalized(term));
}

function extractExperienceRange(value: string): { minimum: number; maximum: number | null } | null {
  const korean = value.match(/(?:경력|실무)[^\d]{0,12}(\d{1,2})(?:\s*(?:-|~|–|—)\s*(\d{1,2}))?\s*년/i);
  const english = value.match(/(\d{1,2})(?:\s*(?:-|~|–|—)\s*(\d{1,2}))?\s*\+?\s*years?/i);
  const match = korean ?? english;
  if (!match?.[1]) return null;
  return {
    minimum: Number(match[1]),
    maximum: match[2] ? Number(match[2]) : null,
  };
}

function experienceOverlaps(job: ScrapedJob, profile: SearchProfile): boolean {
  const content = `${job.position}\n${job.description}`;
  const roleRanges = profile.experience_by_role.filter((range) => includesTerm(content, range.role));
  const desiredRanges = roleRanges.length > 0
    ? roleRanges
    : profile.experience
      ? [profile.experience]
      : [];
  if (desiredRanges.length === 0) return true;
  const range = extractExperienceRange(`${job.position}\n${job.description}`);
  if (!range) return true;

  const jobMaximum = range.maximum ?? Number.POSITIVE_INFINITY;
  return desiredRanges.some((desired) => {
    const desiredMinimum = desired.min_years ?? 0;
    const desiredMaximum = desired.max_years ?? Number.POSITIVE_INFINITY;
    return range.minimum <= desiredMaximum && jobMaximum >= desiredMinimum;
  });
}

function scoreJob(job: ScrapedJob, profile: SearchProfile): number {
  const title = `${job.company} ${job.position}`;
  const content = `${title} ${job.tags.join(" ")} ${job.description}`;
  let score = 0;

  for (const role of profile.roles) {
    if (includesTerm(job.position, role)) score += 12;
    else if (includesTerm(content, role)) score += 4;
  }
  for (const skill of profile.skills) {
    if (includesTerm(title, skill)) score += 5;
    else if (job.tags.some((tag) => includesTerm(tag, skill))) score += 4;
    else if (includesTerm(job.description, skill)) score += 1;
  }
  for (const location of profile.locations) {
    if (includesTerm(content, location)) score += 2;
  }
  return score;
}

function matchMetadata(job: ScrapedJob, profile: SearchProfile) {
  const content = `${job.company} ${job.position} ${job.tags.join(" ")} ${job.description}`;
  const matchedRoles = profile.roles.filter((role) => includesTerm(content, role));
  const matchedSkills = profile.skills.filter((skill) => includesTerm(content, skill));
  const matchedLocations = profile.locations.filter((location) => includesTerm(content, location));
  const experience = extractExperienceRange(`${job.position}\n${job.description}`);
  const reasons: string[] = [];
  const cautions: string[] = [];
  const experienceMatches = experienceOverlaps(job, profile);

  if (matchedRoles.length > 0) reasons.push(`직무 · ${matchedRoles.slice(0, 2).join(", ")}`);
  if (matchedSkills.length > 0) reasons.push(`기술 · ${matchedSkills.slice(0, 4).join(", ")}`);
  if (matchedLocations.length > 0) reasons.push(`지역 · ${matchedLocations.slice(0, 2).join(", ")}`);
  if (experience) {
    const label = experience.maximum === null
      ? `${experience.minimum}년 이상`
      : `${experience.minimum}~${experience.maximum}년`;
    if (experienceMatches) reasons.push(`요구 경력 · ${label}`);
    else cautions.push(`경력 조건 차이 · 요구 ${label}`);
  }

  return {
    matchScore: Math.max(0, scoreJob(job, profile) - (experienceMatches ? 0 : 8)),
    matchReasons: reasons.length > 0 ? reasons : ["프로필 관련 키워드 포함"],
    matchCautions: cautions,
  };
}

export function personalizeJobs(jobs: ScrapedJob[], profile: SearchProfile): ScrapedJob[] {
  const positiveTerms = getProfileDiscoveryKeywords(profile);

  return jobs
    .filter((job) => {
      const content = `${job.company} ${job.position} ${job.tags.join(" ")} ${job.description}`;
      if (profile.exclude_keywords.some((keyword) => includesTerm(content, keyword))) return false;
      return positiveTerms.length === 0 || positiveTerms.some((term) => includesTerm(content, term));
    })
    .map((job, index) => {
      const metadata = matchMetadata(job, profile);
      return { job: { ...job, ...metadata }, index, score: metadata.matchScore };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ job }) => job);
}
