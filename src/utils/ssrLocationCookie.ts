// The visitor's active location, mirrored into a cookie so the SERVER can seed
// its render with the same coordinates the client will use.
//
// Redux-persist keeps `city` in localStorage, which a server render cannot see.
// Without this mirror the server seeds from settings.default_city, hydration
// then swaps in the persisted city, every coordinate-keyed query key changes,
// and the seeded payload is thrown away for a full refetch — the page renders
// twice and flashes a skeleton in between.
//
// Strictly functional (it decides WHICH content is rendered, not analytics), so
// it is written regardless of the analytics cookie choice.
export const SSR_LOCATION_COOKIE = "ssr_loc";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SsrLocation {
  latitude: number;
  longitude: number;
}

const isFiniteCoord = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Parse the cookie's raw `lat,lng` value. Returns null for anything malformed. */
export const parseSsrLocation = (raw: string | undefined | null): SsrLocation | null => {
  if (!raw) return null;
  const [latRaw, lngRaw] = raw.split(",");
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!isFiniteCoord(latitude) || !isFiniteCoord(longitude)) return null;
  // Out-of-range values mean a corrupted cookie, not a real place.
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

/**
 * Mirror the given coordinates into the cookie. No-ops on the server and for
 * coordinates that aren't usable.
 */
export const writeSsrLocationCookie = (
  latitude: unknown,
  longitude: unknown,
): void => {
  if (typeof document === "undefined") return;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return;
  try {
    document.cookie = `${SSR_LOCATION_COOKIE}=${lat},${lng}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    /* cookies blocked — SSR just falls back to default_city as before */
  }
};
