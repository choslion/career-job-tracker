import type { ClassifiedJobLocation } from "./classify";
import { normalizeForMatch } from "./classify";
import { JOB_STATUSES, type JobListItem, type JobOrigin, type JobStatus } from "./types";

export const SORT_OPTIONS = ["match-desc", "deadline-asc", "updated-desc"] as const;
export type JobSort = (typeof SORT_OPTIONS)[number];
export const ROLE_FILTERS = ["all", "publishing", "frontend"] as const;
export type JobRoleFilter = (typeof ROLE_FILTERS)[number];
export const LOCATION_FILTERS = ["preferred", "all"] as const;
export type JobLocationFilter = (typeof LOCATION_FILTERS)[number];

export const VIEW_FILTERS = ["discovered", "applications", "all"] as const;
export type JobView = (typeof VIEW_FILTERS)[number];

export interface JobQuery {
  query?: string;
  status?: string;
  sort?: string;
  origin?: JobOrigin;
  role?: string;
  location?: string;
}

const LOCATION_ORDER: Record<ClassifiedJobLocation, number> = {
  preferred: 0,
  unknown: 1,
  outside: 2,
};

export function normalizeStatusFilter(status: string | undefined): JobStatus | null {
  return status && (JOB_STATUSES as readonly string[]).includes(status)
    ? (status as JobStatus)
    : null;
}

export function normalizeSort(sort: string | undefined): JobSort {
  return sort && (SORT_OPTIONS as readonly string[]).includes(sort)
    ? (sort as JobSort)
    : "match-desc";
}

export function normalizeRoleFilter(role: string | undefined): JobRoleFilter {
  return role && (ROLE_FILTERS as readonly string[]).includes(role)
    ? (role as JobRoleFilter)
    : "all";
}

export function normalizeLocationFilter(location: string | undefined): JobLocationFilter {
  return location === "all" ? "all" : "preferred";
}

export function normalizeView(view: string | undefined): JobView {
  return view && (VIEW_FILTERS as readonly string[]).includes(view)
    ? (view as JobView)
    : "discovered";
}

export function matchesRole(job: JobListItem, role: JobRoleFilter): boolean {
  if (role === "all") return true;
  return job.role === role || job.role === "hybrid";
}

export function filterAndSortJobs(jobs: JobListItem[], input: JobQuery): JobListItem[] {
  const query = normalizeForMatch(input.query?.trim() ?? "");
  const status = normalizeStatusFilter(input.status);
  const sort = normalizeSort(input.sort);
  const role = normalizeRoleFilter(input.role);
  const location = normalizeLocationFilter(input.location);

  return jobs
    .filter((job) => {
      if (input.origin && job.origin !== input.origin) return false;
      if (status && job.status !== status) return false;
      if (!matchesRole(job, role)) return false;
      if (!query) return true;

      return normalizeForMatch([job.company, job.position, ...job.tags].join(" ")).includes(query);
    })
    .sort((a, b) => {
      if (location === "preferred") {
        const difference = LOCATION_ORDER[a.locationClass] - LOCATION_ORDER[b.locationClass];
        if (difference !== 0) return difference;
      }

      if (sort === "match-desc") {
        return (b.matchScore ?? -1) - (a.matchScore ?? -1)
          || (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31")
          || a.company.localeCompare(b.company, "ko");
      }
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
