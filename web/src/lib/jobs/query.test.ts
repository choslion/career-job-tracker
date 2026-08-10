import { describe, expect, it } from "vitest";

import { filterAndSortJobs } from "./query";
import { toJobListItem, type Job, type JobListItem } from "./types";

/** 화면이 받는 형태 그대로 검증하려고 서버 변환(`toJobListItem`)을 거친다. */
function job(overrides: Partial<Job>): JobListItem {
  return toJobListItem({
    slug: "default",
    company: "Example",
    position: "Developer",
    status: "preparing",
    sourceUrl: null,
    deadline: null,
    updatedAt: "2026-08-01",
    tags: [],
    location: null,
    body: "",
    relatedDocuments: {
      analysis: false,
      coverLetter: false,
      careerDescription: false,
      interview: false,
    },
    warnings: [],
    origin: "application",
    sourceName: null,
    matchScore: null,
    matchReasons: [],
    matchCautions: [],
    ...overrides,
  });
}

const jobs = [
  job({ slug: "no-deadline", company: "가나다", tags: ["React"], deadline: null }),
  job({ slug: "later", company: "라마바", position: "Backend", status: "applied", deadline: "2026-09-10" }),
  job({ slug: "earlier", company: "사아자", position: "Frontend", deadline: "2026-08-20", updatedAt: "2026-08-08" }),
];

describe("filterAndSortJobs", () => {
  it("회사·포지션·태그를 통합 검색한다", () => {
    expect(filterAndSortJobs(jobs, { query: "react" }).map((item) => item.slug)).toEqual(["no-deadline"]);
    expect(filterAndSortJobs(jobs, { query: "backend" }).map((item) => item.slug)).toEqual(["later"]);
  });

  it("상태를 필터링한다", () => {
    expect(filterAndSortJobs(jobs, { status: "applied" }).map((item) => item.slug)).toEqual(["later"]);
  });

  it("새 공고와 지원 공고를 구분한다", () => {
    const mixed = [jobs[0]!, { ...jobs[1]!, origin: "discovered" as const }];
    expect(filterAndSortJobs(mixed, { origin: "discovered" }).map((item) => item.slug)).toEqual(["later"]);
  });

  it("마감일 미정 공고를 삭제하지 않고 마감순 마지막에 둔다", () => {
    expect(filterAndSortJobs(jobs, { sort: "deadline-asc" }).map((item) => item.slug)).toEqual([
      "earlier",
      "later",
      "no-deadline",
    ]);
  });

  it("최근 수정 순으로 정렬한다", () => {
    expect(filterAndSortJobs(jobs, { sort: "updated-desc" })[0]?.slug).toBe("earlier");
  });

  it("퍼블리싱과 프론트엔드 직무를 따로 필터링한다", () => {
    const roleJobs = [
      job({ slug: "publisher", position: "웹 퍼블리셔" }),
      job({ slug: "frontend", position: "Frontend Developer" }),
      job({ slug: "hybrid", position: "웹 퍼블리셔 / 프론트엔드 개발자" }),
      job({ slug: "backend", position: "Backend Developer" }),
    ];

    expect(filterAndSortJobs(roleJobs, { role: "publishing" }).map((item) => item.slug)).toEqual([
      "publisher",
      "hybrid",
    ]);
    expect(filterAndSortJobs(roleJobs, { role: "frontend" }).map((item) => item.slug)).toEqual([
      "frontend",
      "hybrid",
    ]);
  });

  it("프로필 일치 점수가 높은 공고를 먼저 둔다", () => {
    const ranked = [
      job({ slug: "low", matchScore: 3 }),
      job({ slug: "high", matchScore: 30 }),
      job({ slug: "middle", matchScore: 12 }),
    ];

    expect(filterAndSortJobs(ranked, { sort: "match-desc" }).map((item) => item.slug)).toEqual([
      "high",
      "middle",
      "low",
    ]);
  });

  it("기본 목록에서는 서울·경기 공고를 먼저, 다른 지역 공고를 마지막에 둔다", () => {
    const locationJobs = [
      job({ slug: "seoul", location: "서울 강남구" }),
      job({ slug: "gyeonggi", tags: ["경기 성남시"] }),
      job({ slug: "busan", location: "부산 해운대구" }),
      job({ slug: "unknown", location: null }),
    ];

    expect(filterAndSortJobs(locationJobs, {}).map((item) => item.slug)).toEqual([
      "seoul",
      "gyeonggi",
      "unknown",
      "busan",
    ]);
    expect(filterAndSortJobs(locationJobs, { location: "all" })).toHaveLength(4);
  });
});
