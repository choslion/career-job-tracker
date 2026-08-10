import { describe, expect, it } from "vitest";

import { getDeadlineLabel, getUpcomingJobs } from "./format";
import type { JobListItem } from "./types";

const baseJob: JobListItem = {
  slug: "example",
  company: "Example",
  position: "Developer",
  status: "preparing",
  sourceUrl: null,
  deadline: null,
  updatedAt: "2026-08-01",
  tags: [],
  location: null,
  relatedDocuments: { analysis: false, coverLetter: false, careerDescription: false, interview: false },
  warnings: [],
  origin: "application",
  sourceName: null,
  matchScore: null,
  matchReasons: [],
  matchCautions: [],
  role: "other",
  locationClass: "unknown",
};

describe("마감일 표시", () => {
  it("마감일이 없으면 미정으로 표시한다", () => {
    expect(getDeadlineLabel(null, "2026-08-09")).toBe("마감일 미정");
  });

  it("임박 목록에서는 마감일 미정과 지난 공고를 제외한다", () => {
    const jobs = [
      baseJob,
      { ...baseJob, slug: "past", deadline: "2026-08-08" },
      { ...baseJob, slug: "future", deadline: "2026-08-10" },
    ];
    expect(getUpcomingJobs(jobs, 5, "2026-08-09").map((job) => job.slug)).toEqual(["future"]);
  });
});
