import { normalizeTitleKey } from "../domain.js";
import { arrayUnion, arrayUnique } from "../utils.js";
import { getLogger } from "../logger.js";
import { NotifyMode } from "../types.js";
import { supabase } from "../supabase.js";

const logger = getLogger({ scope: "notifications" });

export { NotifyMode };

export const NOTIFY_MODES = {
  FOLLOWS: NotifyMode.FOLLOWS,
  ALL: NotifyMode.ALL,
  NONE: NotifyMode.NONE,
};

export async function getUserNotifyMode(userId: string): Promise<NotifyMode> {
  const { data } = await supabase.from("user_notify_settings").select("notify_mode").eq("user_id", userId).maybeSingle();
  return (data?.notify_mode as NotifyMode) || NotifyMode.FOLLOWS;
}

export async function setUserNotifyMode(userId: string, mode: NotifyMode): Promise<void> {
  if (!Object.values(NotifyMode).includes(mode)) {
    throw new Error(`Invalid notify mode: ${mode}`);
  }
  const { error } = await supabase.from("user_notify_settings").upsert(
    { user_id: userId, notify_mode: mode, settings_json: { notify_mode: mode } },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  if (mode === NotifyMode.ALL) {
    await supabase.from("user_all_mode").upsert({ user_id: userId }, { onConflict: "user_id" });
  } else {
    await supabase.from("user_all_mode").delete().eq("user_id", userId);
  }
}

export async function getUserFollowsMembers(userId: string): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase.from("user_follows").select("title_key").eq("user_id", userId);
  return (data || []).map((r) => r.title_key);
}

export async function isUserFollowing(userId: string, title: string): Promise<boolean> {
  const titleKey = normalizeTitleKey(title);
  if (!titleKey || !userId) return false;

  const follows = await getUserFollowsMembers(userId);
  return follows.includes(titleKey);
}

export async function followManga(userId: string, title: string): Promise<void> {
  if (!userId) return;
  const titleKey = normalizeTitleKey(title);
  if (!titleKey) return;
  try {
    await supabase.from("user_follows").upsert(
      { user_id: userId, title_key: titleKey },
      { onConflict: "user_id,title_key" },
    );
    supabase.rpc("increment_popularity", { key: titleKey, delta: 1 }).then(undefined, (err: any) => {
      logger.warn({ err: err instanceof Error ? err.message : String(err), titleKey }, "increment_popularity failed");
    });
  } catch (err: unknown) {
    logger.error({ error: err instanceof Error ? err.message : String(err), titleKey }, "followManga failed");
  }
}

export async function unfollowManga(userId: string, title: string): Promise<void> {
  if (!userId) return;
  const titleKey = normalizeTitleKey(title);
  if (!titleKey) return;
  try {
    await supabase.from("user_follows").delete().eq("user_id", userId).eq("title_key", titleKey);
    supabase.rpc("increment_popularity", { key: titleKey, delta: -1 }).then(undefined, (err: any) => {
      logger.warn({ err: err instanceof Error ? err.message : String(err), titleKey }, "increment_popularity failed");
    });
  } catch (err: unknown) {
    logger.error({ error: err instanceof Error ? err.message : String(err), titleKey }, "unfollowManga failed");
  }
}

export async function muteManga(userId: string, title: string): Promise<void> {
  if (!userId) return;
  const titleKey = normalizeTitleKey(title);
  if (!titleKey) return;
  try {
    await supabase.from("manga_mutes").upsert(
      { user_id: userId, title_key: titleKey },
      { onConflict: "user_id,title_key" },
    );
  } catch (err: unknown) {
    logger.error({ error: err instanceof Error ? err.message : String(err), titleKey }, "muteManga failed");
  }
}

export async function unmuteManga(userId: string, title: string): Promise<void> {
  if (!userId) return;
  const titleKey = normalizeTitleKey(title);
  if (!titleKey) return;
  try {
    await supabase.from("manga_mutes").delete().eq("user_id", userId).eq("title_key", titleKey);
  } catch (err: unknown) {
    logger.error({ error: err instanceof Error ? err.message : String(err), titleKey }, "unmuteManga failed");
  }
}

export async function getMangaSubscribers(title: string): Promise<string[]> {
  const titleKey = normalizeTitleKey(title);
  if (!titleKey) return [];

  try {
    const [followRows, allRows, muteRows] = await Promise.all([
      supabase.from("user_follows").select("user_id").eq("title_key", titleKey),
      supabase.from("user_all_mode").select("user_id"),
      supabase.from("manga_mutes").select("user_id").eq("title_key", titleKey),
    ]);

    const nativeSubs = (followRows.data || []).map((r) => r.user_id);
    const allModeUsers = (allRows.data || []).map((r) => r.user_id);
    const muteList = (muteRows.data || []).map((r) => r.user_id);

    const subscribers = arrayUnique(arrayUnion(nativeSubs, allModeUsers));
    const mutes = new Set(muteList);
    return subscribers.filter((uid) => !mutes.has(uid));
  } catch (err: unknown) {
    logger.error({ error: err instanceof Error ? err.message : String(err), titleKey }, "getMangaSubscribers failed");
    return [];
  }
}
