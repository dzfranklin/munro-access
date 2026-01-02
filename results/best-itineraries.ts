import { selectBestItineraries, calculatePercentiles, scoreItineraryPair, DEFAULT_RANKING_PREFERENCES, type RankingPreferences } from "./scoring";
import type { Itinerary, Route, Munro, Target, Result } from "./schema";

export interface ItineraryOption {
  startId: string;
  startName: string;
  day: string;
  outbound: Itinerary;
  return: Itinerary;
  score: number;
}

export interface TargetWithBestItineraries {
  targetId: string;
  targetName: string;
  targetDescription: string;
  routes: Array<{
    route: Route;
    munros: Munro[];
  }>;
  bestOptions: ItineraryOption[];
  displayOptions?: ItineraryOption[];
}

/**
 * Select the single best itinerary option for each unique day
 * Prioritizes weekends (Saturday, Sunday) over weekdays
 */
function selectDiverseOptions(
  allOptions: ItineraryOption[],
  maxOptions: number = 3
): ItineraryOption[] {
  const dayPriority = ["SATURDAY", "SUNDAY", "WEDNESDAY", "FRIDAY"];
  const bestByDay = new Map<string, ItineraryOption>();

  // For each option, keep only the best scoring one per day
  for (const option of allOptions) {
    const existing = bestByDay.get(option.day);
    if (!existing || option.score > existing.score) {
      bestByDay.set(option.day, option);
    }
  }

  // Convert to array and sort by priority (weekends first)
  const displayOptions = Array.from(bestByDay.values()).sort((a, b) => {
    const indexA = dayPriority.indexOf(a.day);
    const indexB = dayPriority.indexOf(b.day);
    return indexA - indexB;
  });

  return displayOptions.slice(0, maxOptions);
}

/**
 * Get best itineraries for a specific target (trailhead)
 * This computes transport options once per target, since all routes from
 * the same target share the same access point.
 * 
 * @param maxPerStartDay - Maximum number of options to return per start/day combination (default: 10)
 * @param globalPercentiles - Pre-calculated global percentile map (optional, will calculate if not provided)
 * @param cachedItineraries - Pre-computed itinerary cache (optional, for performance optimization)
 */
