import { useState, useCallback } from "react";
import { isFavorite, addFavorite, removeFavorite } from "@/lib/favorites";
import { showToast } from "@/lib/toast";

export function useFavoriteToggle(id: string, meta: { title: string; cover: string | null; source: string }) {
  const [fav, setFav] = useState(() => isFavorite(id));

  const toggle = useCallback(() => {
    if (fav) {
      removeFavorite(id);
      setFav(false);
      showToast("Dihapus dari bookmark");
    } else {
      addFavorite({ id, ...meta });
      setFav(true);
      showToast("Ditambahkan ke bookmark");
    }
  }, [fav, id, meta]);

  return { fav, toggle };
}
