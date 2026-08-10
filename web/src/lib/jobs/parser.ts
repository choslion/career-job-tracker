import matter from "gray-matter";
import { JSON_SCHEMA, load as loadYaml } from "js-yaml";
import { z } from "zod";

import { detectRegion } from "./classify";
import {
  JOB_STATUSES,
  type Job,
  type JobStatus,
  type RelatedDocuments,
} from "./types";

const MAX_DOCUMENT_LENGTH = 2 * 1024 * 1024;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const frontMatterSchema = z
  .object({
    company: z.string().trim().min(1).optional(),
    position: z.string().trim().min(1).optional(),
    status: z.string().trim().optional(),
    source_url: z.string().trim().optional(),
    deadline: z.union([z.string(), z.date()]).optional(),
    updated_at: z.union([z.string(), z.date()]).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    location: z.string().trim().min(1).max(60).optional(),
    origin: z.enum(["application", "discovered"]).optional(),
    source_name: z.string().trim().min(1).optional(),
    match_score: z.number().int().min(0).max(10_000).optional(),
    match_reasons: z.array(z.string().trim().min(1).max(120)).optional(),
    match_cautions: z.array(z.string().trim().min(1).max(120)).optional(),
  })
  .passthrough();

export interface ParseJobInput {
  slug: string;
  source: string;
  modifiedAt: Date;
  relatedDocuments: RelatedDocuments;
}

function dateToIsoDate(value: string | Date): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!isoDatePattern.test(trimmed)) return null;

  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed
    ? null
    : trimmed;
}

function extractFirstHeading(source: string): string | null {
  const match = source.match(/^#\s+(.+?)\s*$/m);
  return match?.[1]?.trim() || null;
}

function humanizeSlug(slug: string): string {
  const value = slug.replace(/[-_]+/g, " ").trim();
  return value || "회사 미상";
}

function contentWithoutFrontMatter(source: string): string {
  if (!source.startsWith("---")) return source;
  const closing = source.indexOf("\n---", 3);
  return closing === -1 ? source : source.slice(closing + 4).trimStart();
}

function normalizeStatus(value: string | undefined, warnings: string[]): JobStatus {
  if (!value) return "preparing";
  if ((JOB_STATUSES as readonly string[]).includes(value)) return value as JobStatus;

  warnings.push("알 수 없는 지원 상태를 ‘준비 중’으로 표시했습니다.");
  return "preparing";
}

function normalizeUrl(value: string | undefined, warnings: string[]): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    warnings.push("유효하지 않은 원문 링크를 숨겼습니다.");
    return null;
  }
}

function normalizeDate(
  value: string | Date | undefined,
  fieldLabel: string,
  warnings: string[],
): string | null {
  if (value === undefined) return null;
  const normalized = dateToIsoDate(value);
  if (!normalized) warnings.push(`${fieldLabel} 형식을 확인해 주세요.`);
  return normalized;
}

export function parseJobDocument(input: ParseJobInput): Job {
  const warnings: string[] = [];
  let data: unknown = {};
  let body = input.source;

  if (input.source.length > MAX_DOCUMENT_LENGTH) {
    throw new Error("DOCUMENT_TOO_LARGE");
  }

  try {
    const parsed = matter(input.source, {
      engines: {
        yaml: (frontMatter) => {
          const loaded = loadYaml(frontMatter, { schema: JSON_SCHEMA });
          return typeof loaded === "object" && loaded !== null ? loaded : {};
        },
      },
    });
    data = parsed.data;
    body = parsed.content;
  } catch {
    warnings.push("문서 머리말을 읽지 못해 기본 정보로 표시했습니다.");
    body = contentWithoutFrontMatter(input.source);
  }

  const validated = frontMatterSchema.safeParse(data);
  const metadata = validated.success ? validated.data : {};
  if (!validated.success) {
    warnings.push("일부 문서 정보를 읽지 못해 기본값을 사용했습니다.");
  }

  const heading = extractFirstHeading(body);
  const fallbackCompany = humanizeSlug(input.slug);
  const company = metadata.company ?? fallbackCompany;
  const position =
    metadata.position ??
    (heading?.startsWith(company) ? heading.slice(company.length).trim() : heading) ??
    "미지정 포지션";

  const deadline = normalizeDate(metadata.deadline, "마감일", warnings);
  const updatedAt =
    normalizeDate(metadata.updated_at, "수정일", warnings) ??
    input.modifiedAt.toISOString().slice(0, 10);

  return {
    slug: input.slug,
    company,
    position: position || "미지정 포지션",
    status: normalizeStatus(metadata.status, warnings),
    sourceUrl: normalizeUrl(metadata.source_url, warnings),
    deadline,
    updatedAt,
    tags: metadata.tags ?? [],
    // front matter에 근무지가 없는 기존 문서는 본문에서 한 번만 추출한다.
    location: metadata.location ?? detectRegion(body),
    body,
    relatedDocuments: input.relatedDocuments,
    warnings,
    origin: metadata.origin ?? "application",
    sourceName: metadata.source_name ?? null,
    matchScore: metadata.match_score ?? null,
    matchReasons: metadata.match_reasons ?? [],
    matchCautions: metadata.match_cautions ?? [],
  };
}
