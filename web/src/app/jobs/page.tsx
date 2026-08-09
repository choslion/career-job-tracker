import type { Metadata } from "next";
import Link from "next/link";

import { JobCard } from "@/components/job-card";
import { RepositoryStateNotice, SkippedDocumentsNotice } from "@/components/repository-state";
import { filterAndSortJobs, normalizeSort, normalizeStatusFilter } from "@/lib/jobs/query";
import { getJobs } from "@/lib/jobs/repository";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/jobs/types";

export const metadata: Metadata = { title: "채용공고" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const [result, params] = await Promise.all([getJobs(), searchParams]);
  const query = singleValue(params.q) ?? "";
  const status = normalizeStatusFilter(singleValue(params.status));
  const sort = normalizeSort(singleValue(params.sort));
  const requestedView = singleValue(params.view);
  const view = requestedView === "applications" || requestedView === "all" ? requestedView : "discovered";
  const origin = view === "discovered" ? "discovered" : view === "applications" ? "application" : undefined;
  const jobs = filterAndSortJobs(result.jobs, { query, status: status ?? undefined, sort, origin });
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
          <form className="filter-panel" method="get" role="search">
            <input name="view" type="hidden" value={view} />
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
                <option value="deadline-asc">마감일 빠른 순</option>
                <option value="updated-desc">최근 수정 순</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">적용</button>
          </form>

          <div className="results-heading">
            <p><strong>{jobs.length}</strong>개의 결과</p>
            {(query || status) && <Link className="text-link" href={`/jobs?view=${view}`}>조건 초기화</Link>}
          </div>

          {jobs.length === 0 ? (
            <section className="soft-empty soft-empty--large">
              <p>검색 조건에 맞는 공고가 없습니다.</p>
              <span>검색어를 줄이거나 상태 필터를 바꿔 보세요.</span>
            </section>
          ) : (
            <div className="jobs-grid">
              {jobs.map((job) => <JobCard job={job} key={job.slug} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
