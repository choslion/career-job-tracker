import { STATUS_LABELS, type JobStatus } from "@/lib/jobs/types";

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
