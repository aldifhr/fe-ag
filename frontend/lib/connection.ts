export async function checkConnection(): Promise<{ backend: boolean; shinigami: boolean }> {
  try {
    const res = await fetch("/api/reader?route=health", { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return { backend: true, shinigami: data.shinigami === "ok" };
  } catch {
    return { backend: false, shinigami: false };
  }
}
