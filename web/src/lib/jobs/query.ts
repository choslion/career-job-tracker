import { JOB_STATUSES, type Job, type JobOrigin, type JobStatus } from "./types";

export const SORT_OPTIONS = ["match-desc", "deadline-asc", "updated-desc"] as const;
export type JobSort = (typeof SORT_OPTIONS)[number];
export const ROLE_FILTERS = ["all", "publishing", "frontend"] as const;
export type JobRoleFilter = (typeof ROLE_FILTERS)[number];
export type ClassifiedJobRole = "publishing" | "frontend" | "hybrid" | "other";
export const LOCATION_FILTERS = ["preferred", "all"] as const;
export type JobLocationFilter = (typeof LOCATION_FILTERS)[number];
export type ClassifiedJobLocation = "preferred" | "outside" | "unknown";

export interface JobQuery {
  query?: string;
  status?: string;
  sort?: string;
  origin?: JobOrigin;
  role?: string;
  location?: string;
}

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

export function classifyJobRole(job: Job): ClassifiedJobRole {
  const title = job.position.normalize("NFKC").toLocaleLowerCase("ko");
  const context = `${title} ${job.tags.join(" ")}`.toLocaleLowerCase("ko");
  const publishing = /퍼블리|마크업|web\s*publish|publisher/.test(title);
  const frontend = /프론트|프런트|front[\s_-]*end|frontend|\bfe\s*(?:개발|developer|engineer)|웹\s*(?:개발|엔지니어)|ui\s*개발/.test(title)
    || (/(개발자|developer|engineer)/.test(title) && /react|vue|nuxt|next\.?js|typescript/.test(context));
  if (publishing && frontend) return "hybrid";
  if (publishing) return "publishing";
  if (frontend) return "frontend";
  return "other";
}

export function classifyJobLocation(job: Job): ClassifiedJobLocation {
  const content = `${job.position} ${job.tags.join(" ")} ${job.body}`
    .normalize("NFKC")
    .toLocaleLowerCase("ko");
  if (/서울|경기|seoul|gyeonggi|재택|원격|remote/.test(content)) return "preferred";
  if (/인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주|incheon|busan|daegu|daejeon/.test(content)) {
    return "outside";
  }
  return "unknown";
}

export function filterAndSortJobs(jobs: Job[], input: JobQuery): Job[] {
  const query = input.query?.trim().toLocaleLowerCase("ko") ?? "";
  const status = normalizeStatusFilter(input.status);
  const sort = normalizeSort(input.sort);
  const role = normalizeRoleFilter(input.role);
  const location = normalizeLocationFilter(input.location);

  return jobs
    .filter((job) => {
      if (input.origin && job.origin !== input.origin) return false;
      if (status && job.status !== status) return false;
      const classifiedRole = classifyJobRole(job);
      if (role === "publishing" && !["publishing", "hybrid"].includes(classifiedRole)) return false;
      if (role === "frontend" && !["frontend", "hybrid"].includes(classifiedRole)) return false;
      if (!query) return true;

      return [job.company, job.position, ...job.tags]
        .join(" ")
        .toLocaleLowerCase("ko")
        .includes(query);
    })
    .sort((a, b) => {
      if (location === "preferred") {
        const locationOrder: Record<ClassifiedJobLocation, number> = {
          preferred: 0,
          unknown: 1,
          outside: 2,
        };
        const locationDifference = locationOrder[classifyJobLocation(a)] - locationOrder[classifyJobLocation(b)];
        if (locationDifference !== 0) return locationDifference;
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
