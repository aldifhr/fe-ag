const STATUS_OPTIONS = [
  { label: "Semua", value: "" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
  { label: "Hiatus", value: "hiatus" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const SORT_OPTIONS = [
  { label: "Terbaru", value: "" },
  { label: "Populer", value: "popularity" },
  { label: "Rating", value: "rating" },
  { label: "A-Z", value: "az" },
] as const;

// ponytail: STATUS_OPTIONS/SORT_OPTIONS duplicated from page.tsx; extract to shared constants file if reused elsewhere

type Props = {
  sortFilter: string;
  setSortFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  hasSearched: boolean;
};

export default function SearchFilters({
  sortFilter,
  setSortFilter,
  statusFilter,
  setStatusFilter,
  hasSearched,
}: Props) {
  if (!hasSearched) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={`sort-${opt.value}`}
            onClick={() => setSortFilter(opt.value)}
            className={`px-3 py-1 text-[13px] rounded-full transition-colors duration-150 ${
              sortFilter === opt.value
                ? "bg-(--color-accent) text-white"
                : "bg-(--color-surface) text-(--color-text-muted) border border-(--color-border)"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="w-px h-5 self-center bg-(--color-border)" />
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={`status-${opt.value}`}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 text-[13px] rounded-full transition-colors duration-150 ${
              statusFilter === opt.value
                ? "bg-(--color-accent) text-white"
                : "bg-(--color-surface) text-(--color-text-muted) border border-(--color-border)"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
