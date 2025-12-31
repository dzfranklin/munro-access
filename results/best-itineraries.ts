import { resultMap, targetMap, munroMap } from "./parse";
import { selectBestItineraries, DEFAULT_PREFERENCES, type UserPreferences } from "./scoring";
import type { Itinerary, Route, Munro } from "./schema";

export interface RouteWithBestItineraries {
  route: Route;
  targetId: string;
  targetName: string;
  targetDescription: string;
  munros: Munro[];
  bestOptions: Array<{
    startId: string;
    startName: string;
    day: string;
    outbound: Itinerary;
    return: Itinerary;
    score: number;
  }>;
  displayOptions?: Array<{
    startId: string;
    startName: string;
    day: string;
    outbound: Itinerary;
    return: Itinerary;
    score: number;
  }>;
}

/**
 * Select diverse itinerary options for display
 * Prioritizes: best score, different days, non-bike alternatives
 */
function selectDiverseOptions(
  allOptions: RouteWithBestItineraries["bestOptions"],
  maxOptions: number = 3
): RouteWithBestItineraries["bestOptions"] {
  const displayOptions: RouteWithBestItineraries["bestOptions"] = [];
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
 * Get all routes with their best itinerary options
 */
export function getAllRoutesWithBestItineraries(
  prefs: UserPreferences = DEFAULT_PREFERENCES
): RouteWithBestItineraries[] {
  const routesWithItineraries: RouteWithBestItineraries[] = [];

  // For each target (trailhead)
  for (const [targetId, target] of targetMap.entries()) {
    // For each route from that target
    for (const route of target.routes) {
      const bestOptions: RouteWithBestItineraries["bestOptions"] = [];

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
            route,
            prefs,
            2
          );

          for (const { outbound, return: returnItin, score } of best) {
            // Find start name
            const startName = Array.from(resultMap.values())
              .find(r => r.start === result.start && r.target === targetId)?.start || result.start;

            bestOptions.push({
              startId: result.start,
              startName,
              day,
              outbound,
              return: returnItin,
              score: score.total,
            });
          }
        }
      }

      // Sort by score and keep top options
      bestOptions.sort((a, b) => b.score - a.score);

      // Resolve munro details
      const munros = route.munros.map(rm => {
        const munro = munroMap.get(rm.number);
        if (!munro) throw new Error(`Munro ${rm.number} not found`);
        return munro;
      });

      routesWithItineraries.push({
        route,
        targetId,
        targetName: target.name,
        targetDescription: target.description,
        munros,
        bestOptions: bestOptions.slice(0, 10), // Keep top 10 options per route
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
  routes: RouteWithBestItineraries[];
}

/**
 * Get top N targets (trailheads) for each starting location, with all routes grouped by target
 */
export function getTopTargetsPerStart(
  n: number = 10,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): Map<string, TargetWithRoutes[]> {
  const allRoutes = getAllRoutesWithBestItineraries(prefs);
  const targetsByStart = new Map<string, Map<string, TargetWithRoutes>>();

  // For each route, group by start location and target
  for (const route of allRoutes) {
    // Group options by start location
    const optionsByStart = new Map<string, typeof route.bestOptions>();

    for (const option of route.bestOptions) {
      if (!optionsByStart.has(option.startId)) {
        optionsByStart.set(option.startId, []);
      }
      optionsByStart.get(option.startId)!.push(option);
    }

    // For each start location, add this route to the appropriate target
    for (const [startId, options] of optionsByStart.entries()) {
      if (!targetsByStart.has(startId)) {
        targetsByStart.set(startId, new Map());
      }

      const targetsMap = targetsByStart.get(startId)!;

      if (!targetsMap.has(route.targetId)) {
        targetsMap.set(route.targetId, {
          targetId: route.targetId,
          targetName: route.targetName,
          targetDescription: route.targetDescription,
          bestScore: 0,
          routes: [],
        });
      }

      const target = targetsMap.get(route.targetId)!;
      const routeWithOptions = {
        ...route,
        bestOptions: options,
        displayOptions: selectDiverseOptions(options, 3),
      };

      target.routes.push(routeWithOptions);

      // Update best score for this target
      const routeBestScore = options[0]?.score || 0;
      target.bestScore = Math.max(target.bestScore, routeBestScore);
    }
  }

  // Convert to final format and sort
  const result = new Map<string, TargetWithRoutes[]>();

  for (const [startId, targetsMap] of targetsByStart.entries()) {
    const targets = Array.from(targetsMap.values());

    // Sort routes within each target by score
    for (const target of targets) {
      target.routes.sort((a, b) => {
        const bestA = a.bestOptions[0]?.score || 0;
        const bestB = b.bestOptions[0]?.score || 0;
        return bestB - bestA;
      });
    }

    // Sort targets by best score
    targets.sort((a, b) => b.bestScore - a.bestScore);

    result.set(startId, targets.slice(0, n));
  }

  return result;
}

/**
 * Get best itineraries for a specific route
 */
export function getBestItinerariesForRoute(
  targetId: string,
  routeName: string,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): RouteWithBestItineraries | null {
  const target = targetMap.get(targetId);
  if (!target) return null;

  const route = target.routes.find(r => r.name === routeName);
  if (!route) return null;

  const bestOptions: RouteWithBestItineraries["bestOptions"] = [];

  for (const result of resultMap.values()) {
    if (result.target !== targetId) continue;

    for (const [day, dayItineraries] of Object.entries(result.itineraries)) {
      const { outbounds, returns } = dayItineraries;

      if (outbounds.length === 0 || returns.length === 0) continue;

      const best = selectBestItineraries(
        outbounds,
        returns,
        route,
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

  bestOptions.sort((a, b) => b.score - a.score);

  const munros = route.munros.map(rm => {
    const munro = munroMap.get(rm.number);
    if (!munro) throw new Error(`Munro ${rm.number} not found`);
    return munro;
  });

  return {
    route,
    targetId,
    targetName: target.name,
    targetDescription: target.description,
    munros,
    bestOptions: bestOptions.slice(0, 10),
  };
}

/**
 * Get stats about itinerary availability
 */
export function getAvailabilityStats() {
  let totalRoutes = 0;
  let routesWithItineraries = 0;
  let totalItineraryOptions = 0;

  for (const target of targetMap.values()) {
    totalRoutes += target.routes.length;
  }

  const allRoutes = getAllRoutesWithBestItineraries();
  for (const route of allRoutes) {
    if (route.bestOptions.length > 0) {
      routesWithItineraries++;
      totalItineraryOptions += route.bestOptions.length;
    }
  }

  return {
    totalRoutes,
    routesWithItineraries,
    totalItineraryOptions,
    averageOptionsPerRoute: totalItineraryOptions / Math.max(routesWithItineraries, 1),
  };
}
