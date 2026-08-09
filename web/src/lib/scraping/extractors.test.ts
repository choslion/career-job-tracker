import { describe, expect, it } from "vitest";

import {
  extractJsonLdJobs,
  extractListingLinks,
  extractSaraminJob,
  extractWantedJob,
  extractWantedListIds,
  normalizeDeadline,
} from "./extractors";

describe("공개 채용공고 추출", () => {
  it("JobPosting JSON-LD만 읽는다", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Frontend Developer",
      description: "<p>React 제품을 개발합니다.</p><ul><li>TypeScript</li></ul>",
      validThrough: "2026-08-31T23:59:00+09:00",
      hiringOrganization: { "@type": "Organization", name: "Example" },
      identifier: { value: "123" },
      url: "https://careers.example.com/jobs/123",
    })}</script></head></html>`;

    expect(extractJsonLdJobs(html, "https://careers.example.com/jobs/123", "회사 채용")).toEqual([
      expect.objectContaining({
        company: "Example",
        position: "Frontend Developer",
        deadline: "2026-08-31",
        externalId: "123",
      }),
    ]);
  });

  it("목록에서 키워드와 상세 경로가 모두 맞는 링크만 고른다", () => {
    const html = `<a href="/Recruit/GI_Read/1">프론트엔드 개발자</a>
      <a href="/Recruit/GI_Read/2">영업 담당자</a>
      <a href="/login">Frontend 로그인</a>`;
    expect(extractListingLinks(
      html,
      "https://www.jobkorea.co.kr/recruit/joblist",
      /\/Recruit\/GI_Read\//,
      ["프론트엔드"],
      5,
    )).toEqual(["https://www.jobkorea.co.kr/Recruit/GI_Read/1"]);
  });

  it("원티드 목록과 상세 공개 응답을 변환한다", () => {
    const listPayload = {
      data: [
        { id: 10, position: "Frontend Developer", company: { name: "Example" } },
        { id: 11, position: "Sales", company: { name: "Example" } },
      ],
    };
    expect(extractWantedListIds(listPayload, ["frontend"], 5)).toEqual(["10"]);

    const job = extractWantedJob({
      job: {
        id: 10,
        position: "Frontend Developer",
        due_time: null,
        company: { name: "Example" },
        detail: { intro: "제품 소개", main_tasks: "React 개발", requirements: "TypeScript" },
        skill_tags: [{ title: "React" }],
      },
    }, "https://www.wanted.co.kr/wd/10", "원티드");

    expect(job).toMatchObject({ company: "Example", position: "Frontend Developer", deadline: null });
    expect(job?.description).toContain("## 주요 업무");
  });

  it("사람인 메타 정보에서 회사·공고명·마감일을 읽는다", () => {
    const html = `<html><head>
      <title>[샘플(주)] 프론트엔드 개발자 - 사람인</title>
      <meta property="og:title" content="[샘플(주)] 프론트엔드 개발자(오늘 마감) - 사람인">
      <meta name="description" content="샘플(주), 프론트엔드 개발자, 경력:3년, 마감일:2026-08-09">
    </head></html>`;
    expect(extractSaraminJob(
      html,
      "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=12",
      "사람인",
    )).toMatchObject({
      company: "샘플(주)",
      position: "프론트엔드 개발자",
      deadline: "2026-08-09",
      externalId: "12",
    });
  });

  it("잘못된 날짜를 보정하지 않는다", () => {
    expect(normalizeDeadline("2026-02-31")).toBeNull();
    expect(normalizeDeadline("상시채용")).toBeNull();
  });
});
