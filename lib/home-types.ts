export type SortOption = "latest" | "popularity" | "rating" | "az";
export type SourceOption = "all" | "shinigami" | "ikiru";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "latest", label: "Terbaru" },
  { value: "popularity", label: "Populer" },
  { value: "rating", label: "Rating" },
  { value: "az", label: "A-Z" },
];

export const SOURCE_OPTIONS: { value: SourceOption; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "shinigami", label: "Shinigami" },
  { value: "ikiru", label: "Ikiru" },
];
