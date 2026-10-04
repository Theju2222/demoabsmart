import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";

// Fetches the FULL category tree (no slug/id param -> every top-level
// category with its nested cat_active_childs, each carrying id+slug) once
// per session and caches it — used to resolve category slugs <-> ids for the
// URL (see src/utils/categorySlugResolver.js). Same cache window as the
// existing per-category childCategories query in ProductsList.jsx.
const CATEGORY_TREE_CACHE_MS = Infinity;

interface UseFullCategoryTreeOptions {
  latitude?: number | string;
  longitude?: number | string;
  languageId?: number | string;
}

export default function useFullCategoryTree({
  latitude,
  longitude,
  languageId,
}: UseFullCategoryTreeOptions = {}) {
  // latitude/longitude/languageId each settle through more than one value
  // while zone/language resolution completes (see Header.jsx's fetchCity and
  // Layout.jsx's fetchLanguage) — debounce so the query key change collapses
  // to the final values instead of fetching once per intermediate one.
  const [debounced, setDebounced] = useState({ latitude, longitude, languageId });
  useEffect(() => {
    const id = setTimeout(
      () => setDebounced({ latitude, longitude, languageId }),
      300,
    );
    return () => clearTimeout(id);
  }, [latitude, longitude, languageId]);

  const queryClient = useQueryClient();
  // Coords normalised to numbers: callers read them from different places
  // (SSR seed vs redux city), and "23.24" vs 23.24 would otherwise split the
  // cache into two keys and fetch the same tree twice.
  const queryKey = [
    "fullCategoryTree",
    debounced.languageId,
    debounced.latitude == null ? null : Number(debounced.latitude),
    debounced.longitude == null ? null : Number(debounced.longitude),
  ];
  const queryFn = async () => {
    const res: any = await api.getCategories({
      latitude: debounced.latitude,
      longitude: debounced.longitude,
    });
    return Array.isArray(res?.data) ? res.data : [];
  };

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: debounced.latitude != null && debounced.longitude != null,
    // Categories barely change within a visit — fetch once per session per
    // location/language, then serve every page (header, footer, filters,
    // products) from cache instead of refetching on each mount.
    staleTime: CATEGORY_TREE_CACHE_MS,
    gcTime: CATEGORY_TREE_CACHE_MS,
  });

  // For callers that need the tree at a specific moment (e.g. a click handler
  // resolving a category id to its slug) rather than reactively — awaits the
  // in-flight/cached query instead of racing it. Resolves to [] if location
  // isn't known yet (same guard as `enabled` above).
  const resolveCategoryTree = async (): Promise<any[]> => {
    if (debounced.latitude == null || debounced.longitude == null) return [];
    return queryClient.fetchQuery({
      queryKey,
      queryFn,
      staleTime: CATEGORY_TREE_CACHE_MS,
    });
  };

  return { ...query, resolveCategoryTree };
}
