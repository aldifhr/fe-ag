import { SearchResult, proxyCover } from "@/lib/api";

type Props = {
  query: string;
  setQuery: (v: string) => void;
  handleEnter: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setInputFocused: (v: boolean) => void;
  setShowSuggestions: (v: boolean) => void; // ponytail: added for onBlur; merge into inputFocused if refactored to single focus state
  shouldShowSuggestions: boolean;
  suggestions: SearchResult[];
  handleSuggestionClick: (item: SearchResult) => void;
  loading: boolean;
};

export default function SearchInput({
  query,
  setQuery,
  handleEnter,
  inputRef,
  setInputFocused,
  setShowSuggestions,
  shouldShowSuggestions,
  suggestions,
  handleSuggestionClick,
  loading,
}: Props) {
  return (
    <>
      {/* Search header */}
      <h1 className="text-xl font-semibold tracking-tight">Cari Manhwa</h1>

      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-(--color-text-muted) pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleEnter}
          onFocus={() => setInputFocused(true)}
          onBlur={() =>
            setTimeout(() => {
              setInputFocused(false);
              setShowSuggestions(false);
            }, 150)
          }
          placeholder="Cari judul manhwa..."
          autoFocus
          className="w-full pl-12 pr-10 py-3 rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text) text-[15px] outline-none placeholder:text-(--color-text-muted) focus:border-(--color-accent) transition-colors duration-150"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-(--color-text-muted) hover:text-(--color-text) transition-colors duration-150"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        {/* Autocomplete suggestions */}
        {shouldShowSuggestions && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-(--color-surface) border border-(--color-border) rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((item, i) => (
              <button
                key={`${item.source}-${item.id}-${i}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(item)}
                className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-(--color-surface-hover) cursor-pointer text-left"
              >
                {item.cover ? (
                  <img
                    src={proxyCover(item.cover)}
                    alt={item.title}
                    className="w-6 h-8 rounded object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-6 h-8 rounded bg-(--color-border) shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-(--color-text) truncate">
                    {item.title}
                  </p>
                  {item.chapter && (
                    <span className="text-[11px] text-(--color-text-muted)">
                      Ch. {item.chapter}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
