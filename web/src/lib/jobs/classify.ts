export type ClassifiedJobRole = "publishing" | "frontend" | "hybrid" | "other";
export type ClassifiedJobLocation = "preferred" | "outside" | "unknown";

/** 선호 지역. 판교·분당·성남은 경기 표기 없이 단독으로 쓰이는 일이 많아 함께 둔다. */
const PREFERRED_PATTERN = /서울|경기|판교|분당|성남|재택|원격|seoul|gyeonggi|pangyo|remote/;
const OUTSIDE_PATTERN =
  /인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주|incheon|busan|daegu|daejeon|gwangju|ulsan|sejong|jeju/;

/** 자유 텍스트에서 근무지를 뽑을 때 찾는 표기. 긴 것부터 확인한다. */
const REGION_TOKENS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "대전",
  "광주",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
  "판교",
  "분당",
  "성남",
  "재택",
  "원격",
] as const;

export function normalizeForMatch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko");
}

/**
 * 자유 텍스트에서 대표 근무지 한 곳을 찾는다.
 * 공고 본문을 저장하지 않으므로, 구조화된 근무지 필드가 없는 소스에서만 보조로 쓴다.
 */
export function detectRegion(source: string): string | null {
  const normalized = normalizeForMatch(source);
  let best: { token: string; index: number } | null = null;

  for (const token of REGION_TOKENS) {
    const index = normalized.indexOf(token);
    if (index === -1) continue;
    if (!best || index < best.index) best = { token, index };
  }

  return best?.token ?? null;
}

export function classifyRole(job: { position: string; tags: string[] }): ClassifiedJobRole {
  const title = normalizeForMatch(job.position);
  const context = normalizeForMatch(`${job.position} ${job.tags.join(" ")}`);
  const publishing = /퍼블리|마크업|web\s*publish|publisher/.test(title);
  const frontend =
    /프론트|프런트|front[\s_-]*end|frontend|\bfe\s*(?:개발|developer|engineer)|웹\s*(?:개발|엔지니어)|ui\s*개발/.test(title) ||
    (/(개발자|developer|engineer)/.test(title) && /react|vue|nuxt|next\.?js|typescript/.test(context));

  if (publishing && frontend) return "hybrid";
  if (publishing) return "publishing";
  if (frontend) return "frontend";
  return "other";
}

/**
 * 지역 분류. 공고 본문 대신 수집 단계에서 저장한 `location`과 태그·직무명만 본다.
 */
export function classifyLocation(job: {
  position: string;
  tags: string[];
  location: string | null;
}): ClassifiedJobLocation {
  const content = normalizeForMatch(
    [job.location ?? "", job.position, job.tags.join(" ")].join(" "),
  );
  if (PREFERRED_PATTERN.test(content)) return "preferred";
  if (OUTSIDE_PATTERN.test(content)) return "outside";
  return "unknown";
}
