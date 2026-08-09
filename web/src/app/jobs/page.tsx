import type { Metadata } from "next";
import Link from "next/link";

import { JobCard } from "@/components/job-card";
import { RepositoryStateNotice, SkippedDocumentsNotice } from "@/components/repository-state";
import {
  filterAndSortJobs,
  normalizeLocationFilter,
  normalizeRoleFilter,
  normalizeSort,
  normalizeStatusFilter,
} from "@/lib/jobs/query";
import { getJobs } from "@/lib/jobs/repository";
import { JOB_STATUSES, STATUS_LABELS, type JobOrigin } from "@/lib/jobs/types";

export const metadata: Metadata = { title: "채용공고" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function jobsHref(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return `/jobs?${params.toString()}`;
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const [result, params] = await Promise.all([getJobs(), searchParams]);
  const query = singleValue(params.q) ?? "";
  const status = normalizeStatusFilter(singleValue(params.status));
  const requestedView = singleValue(params.view);
  const view = requestedView === "applications" || requestedView === "all" ? requestedView : "discovered";
  const sort = normalizeSort(singleValue(params.sort) ?? (view === "discovered" ? "match-desc" : "deadline-asc"));
  const role = normalizeRoleFilter(singleValue(params.role));
  const location = normalizeLocationFilter(singleValue(params.location));
  const requestedLimit = singleValue(params.limit);
  const limit = requestedLimit === "20" || requestedLimit === "50" ? Number(requestedLimit) : null;
  const origin: JobOrigin | undefined = view === "discovered"
    ? "discovered"
    : view === "applications"
      ? "application"
      : undefined;
  const baseQuery = { query, status: status ?? undefined, sort, origin, location };
  const roleScope = filterAndSortJobs(result.jobs, { ...baseQuery, role: "all" });
  const jobs = filterAndSortJobs(result.jobs, { ...baseQuery, role });
  const displayedJobs = limit === null ? jobs : jobs.slice(0, limit);
  const publishingCount = filterAndSortJobs(roleScope, { role: "publishing" }).length;
  const frontendCount = filterAndSortJobs(roleScope, { role: "frontend" }).length;
  const discoveredCount = result.jobs.filter((job) => job.origin === "discovered").length;
  const applicationCount = result.jobs.filter((job) => job.origin === "application").length;

  return (
    <div className="page-shell page-shell--compact">
      <div className="page-heading">
        <div>
          <p className="eyebrow">채용공고</p>
          <h1>지원할 곳을 빠르게 찾으세요.</h1>
          <p>회사, 포지션, 태그를 함께 검색하고 현재 상태별로 모아볼 수 있습니다.</p>
        </div>
        <span className="result-count">{view === "discovered" ? discoveredCount : view === "applications" ? applicationCount : result.jobs.length}개 공고</span>
      </div>

      {result.state !== "ready" ? (
        <RepositoryStateNotice state={result.state} />
      ) : (
        <>
          <SkippedDocumentsNotice count={result.skippedCount} />
          <nav className="view-tabs" aria-label="공고함 구분">
            <Link className={view === "discovered" ? "is-active" : ""} href="/jobs?view=discovered">
              새 공고 <span>{discoveredCount}</span>
            </Link>
            <Link className={view === "applications" ? "is-active" : ""} href="/jobs?view=applications">
              지원 관리 <span>{applicationCount}</span>
            </Link>
            <Link className={view === "all" ? "is-active" : ""} href="/jobs?view=all">
              전체 <span>{result.jobs.length}</span>
            </Link>
          </nav>
          <div className="job-shortcuts">
            <nav className="role-tabs" aria-label="직무 필터">
              <Link className={role === "all" ? "is-active" : ""} href={jobsHref({ view, q: query, status: status ?? undefined, sort, limit: requestedLimit, role: "all", location })}>
                둘 다 <span>{roleScope.length}</span>
              </Link>
              <Link className={role === "publishing" ? "is-active" : ""} href={jobsHref({ view, q: query, status: status ?? undefined, sort, limit: requestedLimit, role: "publishing", location })}>
                퍼블리싱 <span>{publishingCount}</span>
              </Link>
              <Link className={role === "frontend" ? "is-active" : ""} href={jobsHref({ view, q: query, status: status ?? undefined, sort, limit: requestedLimit, role: "frontend", location })}>
                프론트엔드 <span>{frontendCount}</span>
              </Link>
            </nav>
            <Link
              className={`top-jobs-link${limit === 20 && sort === "match-desc" ? " is-active" : ""}`}
              href={jobsHref({ view, q: query, status: status ?? undefined, role, location, sort: "match-desc", limit: "20" })}
            >
              ★ 추천 TOP 20
            </Link>
          </div>
          <form className={`filter-panel${view !== "discovered" ? " filter-panel--with-status" : ""}`} method="get" role="search">
            <input name="view" type="hidden" value={view} />
            <input name="role" type="hidden" value={role} />
            <label className="search-field">
              <span className="sr-only">채용공고 검색</span>
              <span aria-hidden="true">⌕</span>
              <input defaultValue={query} name="q" placeholder="회사, 포지션, 태그 검색" type="search" />
            </label>
            {view !== "discovered" && (
              <label>
                <span className="sr-only">지원 상태</span>
                <select defaultValue={status ?? ""} name="status">
                  <option value="">모든 상태</option>
                  {JOB_STATUSES.map((value) => (
                    <option key={value} value={value}>{STATUS_LABELS[value]}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="sr-only">정렬</span>
              <select defaultValue={sort} name="sort">
                <option value="match-desc">프로필 일치도 순</option>
                <option value="deadline-asc">마감일 빠른 순</option>
                <option value="updated-desc">최근 수정 순</option>
              </select>
            </label>
            <label>
              <span className="sr-only">근무 지역</span>
              <select defaultValue={location} name="location">
                <option value="preferred">서울·경기 우선</option>
                <option value="all">모든 지역</option>
              </select>
            </label>
            <label>
              <span className="sr-only">표시 개수</span>
              <select defaultValue={limit?.toString() ?? ""} name="limit">
                <option value="">전체 보기</option>
                <option value="20">TOP 20</option>
                <option value="50">TOP 50</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">적용</button>
          </form>

          <div className="results-heading">
            <p>
              <strong>{displayedJobs.length}</strong>개 표시
              {displayedJobs.length !== jobs.length && <span> / 조건 일치 {jobs.length}개</span>}
            </p>
            {(query || status || role !== "all" || location !== "preferred" || limit !== null) && <Link className="text-link" href={`/jobs?view=${view}`}>조건 초기화</Link>}
          </div>

          {displayedJobs.length === 0 ? (
            <section className="soft-empty soft-empty--large">
              <p>검색 조건에 맞는 공고가 없습니다.</p>
              <span>검색어를 줄이거나 상태 필터를 바꿔 보세요.</span>
            </section>
          ) : (
            <div className="jobs-grid">
              {displayedJobs.map((job) => <JobCard job={job} key={job.slug} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
