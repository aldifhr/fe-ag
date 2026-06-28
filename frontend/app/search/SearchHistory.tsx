import { clearSearchHistory } from "@/lib/searchHistory";

type Props = {
  showHistory: boolean;
  searchHistory: string[];
  setSearchHistory: (v: string[]) => void;
  handleHistoryClick: (q: string) => void;
};

export default function SearchHistory({
  showHistory,
  searchHistory,
  setSearchHistory,
  handleHistoryClick,
}: Props) {
  if (!showHistory) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-(--color-text-muted)">
          Pencarian terakhir
        </span>
        <button
          onClick={() => {
            clearSearchHistory();
            setSearchHistory([]);
          }}
          className="text-[12px] text-(--color-text-muted) hover:text-(--color-danger) transition-colors"
        >
          Hapus riwayat
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {searchHistory.map((q, i) => (
          <button
            key={`${q}-${i}`}
            onClick={() => handleHistoryClick(q)}
            className="px-3 py-1 text-[13px] rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-border-hover) hover:text-(--color-text) transition-colors duration-150"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