export function getBestItinerariesForTarget(
  targetId: string,
  resultMap: Map<string, Result>,
  targetMap: Map<string, Target>,
  munroMap: Map<number, Munro>,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES,
  maxPerStartDay: number = 10,
  globalPercentiles?: Map<number, number>,
  cachedItineraries?: Map<string, TargetItinerariesCache>
): TargetWithBestItineraries | null {
  const target = targetMap.get(targetId);
  if (!target) return null;

  // Use cached itineraries if available and preferences match defaults
  const usingDefaults = Object.keys(DEFAULT_RANKING_PREFERENCES).every(
    (key) => prefs[key as keyof typeof prefs] === DEFAULT_RANKING_PREFERENCES[key as keyof typeof DEFAULT_RANKING_PREFERENCES]
  );

  let bestOptions: ItineraryOption[];
  let percentileMap: Map<number, number>;

  if (usingDefaults && cachedItineraries && globalPercentiles) {
    // Fast path: use pre-computed cache
    const cached = cachedItineraries.get(targetId);
    if (!cached) {
      return null;
    }

    percentileMap = globalPercentiles;
    bestOptions = cached.options.map(opt => ({
      startId: opt.startId,
      startName: opt.startId,
      day: opt.day,
      outbound: opt.outbound,
      return: opt.return,
      score: percentileMap.get(opt.rawScore) ?? 0,
    }));
  } else {
    // Slow path: compute from scratch (for custom preferences)
    bestOptions = [];

    // Check itineraries from all start cities
    for (const result of resultMap.values()) {
      if (result.target !== targetId) continue;

      // Check each day of the week
      for (const [day, dayItineraries] of Object.entries(result.itineraries)) {
        const { outbounds, returns } = dayItineraries;

        if (outbounds.length === 0 || returns.length === 0) continue;

        // Try each route and find best scores for each itinerary pair
        const pairScores = new Map<string, { outbound: Itinerary; return: Itinerary; bestScore: number; viableRouteCount: number }>();

        for (const route of target.routes) {
          const viable = selectBestItineraries(
            outbounds,
            returns,
            route,
            prefs,
            Infinity
          );

          for (const { outbound, return: returnItin, score } of viable) {
            const pairKey = `${outbound.startTime}-${returnItin.startTime}`;
            const existing = pairScores.get(pairKey);

            if (!existing) {
              pairScores.set(pairKey, {
                outbound,
                return: returnItin,
                bestScore: score.rawScore,
                viableRouteCount: 1,
              });
            } else {
              // Keep best score, but count all viable routes
              if (score.rawScore > existing.bestScore) {
                existing.bestScore = score.rawScore;
              }
              existing.viableRouteCount++;
            }
          }
        }

        // Add pairs with route flexibility boost
        for (const pair of pairScores.values()) {
          // Apply boost: 2% per additional viable route beyond the first
          const routeBoost = 1 + (pair.viableRouteCount - 1) * 0.02;
          const boostedScore = pair.bestScore * routeBoost;

          bestOptions.push({
            startId: result.start,
            startName: result.start,
            day,
            outbound: pair.outbound,
            return: pair.return,
            score: boostedScore,
          });
        }
      }
    }

    // Sort by score (best first)
    bestOptions.sort((a, b) => b.score - a.score);

    // Calculate percentiles if not provided, then apply them
    percentileMap = globalPercentiles ?? calculateGlobalPercentiles(resultMap, targetMap, prefs);
    for (const option of bestOptions) {
      const percentile = percentileMap.get(option.score) ?? 0;
      option.score = percentile;
    }
  }

  // Sort by percentile score
  bestOptions.sort((a, b) => b.score - a.score);

  // Limit options per start/day combination to keep UI manageable
  const limitedOptions: ItineraryOption[] = [];
  const countsByStartDay = new Map<string, number>();

  for (const option of bestOptions) {
    const key = `${option.startId}-${option.day}`;
    const count = countsByStartDay.get(key) || 0;
    if (count < maxPerStartDay) {
      limitedOptions.push(option);
      countsByStartDay.set(key, count + 1);
    }
  }

  // Resolve route details
  const routes = target.routes.map(route => {
    const munros = route.munros.map(rm => {
      const munro = munroMap.get(rm.number);
      if (!munro) throw new Error(`Munro ${rm.number} not found`);
      return munro;
    });
    return { route, munros };
  });

  return {
    targetId,
    targetName: target.name,
    targetDescription: target.description,
    routes,
    bestOptions: limitedOptions,
  };
}

// Cache structure for pre-computed target itineraries
interface TargetItinerariesCache {
  targetId: string;
  options: Array<{
    startId: string;
    day: string;
    outbound: Itinerary;
    return: Itinerary;
    rawScore: number;
  }>;
}

/**
 * Pre-compute all viable itinerary pairs for all targets
 * This does the expensive work once and returns both the options and percentile map
 */
