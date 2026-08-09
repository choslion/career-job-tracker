import Link from "next/link";

import type { RepositoryState } from "@/lib/jobs/types";

const stateCopy: Record<Exclude<RepositoryState, "ready">, { title: string; description: string }> = {
  "not-configured": {
    title: "데이터 경로를 설정해 주세요",
    description: "CAREER_DATA_DIR에 지원 자료가 있는 디렉터리를 지정하면 공고를 불러옵니다.",
  },
  missing: {
    title: "지원 자료 폴더를 찾지 못했습니다",
    description: "설정한 디렉터리 아래에 applications 폴더가 있는지 확인해 주세요.",
  },
  empty: {
    title: "표시할 채용공고가 없습니다",
    description: "applications/<slug>/job-posting.md 구조로 문서를 추가하거나 가상 fixture를 연결해 보세요.",
  },
};

export function RepositoryStateNotice({ state }: { state: Exclude<RepositoryState, "ready"> }) {
  const copy = stateCopy[state];
  return (
    <section className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">↗</div>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      <Link className="button button--secondary" href="/jobs">채용공고 화면 보기</Link>
    </section>
  );
}

export function SkippedDocumentsNotice({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="inline-notice" role="status">
      안전하게 읽을 수 없는 문서 {count}개는 목록에서 제외했습니다.
    </p>
  );
}
