import type { Page } from "@playwright/test";
import { DEFAULT_PREFERENCES, type UserPreferences, type RankingPreferences, type UIPreferences } from "results/scoring";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export async function setPreferences(
  page: Page,
  preferences: DeepPartial<UserPreferences>
) {
  const mergedPreferences: UserPreferences = {
    ranking: {
      ...DEFAULT_PREFERENCES.ranking,
      ...(preferences.ranking || {}),
      weights: {
        ...DEFAULT_PREFERENCES.ranking.weights,
        ...(preferences.ranking?.weights || {}),
      },
    },
    ui: {
      ...DEFAULT_PREFERENCES.ui,
      ...(preferences.ui || {}),
    },
  };

  const prefsJson = JSON.stringify(mergedPreferences);
  const encodedPrefs = encodeURIComponent(prefsJson);

  await page.context().addCookies([
    {
      name: "munro-access-preferences",
      value: encodedPrefs,
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}
