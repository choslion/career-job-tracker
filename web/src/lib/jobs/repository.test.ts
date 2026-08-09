import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { detectRelatedDocuments } from "./repository";

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
