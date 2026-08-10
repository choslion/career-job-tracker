import { describe, expect, it } from "vitest";

import {
  getProfileDiscoveryKeywords,
  getProfileKeywords,
  parseSearchProfile,
  personalizeJobs,
} from "./profile";
import type { ScrapedJob } from "./types";

const baseJob: ScrapedJob = {
  source: "fixture",
  externalId: "1",
  company: "Example",
  position: "Frontend Developer",
  sourceUrl: "https://example.com/jobs/1",
  deadline: null,
  tags: ["React"],
  location: "서울",
  description: "React와 TypeScript로 제품을 개발합니다. 경력 3년 이상",
};

describe("검색 프로필", () => {
  it("허용한 최소 검색 정보만 파싱한다", () => {
    const profile = parseSearchProfile(`
roles:
  - 프론트엔드 개발자
skills:
  - React
locations:
  - 서울
experience:
  min_years: 2
  max_years: 5
exclude_keywords:
  - 파견
`);

    expect(getProfileKeywords(profile)).toEqual(["프론트엔드 개발자", "React"]);
  });

  it("알 수 없는 개인정보 필드는 거부한다", () => {
    expect(() => parseSearchProfile("roles: []\nemail: person@example.com")).toThrow();
  });

  it("공고 발견 기술과 상세 점수 기술을 분리한다", () => {
    const profile = parseSearchProfile(`
roles: [프론트엔드]
skills: [React, Git, JIRA]
discovery_skills: [React]
`);
    expect(getProfileDiscoveryKeywords(profile)).toEqual(expect.arrayContaining([
      "프론트엔드",
      "프론트 엔드",
      "FE Developer",
      "웹개발",
      "React",
    ]));
    expect(getProfileKeywords(profile)).toEqual(["프론트엔드", "React", "Git", "JIRA"]);
  });

  it("제외 키워드는 제거하고 경력 차이는 주의 정보로 남긴다", () => {
    const profile = parseSearchProfile(`
roles: [Frontend]
skills: [React]
experience:
  min_years: 1
  max_years: 5
exclude_keywords: [파견]
`);
    const jobs = [
      baseJob,
      { ...baseJob, externalId: "2", position: "Frontend 파견 개발자" },
      { ...baseJob, externalId: "3", description: "React 개발, 경력 8년 이상" },
    ];

    const personalized = personalizeJobs(jobs, profile);
    expect(personalized.map((job) => job.externalId)).toEqual(["1", "3"]);
    expect(personalized[1]?.matchCautions).toEqual(["경력 조건 차이 · 요구 8년 이상"]);
  });

  it("직무명과 기술 일치도가 높은 공고를 먼저 둔다", () => {
    const profile = parseSearchProfile("roles: [Frontend Developer]\nskills: [React]");
    const jobs = [
      { ...baseJob, externalId: "weak", position: "Web Developer" },
      { ...baseJob, externalId: "strong" },
    ];

    expect(personalizeJobs(jobs, profile)[0]?.externalId).toBe("strong");
  });

  it("같은 직무의 흔한 별칭도 검색 후보로 유지한다", () => {
    const profile = parseSearchProfile("roles: [프론트엔드 개발자]\nskills: []");
    const jobs = [
      { ...baseJob, externalId: "fe", position: "FE Developer", tags: [], description: "웹 서비스 개발" },
      { ...baseJob, externalId: "server", position: "서버 개발자", tags: [], description: "서버 운영" },
    ];

    expect(personalizeJobs(jobs, profile).map((job) => job.externalId)).toEqual(["fe"]);
  });

  it("직무별 경력 범위를 따로 적용한다", () => {
    const profile = parseSearchProfile(`
roles: [퍼블리셔, 프론트엔드]
experience_by_role:
  - role: 퍼블리셔
    min_years: 3
    max_years: 4
  - role: 프론트엔드
    min_years: 1
    max_years: 2
`);
    const jobs = [
      { ...baseJob, externalId: "publisher", position: "웹 퍼블리셔", description: "퍼블리싱 경력 3년 이상" },
      { ...baseJob, externalId: "frontend", position: "프론트엔드 개발자", description: "프론트엔드 경력 2년 이상" },
      { ...baseJob, externalId: "senior", position: "프론트엔드 개발자", description: "프론트엔드 경력 6년 이상" },
    ];

    const personalized = personalizeJobs(jobs, profile);
    expect(personalized.map((job) => job.externalId)).toEqual([
      "publisher",
      "frontend",
      "senior",
    ]);
    expect(personalized[2]?.matchCautions).toContain("경력 조건 차이 · 요구 6년 이상");
  });
});
