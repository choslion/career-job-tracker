import { JOB_STATUSES, type Job, type JobOrigin, type JobStatus } from "./types";

export const SORT_OPTIONS = ["deadline-asc", "updated-desc"] as const;
export type JobSort = (typeof SORT_OPTIONS)[number];

export interface JobQuery {
  query?: string;
  status?: string;
  sort?: string;
  origin?: JobOrigin;
}

export function normalizeStatusFilter(status: string | undefined): JobStatus | null {
  return status && (JOB_STATUSES as readonly string[]).includes(status)
    ? (status as JobStatus)
    : null;
}

export function normalizeSort(sort: string | undefined): JobSort {
  return sort === "updated-desc" ? "updated-desc" : "deadline-asc";
}

export function filterAndSortJobs(jobs: Job[], input: JobQuery): Job[] {
  const query = input.query?.trim().toLocaleLowerCase("ko") ?? "";
  const status = normalizeStatusFilter(input.status);
  const sort = normalizeSort(input.sort);

  return jobs
    .filter((job) => {
      if (input.origin && job.origin !== input.origin) return false;
      if (status && job.status !== status) return false;
      if (!query) return true;

      return [job.company, job.position, ...job.tags]
        .join(" ")
        .toLocaleLowerCase("ko")
        .includes(query);
    })
    .sort((a, b) => {
      if (sort === "updated-desc") {
        return b.updatedAt.localeCompare(a.updatedAt) || a.company.localeCompare(b.company, "ko");
      }

      if (a.deadline === null && b.deadline === null) {
        return a.company.localeCompare(b.company, "ko");
      }
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline.localeCompare(b.deadline) || a.company.localeCompare(b.company, "ko");
    });
}
