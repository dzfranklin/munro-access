import {
  DEFAULT_PREFERENCES,
  userPreferencesSchema,
  type UserPreferences,
} from "results/scoring";

export function parsePreferencesFromCookie(
  cookieHeader: string | null
): UserPreferences {
  if (!cookieHeader) {
    return DEFAULT_PREFERENCES;
  }

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...v] = c.trim().split("=");
      return [key, decodeURIComponent(v.join("="))];
    })
  );

  const prefsCookie = cookies["munro-access-preferences"];
  if (!prefsCookie) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(prefsCookie);
    const validated = userPreferencesSchema.parse({
      ranking: { ...DEFAULT_PREFERENCES.ranking, ...parsed.ranking },
      ui: { ...DEFAULT_PREFERENCES.ui, ...parsed.ui },
    });
    return validated;
  } catch (error) {
    console.warn("Invalid preferences in cookie, using defaults:", error);
    return DEFAULT_PREFERENCES;
  }
}

export function createPreferencesCookie(preferences: UserPreferences): string {
  const prefsJson = JSON.stringify(preferences);
  return `munro-access-preferences=${encodeURIComponent(prefsJson)}; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}
