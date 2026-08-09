import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="커리어 트래커 홈">
          <span className="brand__mark" aria-hidden="true">CT</span>
          <span>
            <strong>Career Tracker</strong>
            <small>나만의 지원 현황판</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="주요 메뉴">
          <Link href="/">대시보드</Link>
          <Link href="/jobs">채용공고</Link>
        </nav>
      </div>
    </header>
  );
}
