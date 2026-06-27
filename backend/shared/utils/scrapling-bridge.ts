import axios from "axios";
import { getLogger } from "../logger.js";
import { env } from "../config/env.js";

const logger = getLogger({ scope: "scrapling-bridge" });

export interface ScraplingOptions {
  action: "latest" | "expand" | "search" | "metadata";
  url?: string;
  query?: string;
  baseUrl?: string;
  maxPages?: number;
  skipMeta?: boolean;
}

interface ScraplingResponse<T> {
  data: T;
  _cookies?: Record<string, string>;
}

/**
 * Bridge to execute Python Scrapling scraper via HTTP (Vercel compatible)
 * Cookie persistence via Supabase (Redis removed).
 */
export async function runScrapling<T>(options: ScraplingOptions): Promise<T> {
  // Determine API base URL
  let apiBase = "http://localhost:3000";
  
  if (env.BASE_URL) {
    apiBase = env.BASE_URL;
  } else if (process.env.VERCEL_URL) {
    apiBase = `https://${process.env.VERCEL_URL}`;
  } else if (env.APP_URL) {
    apiBase = env.APP_URL;
  }

  
  const isIkiru = options.baseUrl?.includes("ikiru") || (!options.baseUrl && (options.url?.includes("ikiru") || options.action === "latest"));
  const existingCookies: string | null = null; // dead code: never populated; Python scraper has full cookie support if needed later

  const isLocal = process.env.NODE_ENV === "development" || !process.env.VERCEL;

  if (isLocal) {
    const cp = "child_process";
    const { spawnSync } = await import(cp);
    const args = [
      "api/scrapling_bridge.py",
      "--action", options.action,
      "--baseUrl", options.baseUrl || "https://03.ikiru.wtf",
      "--maxPages", String(options.maxPages || 1)
    ];
    if (options.url) args.push("--url", options.url);
    if (options.query) args.push("--query", options.query);
    if (options.skipMeta) args.push("--skipMeta");
    if (existingCookies) {
      const cookieStr = typeof existingCookies === "string" ? existingCookies : JSON.stringify(existingCookies);
      args.push("--cookies", cookieStr);
    }
    
    if (isIkiru) {
      if (env.IKIRU_EMAIL) args.push("--username", env.IKIRU_EMAIL);
      if (env.IKIRU_PASSWORD) args.push("--password", env.IKIRU_PASSWORD);
    }

    logger.info({ action: options.action, args: args.map(a => a.length > 100 ? a.substring(0, 50) + "..." : a) }, "Executing local Python scraper");
    
    const result = spawnSync("python", args, { encoding: "utf-8" });
    
    if (result.error) {
      logger.error({ err: result.error.message }, "Local Python scraper execution error");
      throw new Error(`Failed to run local python scraper: ${result.error.message}`);
    }
    
    try {
      const output = result.stdout.trim();
      const stderr = result.stderr.trim();
      
      if (stderr) {
        logger.warn({ stderr }, "Python scraper stderr output");
      }
      
      if (!output) {
        logger.warn("Python scraper returned empty stdout");
        return [] as unknown as T;
      }
      
      const parsed = JSON.parse(output) as ScraplingResponse<T>;
      
      
      
      return parsed.data;
    } catch (err) {
      logger.error({ stdout: result.stdout, stderr: result.stderr }, "Failed to parse local python output");
      throw new Error("Failed to parse local python output");
    }
  }

  const apiUrl = `${apiBase.replace(/\/$/, "")}/api/scrapling_bridge`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${env.CRON_SECRET}`,
  };

  if (env.VERCEL_PROTECTION_BYPASS) {
    headers["x-vercel-protection-bypass"] = env.VERCEL_PROTECTION_BYPASS;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }

  const params: Record<string, any> = { ...options };
  if (existingCookies) params.cookies = existingCookies;
  if (env.VERCEL_PROTECTION_BYPASS) {
    params["x-vercel-protection-bypass"] = env.VERCEL_PROTECTION_BYPASS;
  }

  logger.info({ action: options.action, url: options.url, apiUrl }, "Calling Scrapling API");

  try {
    const response = await axios.get(apiUrl, {
      params,
      timeout: 60000,
      headers
    });

    const parsed = response.data as ScraplingResponse<T>;
    
    
    
    return parsed.data;
  } catch (err: unknown) {
    const axiosErr = err as Record<string, unknown> | undefined;
    const response = axiosErr?.response as Record<string, unknown> | undefined;
    const message = response?.data || (err instanceof Error ? err.message : String(err));
    logger.error({ action: options.action, err: message }, "Scrapling API failed");
    throw new Error(`Scrapling API failed: ${message}`);
  }
}
