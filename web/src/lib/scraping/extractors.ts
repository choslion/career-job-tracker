import { load } from "cheerio";

import type { ScrapedJob } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function htmlToReadableText(html: string): string {
  const $ = load(`<main>${html}</main>`);
  $("script, style, noscript, svg, form, button").remove();
  $("br").replaceWith("\n");
  $("h1, h2, h3").each((_, element) => {
    $(element).prepend("\n## ").append("\n");
  });
  $("p, div, section, article, table, tr").each((_, element) => {
    $(element).append("\n");
  });
  $("li").each((_, element) => {
    $(element).prepend("\n- ");
  });
  return cleanText($("main").text());
}

export function normalizeDeadline(value: unknown): string | null {
  const candidate = text(value).slice(0, 10);
  if (!datePattern.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function findJobPostingNodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(findJobPostingNodes);
  const record = asRecord(value);
  if (!record) return [];

  const type = record["@type"];
  const own = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))
    ? [record]
    : [];
  return [...own, ...Object.values(record).flatMap(findJobPostingNodes)];
}

function idFromUrl(url: string): string {
  const parsed = new URL(url);
  const lastSegment = parsed.pathname.split("/").filter(Boolean).at(-1);
  return lastSegment || Buffer.from(url).toString("base64url").slice(0, 16);
}

export function extractJsonLdJobs(html: string, pageUrl: string, source: string): ScrapedJob[] {
  const $ = load(html);
  const nodes: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      nodes.push(...findJobPostingNodes(JSON.parse($(element).text())));
    } catch {
      // 한 블록이 깨져 있어도 다른 구조화 데이터는 계속 확인한다.
    }
  });

  return nodes.flatMap((node) => {
    const organization = asRecord(node.hiringOrganization);
    const position = text(node.title);
    const company = text(organization?.name);
    const sourceUrl = text(node.url) || pageUrl;
    if (!position || !company) return [];

    const keywords = text(node.skills || node.keywords)
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

    return [{
      source,
      externalId: text(asRecord(node.identifier)?.value) || idFromUrl(sourceUrl),
      company,
      position,
      sourceUrl,
      deadline: normalizeDeadline(node.validThrough),
      tags: [source, ...keywords],
      description: htmlToReadableText(text(node.description)) || "공고 원문에서 자세한 내용을 확인해 주세요.",
    }];
  });
}

function keywordMatches(value: string, keywords: string[]): boolean {
  const normalized = value.toLocaleLowerCase("ko");
  return keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("ko")));
}

export function extractListingLinks(
  html: string,
  baseUrl: string,
  pathPattern: RegExp,
  keywords: string[],
  candidateLimit: number,
  limit = candidateLimit,
): string[] {
  const $ = load(html);
  const candidates = new Map<string, { score: number; index: number }>();
  let index = 0;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      return;
    }

    if (!pathPattern.test(`${url.pathname}${url.search}`)) return;
    const card = $(element).closest("li, article, .list-item, .post, .item, .card");
    const title = $(element).text();
    const context = `${title} ${card.length > 0 ? card.first().text() : ""}`;
    if (!keywordMatches(context, keywords)) return;

    url.hash = "";
    const canonical = url.toString();
    const titleText = title.toLocaleLowerCase("ko");
    const contextText = context.toLocaleLowerCase("ko");
    const score = keywords.reduce((total, keyword) => {
      const term = keyword.toLocaleLowerCase("ko");
      return total + (titleText.includes(term) ? 5 : contextText.includes(term) ? 1 : 0);
    }, 0);
    const existing = candidates.get(canonical);
    if (!existing || score > existing.score) {
      candidates.set(canonical, { score, index: index++ });
    }
  });

  return [...candidates.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].index - b[1].index)
    .slice(0, candidateLimit)
    .slice(0, limit)
    .map(([url]) => url);
}

export function extractSaraminJob(html: string, pageUrl: string, source: string): ScrapedJob | null {
  const $ = load(html);
  const title = $('meta[property="og:title"]').attr("content") || $("title").text();
  const description = $('meta[name="description"]').attr("content") || "";
  const match = title.match(/^\[([^\]]+)]\s*(.+?)(?:\s*-\s*사람인)?$/);
  if (!match) return null;

  const company = match[1]?.trim();
  const position = match[2]?.replace(/\((?:오늘|내일)\s*마감\)$/, "").trim();
  if (!company || !position) return null;

  const deadline = description.match(/마감일\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const parsed = new URL(pageUrl);
  return {
    source,
    externalId: parsed.searchParams.get("rec_idx") || idFromUrl(pageUrl),
    company,
    position,
    sourceUrl: pageUrl,
    deadline: normalizeDeadline(deadline),
    tags: [source],
    description: description ? `## 공고 요약\n\n${description}` : "공고 원문에서 자세한 내용을 확인해 주세요.",
  };
}

