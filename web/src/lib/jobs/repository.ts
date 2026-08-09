import "server-only";

import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parseJobDocument } from "./parser";
import {
  RELATED_DOCUMENTS,
  type Job,
  type JobsResult,
  type RelatedDocuments,
} from "./types";

const JOB_POSTING_FILE = "job-posting.md";

function normalizeCompany(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/주식회사|유한회사|\(?주\)?|㈜|\(유\)|\(재\)/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function normalizePosition(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/\[[^\]]*(?:채용|모집|경력|신입)[^\]]*]/g, " ")
    .replace(/\([^)]*(?:채용|모집|경력|신입)[^)]*\)/g, " ")
    .replace(/(?:상시|수시|긴급)?\s*(?:채용|모집)(?:중)?/g, " ")
    .replace(/프런트/g, "프론트")
    .replace(/front[\s_-]*end/g, "frontend")
    .replace(/웹\s*퍼블리셔/g, "퍼블리셔")
    .replace(/[^\p{Letter}\p{Number}+#]+/gu, "");
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

function titleSimilarity(left: string, right: string): number {
  const a = normalizePosition(left);
  const b = normalizePosition(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 9 && (a.includes(b) || b.includes(a))) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  const rightCounts = new Map<string, number>();
  for (const gram of bigrams(b)) rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  let overlap = 0;
  const leftBigrams = bigrams(a);
  for (const gram of leftBigrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count === 0) continue;
    overlap += 1;
    rightCounts.set(gram, count - 1);
  }
  return (2 * overlap) / (leftBigrams.length + bigrams(b).length);
}

function sourcePriority(job: Job): number {
  if (job.origin === "application") return 0;
  const source = job.sourceName ?? "";
  if (source.startsWith("자사채용")) return 1;
  if (source.includes("원티드")) return 2;
  if (source.includes("점핏")) return 3;
  if (source.includes("사람인")) return 4;
  if (source.includes("잡코리아")) return 5;
  return 6;
}

export function dedupeJobs(input: Job[]): Job[] {
  const jobs: Job[] = [];
  for (const candidate of input) {
    const company = normalizeCompany(candidate.company);
    const existingIndex = jobs.findIndex((job) =>
      normalizeCompany(job.company) === company && titleSimilarity(job.position, candidate.position) >= 0.9,
    );
    if (existingIndex === -1) {
      jobs.push(candidate);
      continue;
    }
    if (sourcePriority(candidate) < sourcePriority(jobs[existingIndex]!)) {
      jobs[existingIndex] = candidate;
    }
  }
  return jobs;
}

export async function detectRelatedDocuments(directory: string): Promise<RelatedDocuments> {
  const entries = await Promise.all(
    Object.entries(RELATED_DOCUMENTS).map(async ([key, definition]) => {
      try {
        const stats = await lstat(path.join(directory, definition.fileName));
        return [key, stats.isFile() && !stats.isSymbolicLink()] as const;
      } catch {
        return [key, false] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as RelatedDocuments;
}

export async function getJobs(): Promise<JobsResult> {
  const configuredRoot = process.env.CAREER_DATA_DIR?.trim();
  const scrapedRoot = process.env.SCRAPED_DATA_DIR?.trim() || path.resolve(process.cwd(), ".scraped-data");
  const roots = [...new Set([configuredRoot, scrapedRoot].filter((value): value is string => Boolean(value)))];
  const combinedJobs: Job[] = [];
  let skippedCount = 0;
  let availableRootCount = 0;

  for (const root of roots) {
    const scanned = await scanRoot(root);
    if (scanned.available) availableRootCount += 1;
    skippedCount += scanned.skippedCount;
    combinedJobs.push(...scanned.jobs);
  }

  const jobs = dedupeJobs(combinedJobs);

  jobs.sort((a, b) => a.company.localeCompare(b.company, "ko"));
  if (jobs.length > 0) return { state: "ready", jobs, skippedCount };
  if (availableRootCount > 0) return { state: "empty", jobs: [], skippedCount };
  return {
    state: configuredRoot ? "missing" : "not-configured",
    jobs: [],
    skippedCount,
  };
}

async function scanRoot(root: string): Promise<{ available: boolean; jobs: Job[]; skippedCount: number }> {
  const applicationsDirectory = path.resolve(root, "applications");
  let activeSlugs: Set<string> | null = null;
  let directories;

  try {
    try {
      const state = JSON.parse(await readFile(path.resolve(root, ".scrape-state.json"), "utf8")) as {
        activeSlugs?: unknown;
      };
      if (Array.isArray(state.activeSlugs)) {
        activeSlugs = new Set(state.activeSlugs.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      // 일반 CAREER_DATA_DIR에는 수집 매니페스트가 없어도 된다.
    }
    directories = await readdir(applicationsDirectory, { withFileTypes: true });
  } catch {
    return { available: false, jobs: [], skippedCount: 0 };
  }

  const jobDirectories = directories.filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.isSymbolicLink() &&
      !entry.name.startsWith(".") &&
      (activeSlugs === null || activeSlugs.has(entry.name)),
  );
  const jobs: Job[] = [];
  let skippedCount = 0;

  for (const entry of jobDirectories) {
    const directory = path.join(applicationsDirectory, entry.name);
    const postingPath = path.join(directory, JOB_POSTING_FILE);

    try {
      const stats = await lstat(postingPath);
      if (!stats.isFile() || stats.isSymbolicLink()) continue;

      const [source, relatedDocuments] = await Promise.all([
        readFile(postingPath, "utf8"),
        detectRelatedDocuments(directory),
      ]);

      jobs.push(
        parseJobDocument({
          slug: entry.name,
          source,
          modifiedAt: stats.mtime,
          relatedDocuments,
        }),
      );
    } catch {
      skippedCount += 1;
    }
  }

  return {
    available: true,
    jobs,
    skippedCount,
  };
}

export function decodeJobSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    // 잘못된 퍼센트 인코딩은 원문 그대로 조회해 안전하게 not-found 처리한다.
    return slug;
  }
}

export async function getJob(slug: string) {
  const result = await getJobs();
  return { result, job: result.jobs.find((item) => item.slug === decodeJobSlug(slug)) ?? null };
}
