import { resultMap, targetMap, munroMap } from "./parse";
import { selectBestItineraries, DEFAULT_PREFERENCES, type UserPreferences } from "./scoring";
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

export interface RouteWithBestItineraries {
  route: Route;
  targetId: string;
  targetName: string;
  targetDescription: string;
  munros: Munro[];
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
 */
export function getBestItinerariesForTarget(
  targetId: string,
  prefs: UserPreferences = DEFAULT_PREFERENCES
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

      // Get best 1-2 itinerary pairs for this day
      const best = selectBestItineraries(
        outbounds,
        returns,
        longestRoute,
        prefs,
        2
      );

      for (const { outbound, return: returnItin, score } of best) {
        bestOptions.push({
          startId: result.start,
          startName: result.start,
          day,
          outbound,
          return: returnItin,
          score: score.total,
        });
      }
    }
  }

  // Sort by score
  bestOptions.sort((a, b) => b.score - a.score);

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
    bestOptions: bestOptions.slice(0, 20), // Keep top 20 options
  };
}

/**
 * Get all targets with their best itinerary options
 */
export function getAllTargetsWithBestItineraries(
  prefs: UserPreferences = DEFAULT_PREFERENCES
): TargetWithBestItineraries[] {
  const targetsWithItineraries: TargetWithBestItineraries[] = [];

  // For each target (trailhead)
  for (const [targetId] of targetMap.entries()) {
    const targetData = getBestItinerariesForTarget(targetId, prefs);
    if (targetData && targetData.bestOptions.length > 0) {
      targetsWithItineraries.push(targetData);
    }
  }

  return targetsWithItineraries;
}

/**
 * Get all routes with their best itinerary options
 * @deprecated Use getAllTargetsWithBestItineraries instead - routes share target transport
 */
export function getAllRoutesWithBestItineraries(
  prefs: UserPreferences = DEFAULT_PREFERENCES
): RouteWithBestItineraries[] {
  const routesWithItineraries: RouteWithBestItineraries[] = [];

  // Get target-level data
  const targets = getAllTargetsWithBestItineraries(prefs);

  // Expand to route-level for backwards compatibility
  for (const target of targets) {
    for (const { route, munros } of target.routes) {
      routesWithItineraries.push({
        route,
        targetId: target.targetId,
        targetName: target.targetName,
        targetDescription: target.targetDescription,
        munros,
        bestOptions: target.bestOptions,
        displayOptions: target.displayOptions,
      });
    }
  }

  return routesWithItineraries;
}

/**
 * Get top N routes overall by best score
 */
export function getTopRoutes(
  n: number = 20,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): RouteWithBestItineraries[] {
  const allRoutes = getAllRoutesWithBestItineraries(prefs);

  // Sort by best score available for that route
  allRoutes.sort((a, b) => {
    const bestA = a.bestOptions[0]?.score || 0;
    const bestB = b.bestOptions[0]?.score || 0;
    return bestB - bestA;
  });

  return allRoutes.slice(0, n);
}

/**
 * Get top N routes for each starting location
 */
export function getTopRoutesPerStart(
  n: number = 10,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): Map<string, RouteWithBestItineraries[]> {
  const allRoutes = getAllRoutesWithBestItineraries(prefs);
  const routesByStart = new Map<string, RouteWithBestItineraries[]>();

  // For each route, create a version filtered to each start location
  for (const route of allRoutes) {
    // Group options by start location
    const optionsByStart = new Map<string, typeof route.bestOptions>();

    for (const option of route.bestOptions) {
      if (!optionsByStart.has(option.startId)) {
        optionsByStart.set(option.startId, []);
      }
      optionsByStart.get(option.startId)!.push(option);
    }

    // Create a route entry for each start location
    for (const [startId, options] of optionsByStart.entries()) {
      if (!routesByStart.has(startId)) {
        routesByStart.set(startId, []);
      }

      routesByStart.get(startId)!.push({
        ...route,
        bestOptions: options,
        displayOptions: selectDiverseOptions(options, 3),
      });
    }
  }

  // Sort routes within each start location by best score
  for (const [startId, routes] of routesByStart.entries()) {
    routes.sort((a, b) => {
      const bestA = a.bestOptions[0]?.score || 0;
      const bestB = b.bestOptions[0]?.score || 0;
      return bestB - bestA;
    });
    routesByStart.set(startId, routes.slice(0, n));
  }

  return routesByStart;
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
  prefs: UserPreferences = DEFAULT_PREFERENCES
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

      targetsByStart.get(startId)!.push({
        targetId: target.targetId,
        targetName: target.targetName,
        targetDescription: target.targetDescription,
        bestScore: options[0]?.score || 0,
        routes: target.routes,
        bestOptions: options,
        displayOptions: selectDiverseOptions(options, 3),
      });
    }
  }

  // Sort targets within each start location by best score
  for (const [startId, targets] of targetsByStart.entries()) {
    targets.sort((a, b) => b.bestScore - a.bestScore);
    targetsByStart.set(startId, targets.slice(0, n));
  }

  return targetsByStart;
}

/**
 * Get best itineraries for a specific route
 * @deprecated Use getBestItinerariesForTarget instead - routes share target transport
 */
export function getBestItinerariesForRoute(
  targetId: string,
  routeName: string,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): RouteWithBestItineraries | null {
  const targetData = getBestItinerariesForTarget(targetId, prefs);
  if (!targetData) return null;

  const routeInfo = targetData.routes.find(r => r.route.name === routeName);
  if (!routeInfo) return null;

  return {
    route: routeInfo.route,
    targetId: targetData.targetId,
    targetName: targetData.targetName,
    targetDescription: targetData.targetDescription,
    munros: routeInfo.munros,
    bestOptions: targetData.bestOptions,
  };
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
