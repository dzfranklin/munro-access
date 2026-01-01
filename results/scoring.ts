import type { Itinerary, Route } from "./schema";
import { z } from "zod";
import {
  isSameDay,
  getDaysBetween,
  calculateDuration,
  isOvernightJourney,
  parseTime,
} from "../app/utils/format";

// Preferences that affect itinerary scoring/ranking
const rankingPreferencesSchema = z.object({
  // Earliest acceptable departure time (in hours, 24h format)
  earliestDeparture: z.number().min(0).max(24),

  // Walking speed multiplier (1.0 = standard WalkHighlands time)
  walkingSpeed: z.number().min(0.5).max(2.0),

  // Minimum buffer time after hike finishes before catching return (in hours)
  returnBuffer: z.number().min(0).max(6),

  // Latest acceptable sunset time (hours, 24h format)
  sunset: z.number().min(12).max(24),

  // Preference weights (0-1, higher = more important)
  weights: z.object({
    departureTime: z.number().min(0).max(1),
    hikeDuration: z.number().min(0).max(1),
    returnOptions: z.number().min(0).max(1),
    totalDuration: z.number().min(0).max(1),
  }),

  // Penalty for overnight trips (0 = no penalty, 1 = maximum penalty)
  overnightPenalty: z.number().min(0).max(1),
});

// UI-only preferences (don't affect scoring)
const uiPreferencesSchema = z.object({
  // Preferred start location (null means no preference)
  preferredStartLocation: z.string().nullable(),

  // Most recently viewed start location (updated when tabs clicked)
  lastViewedStartLocation: z.string().nullable(),
});

const userPreferencesSchema =
  rankingPreferencesSchema.merge(uiPreferencesSchema);

export type RankingPreferences = z.infer<typeof rankingPreferencesSchema>;
export type UIPreferences = z.infer<typeof uiPreferencesSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export { userPreferencesSchema, rankingPreferencesSchema, uiPreferencesSchema };

export const DEFAULT_RANKING_PREFERENCES: RankingPreferences = {
  earliestDeparture: 6, // 6am earliest
  walkingSpeed: 1.0, // Standard speed
  returnBuffer: 0.5, // 30 minutes
  sunset: 21, // 9pm in summer
  overnightPenalty: 0.3, // 30% penalty for overnight trips
  weights: {
    departureTime: 0.2,
    hikeDuration: 1.0, // Most important
    returnOptions: 0.8,
    totalDuration: 0.6,
  },
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  preferredStartLocation: null,
  lastViewedStartLocation: null,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  ...DEFAULT_RANKING_PREFERENCES,
  ...DEFAULT_UI_PREFERENCES,
};

interface ItineraryScore {
  rawScore: number;
  percentile: number;
  components: {
    departureTime: number;
    hikeDuration: number;
    returnOptions: number;
    totalDuration: number;
  };
  feasible: boolean;
  reason?: string;
}

/**
 * Score an outbound + return itinerary pair
 * Returns raw score (0-1) before percentile normalization
 */
