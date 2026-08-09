import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dump as dumpYaml } from "js-yaml";
import robotsParser from "robots-parser";

import {
  extractJsonLdJobs,
  extractListingLinks,
  extractSaraminJob,
  extractWantedJob,
  extractWantedListIds,
} from "../src/lib/scraping/extractors";
import {
  getProfileDiscoveryKeywords,
  parseSearchProfile,
  personalizeJobs,
  type SearchProfile,
} from "../src/lib/scraping/profile";
import type {
  CompanyPageSource,
  ScrapeConfig,
  ScrapedJob,
  ScrapeSource,
} from "../src/lib/scraping/types";

const USER_AGENT = "CareerJobTracker/0.1 (+local-personal-job-search)";
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_PROFILE_BYTES = 64 * 1024;
const MAX_DESCRIPTION_LENGTH = 60_000;
const CONFIG_FILE = path.resolve(process.cwd(), "scrape.config.json");
const DEFAULT_OUTPUT_DIRECTORY = path.resolve(process.cwd(), ".scraped-data");
const LOCAL_PROFILE_FILE = path.resolve(process.cwd(), ".local", "search-profile.yaml");
const DEFAULT_PROFILE_FILE = path.resolve(process.cwd(), "..", "..", "career-workbench", "job-search.yaml");

let requestDelayMs = 800;
let lastRequestAt = 0;
const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();

function log(message: string) {
  console.log(`[공고 수집] ${message}`);
}

