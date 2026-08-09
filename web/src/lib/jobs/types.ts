export const JOB_STATUSES = [
  "interested",
  "preparing",
  "applied",
  "document_pass",
  "interview",
  "offer",
  "rejected",
  "hold",
  "closed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobOrigin = "application" | "discovered";

export const STATUS_LABELS: Record<JobStatus, string> = {
  interested: "관심",
  preparing: "준비 중",
  applied: "지원 완료",
  document_pass: "서류 합격",
  interview: "면접 진행",
  offer: "제안 검토",
  rejected: "종료·불합격",
  hold: "보류",
  closed: "공고 마감",
};

export const RELATED_DOCUMENTS = {
  analysis: { fileName: "analysis.md", label: "공고 분석" },
  coverLetter: { fileName: "cover-letter.md", label: "자기소개서" },
  careerDescription: { fileName: "career-description.md", label: "경력기술서" },
  interview: { fileName: "interview.md", label: "면접 준비" },
} as const;

export type RelatedDocumentKey = keyof typeof RELATED_DOCUMENTS;
export type RelatedDocuments = Record<RelatedDocumentKey, boolean>;

export interface Job {
  slug: string;
  company: string;
  position: string;
  status: JobStatus;
  sourceUrl: string | null;
  deadline: string | null;
  updatedAt: string;
  tags: string[];
  body: string;
  relatedDocuments: RelatedDocuments;
  warnings: string[];
  origin: JobOrigin;
  sourceName: string | null;
  matchScore: number | null;
  matchReasons: string[];
  matchCautions: string[];
}

export type RepositoryState = "ready" | "not-configured" | "missing" | "empty";

export interface JobsResult {
  state: RepositoryState;
  jobs: Job[];
  skippedCount: number;
}
