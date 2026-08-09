import { describe, expect, it } from "vitest";

import { normalizeInlineBullets } from "./markdown-content";

describe("normalizeInlineBullets", () => {
  it("한 문단에 붙은 bullet 항목을 Markdown 목록 줄로 나눈다", () => {
    expect(normalizeInlineBullets("자격 요건 • React 경험 • TypeScript 이해")).toBe(
      "자격 요건\n\n- React 경험\n- TypeScript 이해",
    );
    expect(normalizeInlineBullets("• 첫 번째 • 두 번째")).toBe("- 첫 번째\n- 두 번째");
  });

  it("코드 블록 안의 bullet 문자는 바꾸지 않는다", () => {
    const source = "```text\nvalue • value\n```";
    expect(normalizeInlineBullets(source)).toBe(source);
  });
});
