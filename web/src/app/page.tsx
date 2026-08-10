import Link from "next/link";

import { JobCard } from "@/components/job-card";
import { RepositoryStateNotice, SkippedDocumentsNotice } from "@/components/repository-state";
import { StatusBadge } from "@/components/status-badge";
import { formatKoreanDate, getDeadlineLabel, getUpcomingJobs } from "@/lib/jobs/format";
import { getJobListItems } from "@/lib/jobs/repository";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await getJobListItems();
  const applications = result.jobs.filter((job) => job.origin === "application");
  const discovered = result.jobs.filter((job) => job.origin === "discovered");
  const upcoming = getUpcomingJobs(applications);
  const activeStatuses = JOB_STATUSES.map((status) => ({
    status,
    count: applications.filter((job) => job.status === status).length,
  })).filter((item) => item.count > 0);

  return (
    <div className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">오늘의 지원 현황</p>
          <h1>흩어진 공고를 한눈에,<br />다음 할 일은 선명하게.</h1>
          <p className="hero__description">
            개인 지원 문서는 그대로 두고, 필요한 정보만 안전하게 모아봅니다.
          </p>
        </div>
        <Link className="button button--primary" href="/jobs">전체 채용공고 보기 <span>→</span></Link>
      </section>

      {result.state !== "ready" ? (
        <RepositoryStateNotice state={result.state} />
      ) : (
        <>
          <SkippedDocumentsNotice count={result.skippedCount} />
          <section className="summary-grid" aria-label="지원 요약">
            <article className="summary-card summary-card--total">
              <span>지원 관리</span>
              <strong>{applications.length}</strong>
              <p>현재 추적 중인 지원 공고</p>
            </article>
            <article className="summary-card summary-card--discovered">
              <span>새로 찾은 공고</span>
              <strong>{discovered.length}</strong>
              <p>프로필 조건으로 자동 수집</p>
            </article>
            {activeStatuses.slice(0, 2).map(({ status, count }) => (
              <article className="summary-card" key={status}>
                <StatusBadge status={status} />
                <strong>{count}</strong>
                <p>{STATUS_LABELS[status]} 상태</p>
              </article>
            ))}
          </section>

          {discovered.length > 0 && (
            <section className="section-block">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">새 공고함</p>
                  <h2>프로필과 잘 맞는 공고</h2>
                </div>
                <Link className="text-link" href="/jobs">새 공고 전체 보기 →</Link>
              </div>
              <div className="jobs-grid jobs-grid--preview">
                {discovered
                  .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
                  .slice(0, 3)
                  .map((job) => <JobCard job={job} key={job.slug} />)}
              </div>
            </section>
          )}

          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">다가오는 일정</p>
                <h2>가까운 마감일</h2>
              </div>
              <Link className="text-link" href="/jobs">전체 일정 보기 →</Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="soft-empty">
                <p>예정된 마감일이 없습니다.</p>
                <span>마감일이 없는 공고는 목록에서 계속 확인할 수 있어요.</span>
              </div>
            ) : (
              <div className="deadline-list">
                {upcoming.map((job) => {
                  const content = (
                    <>
                      <span className="deadline-row__date">
                        <strong>{getDeadlineLabel(job.deadline)}</strong>
                        <small>{job.deadline && formatKoreanDate(job.deadline)}</small>
                      </span>
                      <span className="deadline-row__job">
                        <small>{job.company}</small>
                        <strong>{job.position}</strong>
                      </span>
                      <StatusBadge status={job.status} />
                      <span aria-hidden="true">{job.sourceUrl ? "↗" : ""}</span>
                    </>
                  );

                  return job.sourceUrl ? (
                    <a
                      className="deadline-row"
                      href={job.sourceUrl}
                      key={job.slug}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="deadline-row deadline-row--static" key={job.slug}>{content}</div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
