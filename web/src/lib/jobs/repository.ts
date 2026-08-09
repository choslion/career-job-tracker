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

  const seen = new Set<string>();
  const jobs = combinedJobs.filter((job) => {
    const semanticIdentity = [job.company, job.position, job.deadline ?? ""]
      .join("|")
      .normalize("NFKC")
      .toLocaleLowerCase("ko")
      .replace(/[^\p{Letter}\p{Number}|]+/gu, "");
    const identity = semanticIdentity || job.sourceUrl || `slug:${job.slug}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });

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

export async function getJob(slug: string) {
  const result = await getJobs();
  return { result, job: result.jobs.find((item) => item.slug === slug) ?? null };
}
