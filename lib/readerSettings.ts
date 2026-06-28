export interface ReaderSettings {
  bgColor: "default" | "dark" | "sepia" | "white";
  brightness: number;
  nightMode: boolean;
}

export async function syncReaderSettingsFromApi(): Promise<void> {
  try {
    const res = await fetch("/api/user-preferences/settings");
    if (!res.ok) throw new Error("API unavailable");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    const data = json.data;
    if (!data) return;
    if (data.bgColor) localStorage.setItem("manhwa-reader-bg", data.bgColor);
    if (data.brightness != null)
      localStorage.setItem("manhwa-reader-brightness", String(data.brightness));
    if (data.nightMode != null)
      localStorage.setItem("manhwa-night-mode", String(data.nightMode));
  } catch {
    /* fallback to localStorage */
  }
}

export async function saveReaderSettingsApi(
  settings: Partial<ReaderSettings>,
): Promise<void> {
  try {
    await fetch("/api/user-preferences/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch {
    /* local already saved */
  }
}
