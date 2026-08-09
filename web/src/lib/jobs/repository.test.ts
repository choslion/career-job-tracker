import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { decodeJobSlug, dedupeJobs, detectRelatedDocuments } from "./repository";
import type { Job } from "./types";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("detectRelatedDocuments", () => {
  it("정해진 관련 문서의 존재 여부만 반환한다", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "career-tracker-test-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "analysis.md"), "fixture", "utf8");
    await writeFile(path.join(directory, "private-note.md"), "ignored", "utf8");

    await expect(detectRelatedDocuments(directory)).resolves.toEqual({
      analysis: true,
      coverLetter: false,
      careerDescription: false,
      interview: false,
    });
  });
});

function job(overrides: Partial<Job>): Job {
  return {
    slug: "job",
    company: "예시 주식회사",
    position: "프론트엔드 개발자",
    status: "interested",
    sourceUrl: "https://example.com/job",
    deadline: null,
    updatedAt: "2026-08-09",
    tags: [],
    body: "",
    relatedDocuments: { analysis: false, coverLetter: false, careerDescription: false, interview: false },
    warnings: [],
    origin: "discovered",
    sourceName: "사람인",
    matchScore: 10,
    matchReasons: [],
    matchCautions: [],
    ...overrides,
  };
}

describe("dedupeJobs", () => {
  it("회사 법인격과 채용 장식이 다른 유사 공고를 하나로 합친다", () => {
    const result = dedupeJobs([
      job({ company: "예시(주)", position: "[경력 채용] 프론트엔드 개발자", sourceName: "사람인" }),
      job({ company: "예시 주식회사", position: "프론트엔드 개발자 모집", sourceName: "자사채용 · 예시" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.sourceName).toBe("자사채용 · 예시");
  });

  it("같은 회사의 서로 다른 프론트엔드 직무는 유지한다", () => {
    const result = dedupeJobs([
      job({ position: "프론트엔드 플랫폼 개발자" }),
      job({ position: "프론트엔드 디자인시스템 개발자" }),
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("decodeJobSlug", () => {
  it("한글 상세 경로의 퍼센트 인코딩을 실제 공고 slug로 되돌린다", () => {
    const slug = "사람인-프론트엔드-예시회사";
    expect(decodeJobSlug(encodeURIComponent(slug))).toBe(slug);
    expect(decodeJobSlug(slug)).toBe(slug);
  });
});
