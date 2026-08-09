import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownContent } from "@/components/markdown-content";
import { StatusBadge } from "@/components/status-badge";
import { formatKoreanDate, getDeadlineLabel } from "@/lib/jobs/format";
import { getJob } from "@/lib/jobs/repository";
import { RELATED_DOCUMENTS } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { job } = await getJob(slug);
  return { title: job ? `${job.company} ${job.position}` : "공고를 찾을 수 없음" };
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { job } = await getJob(slug);
  if (!job) notFound();

  return (
    <div className="page-shell page-shell--detail">
      <Link className="back-link" href="/jobs">← 채용공고 목록</Link>
      <section className="detail-hero">
        <div className="detail-hero__main">
          <div className="detail-hero__badges">
            {job.origin === "discovered" ? (
              <span className="origin-badge"><span aria-hidden="true">✦</span> 새 공고</span>
            ) : (
              <StatusBadge status={job.status} />
            )}
            <span className={`deadline-chip${job.deadline ? "" : " deadline-chip--unset"}`}>
              {getDeadlineLabel(job.deadline)}
            </span>
          </div>
          <p className="eyebrow">{job.company}</p>
          <h1>{job.position}</h1>
          {job.tags.length > 0 && (
            <ul className="tag-list">
              {job.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          )}
        </div>
        <dl className="detail-meta">
          <div>
            <dt>마감일</dt>
            <dd>{job.deadline ? formatKoreanDate(job.deadline) : "미정"}</dd>
          </div>
          <div>
            <dt>최근 수정</dt>
            <dd>{formatKoreanDate(job.updatedAt)}</dd>
          </div>
          {job.sourceUrl && (
            <div>
              <dt>원문</dt>
              <dd><a href={job.sourceUrl} rel="noopener noreferrer" target="_blank">공고 페이지 열기 ↗</a></dd>
            </div>
          )}
          {job.sourceName && (
            <div>
              <dt>수집 출처</dt>
              <dd>{job.sourceName}</dd>
            </div>
          )}
        </dl>
      </section>

      {job.origin === "discovered" && job.matchReasons.length > 0 && (
        <aside className="match-detail" aria-label="프로필 일치 이유">
          <div>
            <p className="eyebrow">프로필 분석</p>
            <strong>
              {job.matchScore !== null && job.matchScore >= 20
                ? "높은 일치"
                : job.matchScore !== null && job.matchScore >= 8
                  ? "조건 일치"
                  : "관련 공고"}
            </strong>
          </div>
          <ul>
            {job.matchReasons.map((reason) => <li key={reason}>{reason}</li>)}
            {job.matchCautions.map((caution) => (
              <li className="is-caution" key={caution}>{caution}</li>
            ))}
          </ul>
        </aside>
      )}

      {job.warnings.length > 0 && (
        <aside className="warning-box" role="status">
          <strong>일부 정보에 기본값을 사용했습니다</strong>
          <ul>{job.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </aside>
      )}

      <div className="detail-layout">
        <article className="content-card">
          <div className="content-card__heading">
            <p className="eyebrow">공고 내용</p>
            <h2>채용공고 상세</h2>
          </div>
          <MarkdownContent source={job.body} />
        </article>

        <aside className="documents-card">
          <p className="eyebrow">준비 자료</p>
          <h2>관련 문서</h2>
          <p>문서 내용은 노출하지 않고 존재 여부만 확인합니다.</p>
          <ul>
            {Object.entries(RELATED_DOCUMENTS).map(([key, definition]) => {
              const exists = job.relatedDocuments[key as keyof typeof RELATED_DOCUMENTS];
              return (
                <li key={key} className={exists ? "document-present" : "document-missing"}>
                  <span aria-hidden="true">{exists ? "✓" : "–"}</span>
                  <span>{definition.label}<small>{exists ? "준비됨" : "없음"}</small></span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
