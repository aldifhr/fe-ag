import { useState, useCallback, useEffect } from "react";
import { isFavorite, syncFavoritesFromApi, addFavoriteApi, removeFavoriteApi } from "@/lib/favorites";
import { showToast } from "@/lib/toast";

export function useFavoriteToggle(id: string, meta: { title: string; cover: string | null; source: string }) {
  const [fav, setFav] = useState(() => isFavorite(id));

  useEffect(() => {
    setFav(isFavorite(id));
  }, [id]);

  useEffect(() => {
    const handler = () => setFav(isFavorite(id));
    window.addEventListener("manhwa-favorites-change", handler);
    return () => window.removeEventListener("manhwa-favorites-change", handler);
  }, [id]);

  const toggle = useCallback(async () => {
    if (fav) {
      await removeFavoriteApi(id);
      setFav(false);
      showToast("Dihapus dari bookmark");
    } else {
      await addFavoriteApi({ id, ...meta });
      setFav(true);
      showToast("Ditambahkan ke bookmark");
    }
  }, [fav, id, meta]);

  return { fav, toggle };
}
