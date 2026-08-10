import type { JobListItem } from "./types";

export function formatKoreanDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function todayIsoDate(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function getUpcomingJobs(
  jobs: JobListItem[],
  limit = 5,
  today = todayIsoDate(),
): JobListItem[] {
  return jobs
    .filter((job) => job.deadline !== null && job.deadline >= today)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
    .slice(0, limit);
}

export function getDeadlineLabel(deadline: string | null, today = todayIsoDate()): string {
  if (deadline === null) return "마감일 미정";

  const start = new Date(`${today}T00:00:00+09:00`).getTime();
  const end = new Date(`${deadline}T00:00:00+09:00`).getTime();
  const days = Math.round((end - start) / 86_400_000);

  if (days === 0) return "오늘 마감";
  if (days > 0) return `D-${days}`;
  return `마감 ${Math.abs(days)}일 지남`;
}