export function extractWantedListIds(payload: unknown, keywords: string[], limit: number): string[] {
  const rawData = asRecord(payload)?.data;
  const data = Array.isArray(rawData) ? rawData : asRecord(rawData)?.jobs;
  if (!Array.isArray(data)) return [];

  return data.flatMap((item, index) => {
    const record = asRecord(item);
    const company = asRecord(record?.company);
    const title = text(record?.position).toLocaleLowerCase("ko");
    const companyName = text(company?.name).toLocaleLowerCase("ko");
    const score = keywords.reduce((total, keyword) => {
      const term = keyword.toLocaleLowerCase("ko");
      return total + (title.includes(term) ? 5 : companyName.includes(term) ? 1 : 0);
    }, 0);
    if (!record?.id || score === 0) return [];
    return [{ id: String(record.id), score, index }];
  })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.id);
}

export function extractJumpitJobs(payload: unknown, source: string): ScrapedJob[] {
  const positions = asRecord(asRecord(payload)?.result)?.positions;
  if (!Array.isArray(positions)) return [];

  return positions.flatMap((value) => {
    const item = asRecord(value);
    const id = item?.id;
    const position = text(item?.title);
    const company = text(item?.companyName);
    if (!id || !position || !company) return [];

    const locations = Array.isArray(item.locations)
      ? item.locations.map(text).filter(Boolean)
      : [];
    const stacks = Array.isArray(item.techStacks)
      ? item.techStacks.map(text).filter(Boolean).slice(0, 10)
      : [];
    const minimum = typeof item.minCareer === "number" ? item.minCareer : null;
    const maximum = typeof item.maxCareer === "number" ? item.maxCareer : null;
    const career = minimum === null
      ? ""
      : maximum === null || maximum >= 99
        ? `경력 ${minimum}년 이상`
        : `경력 ${minimum}~${maximum}년`;
    const deadline = item.alwaysOpen === true ? null : normalizeDeadline(item.closedAt);

    return [{
      source,
      externalId: String(id),
      company,
      position,
      sourceUrl: `https://jumpit.saramin.co.kr/position/${encodeURIComponent(String(id))}`,
      deadline,
      tags: [source, ...stacks],
      description: [
        locations.length > 0 ? `근무지 · ${locations.join(", ")}` : "",
        career,
        text(item.jobCategory) ? `직무 · ${text(item.jobCategory)}` : "",
        stacks.length > 0 ? `기술 · ${stacks.join(", ")}` : "",
      ].filter(Boolean).join("\n\n") || "공고 원문에서 자세한 내용을 확인해 주세요.",
    }];
  });
}

function publicAtsDescription(parts: unknown[]): string {
  const readable = parts
    .map((part) => text(part) ? htmlToReadableText(text(part)) : "")
    .filter(Boolean)
    .join("\n\n");
  return readable || "공고 원문에서 자세한 내용을 확인해 주세요.";
}

export function extractLeverJobs(payload: unknown, companyName: string, source: string): ScrapedJob[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((value) => {
    const item = asRecord(value);
    const categories = asRecord(item?.categories);
    const id = item?.id;
    const position = text(item?.text);
    const sourceUrl = text(item?.hostedUrl);
    if (!id || !position || !sourceUrl) return [];
    const location = text(categories?.location);
    const commitment = text(categories?.commitment);
    return [{
      source,
      externalId: String(id),
      company: companyName,
      position,
      sourceUrl,
      deadline: null,
      tags: [source, location, commitment].filter(Boolean),
      description: publicAtsDescription([
        item.descriptionPlain,
        item.description,
        item.additionalPlain,
        item.additional,
      ]),
    }];
  });
}

export function extractAshbyJobs(payload: unknown, companyName: string, source: string): ScrapedJob[] {
  const jobs = asRecord(payload)?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.flatMap((value) => {
    const item = asRecord(value);
    if (item?.isListed === false) return [];
    const id = item?.id;
    const position = text(item?.title);
    const sourceUrl = text(item?.jobUrl);
    if (!id || !position || !sourceUrl) return [];
    const location = text(item.location);
    const employment = text(item.employmentType);
    return [{
      source,
      externalId: String(id),
      company: companyName,
      position,
      sourceUrl,
      deadline: null,
      tags: [source, location, employment].filter(Boolean),
      description: publicAtsDescription([item.descriptionPlain, item.descriptionHtml]),
    }];
  });
}

export function extractGreenhouseJobs(payload: unknown, companyName: string, source: string): ScrapedJob[] {
  const jobs = asRecord(payload)?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.flatMap((value) => {
    const item = asRecord(value);
    const location = asRecord(item?.location);
    const id = item?.id;
    const position = text(item?.title);
    const sourceUrl = text(item?.absolute_url);
    if (!id || !position || !sourceUrl) return [];
    const locationName = text(location?.name);
    return [{
      source,
      externalId: String(id),
      company: companyName,
      position,
      sourceUrl,
      deadline: null,
      tags: [source, locationName].filter(Boolean),
      description: publicAtsDescription([item.content]),
    }];
  });
}

