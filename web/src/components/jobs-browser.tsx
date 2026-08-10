"use client";

import { useMemo, useState } from "react";

import {
  filterAndSortJobs,
  matchesRole,
  type JobLocationFilter,
  type JobRoleFilter,
  type JobSort,
  type JobView,
} from "@/lib/jobs/query";
import { JOB_STATUSES, STATUS_LABELS, type JobListItem, type JobStatus } from "@/lib/jobs/types";

import { JobCard } from "./job-card";

const VIEW_ORIGIN = {
  discovered: "discovered",
  applications: "application",
  all: undefined,
} as const;

/** 사용자가 정렬을 직접 고르기 전까지는 공고함에 맞는 기본값을 쓴다. */
function defaultSort(view: JobView): JobSort {
  return view === "discovered" ? "match-desc" : "deadline-asc";
}

export function JobsBrowser({ jobs }: { jobs: JobListItem[] }) {
  const [view, setView] = useState<JobView>("discovered");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "">("");
  const [role, setRole] = useState<JobRoleFilter>("all");
  const [location, setLocation] = useState<JobLocationFilter>("preferred");
  const [limit, setLimit] = useState<20 | 50 | null>(null);
  const [chosenSort, setChosenSort] = useState<JobSort | null>(null);

  const sort = chosenSort ?? defaultSort(view);
  const origin = VIEW_ORIGIN[view];

  const counts = useMemo(
    () => ({
      discovered: jobs.filter((job) => job.origin === "discovered").length,
      applications: jobs.filter((job) => job.origin === "application").length,
      all: jobs.length,
    }),
    [jobs],
  );

  // 직무 탭 숫자는 직무를 제외한 나머지 조건이 적용된 목록에서 센다.
  const roleScope = useMemo(
    () => filterAndSortJobs(jobs, { query, status, sort, origin, location, role: "all" }),
    [jobs, query, status, sort, origin, location],
  );
  const visible = useMemo(() => roleScope.filter((job) => matchesRole(job, role)), [roleScope, role]);
  const displayed = limit === null ? visible : visible.slice(0, limit);

  const publishingCount = roleScope.filter((job) => matchesRole(job, "publishing")).length;
  const frontendCount = roleScope.filter((job) => matchesRole(job, "frontend")).length;
  const isFiltered = Boolean(query) || status !== "" || role !== "all" || location !== "preferred" || limit !== null;

  function selectView(next: JobView) {
    setView(next);
    setChosenSort(null);
  }

  function reset() {
    setQuery("");
    setStatus("");
    setRole("all");
    setLocation("preferred");
    setLimit(null);
    setChosenSort(null);
  }

  return (
    <>
      <nav className="view-tabs" aria-label="공고함 구분">
        {(["discovered", "applications", "all"] as const).map((value) => (
          <button
            aria-pressed={view === value}
            className={view === value ? "is-active" : ""}
            key={value}
            onClick={() => selectView(value)}
            type="button"
          >
            {value === "discovered" ? "새 공고" : value === "applications" ? "지원 관리" : "전체"}
            <span>{counts[value]}</span>
          </button>
        ))}
      </nav>

      <div className="job-shortcuts">
        <nav className="role-tabs" aria-label="직무 필터">
          {([
            ["all", "둘 다", roleScope.length],
            ["publishing", "퍼블리싱", publishingCount],
            ["frontend", "프론트엔드", frontendCount],
          ] as const).map(([value, label, count]) => (
            <button
              aria-pressed={role === value}
              className={role === value ? "is-active" : ""}
              key={value}
              onClick={() => setRole(value)}
              type="button"
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </nav>
        <button
          className={`top-jobs-link${limit === 20 && sort === "match-desc" ? " is-active" : ""}`}
          onClick={() => {
            setChosenSort("match-desc");
            setLimit(20);
          }}
          type="button"
        >
          ★ 추천 TOP 20
        </button>
      </div>

      <div className={`filter-panel${view !== "discovered" ? " filter-panel--with-status" : ""}`} role="search">
        <label className="search-field">
          <span className="sr-only">채용공고 검색</span>
          <span aria-hidden="true">⌕</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="회사, 포지션, 태그 검색"
            type="search"
            value={query}
          />
        </label>
        {view !== "discovered" && (
          <label>
            <span className="sr-only">지원 상태</span>
            <select onChange={(event) => setStatus(event.target.value as JobStatus | "")} value={status}>
              <option value="">모든 상태</option>
              {JOB_STATUSES.map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="sr-only">정렬</span>
          <select onChange={(event) => setChosenSort(event.target.value as JobSort)} value={sort}>
            <option value="match-desc">프로필 일치도 순</option>
            <option value="deadline-asc">마감일 빠른 순</option>
            <option value="updated-desc">최근 수정 순</option>
          </select>
        </label>
        <label>
          <span className="sr-only">근무 지역</span>
          <select
            onChange={(event) => setLocation(event.target.value as JobLocationFilter)}
            value={location}
          >
            <option value="preferred">서울·경기 우선</option>
            <option value="all">모든 지역</option>
          </select>
        </label>
        <label>
          <span className="sr-only">표시 개수</span>
          <select
            onChange={(event) => setLimit(event.target.value === "" ? null : (Number(event.target.value) as 20 | 50))}
            value={limit?.toString() ?? ""}
          >
            <option value="">전체 보기</option>
            <option value="20">TOP 20</option>
            <option value="50">TOP 50</option>
          </select>
        </label>
      </div>

      <div className="results-heading">
        <p aria-live="polite">
          <strong>{displayed.length}</strong>개 표시
          {displayed.length !== visible.length && <span> / 조건 일치 {visible.length}개</span>}
        </p>
        {isFiltered && (
          <button className="text-link" onClick={reset} type="button">조건 초기화</button>
        )}
      </div>

      {displayed.length === 0 ? (
        <section className="soft-empty soft-empty--large">
          <p>검색 조건에 맞는 공고가 없습니다.</p>
          <span>검색어를 줄이거나 상태 필터를 바꿔 보세요.</span>
        </section>
      ) : (
        <div className="jobs-grid">
          {displayed.map((job) => <JobCard job={job} key={job.slug} />)}
        </div>
      )}
    </>
  );
}
