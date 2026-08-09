import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell page-shell--compact">
      <section className="empty-state">
        <div className="empty-state__icon" aria-hidden="true">?</div>
        <h1>공고를 찾을 수 없습니다</h1>
        <p>삭제되었거나 주소가 변경된 공고일 수 있습니다.</p>
        <Link className="button button--primary" href="/jobs">채용공고로 돌아가기</Link>
      </section>
    </div>
  );
}
