import type { Request, Response } from "express";
import { handleLatest } from "../shared/reader-handlers/latest.js";
import { handleSearch } from "../shared/reader-handlers/search.js";
import { handleManga } from "../shared/reader-handlers/manga.js";
import { handlePages } from "../shared/reader-handlers/pages.js";
import { handlePopular, handleFilters, handleGenres, handleGenreManga, handleRandom, handleHealth, handleDebug } from "../shared/reader-handlers/misc.js";

// ponytail: Route dispatch stays here; individual handlers are in reader-handlers/.
// If this grows past ~20 routes, consider a registry pattern or express Router.

export default async function handler(req: Request, res: Response) {
  const route = (req.query.route as string) || "";

  try {
    switch (route) {
      case "latest":  return await handleLatest(req, res);
      case "search":  return await handleSearch(req, res);
      case "manga":   return await handleManga(req, res);
      case "pages":   return await handlePages(req, res);
      case "health":  return await handleHealth(req, res);
      case "debug":   return await handleDebug(req, res);
      case "popular":  return await handlePopular(req, res);
      case "filters":  return await handleFilters(req, res);
      case "genres":  return await handleGenres(req, res);
      case "genre-manga": return await handleGenreManga(req, res);
      case "random":  return await handleRandom(req, res);
      default:        return res.status(404).json({ error: `Unknown route: ${route}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
