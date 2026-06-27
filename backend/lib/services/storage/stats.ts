import { getLogger } from "../../../shared/logger.js";
import { supabase, withSupabaseTimeout } from "../../supabase.js";

const logger = getLogger({ scope: "storage" });

export async function supabasePing(): Promise<boolean> {
  try {
    const { error } = await withSupabaseTimeout(
      () => supabase.from("whitelist").select("count", { count: "exact", head: true }),
      5000,
    );
    if (error) throw error;
    logger.debug("[supabasePing] Heartbeat sent successfully");
    return true;
  } catch (err: unknown) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[supabasePing] Heartbeat failed",
    );
    return false;
  }
}