export function scoreItineraryPair(
  outbound: Itinerary,
  returnItin: Itinerary | null,
  route: Route,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES
): ItineraryScore {
  const components = {
    departureTime: 0,
    hikeDuration: 0,
    returnOptions: 0,
    totalDuration: 0,
  };

  const departureTime = parseTime(outbound.startTime);
  let arrivalTime = parseTime(outbound.endTime);

  // Handle overnight journeys - check if the journey crosses midnight
  if (isOvernightJourney(outbound)) {
    arrivalTime += 24;
  }

  // Check if departure is acceptable
  if (departureTime < prefs.earliestDeparture) {
    return {
      rawScore: 0,
      percentile: 0,
      components,
      feasible: false,
      reason: `Departure too early (${outbound.startTime})`,
    };
  }

  // Reject overnight arrivals (arrivals between midnight and earliest acceptable departure)
  const arrivalTimeOfDay = arrivalTime % 24;
  if (arrivalTimeOfDay < prefs.earliestDeparture) {
    return {
      rawScore: 0,
      percentile: 0,
      components,
      feasible: false,
      reason: `Arrival too early (${outbound.endTime})`,
    };
  }

  // Calculate adjusted hike duration based on walking speed
  const routeTimeMax = route.stats.timeHours.max / prefs.walkingSpeed;
  const hikeEndTime = arrivalTime + routeTimeMax;

  // Check if hike would finish before sunset
  if (hikeEndTime > prefs.sunset) {
    return {
      rawScore: 0,
      percentile: 0,
      components,
      feasible: false,
      reason: `Hike would finish after sunset (estimated ${hikeEndTime.toFixed(1)}h)`,
    };
  }

  // If no return specified, can't evaluate return timing
  if (!returnItin) {
    return {
      rawScore: 0,
      percentile: 0,
      components,
      feasible: false,
      reason: "No return itinerary",
    };
  }

  // Can't return via bike if you didn't leave via bike
  const outboundUsesBike = outbound.modes.includes("BICYCLE");
  const returnUsesBike = returnItin.modes.includes("BICYCLE");

  if (returnUsesBike && !outboundUsesBike) {
    return {
      rawScore: 0,
      percentile: 0,
      components,
      feasible: false,
      reason: "Cannot return via bike without taking bike on outbound journey",
    };
  }

  let returnDepartureTime = parseTime(returnItin.startTime);
  let returnArrivalTime = parseTime(returnItin.endTime);

  // Adjust return times based on actual date differences
  const daysBetween = getDaysBetween(outbound, returnItin);
  returnDepartureTime += daysBetween * 24;

  // Handle overnight return journey (within the return journey itself)
  if (isOvernightJourney(returnItin)) {
    returnArrivalTime += 24;
  }
  // Also add the days between if not an overnight journey
  returnArrivalTime += daysBetween * 24;

  // Check if there's enough buffer time before return
  const bufferTime = returnDepartureTime - hikeEndTime;
  if (bufferTime < prefs.returnBuffer) {
    return {
      rawScore: 0,
      percentile: 0,
      components,
      feasible: false,
      reason: `Insufficient buffer before return (${bufferTime.toFixed(1)}h < ${prefs.returnBuffer}h)`,
    };
  }

  // Now calculate scoring components (all 0-1, higher is better)

  // 1. Departure time score (penalize very early starts, slight preference for 8am+)
  // 8am+ = 1.0, 7am = 0.9, earlier = linear penalty down to earliestDeparture
  if (departureTime >= 8) {
    components.departureTime = 1.0;
  } else if (departureTime >= 7) {
    components.departureTime = 0.9 + 0.1 * (departureTime - 7);
  } else {
    components.departureTime = Math.max(
      0,
      (0.9 * (departureTime - prefs.earliestDeparture)) /
        (7 - prefs.earliestDeparture)
    );
  }

  // 2. Hike duration score (prefer having plenty of time, 1.2x route time is ideal)
  const availableHikeTime =
    returnDepartureTime - prefs.returnBuffer - arrivalTime;
  const idealHikeTime = (route.stats.timeHours.max * 1.2) / prefs.walkingSpeed;
  const timeRatio = availableHikeTime / idealHikeTime;
  components.hikeDuration = timeRatio >= 1 ? 1.0 : Math.max(0, timeRatio);

  // 3. Return options score (calculated separately - this is for a single pair)
  // Will be set to 1.0 if multiple viable returns exist, 0.5 if only one
  components.returnOptions = 0.5;

  // 4. Total duration score (prefer shorter total journey)
  const totalHours = calculateDuration(
    outbound.date,
    outbound.startTime,
    returnItin.date,
    returnItin.endTime
  );

  // Penalize trips over 14 hours
  components.totalDuration = Math.max(0, 1 - (totalHours - 10) / 10);

  // Calculate weighted total
  const total =
    components.departureTime * prefs.weights.departureTime +
    components.hikeDuration * prefs.weights.hikeDuration +
    components.returnOptions * prefs.weights.returnOptions +
    components.totalDuration * prefs.weights.totalDuration;

  // Normalize by sum of weights
  const weightSum = Object.values(prefs.weights).reduce((a, b) => a + b, 0);
  let finalScore = total / weightSum;

  // Apply overnight penalty if trip spans multiple days
  const isOvernight = !isSameDay(outbound, returnItin);
  if (isOvernight) {
    finalScore *= 1 - prefs.overnightPenalty;
  }

  return {
    rawScore: finalScore,
    percentile: 0, // Will be calculated later
    components,
    feasible: true,
  };
}

/**
 * Find best itinerary pairs for a given day
 */
export function selectBestItineraries(
  outbounds: Itinerary[],
  returns: Itinerary[],
  route: Route,
  prefs: RankingPreferences = DEFAULT_RANKING_PREFERENCES,
  maxResults: number = 2
): Array<{
  outbound: Itinerary;
  return: Itinerary;
  score: ItineraryScore;
}> {
  const scored: Array<{
    outbound: Itinerary;
    return: Itinerary;
    score: ItineraryScore;
  }> = [];

  // Try all combinations
  for (const outbound of outbounds) {
    for (const returnItin of returns) {
      const score = scoreItineraryPair(outbound, returnItin, route, prefs);
      if (score.feasible) {
        // Check if this return offers redundancy
        const arrivalTime = parseTime(outbound.endTime);
        const routeTimeMax = route.stats.timeHours.max / prefs.walkingSpeed;
        const hikeEndTime = arrivalTime + routeTimeMax;

        // Count how many return options exist within 2 hours of this one
        const returnTime = parseTime(returnItin.startTime);
        const alternativeReturns = returns.filter(r => {
          const rt = parseTime(r.startTime);
          return rt > hikeEndTime + prefs.returnBuffer &&
                 Math.abs(rt - returnTime) <= 2;
        });

        // Boost score if multiple return options
        if (alternativeReturns.length > 1) {
          score.components.returnOptions = 1.0;
          // Recalculate total
          const weightSum = Object.values(prefs.weights).reduce((a, b) => a + b, 0);
          score.rawScore = Object.entries(score.components)
            .reduce((sum, [key, val]) => sum + val * prefs.weights[key as keyof typeof prefs.weights], 0) / weightSum;
        }

        scored.push({ outbound, return: returnItin, score });
      }
    }
  }

  // Sort by score and return top results
  scored.sort((a, b) => b.score.rawScore - a.score.rawScore);
  return scored.slice(0, maxResults);
}

/**
 * Calculate percentile for each score in a collection
 * Percentile represents the percentage of scores that are lower than this score
 */
export function calculatePercentiles(scores: number[]): Map<number, number> {
  const sortedScores = [...scores].sort((a, b) => a - b);
  const percentileMap = new Map<number, number>();
  
  for (let i = 0; i < sortedScores.length; i++) {
    const score = sortedScores[i];
    // Don't overwrite if we've already seen this score (use first occurrence for duplicate scores)
    if (!percentileMap.has(score)) {
      const percentile = (i / Math.max(1, sortedScores.length - 1));
      percentileMap.set(score, percentile);
    }
  }
  
  return percentileMap;
}