export function computeAllTargetItineraries(
  resultMap: Map<string, Result>,
  targetMap: Map<string, Target>,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES
): {
  targetCache: Map<string, TargetItinerariesCache>;
  percentileMap: Map<number, number>;
} {
  const allScores: number[] = [];
  const targetCache = new Map<string, TargetItinerariesCache>();

  // Compute all viable pairs for all targets in one pass
  for (const [targetId, target] of targetMap.entries()) {
    const options: TargetItinerariesCache['options'] = [];

    for (const result of resultMap.values()) {
      if (result.target !== targetId) continue;

      for (const [day, dayItineraries] of Object.entries(result.itineraries)) {
        const { outbounds, returns } = dayItineraries;
        if (outbounds.length === 0 || returns.length === 0) continue;

        // Try each route and find best scores for each itinerary pair
        const pairScores = new Map<string, { outbound: Itinerary; return: Itinerary; bestScore: number; viableRouteCount: number }>();

        for (const route of target.routes) {
          const viable = selectBestItineraries(
            outbounds,
            returns,
            route,
            prefs,
            Infinity
          );

          for (const { outbound, return: returnItin, score } of viable) {
            const pairKey = `${outbound.startTime}-${returnItin.startTime}`;
            const existing = pairScores.get(pairKey);

            if (!existing) {
              pairScores.set(pairKey, {
                outbound,
                return: returnItin,
                bestScore: score.rawScore,
                viableRouteCount: 1,
              });
            } else {
              // Keep best score, but count all viable routes
              if (score.rawScore > existing.bestScore) {
                existing.bestScore = score.rawScore;
              }
              existing.viableRouteCount++;
            }
          }
        }

        // Add pairs with route flexibility boost
        for (const pair of pairScores.values()) {
          // Apply boost: 2% per additional viable route beyond the first
          const routeBoost = 1 + (pair.viableRouteCount - 1) * 0.02;
          const boostedScore = pair.bestScore * routeBoost;

          options.push({
            startId: result.start,
            day,
            outbound: pair.outbound,
            return: pair.return,
            rawScore: boostedScore,
          });
          allScores.push(boostedScore);
        }
      }
    }

    if (options.length > 0) {
      targetCache.set(targetId, { targetId, options });
    }
  }

  const percentileMap = calculatePercentiles(allScores);
  return { targetCache, percentileMap };
}

/**
 * Calculate global percentiles for all itinerary scores
 * DEPRECATED: Use computeAllTargetItineraries instead for better performance
 */
export function calculateGlobalPercentiles(
  resultMap: Map<string, Result>,
  targetMap: Map<string, Target>,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES
): Map<number, number> {
  const { percentileMap } = computeAllTargetItineraries(resultMap, targetMap, prefs);
  return percentileMap;
}

/**
 * Get all targets with their best itinerary options
 * Scores are normalized to global percentiles
 */
export function getAllTargetsWithBestItineraries(
  resultMap: Map<string, Result>,
  targetMap: Map<string, Target>,
  munroMap: Map<number, Munro>,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES,
  cachedItineraries?: Map<string, TargetItinerariesCache>,
  cachedPercentiles?: Map<number, number>
): TargetWithBestItineraries[] {
  // Use cache if provided and preferences match defaults
  const usingDefaults = Object.keys(DEFAULT_RANKING_PREFERENCES).every(
    (key) => prefs[key as keyof typeof prefs] === DEFAULT_RANKING_PREFERENCES[key as keyof typeof DEFAULT_RANKING_PREFERENCES]
  );

  let targetCache: Map<string, TargetItinerariesCache>;
  let percentileMap: Map<number, number>;

  if (usingDefaults && cachedItineraries && cachedPercentiles) {
    // Use pre-computed cache
    targetCache = cachedItineraries;
    percentileMap = cachedPercentiles;
  } else {
    // Compute all itineraries and percentiles in one pass
    const computed = computeAllTargetItineraries(resultMap, targetMap, prefs);
    targetCache = computed.targetCache;
    percentileMap = computed.percentileMap;
  }
  
  const targetsWithItineraries: TargetWithBestItineraries[] = [];

  // For each target, build the result using cached data
  for (const [targetId, cached] of targetCache.entries()) {
    const target = targetMap.get(targetId);
    if (!target) continue;

    // Apply percentiles to cached scores
    const bestOptions: ItineraryOption[] = cached.options.map(opt => ({
      startId: opt.startId,
      startName: opt.startId,
      day: opt.day,
      outbound: opt.outbound,
      return: opt.return,
      score: percentileMap.get(opt.rawScore) ?? 0,
    }));

    // Sort by percentile score
    bestOptions.sort((a, b) => b.score - a.score);

    // Limit options per start/day combination
    const maxPerStartDay = 10;
    const limitedOptions: ItineraryOption[] = [];
    const countsByStartDay = new Map<string, number>();

    for (const option of bestOptions) {
      const key = `${option.startId}-${option.day}`;
      const count = countsByStartDay.get(key) || 0;
      if (count < maxPerStartDay) {
        limitedOptions.push(option);
        countsByStartDay.set(key, count + 1);
      }
    }

    // Resolve route details
    const routes = target.routes.map(route => {
      const munros = route.munros.map(rm => {
        const munro = munroMap.get(rm.number);
        if (!munro) throw new Error(`Munro ${rm.number} not found`);
        return munro;
      });
      return { route, munros };
    });

    targetsWithItineraries.push({
      targetId,
      targetName: target.name,
      targetDescription: target.description,
      routes,
      bestOptions: limitedOptions,
    });
  }

  return targetsWithItineraries;
}

