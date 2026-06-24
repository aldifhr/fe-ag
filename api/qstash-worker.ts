import type { Request, Response } from "express";
import { Receiver } from "@upstash/qstash";
import { supabase } from "../lib/supabase.js";
import { sendDiscordEmbedsChannelBatch } from "../lib/discord.js";
import { getLogger } from "../lib/logger.js";
import { QStashNotificationTask, isQStashEnabled } from "../lib/services/qstash.js";
import { mangaProviderRegistry } from "../lib/providers/registry.js";
import { setMangaMetadata, recordDispatchToSupabase } from "../lib/services/storage.js";
import { isMetadataEmpty } from "../lib/services/metadata-enrichment.js";
import { normalizeSource } from "../lib/scrapers/shared.js";
import { MangaMetadata } from "../lib/types.js";
import { getChapterNumber } from "../lib/domain.js";
import {
  QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY,
} from "../lib/config.js";

const logger = getLogger({ scope: "qstash-worker" });

export const config = { api: { bodyParser: true } };

const receiver = new Receiver({
  currentSigningKey: QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: QSTASH_NEXT_SIGNING_KEY || "",
});

export default async function handler(req: Request, res: Response) {
  // Skip QStash verification in development mode (NODE_ENV defaults to "development" if unset)
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  if (!isDev) {
    const qstashSignature = req.headers["upstash-signature"] as string | undefined;

    if (!qstashSignature) {
      logger.warn("No QStash signature provided");
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No QStash signature" } });
    }

    try {
      const isValid = await receiver.verify({
        signature: qstashSignature,
        body: JSON.stringify(req.body),
      });

      if (!isValid) {
        logger.warn("Invalid QStash signature");
        return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid QStash signature" } });
      }
    } catch (err) {
      logger.error({ err }, "Signature verification error");
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Signature verification failed" } });
    }
  }

  try {
    const task = req.body as QStashNotificationTask;

    if (!task || !task.chapter || !task.channelIds) {
      logger.warn({ task }, "Invalid task payload");
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Deduplicate channel IDs for this task
    const uniqueChannelIds = [...new Set(task.channelIds)];
    if (uniqueChannelIds.length < task.channelIds.length) {
      logger.info({
        chapter: task.chapter.title,
        original: task.channelIds.length,
        unique: uniqueChannelIds.length
      }, "Deduplicated channel IDs in worker");
    }

    // Safety check: skip if already sent (handles QStash retries)
    const keysToCheck = [task.chapter.key, task.chapter.duplicateKey].filter(Boolean) as string[];
    if (keysToCheck.length > 0) {
      let alreadySent = false;
      let reason = "already_sent";

      try {
        const { data, error } = await supabase
          .from("dispatch_history")
          .select("chapter_url")
          .in("chapter_url", keysToCheck);
        
        if (!error && data && data.length > 0) {
          alreadySent = true;
          const sentUrls = data.map(d => d.chapter_url);
          reason = sentUrls.includes(task.chapter.key || "") ? "already_sent" : "cross_source_duplicate";
        }
      } catch (err) {
        logger.error({ err }, "Supabase error in safety check");
      }

      if (alreadySent) {
        logger.info({ chapter: task.chapter.title, reason }, "Skipping notification (safety check)");
        return res.status(200).json({ success: true, reason });
      }
    }

    logger.info({ 
      chapter: task.chapter.title, 
      channels: task.channelIds.length 
    }, "Processing QStash notification");

    // 1. ASYNC METADATA ENRICHMENT (New)
    // If chapter is missing metadata, try to fetch it now before sending
    const currentDescription = (task.chapter as any).description;
    const isMissingDesc = !currentDescription || 
                         currentDescription.toLowerCase() === "unknown" || 
                         currentDescription.toLowerCase() === "n/a" ||
                         currentDescription.length < 10;
                         
    if (!task.chapter.cover || isMissingDesc) {
      const source = normalizeSource(task.chapter.source);
      const titleKey = task.chapter.titleKey;
      const mangaUrl = task.chapter.mangaUrl;

      if (source && titleKey && mangaUrl) {
        try {
          const provider = mangaProviderRegistry.getProvider(source);
          if (provider && provider.fetchMetadata) {
            logger.info({ titleKey, source }, "Worker: Fetching missing metadata");
            const meta = await provider.fetchMetadata(mangaUrl, null);
            
            if (meta && !isMetadataEmpty(meta as any)) {
              // Update task object so the embed uses the new data
              task.chapter.cover = meta.cover || task.chapter.cover;
              (task.chapter as any).description = meta.description;
              (task.chapter as any).rating = meta.rating || (task.chapter as any).rating;
              (task.chapter as any).genres = meta.genres || (task.chapter as any).genres;
              (task.chapter as any).status = meta.status || (task.chapter as any).status;
              
              // Cache for future use
              await setMangaMetadata(null as any, titleKey, meta as MangaMetadata);
              logger.info({ titleKey }, "Worker: Metadata enriched and cached");
            }
          }
        } catch (err) {
          logger.warn({ err: (err as Error).message, titleKey }, "Worker: Metadata fetch failed, sending basic notification");
        }
      }
    }

    // Send to all channels
    let successCount = 0;
    let failCount = 0;

    for (const channelId of uniqueChannelIds) {
      try {
        await sendDiscordEmbedsChannelBatch(
          [task.chapter as any],
          channelId,
          null,
          task.mentions?.join(" ")
        );
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ channelId, err: message }, "Failed to send to channel");
        failCount++;
      }
    }

    // Mark as SENT in Supabase
    if (successCount > 0 && task.chapter.key) {
      try {
        const chapterUrl = task.chapter.key.startsWith("chapter:") ? task.chapter.key.slice("chapter:".length) : task.chapter.key;
        const dupUrl = task.chapter.duplicateKey
          ? (task.chapter.duplicateKey.startsWith("chapter:") ? task.chapter.duplicateKey.slice("chapter:".length) : task.chapter.duplicateKey)
          : "";

        // Mark claim as sent
        await supabase.rpc("complete_dispatch_claim", { 
          p_chapter_url: chapterUrl, 
          p_duplicate_url: dupUrl || "" 
        });

        // Update title last chapter
        const chapterNum = getChapterNumber(task.chapter.chapter);
        if (chapterNum && task.chapter.titleKey) {
          try {
            await supabase.rpc("upsert_title_last_chapter", {
              p_title_key: task.chapter.titleKey,
              p_chapter_number: chapterNum,
            });
          } catch (_) {}
        }
        
        logger.info({ chapter: task.chapter.title }, "Marked as sent in Supabase");
        
        // Record to dispatch_history
        const titleKey = task.chapter.titleKey || "";
        if (titleKey) {
          recordDispatchToSupabase(task.chapter as any, titleKey).catch(() => {});
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message, chapter: task.chapter.title }, "Failed to mark as sent in Supabase");
      }
    }

    logger.info({ 
      chapter: task.chapter.title,
      success: successCount,
      failed: failCount 
    }, "Notification processed");

    return res.status(200).json({ 
      success: true, 
      sent: successCount,
      failed: failCount 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "Worker error");
    // Return 200 to prevent QStash retry on parsing errors
    return res.status(200).json({ error: "Processed with errors" });
  }
}

// Health check endpoint for the worker
export async function workerHealth(req: Request, res: Response) {
  return res.status(200).json({
    status: "healthy",
    qstashEnabled: isQStashEnabled(),
    timestamp: new Date().toISOString(),
  });
}