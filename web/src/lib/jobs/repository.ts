import "server-only";

import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parseJobDocument } from "./parser";
import {
  RELATED_DOCUMENTS,
  toJobListItem,
  type Job,
  type JobListResult,
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

/** 이미 정규화된 직무명끼리 비교한다. 정규화 비용은 호출부에서 한 번만 치른다. */
function normalizedTitleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 9 && (a.includes(b) || b.includes(a))) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  const rightBigrams = bigrams(b);
  const rightCounts = new Map<string, number>();
  for (const gram of rightBigrams) rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  let overlap = 0;
  const leftBigrams = bigrams(a);
  for (const gram of leftBigrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count === 0) continue;
    overlap += 1;
    rightCounts.set(gram, count - 1);
  }
  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
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

interface DedupeEntry {
  job: Job;
  position: string;
  priority: number;
}

export function dedupeJobs(input: Job[]): Job[] {
  const entries: DedupeEntry[] = [];
  // 정규화한 회사명으로 후보를 묶어, 비교를 같은 회사 안에서만 한다.
  const indexesByCompany = new Map<string, number[]>();

  for (const candidate of input) {
    const company = normalizeCompany(candidate.company);
    const position = normalizePosition(candidate.position);
    const priority = sourcePriority(candidate);
    const bucket = indexesByCompany.get(company);
    const existingIndex = bucket?.find(
      (index) => normalizedTitleSimilarity(entries[index]!.position, position) >= 0.9,
    );

    if (existingIndex === undefined) {
      entries.push({ job: candidate, position, priority });
      if (bucket) bucket.push(entries.length - 1);
      else indexesByCompany.set(company, [entries.length - 1]);
      continue;
    }

    if (priority < entries[existingIndex]!.priority) {
      entries[existingIndex] = { job: candidate, position, priority };
    }
  }

  return entries.map((entry) => entry.job);
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

/**
 * 화면이 사용하는 유일한 진입점. 공고 본문을 떼어낸 목록만 반환해
 * 서버 렌더링과 클라이언트 전송에서 본문을 다루지 않는다.
 */
export async function getJobListItems(): Promise<JobListResult> {
  const result = await getJobs();
  return {
    state: result.state,
    jobs: result.jobs.map(toJobListItem),
    skippedCount: result.skippedCount,
  };
}
