export function readLS<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored && (valid as readonly string[]).includes(stored)) return stored as T;
  } catch {}
  return fallback;
}