function greetingOpenings(payload: unknown): Record<string, unknown>[] {
  const props = asRecord(asRecord(payload)?.props);
  const pageProps = asRecord(props?.pageProps);
  const dehydratedState = asRecord(pageProps?.dehydratedState);
  const queries = dehydratedState?.queries;
  if (!Array.isArray(queries)) return [];

  for (const value of queries) {
    const query = asRecord(value);
    const queryKey = query?.queryKey;
    const queryHash = text(query?.queryHash);
    const isOpenings = (Array.isArray(queryKey) && queryKey[0] === "openings") || queryHash === '["openings"]';
    if (!isOpenings) continue;
    const data = asRecord(query?.state)?.data;
    if (Array.isArray(data)) return data.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
  }
  return [];
}

function greetingMeta(opening: Record<string, unknown>): { tags: string[]; description: string } {
  const openingPosition = asRecord(opening.openingJobPosition);
  const positions = openingPosition?.openingJobPositions;
  if (!Array.isArray(positions)) return { tags: [], description: "" };
  const tags: string[] = [];
  const descriptions: string[] = [];

  for (const value of positions) {
    const position = asRecord(value);
    const place = asRecord(position?.workspacePlace);
    const location = [text(place?.place), text(place?.detailPlace)].filter(Boolean).join(" ");
    if (location) tags.push(location);
    const employment = text(asRecord(position?.jobPositionEmployment)?.employmentType);
    if (employment) tags.push(employment);
    const career = asRecord(position?.jobPositionCareer);
    const careerType = text(career?.careerType);
    if (careerType === "NOT_MATTER") descriptions.push("경력 무관");
    else if (careerType === "NEW_COMER") descriptions.push("신입");
    else if (career) {
      const from = typeof career.careerFrom === "number" ? career.careerFrom : null;
      const to = typeof career.careerTo === "number" ? career.careerTo : null;
      if (from !== null) descriptions.push(to === null ? `경력 ${from}년 이상` : `경력 ${from}~${to}년`);
    }
  }
  return { tags: [...new Set(tags)], description: [...new Set(descriptions)].join(" · ") };
}

export function extractGreetingJobs(html: string, baseUrl: string, fallbackCompany: string, source: string): ScrapedJob[] {
  const $ = load(html);
  const script = $('script#__NEXT_DATA__').text();
  if (!script) return [];
  let payload: unknown;
  try {
    payload = JSON.parse(script);
  } catch {
    return [];
  }
  const origin = new URL(baseUrl).origin;
  return greetingOpenings(payload).flatMap((opening) => {
    if (opening.deploy === false) return [];
    const id = opening.openingId;
    const position = text(opening.title);
    const company = text(asRecord(opening.group)?.name) || fallbackCompany;
    if (!id || !position || !company) return [];
    const meta = greetingMeta(opening);
    return [{
      source,
      externalId: String(id),
      company,
      position,
      sourceUrl: `${origin}/ko/o/${encodeURIComponent(String(id))}`,
      deadline: normalizeDeadline(opening.dueDate),
      tags: [source, ...meta.tags],
      description: meta.description || "공고 원문에서 자세한 내용을 확인해 주세요.",
    }];
  });
}

export function extractWantedJob(payload: unknown, pageUrl: string, source: string): ScrapedJob | null {
  const job = asRecord(asRecord(payload)?.job);
  const company = asRecord(job?.company);
  const detail = asRecord(job?.detail);
  if (!job || !company || !detail) return null;

  const position = text(job.position);
  const companyName = text(company.name);
  if (!position || !companyName || !job.id) return null;

  const sections = [
    ["포지션 소개", detail.intro],
    ["주요 업무", detail.main_tasks],
    ["자격 요건", detail.requirements],
    ["우대 사항", detail.preferred_points],
    ["혜택 및 복지", detail.benefits],
  ]
    .filter(([, value]) => text(value))
    .map(([heading, value]) => `## ${heading}\n\n${text(value)}`)
    .join("\n\n");
  const skillTags = Array.isArray(job.skill_tags)
    ? job.skill_tags.map((item) => text(asRecord(item)?.title)).filter(Boolean).slice(0, 8)
    : [];

  return {
    source,
    externalId: String(job.id),
    company: companyName,
    position,
    sourceUrl: pageUrl,
    deadline: normalizeDeadline(job.due_time),
    tags: [source, ...skillTags],
    description: sections || "공고 원문에서 자세한 내용을 확인해 주세요.",
  };
}
