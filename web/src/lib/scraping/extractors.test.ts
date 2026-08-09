import { describe, expect, it } from "vitest";

import {
  extractAshbyJobs,
  extractGreetingJobs,
  extractJsonLdJobs,
  extractJumpitJobs,
  extractLeverJobs,
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

  it("원티드 검색 응답의 중첩 jobs 목록도 읽는다", () => {
    const payload = {
      data: {
        jobs: [
          { id: 20, position: "웹 퍼블리셔", company: { name: "Example" } },
          { id: 21, position: "Sales", company: { name: "Example" } },
        ],
      },
    };

    expect(extractWantedListIds(payload, ["퍼블리셔"], 10)).toEqual(["20"]);
  });

  it("점핏 공개 목록을 공통 공고 형식으로 변환한다", () => {
    const jobs = extractJumpitJobs({
      result: {
        positions: [{
          id: 30,
          title: "Frontend Engineer",
          companyName: "Example",
          locations: ["서울"],
          minCareer: 2,
          maxCareer: 5,
          alwaysOpen: true,
          techStacks: ["Vue.js", "TypeScript"],
        }],
      },
    }, "점핏");

    expect(jobs[0]).toMatchObject({
      externalId: "30",
      company: "Example",
      deadline: null,
      tags: ["점핏", "Vue.js", "TypeScript"],
    });
    expect(jobs[0]?.description).toContain("경력 2~5년");
  });

  it("Lever와 Ashby 공개 Job Board 응답을 변환한다", () => {
    expect(extractLeverJobs([{
      id: "lever-1",
      text: "Frontend Engineer",
      hostedUrl: "https://jobs.lever.co/example/lever-1",
      categories: { location: "Seoul", commitment: "Full-time" },
      descriptionPlain: "React와 TypeScript 개발",
    }], "Example", "자사채용 · Example")[0]).toMatchObject({
      company: "Example",
      position: "Frontend Engineer",
    });

    expect(extractAshbyJobs({ jobs: [{
      id: "ashby-1",
      title: "Web Publisher",
      jobUrl: "https://jobs.ashbyhq.com/example/ashby-1",
      location: "Seoul",
      isListed: true,
      descriptionPlain: "HTML과 CSS",
    }] }, "Example", "자사채용 · Example")[0]).toMatchObject({
      externalId: "ashby-1",
      position: "Web Publisher",
    });
  });

  it("Greeting 공개 목록의 채용 정보를 변환한다", () => {
    const payload = {
      props: {
        pageProps: {
          dehydratedState: {
            queries: [{
              queryKey: ["openings"],
              state: {
                data: [{
                  openingId: 40,
                  title: "프론트엔드 개발자",
                  dueDate: "2026-08-31T23:59:59+09:00",
                  group: { name: "Example" },
                  openingJobPosition: {
                    openingJobPositions: [{
                      workspacePlace: { place: "서울", detailPlace: "강남구" },
                      jobPositionCareer: { careerType: "EXPERIENCED", careerFrom: 2, careerTo: 5 },
                    }],
                  },
                }],
              },
            }],
          },
        },
      },
    };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
    const jobs = extractGreetingJobs(html, "https://example.career.greetinghr.com/ko", "Fallback", "자사채용 · Example");

    expect(jobs[0]).toMatchObject({
      externalId: "40",
      company: "Example",
      deadline: "2026-08-31",
    });
    expect(jobs[0]?.description).toContain("경력 2~5년");
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
