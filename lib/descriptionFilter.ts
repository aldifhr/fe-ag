/**
 * Words/phrases to strip from manga descriptions.
 * Edit this list to add or remove filtered terms.
 * Case-insensitive matching. Wrap in word boundaries to avoid partial matches.
 */
const FILTERED_WORDS: string[] = [
  // Source names / watermarks
  "<p>",
  "</p>",
  // Add more as needed
];

// Pre-build regex once (case-insensitive, no word-boundary — <>/ are non-word chars)
const pattern = new RegExp(
  `(${FILTERED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "gi",
);

/** Strip filtered words from a description string */
export function cleanDescription(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(pattern, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
