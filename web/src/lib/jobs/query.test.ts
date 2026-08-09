import { describe, expect, it } from "vitest";

import { filterAndSortJobs } from "./query";
import type { Job } from "./types";

function job(overrides: Partial<Job>): Job {
  return {
    slug: "default",
    company: "Example",
    position: "Developer",
    status: "preparing",
    sourceUrl: null,
    deadline: null,
    updatedAt: "2026-08-01",
    tags: [],
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
  };
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
});
