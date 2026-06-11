/**
 * Discord formatting utilities
 */

import {
  DISCORD_EMBED_TITLE_LIMIT,
} from "../config.js";

const STAR_FILLED = "\u2B50";
const STAR_EMPTY = "\u2606";

/**
 * Convert rating to star display (5-star scale)
 */
export const ratingStars = (rating: string | number | null | undefined): string => {
  if (!rating || rating === "N/A") return "`No rating`";
  const num = typeof rating === "number" ? rating : parseFloat(rating);
  if (Number.isNaN(num)) return "`No rating`";
  const filled = Math.min(5, Math.max(0, Math.round(num / 2)));
  const display = Number.isInteger(num) ? num : num.toFixed(1);
  return `${STAR_FILLED.repeat(filled) + STAR_EMPTY.repeat(5 - filled)
    } \`${display}/10\``;
};

/**
 * Truncate and clean HTML from synopsis
 */
export const shortSynopsis = (description: string | null | undefined): string | null => {
  if (!description) return null;
  const d = String(description).trim();
  if (d.toLowerCase() === "unknown" || d.toLowerCase() === "n/a") return null;
  const clean = d.replace(/<[^>]*>/g, "").trim();
  if (clean.length <= 220) return clean;
  const sub = clean.substring(0, 220);
  const lastSpace = sub.lastIndexOf(" ");
  return `${sub.substring(0, lastSpace > 160 ? lastSpace : 220).trim()}...`;
};

/**
 * Escape Discord mentions (@everyone, @here, <@...>) to prevent mention injection
 */
export const escapeDiscordMentions = (text: string): string => {
  return text
    .replace(/@everyone/g, "@\u200Beveryone")
    .replace(/@here/g, "@\u200Bhere")
    .replace(/<@&(\d+)>/g, "<@&\u200B$1>")
    .replace(/<@!?(\d+)>/g, "<@\u200B$1>")
    .replace(/<#(\d+)>/g, "<#\u200B$1>");
};

/**
 * Truncate title to Discord embed limit
 */
export const truncateTitle = (title: string, limit = DISCORD_EMBED_TITLE_LIMIT): string => {
  const escaped = escapeDiscordMentions(title);
  if (escaped.length <= limit) return escaped;
  return escaped.substring(0, limit - 3) + "...";
};

/**
 * Normalize chapter text for display
 */
export const normalizeChapterText = (chapter: string): string => {
  const raw = String(chapter || "Unknown").replace(/\s+/g, " ").trim();
  if (/^chapter\b/i.test(raw)) {
    return raw.replace(/^chapter\b\.?\s*/i, "Chapter ");
  }
  if (/^ch\b/i.test(raw)) {
    return raw.replace(/^ch\b\.?\s*/i, "Chapter ");
  }
  return `Chapter ${raw}`;
};
