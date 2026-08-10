export type BuiltInSourceType = "jobkorea" | "wanted" | "saramin" | "jumpit";

export interface ScrapeSource {
  type: BuiltInSourceType;
  name: string;
  url: string;
  searchQueries?: string[];
  tagIds?: number[];
  maxPages?: number;
}

export interface CompanyPageSource {
  name: string;
  url: string;
  mode?: "detail" | "listing";
}

export interface ScrapeConfig {
  enabled: boolean;
  cacheHours: number;
  requestDelayMs: number;
  maxItemsPerSource: number;
  candidateLimitPerSource: number;
  maxListingPages: number;
  keywords: string[];
  sources: ScrapeSource[];
  companyPages: CompanyPageSource[];
}

export interface ScrapedJob {
  source: string;
  externalId: string;
  company: string;
  position: string;
  sourceUrl: string;
  deadline: string | null;
  tags: string[];
  /** 근무지 원문. 본문을 저장하지 않으므로 지역 필터는 이 값만 사용한다. */
  location: string | null;
  /** 점수 계산에만 쓰는 휘발성 원문. 로컬 캐시에는 기록하지 않는다. */
  description: string;
  matchScore?: number;
  matchReasons?: string[];
  matchCautions?: string[];
}
