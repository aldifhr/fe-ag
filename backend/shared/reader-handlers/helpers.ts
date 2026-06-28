/**
 * Pick the best cover URL from a row object, trying multiple field names.
 * Consolidates the duplicated cover extraction chain across reader-handlers.
 */
export function pickCover(row: Record<string, any>): string | null {
  return row.cover_portrait_url || row.cover_image_url || row.cover || row.image || null;
}

/**
 * Pick the best updated time from a row object.
 */
export function pickTime(row: Record<string, any>): string | undefined {
  return row.latest_chapter_time || row.updated_at || row.time || undefined;
}
