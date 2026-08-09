import Link from "next/link";

import { formatKoreanDate, getDeadlineLabel } from "@/lib/jobs/format";
import type { Job } from "@/lib/jobs/types";

import { StatusBadge } from "./status-badge";

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="job-card">
      <div className="job-card__top">
        {job.origin === "discovered" ? (
          <span className="origin-badge"><span aria-hidden="true">✦</span> 새 공고</span>
        ) : (
          <StatusBadge status={job.status} />
        )}
        <span className={`deadline-chip${job.deadline ? "" : " deadline-chip--unset"}`}>
          {getDeadlineLabel(job.deadline)}
        </span>
      </div>
      <div>
        <p className="job-card__company">{job.company}</p>
        <h2><Link href={`/jobs/${job.slug}`}>{job.position}</Link></h2>
      </div>
      {job.tags.length > 0 && (
        <ul className="tag-list" aria-label="태그">
          {job.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      )}
      {job.origin === "discovered" && job.matchReasons.length > 0 && (
        <div className="match-summary">
          <strong>
            {job.matchScore !== null && job.matchScore >= 20
              ? "높은 일치"
              : job.matchScore !== null && job.matchScore >= 8
                ? "조건 일치"
                : "관련 공고"}
          </strong>
          <ul>
            {job.matchReasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
            {job.matchCautions.slice(0, 1).map((caution) => (
              <li className="is-caution" key={caution}>{caution}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="job-card__footer">
        <span>
          {job.deadline ? `${formatKoreanDate(job.deadline)} 마감` : "마감일이 정해지지 않았어요"}
        </span>
        <div className="job-card__actions">
          <Link className="text-link" href={`/jobs/${job.slug}`}>상세 보기</Link>
          {job.sourceUrl && (
            <a className="source-link" href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
              원문 바로가기 ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