function warn(message: string) {
  console.warn(`[공고 수집] ${message}`);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function throttle() {
  const remaining = requestDelayMs - (Date.now() - lastRequestAt);
  if (remaining > 0) await delay(remaining);
  lastRequestAt = Date.now();
}

async function request(url: string, redirects = 0): Promise<Response> {
  if (redirects > 3) throw new Error("리디렉션이 너무 많습니다.");
  await throttle();

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json,text/html;q=0.9,*/*;q=0.1",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`리디렉션 위치가 없습니다 (${response.status}).`);
    const redirectedUrl = new URL(location, url).toString();
    if (!(await isAllowedByRobots(redirectedUrl))) throw new Error("robots.txt에서 리디렉션 경로를 허용하지 않습니다.");
    return request(redirectedUrl, redirects + 1);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error("응답 크기 제한을 초과했습니다.");
  return response;
}

async function fetchText(url: string): Promise<string> {
  const response = await request(url);
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) throw new Error("응답 크기 제한을 초과했습니다.");
  return body;
}

async function fetchJson(url: string): Promise<unknown> {
  return JSON.parse(await fetchText(url));
}

async function isAllowedByRobots(url: string): Promise<boolean> {
  const target = new URL(url);
  const origin = target.origin;
  if (!robotsCache.has(origin)) {
    try {
      await throttle();
      const robotsUrl = new URL("/robots.txt", origin).toString();
      const response = await fetch(robotsUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/plain" },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        robotsCache.set(origin, robotsParser(robotsUrl, await response.text()));
      } else if (response.status >= 400 && response.status < 500) {
        // RFC 9309: robots.txt의 4xx는 unavailable로 보고 접근 제한이 없는 것으로 처리한다.
        robotsCache.set(origin, null);
      } else {
        warn(`${target.hostname}의 robots.txt를 확인하지 못해 이 사이트를 건너뜁니다.`);
        return false;
      }
    } catch {
      warn(`${target.hostname}의 robots.txt 요청에 실패해 이 사이트를 건너뜁니다.`);
      return false;
    }
  }

  const robots = robotsCache.get(origin);
  return robots ? robots.isAllowed(url, USER_AGENT) !== false : true;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function readConfig(): Promise<ScrapeConfig> {
  const raw = JSON.parse(await readFile(CONFIG_FILE, "utf8")) as Partial<ScrapeConfig>;
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 20)
    : [];
  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter((item): item is ScrapeSource =>
      Boolean(item && ["jobkorea", "wanted", "saramin"].includes(item.type) && item.name && isHttpsUrl(item.url)),
    )
    : [];
  const companyPages = Array.isArray(raw.companyPages)
    ? raw.companyPages.filter((item): item is CompanyPageSource => Boolean(item?.name && isHttpsUrl(item.url)))
    : [];

  return {
    enabled: raw.enabled !== false,
    cacheHours: clampInteger(raw.cacheHours, 6, 0, 168),
    requestDelayMs: clampInteger(raw.requestDelayMs, 800, 500, 10_000),
    maxItemsPerSource: clampInteger(raw.maxItemsPerSource, 20, 1, 50),
    candidateLimitPerSource: clampInteger(raw.candidateLimitPerSource, 50, 10, 200),
    maxListingPages: clampInteger(raw.maxListingPages, 3, 1, 5),
    keywords: keywords.length > 0 ? keywords : ["프론트엔드", "frontend"],
    sources,
    companyPages,
  };
}

async function readSearchProfile(): Promise<SearchProfile | null> {
  const explicitlyConfigured = Boolean(process.env.CAREER_PROFILE_PATH?.trim());
  const candidates = explicitlyConfigured
    ? [path.resolve(process.env.CAREER_PROFILE_PATH!.trim())]
    : [LOCAL_PROFILE_FILE, DEFAULT_PROFILE_FILE];

  for (const profilePath of candidates) {
    try {
      const stats = await lstat(profilePath);
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_PROFILE_BYTES) {
        warn("검색 프로필이 일반 파일이 아니거나 크기 제한을 초과해 적용하지 않았습니다.");
        return null;
      }
      const profile = parseSearchProfile(await readFile(profilePath, "utf8"));
      log("개인 검색 프로필을 적용합니다. 프로필 내용은 캐시에 복사하지 않습니다.");
      return profile;
    } catch {
      if (explicitlyConfigured) {
        warn("CAREER_PROFILE_PATH의 검색 프로필을 읽지 못해 기본 키워드를 사용합니다.");
        return null;
      }
    }
  }
  return null;
}

async function ensureSafeOutputDirectory(): Promise<string> {
  const workspace = await realpath(process.cwd());
  const configured = process.env.SCRAPED_DATA_DIR?.trim();
  const output = path.resolve(configured || DEFAULT_OUTPUT_DIRECTORY);
  if (output === workspace || !output.startsWith(`${workspace}${path.sep}`)) {
    throw new Error("SCRAPED_DATA_DIR은 web 디렉터리 안쪽이어야 합니다.");
  }

  const careerDirectory = process.env.CAREER_DATA_DIR?.trim();
  if (careerDirectory) {
    const career = path.resolve(careerDirectory);
    if (output === career || output.startsWith(`${career}${path.sep}`) || career.startsWith(`${output}${path.sep}`)) {
      throw new Error("수집 캐시와 CAREER_DATA_DIR은 서로 겹칠 수 없습니다.");
    }
  }

  await mkdir(output, { recursive: true });
  const outputStats = await lstat(output);
  const realOutput = await realpath(output);
  if (!outputStats.isDirectory() || outputStats.isSymbolicLink() || !realOutput.startsWith(`${workspace}${path.sep}`)) {
    throw new Error("수집 캐시 경로가 안전한 로컬 디렉터리가 아닙니다.");
  }
  return realOutput;
}

async function stateIsFresh(output: string, cacheHours: number, cacheKey: string): Promise<boolean> {
  if (process.argv.includes("--force") || cacheHours === 0) return false;
  try {
    const state = JSON.parse(await readFile(path.join(output, ".scrape-state.json"), "utf8")) as {
      completedAt?: string;
      cacheKey?: string;
    };
    const completedAt = state.completedAt ? new Date(state.completedAt).getTime() : Number.NaN;
    return state.cacheKey === cacheKey && Number.isFinite(completedAt) && Date.now() - completedAt < cacheHours * 3_600_000;
  } catch {
    return false;
  }
}

function uniqueJobs(jobs: ScrapedJob[]): ScrapedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.sourceUrl)) return false;
    seen.add(job.sourceUrl);
    return true;
  });
}

function selectedJobs(jobs: ScrapedJob[], profile: SearchProfile | null, limit: number): ScrapedJob[] {
  return (profile ? personalizeJobs(jobs, profile) : jobs).slice(0, limit);
}

function reachedTarget(jobs: ScrapedJob[], profile: SearchProfile | null, limit: number): boolean {
  return selectedJobs(jobs, profile, limit).length >= limit;
}

async function scrapeJobKorea(
  source: ScrapeSource,
  config: ScrapeConfig,
  profile: SearchProfile | null,
): Promise<ScrapedJob[]> {
  const listings: string[] = [];
  for (let page = 1; page <= config.maxListingPages; page += 1) {
    const pageUrl = new URL(source.url);
    if (page > 1) pageUrl.searchParams.set("Page", String(page));
    if (!(await isAllowedByRobots(pageUrl.toString()))) continue;
    listings.push(await fetchText(pageUrl.toString()));
  }
  const links = extractListingLinks(
    listings.join("\n"),
    source.url,
    /\/Recruit\/GI_Read\//i,
    config.keywords,
    config.candidateLimitPerSource,
  );
  const jobs: ScrapedJob[] = [];
  for (const link of links) {
    if (!(await isAllowedByRobots(link))) continue;
    try {
      jobs.push(...extractJsonLdJobs(await fetchText(link), link, source.name));
    } catch {
      continue;
    }
    if (reachedTarget(jobs, profile, config.maxItemsPerSource)) break;
  }
  log(`${source.name}: 목록 후보 ${links.length}개 중 상세 ${jobs.length}개 확인`);
  return jobs;
}

async function scrapeSaramin(
  source: ScrapeSource,
  config: ScrapeConfig,
  profile: SearchProfile | null,
): Promise<ScrapedJob[]> {
  const listings: string[] = [];
  for (let page = 1; page <= config.maxListingPages; page += 1) {
    const pageUrl = new URL(source.url);
    if (page > 1) {
      pageUrl.searchParams.set("page", String(page));
      pageUrl.searchParams.set("page_count", "50");
    }
    if (!(await isAllowedByRobots(pageUrl.toString()))) continue;
    listings.push(await fetchText(pageUrl.toString()));
  }
  const links = extractListingLinks(
    listings.join("\n"),
    source.url,
    /\/zf_user\/jobs\/(?:relay\/view|view)/i,
    config.keywords,
    config.candidateLimitPerSource,
  );
  const jobs: ScrapedJob[] = [];
  for (const link of links) {
    if (!(await isAllowedByRobots(link))) continue;
    try {
      const job = extractSaraminJob(await fetchText(link), link, source.name);
      if (job) jobs.push(job);
    } catch {
      continue;
    }
    if (reachedTarget(jobs, profile, config.maxItemsPerSource)) break;
  }
  log(`${source.name}: 목록 후보 ${links.length}개 중 상세 ${jobs.length}개 확인`);
  return jobs;
}

async function scrapeWanted(
  source: ScrapeSource,
  config: ScrapeConfig,
  profile: SearchProfile | null,
): Promise<ScrapedJob[]> {
  const ids: string[] = [];
  const seenIds = new Set<string>();
  const initialUrl = new URL(source.url);
  const pageSize = clampInteger(Number(initialUrl.searchParams.get("limit")), 100, 1, 100);
  const initialOffset = clampInteger(Number(initialUrl.searchParams.get("offset")), 0, 0, 100_000);

  for (let page = 0; page < config.maxListingPages && ids.length < config.candidateLimitPerSource; page += 1) {
    const pageUrl = new URL(source.url);
    pageUrl.searchParams.set("limit", String(pageSize));
    pageUrl.searchParams.set("offset", String(initialOffset + page * pageSize));
    const pageIds = extractWantedListIds(
      await fetchJson(pageUrl.toString()),
      config.keywords,
      config.candidateLimitPerSource,
    );
    for (const id of pageIds) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      ids.push(id);
    }
    if (pageIds.length === 0) continue;
  }

  const jobs: ScrapedJob[] = [];
  for (const id of ids) {
    const apiUrl = `https://www.wanted.co.kr/api/v4/jobs/${encodeURIComponent(id)}`;
    if (!(await isAllowedByRobots(apiUrl))) continue;
    const pageUrl = `https://www.wanted.co.kr/wd/${encodeURIComponent(id)}`;
    try {
      const job = extractWantedJob(await fetchJson(apiUrl), pageUrl, source.name);
      if (job) jobs.push(job);
    } catch {
      continue;
    }
    if (reachedTarget(jobs, profile, config.maxItemsPerSource)) break;
  }
  log(`${source.name}: 목록 후보 ${ids.length}개 중 상세 ${jobs.length}개 확인`);
  return jobs;
}

async function scrapeBuiltInSource(
  source: ScrapeSource,
  config: ScrapeConfig,
  profile: SearchProfile | null,
): Promise<ScrapedJob[]> {
  if (!(await isAllowedByRobots(source.url))) {
    warn(`${source.name} 목록은 robots.txt에서 허용하지 않아 건너뜁니다.`);
    return [];
  }
  if (source.type === "jobkorea") return scrapeJobKorea(source, config, profile);
  if (source.type === "wanted") return scrapeWanted(source, config, profile);
  return scrapeSaramin(source, config, profile);
}

async function scrapeCompanyPage(
  source: CompanyPageSource,
  config: ScrapeConfig,
  profile: SearchProfile | null,
): Promise<ScrapedJob[]> {
  if (!(await isAllowedByRobots(source.url))) {
    warn(`${source.name} 채용 페이지는 robots.txt에서 허용하지 않아 건너뜁니다.`);
    return [];
  }

  const html = await fetchText(source.url);
  const directJobs = extractJsonLdJobs(html, source.url, source.name);
  if (directJobs.length > 0 || source.mode === "detail") return directJobs;

  const origin = new URL(source.url).origin;
  const links = extractListingLinks(
    html,
    source.url,
    /(?:career|careers|job|jobs|recruit|opening|position)/i,
    config.keywords,
    config.candidateLimitPerSource,
  ).filter((link) => new URL(link).origin === origin);
  const jobs: ScrapedJob[] = [];
  for (const link of links) {
    if (!(await isAllowedByRobots(link))) continue;
    try {
      jobs.push(...extractJsonLdJobs(await fetchText(link), link, source.name));
    } catch {
      continue;
    }
    if (reachedTarget(jobs, profile, config.maxItemsPerSource)) break;
  }
  return jobs;
}

function safeSegment(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "job";
}

async function writeJob(output: string, job: ScrapedJob): Promise<string> {
  const slug = `${safeSegment(job.source)}-${safeSegment(job.externalId)}-${safeSegment(job.company)}`.slice(0, 100);
  const directory = path.join(output, "applications", slug);
  await mkdir(directory, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const metadata = {
    company: job.company,
    position: job.position,
    status: job.deadline && job.deadline < today ? "closed" : "interested",
    source_url: job.sourceUrl,
    ...(job.deadline ? { deadline: job.deadline } : {}),
    updated_at: today,
    tags: [...new Set(job.tags)].slice(0, 10),
    origin: "discovered",
    source_name: job.source,
    ...(job.matchScore !== undefined ? { match_score: job.matchScore } : {}),
    ...(job.matchReasons?.length ? { match_reasons: job.matchReasons } : {}),
    ...(job.matchCautions?.length ? { match_cautions: job.matchCautions } : {}),
  };
  const body = [
    `# ${job.company} ${job.position}`,
    "",
    `> ${job.source}의 공개 채용공고에서 자동 수집한 로컬 사본입니다. 지원 전 [원문](${job.sourceUrl})을 확인해 주세요.`,
    "",
    job.description.slice(0, MAX_DESCRIPTION_LENGTH),
  ].join("\n");
  const contents = `---\n${dumpYaml(metadata, { noRefs: true, lineWidth: -1 })}---\n\n${body}\n`;
  const target = path.join(directory, "job-posting.md");
  const temporary = path.join(directory, `.job-posting-${process.pid}-${Date.now()}.tmp`);
  await writeFile(temporary, contents, { encoding: "utf8", flag: "wx" });
  await rename(temporary, target);
  return slug;
}

async function writeState(output: string, activeSlugs: string[], cacheKey: string) {
  const target = path.join(output, ".scrape-state.json");
  const temporary = path.join(output, `.scrape-state-${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify({
    completedAt: new Date().toISOString(),
    jobCount: activeSlugs.length,
    activeSlugs,
    cacheKey,
  }, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporary, target);
}

async function main() {
  if (process.env.JOB_SCRAPE_DISABLED === "1") {
    log("JOB_SCRAPE_DISABLED=1 설정으로 자동 수집을 건너뜁니다.");
    return;
  }

  const baseConfig = await readConfig();
  if (!baseConfig.enabled) {
    log("설정에서 자동 수집이 꺼져 있습니다.");
    return;
  }

  const profile = await readSearchProfile();
  const profileKeywords = profile ? getProfileDiscoveryKeywords(profile) : [];
  const config = {
    ...baseConfig,
    keywords: profileKeywords.length > 0
      ? [...new Set([...profileKeywords, ...baseConfig.keywords])]
      : baseConfig.keywords,
  };
  const cacheKey = createHash("sha256").update(JSON.stringify({ config, profile })).digest("hex");
  requestDelayMs = config.requestDelayMs;
  const output = await ensureSafeOutputDirectory();
  if (await stateIsFresh(output, config.cacheHours, cacheKey)) {
    log(`${config.cacheHours}시간 이내 캐시가 있어 네트워크 수집을 건너뜁니다.`);
    return;
  }

  const jobs: ScrapedJob[] = [];
  for (const source of config.sources) {
    try {
      const scraped = await scrapeBuiltInSource(source, config, profile);
      const found = selectedJobs(scraped, profile, config.maxItemsPerSource);
      jobs.push(...found);
      log(`${source.name}: ${found.length}개 수집`);
    } catch (error) {
      warn(`${source.name}: ${error instanceof Error ? error.message : "수집 실패"}`);
    }
  }
  for (const source of config.companyPages) {
    try {
      const scraped = await scrapeCompanyPage(source, config, profile);
      const found = selectedJobs(scraped, profile, config.maxItemsPerSource);
      jobs.push(...found);
      log(`${source.name}: ${found.length}개 수집`);
    } catch (error) {
      warn(`${source.name}: ${error instanceof Error ? error.message : "수집 실패"}`);
    }
  }

  const unique = uniqueJobs(jobs);
  if (unique.length === 0 && config.sources.length + config.companyPages.length > 0) {
    warn("새 공고를 하나도 확인하지 못해 마지막 정상 캐시를 유지합니다.");
    return;
  }

  const activeSlugs: string[] = [];
  for (const job of unique) activeSlugs.push(await writeJob(output, job));
  await writeState(output, activeSlugs, cacheKey);
  log(`완료: ${unique.length}개 공고를 로컬 캐시에 반영했습니다.`);
}

main().catch((error) => {
  // 네트워크나 개별 사이트 문제로 개발 서버 실행을 막지 않는다.
  warn(error instanceof Error ? error.message : "자동 수집을 완료하지 못했습니다.");
});
