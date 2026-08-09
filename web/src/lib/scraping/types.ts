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
  description: string;
  matchScore?: number;
  matchReasons?: string[];
  matchCautions?: string[];
}
