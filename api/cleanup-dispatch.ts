import type { Request, Response } from "express";
import { isCronAuthorized } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { logApiHit, logApiOk, logApiError, getLogger } from "../lib/logger.js";
import { createSuccessResponse, createErrorResponse } from "../lib/api/response.js";

const logger = getLogger({ scope: "api:cleanup-dispatch" });

export default async function handler(req: Request, res: Response) {
  const reqLogger = logApiHit("cleanup-dispatch", req);

  if (req.method !== "POST") {
    logApiOk(reqLogger, { status: 405, reason: "method_not_allowed" });
    return res.status(405).json(createErrorResponse("METHOD_NOT_ALLOWED", "Method not allowed"));
  }

  if (!await isCronAuthorized(req)) {
    logApiOk(reqLogger, { status: 401, reason: "unauthorized" });
    return res.status(401).json(createErrorResponse("UNAUTHORIZED", "Unauthorized"));
  }

  try {
    const { error } = await supabase
      .from("dispatch_claims")
      .delete()
      .lt("created_at", new Date(Date.now() - 2 * 86400000).toISOString());

    if (error) throw error;

    logApiOk(reqLogger, { status: 200 });
    return res.status(200).json(createSuccessResponse({ ok: true, message: "Old dispatch claims cleaned up" }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "Failed to cleanup old dispatch claims");
    logApiError(reqLogger, err, { status: 500 });
    return res.status(500).json(createErrorResponse("CLEANUP_FAILED", msg));
  }
}
