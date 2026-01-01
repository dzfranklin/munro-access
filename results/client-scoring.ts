import type { MinimalTargetItinerariesCache, MinimalRoute, ItineraryOption } from "./best-itineraries";
import type { RankingPreferences } from "./scoring";
import { scoreItineraryPair, calculatePercentiles } from "./scoring";
import type { Itinerary, Munro, Target } from "./schema";

/**
 * Recompute best itineraries for a target using minimal cached data
 * This allows client-side preference changes without full dataset
 */
export function recomputeBestItinerariesForTarget(
  targetId: string,
  minimalCache: Map<string, MinimalTargetItinerariesCache>,
  minimalRoutes: Map<string, MinimalRoute>,
  percentileMap: Map<number, number>,
  prefs: RankingPreferences,
  maxPerStartDay: number = 10
): ItineraryOption[] {
  const cached = minimalCache.get(targetId);
  const route = minimalRoutes.get(targetId);
  
  if (!cached || !route) {
    return [];
  }

  const options: ItineraryOption[] = [];

  // Rescore all cached options with new preferences
  for (const opt of cached.options) {
    const score = scoreItineraryPair(opt.outbound, opt.return, route, prefs);
    if (score) {
      options.push({
        startId: opt.startId,
        startName: opt.startId,
        day: opt.day,
        // Cast minimal back to full Itinerary for compatibility
        // (client doesn't render legs anyway, so this is safe)
        outbound: opt.outbound as unknown as Itinerary,
        return: opt.return as unknown as Itinerary,
        score: percentileMap.get(score.rawScore) ?? 0,
      });
    }
  }

  // Sort by percentile score
  options.sort((a, b) => b.score - a.score);

  // Limit options per start/day combination
  const limitedOptions: ItineraryOption[] = [];
  const countsByStartDay = new Map<string, number>();

  for (const option of options) {
    const key = `${option.startId}-${option.day}`;
    const count = countsByStartDay.get(key) || 0;
    if (count < maxPerStartDay) {
      limitedOptions.push(option);
      countsByStartDay.set(key, count + 1);
    }
  }

  return limitedOptions;
}

/**
 * Recompute global percentiles with custom preferences
 */
export function recomputePercentiles(
  minimalCache: Map<string, MinimalTargetItinerariesCache>,
  minimalRoutes: Map<string, MinimalRoute>,
  prefs: RankingPreferences
): Map<number, number> {
  const allScores: number[] = [];

  for (const [targetId, cached] of minimalCache.entries()) {
    const route = minimalRoutes.get(targetId);
    if (!route) continue;

    for (const opt of cached.options) {
      const score = scoreItineraryPair(opt.outbound, opt.return, route, prefs);
      if (score) {
        allScores.push(score.rawScore);
      }
    }
  }

  return calculatePercentiles(allScores);
}
