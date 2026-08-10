import type { Metadata } from "next";

import { JobsBrowser } from "@/components/jobs-browser";
import { RepositoryStateNotice, SkippedDocumentsNotice } from "@/components/repository-state";
import { getJobListItems } from "@/lib/jobs/repository";

export const metadata: Metadata = { title: "채용공고" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const result = await getJobListItems();

  return (
    <div className="page-shell page-shell--compact">
      <div className="page-heading">
        <div>
          <p className="eyebrow">채용공고</p>
          <h1>지원할 곳을 빠르게 찾으세요.</h1>
          <p>회사, 포지션, 태그를 함께 검색하고 현재 상태별로 모아볼 수 있습니다. 공고 제목을 누르면 원문이 새 탭에서 열립니다.</p>
        </div>
        <span className="result-count">{result.jobs.length}개 공고</span>
      </div>

      {result.state !== "ready" ? (
        <RepositoryStateNotice state={result.state} />
      ) : (
        <>
          <SkippedDocumentsNotice count={result.skippedCount} />
          <JobsBrowser jobs={result.jobs} />
        </>
      )}
    </div>
  );
}
