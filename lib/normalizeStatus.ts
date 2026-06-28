export function normalizeStatus(status: string | number | null | undefined): { label: string; color: string } | null {
  if (status == null) return null;
  if (typeof status === "number") {
    if (status === 1) return { label: "Ongoing", color: "var(--color-accent)" };
    if (status === 2) return { label: "Completed", color: "var(--color-success, #22c55e)" };
    if (status === 3) return { label: "Hiatus", color: "var(--color-warning, #f59e0b)" };
    return { label: `Status ${status}`, color: "var(--color-text-secondary)" };
  }
  const s = String(status).toLowerCase();
  if (s === "ongoing" || s === "1") return { label: "Ongoing", color: "var(--color-accent)" };
  if (s === "completed" || s === "2") return { label: "Completed", color: "var(--color-success, #22c55e)" };
  if (s === "hiatus" || s === "3") return { label: "Hiatus", color: "var(--color-warning, #f59e0b)" };
  if (s === "cancelled") return { label: "Cancelled", color: "var(--color-error, #ef4444)" };
  return { label: String(status), color: "var(--color-text-secondary)" };
}
