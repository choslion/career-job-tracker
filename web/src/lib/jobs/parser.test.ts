import { describe, expect, it } from "vitest";

import { parseJobDocument } from "./parser";
import type { RelatedDocuments } from "./types";

const noRelatedDocuments: RelatedDocuments = {
  analysis: false,
  coverLetter: false,
  careerDescription: false,
  interview: false,
};

function parse(source: string) {
  return parseJobDocument({
    slug: "example-company",
    source,
    modifiedAt: new Date("2026-08-01T00:00:00Z"),
    relatedDocuments: noRelatedDocuments,
  });
}

describe("parseJobDocument", () => {
  it("정상 front matter와 본문을 파싱한다", () => {
    const job = parse(`---
company: Example Mobility
position: Frontend Developer
status: applied
source_url: https://example.com/jobs/1
deadline: 2026-08-31
updated_at: 2026-08-07
tags:
  - Next.js
  - TypeScript
---
# Example Mobility 프론트엔드 개발자

공고 본문입니다.`);

    expect(job).toMatchObject({
      company: "Example Mobility",
      position: "Frontend Developer",
      status: "applied",
      deadline: "2026-08-31",
      updatedAt: "2026-08-07",
      tags: ["Next.js", "TypeScript"],
      warnings: [],
    });
    expect(job.body).toContain("공고 본문입니다.");
  });

  it("마감일 누락을 정상적인 미정 상태로 유지한다", () => {
    const job = parse(`---
company: Example
position: Developer
---
# Developer`);

    expect(job.deadline).toBeNull();
    expect(job.warnings.some((warning) => warning.includes("마감일"))).toBe(false);
  });

  it("front matter가 없는 문서는 H1과 폴더명을 사용한다", () => {
    const job = parse("# 백엔드 개발자\n\n레거시 공고 본문");

    expect(job.company).toBe("example company");
    expect(job.position).toBe("백엔드 개발자");
    expect(job.status).toBe("preparing");
    expect(job.updatedAt).toBe("2026-08-01");
  });

  it("잘못된 값은 안전한 기본값으로 정규화하고 경고한다", () => {
    const job = parse(`---
company: Example
position: Developer
status: unknown
source_url: file:///private/resume.md
deadline: 2026-02-31
---
# Developer`);

    expect(job.status).toBe("preparing");
    expect(job.sourceUrl).toBeNull();
    expect(job.deadline).toBeNull();
    expect(job.warnings.length).toBeGreaterThanOrEqual(3);
    expect(job.warnings.join(" ")).not.toContain("file:///private/resume.md");
  });

  it("깨진 front matter 한 건 때문에 파싱이 중단되지 않는다", () => {
    const job = parse("---\ncompany: [broken\n---\n# 안전한 제목\n\n본문");

    expect(job.position).toBe("안전한 제목");
    expect(job.warnings).toContain("문서 머리말을 읽지 못해 기본 정보로 표시했습니다.");
  });
});