export interface TargetWithRoutes {
  targetId: string;
  targetName: string;
  targetDescription: string;
  bestScore: number;
  routes: Array<{
    route: Route;
    munros: Munro[];
  }>;
  bestOptions: ItineraryOption[];
  displayOptions?: ItineraryOption[];
}

/**
 * Get top N targets (trailheads) for each starting location
 */
export function getTopTargetsPerStart(
  resultMap: Map<string, Result>,
  targetMap: Map<string, Target>,
  munroMap: Map<number, Munro>,
  n: number = 10,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES,
  cachedItineraries?: Map<string, TargetItinerariesCache>,
  cachedPercentiles?: Map<number, number>
): Map<string, TargetWithRoutes[]> {
  const allTargets = getAllTargetsWithBestItineraries(
    resultMap,
    targetMap,
    munroMap,
    prefs,
    cachedItineraries,
    cachedPercentiles
  );
  const targetsByStart = new Map<string, TargetWithRoutes[]>();

  // For each target, create filtered versions per start location
  for (const target of allTargets) {
    // Group options by start location
    const optionsByStart = new Map<string, ItineraryOption[]>();

    for (const option of target.bestOptions) {
      if (!optionsByStart.has(option.startId)) {
        optionsByStart.set(option.startId, []);
      }
      optionsByStart.get(option.startId)!.push(option);
    }

    // Create a target entry for each start location
    for (const [startId, options] of optionsByStart.entries()) {
      if (!targetsByStart.has(startId)) {
        targetsByStart.set(startId, []);
      }

      const routeBoost = 1 + (target.routes.length - 1) * 0.05;
      const boostedScore = (options[0]?.score || 0) * routeBoost;

      targetsByStart.get(startId)!.push({
        targetId: target.targetId,
        targetName: target.targetName,
        targetDescription: target.targetDescription,
        bestScore: boostedScore,
        routes: target.routes,
        bestOptions: options,
        displayOptions: selectDiverseOptions(options, 3),
      });
    }
  }

  // Sort targets within each start location by boosted score
  for (const [startId, targets] of targetsByStart.entries()) {
    targets.sort((a, b) => b.bestScore - a.bestScore);
    targetsByStart.set(startId, targets.slice(0, n));
  }

  return targetsByStart;
}

/**
 * Get stats about itinerary availability
 */
export function getAvailabilityStats(
  resultMap: Map<string, Result>,
  targetMap: Map<string, Target>,
  munroMap: Map<number, Munro>
) {
  let totalRoutes = 0;
  let totalTargets = 0;
  let targetsWithItineraries = 0;
  let totalItineraryOptions = 0;

  for (const target of targetMap.values()) {
    totalTargets++;
    totalRoutes += target.routes.length;
  }

  const allTargets = getAllTargetsWithBestItineraries(resultMap, targetMap, munroMap);
  for (const target of allTargets) {
    if (target.bestOptions.length > 0) {
      targetsWithItineraries++;
      totalItineraryOptions += target.bestOptions.length;
    }
  }

  return {
    totalRoutes,
    totalTargets,
    targetsWithItineraries,
    totalItineraryOptions,
    averageOptionsPerTarget: totalItineraryOptions / Math.max(targetsWithItineraries, 1),
  };
}
