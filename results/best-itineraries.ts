import { resultMap, targetMap, munroMap } from "./parse.server";
import { selectBestItineraries, calculatePercentiles, DEFAULT_RANKING_PREFERENCES, type RankingPreferences } from "./scoring";
import type { Itinerary, Route, Munro } from "./schema";

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
 * Select diverse itinerary options for display
 * Prioritizes: best score, different days, non-bike alternatives
 */
function selectDiverseOptions(
  allOptions: ItineraryOption[],
  maxOptions: number = 3
): ItineraryOption[] {
  const displayOptions: ItineraryOption[] = [];
  const dayOrder = ["WEDNESDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  // First, add the best option
  if (allOptions.length > 0) {
    displayOptions.push(allOptions[0]);
  }

  // Try to find options for different days
  const seenDays = new Set([allOptions[0]?.day]);
  for (const option of allOptions.slice(1)) {
    if (!seenDays.has(option.day)) {
      displayOptions.push(option);
      seenDays.add(option.day);
      if (displayOptions.length >= maxOptions) break;
    }
  }

  // If best option uses bike, try to find one without
  if (displayOptions.length < maxOptions && allOptions[0]?.outbound.modes.includes("BICYCLE")) {
    const noBikeOption = allOptions.find(
      opt => !opt.outbound.modes.includes("BICYCLE") && !opt.return.modes.includes("BICYCLE")
    );
    if (noBikeOption && !displayOptions.includes(noBikeOption)) {
      displayOptions.push(noBikeOption);
    }
  }

  // Fill remaining slots with next best options
  for (const option of allOptions) {
    if (!displayOptions.includes(option)) {
      displayOptions.push(option);
      if (displayOptions.length >= maxOptions) break;
    }
  }

  // Sort by day order
  displayOptions.sort((a, b) => {
    const indexA = dayOrder.indexOf(a.day);
    const indexB = dayOrder.indexOf(b.day);
    return indexA - indexB;
  });

  return displayOptions;
}

/**
 * Get best itineraries for a specific target (trailhead)
 * This computes transport options once per target, since all routes from
 * the same target share the same access point.
 * 
 * @param maxPerStartDay - Maximum number of options to return per start/day combination (default: 10)
 * @param globalPercentiles - Pre-calculated global percentile map (optional, will calculate if not provided)
 */
export function getBestItinerariesForTarget(
  targetId: string,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES,
  maxPerStartDay: number = 10,
  globalPercentiles?: Map<number, number>
): TargetWithBestItineraries | null {
  const target = targetMap.get(targetId);
  if (!target) return null;

  const bestOptions: ItineraryOption[] = [];

  // Use the longest route for scoring (most conservative estimate)
  const longestRoute = target.routes.reduce((longest, route) => {
    const longestMax = longest.stats.timeHours.max;
    const routeMax = route.stats.timeHours.max;
    return routeMax > longestMax ? route : longest;
  }, target.routes[0]);

  // Check itineraries from all start cities
  for (const result of resultMap.values()) {
    if (result.target !== targetId) continue;

    // Check each day of the week
    for (const [day, dayItineraries] of Object.entries(result.itineraries)) {
      const { outbounds, returns } = dayItineraries;

      if (outbounds.length === 0 || returns.length === 0) continue;

      // Get all viable itinerary pairs for this day
      const viable = selectBestItineraries(
        outbounds,
        returns,
        longestRoute,
        prefs,
        Infinity // No limit - return all viable pairs
      );

      for (const { outbound, return: returnItin, score } of viable) {
        bestOptions.push({
          startId: result.start,
          startName: result.start,
          day,
          outbound,
          return: returnItin,
          score: score.rawScore,
        });
      }
    }
  }

  // Sort by score (best first)
  bestOptions.sort((a, b) => b.score - a.score);

  // Calculate percentiles if not provided, then apply them
  const percentileMap = globalPercentiles ?? calculateGlobalPercentiles(prefs);
  for (const option of bestOptions) {
    const percentile = percentileMap.get(option.score) ?? 0;
    option.score = percentile;
  }

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

/**
 * Calculate global percentiles for all itinerary scores
 * Call this once before generating all targets
 */
export function calculateGlobalPercentiles(
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES
): Map<number, number> {
  const allScores: number[] = [];

  // Collect all scores from all targets
  for (const [targetId, target] of targetMap.entries()) {
    const longestRoute = target.routes.reduce((longest, route) => {
      const longestMax = longest.stats.timeHours.max;
      const routeMax = route.stats.timeHours.max;
      return routeMax > longestMax ? route : longest;
    }, target.routes[0]);

    for (const result of resultMap.values()) {
      if (result.target !== targetId) continue;

      for (const [day, dayItineraries] of Object.entries(result.itineraries)) {
        const { outbounds, returns } = dayItineraries;
        if (outbounds.length === 0 || returns.length === 0) continue;

        const viable = selectBestItineraries(
          outbounds,
          returns,
          longestRoute,
          prefs,
          Infinity
        );

        for (const { score } of viable) {
          allScores.push(score.rawScore);
        }
      }
    }
  }

  return calculatePercentiles(allScores);
}

/**
 * Get all targets with their best itinerary options
 * Scores are normalized to global percentiles
 */
export function getAllTargetsWithBestItineraries(
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES
): TargetWithBestItineraries[] {
  // First, calculate global percentiles
  const globalPercentiles = calculateGlobalPercentiles(prefs);

  const targetsWithItineraries: TargetWithBestItineraries[] = [];

  // For each target (trailhead)
  for (const [targetId] of targetMap.entries()) {
    const targetData = getBestItinerariesForTarget(targetId, prefs, 10, globalPercentiles);
    if (targetData && targetData.bestOptions.length > 0) {
      targetsWithItineraries.push(targetData);
    }
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
  n: number = 10,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES
): Map<string, TargetWithRoutes[]> {
  const allTargets = getAllTargetsWithBestItineraries(prefs);
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
export function getAvailabilityStats() {
  let totalRoutes = 0;
  let totalTargets = 0;
  let targetsWithItineraries = 0;
  let totalItineraryOptions = 0;

  for (const target of targetMap.values()) {
    totalTargets++;
    totalRoutes += target.routes.length;
  }

  const allTargets = getAllTargetsWithBestItineraries();
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
