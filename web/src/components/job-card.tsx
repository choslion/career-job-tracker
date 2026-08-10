import { formatKoreanDate, getDeadlineLabel } from "@/lib/jobs/format";
import { RELATED_DOCUMENTS, type JobListItem } from "@/lib/jobs/types";

import { StatusBadge } from "./status-badge";

const RELATED_DOCUMENT_ENTRIES = Object.entries(RELATED_DOCUMENTS) as [
  keyof typeof RELATED_DOCUMENTS,
  (typeof RELATED_DOCUMENTS)[keyof typeof RELATED_DOCUMENTS],
][];

export function JobCard({ job }: { job: JobListItem }) {
  const preparedDocuments = RELATED_DOCUMENT_ENTRIES.filter(([key]) => job.relatedDocuments[key]);

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
        <h2>
          {job.sourceUrl ? (
            <a href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
              {job.position}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only">(원문 채용공고, 새 탭에서 열림)</span>
            </a>
          ) : (
            job.position
          )}
        </h2>
      </div>
      {(job.location || job.sourceName) && (
        <p className="job-card__facts">
          {[job.location, job.sourceName].filter(Boolean).join(" · ")}
        </p>
      )}
      {job.tags.length > 0 && (
        <ul className="tag-list" aria-label="태그">
          {job.tags.slice(0, 8).map((tag) => <li key={tag}>{tag}</li>)}
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
      {preparedDocuments.length > 0 && (
        <ul className="document-chips" aria-label="준비된 관련 문서">
          {preparedDocuments.map(([key, definition]) => (
            <li key={key}><span aria-hidden="true">✓</span> {definition.label}</li>
          ))}
        </ul>
      )}
      <div className="job-card__footer">
        <span>
          {job.deadline ? `${formatKoreanDate(job.deadline)} 마감` : "마감일이 정해지지 않았어요"}
        </span>
        {job.sourceUrl && (
          <a className="source-link" href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
            원문에서 상세 보기 ↗
          </a>
        )}
      </div>
    </article>
  );
}
