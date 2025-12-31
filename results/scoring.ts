import type { Itinerary, Route } from "./schema";
import { z } from "zod";

const userPreferencesSchema = z.object({
  // Earliest acceptable departure time (in hours, 24h format)
  earliestDeparture: z.number().min(0).max(24),

  // Walking speed multiplier (1.0 = standard WalkHighlands time)
  walkingSpeed: z.number().min(0.5).max(2.0),

  // Minimum buffer time after hike finishes before catching return (in hours)
  returnBuffer: z.number().min(0).max(6),

  // Additional buffer for tight connections (in minutes)
  connectionBuffer: z.number().int().min(0).max(60),

  // Latest acceptable sunset time (hours, 24h format)
  sunset: z.number().min(12).max(24),

  // Preferred start location (null means use most recently selected)
  preferredStartLocation: z.string().nullable(),

  // Preference weights (0-1, higher = more important)
  weights: z.object({
    departureTime: z.number().min(0).max(1),
    hikeDuration: z.number().min(0).max(1),
    returnOptions: z.number().min(0).max(1),
    connectionTime: z.number().min(0).max(1),
    totalDuration: z.number().min(0).max(1),
  }),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export { userPreferencesSchema };

export const DEFAULT_PREFERENCES: UserPreferences = {
  earliestDeparture: 6,      // 6am earliest
  walkingSpeed: 1.0,         // Standard speed
  returnBuffer: 1.5,         // 1.5 hours after hike completion
  connectionBuffer: 10,      // 10 minutes for connections
  sunset: 21,                // 9pm in summer
  preferredStartLocation: null,  // Use most recently selected
  weights: {
    departureTime: 0.7,
    hikeDuration: 1.0,       // Most important
    returnOptions: 0.8,
    connectionTime: 0.6,
    totalDuration: 0.5,
  },
};

interface ItineraryScore {
  total: number;
  components: {
    departureTime: number;
    hikeDuration: number;
    returnOptions: number;
    connectionTime: number;
    totalDuration: number;
  };
  feasible: boolean;
  reason?: string;
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}

function addHours(timeStr: string, hours: number): string {
  const totalHours = parseTime(timeStr) + hours;
  const h = Math.floor(totalHours) % 24;
  const m = Math.round((totalHours % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/**
 * Score an outbound + return itinerary pair
 */
export function scoreItineraryPair(
  outbound: Itinerary,
  returnItin: Itinerary | null,
  route: Route,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): ItineraryScore {
  const components = {
    departureTime: 0,
    hikeDuration: 0,
    returnOptions: 0,
    connectionTime: 0,
    totalDuration: 0,
  };

  const departureTime = parseTime(outbound.startTime);
  let arrivalTime = parseTime(outbound.endTime);

  // Handle overnight journeys - if arrival time is less than departure time, it's the next day
  if (arrivalTime < departureTime) {
    arrivalTime += 24;
  }

  // Check if departure is acceptable
  if (departureTime < prefs.earliestDeparture) {
    return {
      total: 0,
      components,
      feasible: false,
      reason: `Departure too early (${outbound.startTime})`,
    };
  }

  // Reject overnight arrivals (arrivals between midnight and earliest acceptable departure)
  const arrivalTimeOfDay = arrivalTime % 24;
  if (arrivalTimeOfDay < prefs.earliestDeparture) {
    return {
      total: 0,
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
      total: 0,
      components,
      feasible: false,
      reason: `Hike would finish after sunset (estimated ${hikeEndTime.toFixed(1)}h)`,
    };
  }

  // If no return specified, can't evaluate return timing
  if (!returnItin) {
    return {
      total: 0,
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
      total: 0,
      components,
      feasible: false,
      reason: "Cannot return via bike without taking bike on outbound journey",
    };
  }

  let returnDepartureTime = parseTime(returnItin.startTime);
  let returnArrivalTime = parseTime(returnItin.endTime);

  // Handle overnight return journeys
  if (returnDepartureTime < arrivalTime) {
    returnDepartureTime += 24;
  }
  if (returnArrivalTime < returnDepartureTime) {
    returnArrivalTime += 24;
  }

  // Check if there's enough buffer time before return
  const bufferTime = returnDepartureTime - hikeEndTime;
  if (bufferTime < prefs.returnBuffer) {
    return {
      total: 0,
      components,
      feasible: false,
      reason: `Insufficient buffer before return (${bufferTime.toFixed(1)}h < ${prefs.returnBuffer}h)`,
    };
  }

  // Now calculate scoring components (all 0-1, higher is better)

  // 1. Departure time score (prefer 8am-10am, penalize very early/late)
  const idealDeparture = 9;
  const departureOffset = Math.abs(departureTime - idealDeparture);
  components.departureTime = Math.max(0, 1 - departureOffset / 6);

  // 2. Hike duration score (prefer having plenty of time, 1.5x route time is ideal)
  const availableHikeTime = returnDepartureTime - prefs.returnBuffer - arrivalTime;
  const idealHikeTime = route.stats.timeHours.max * 1.5 / prefs.walkingSpeed;
  const timeRatio = availableHikeTime / idealHikeTime;
  components.hikeDuration = timeRatio >= 1
    ? 1.0
    : Math.max(0, timeRatio);

  // 3. Return options score (calculated separately - this is for a single pair)
  // Will be set to 1.0 if multiple viable returns exist, 0.5 if only one
  components.returnOptions = 0.5;

  // 4. Connection time score (penalize tight connections)
  let minConnectionMinutes = Infinity;
  for (let i = 1; i < outbound.legs.length; i++) {
    if (!outbound.legs[i].interlineWithPreviousLeg) {
      const prevEnd = parseTime(outbound.legs[i - 1].endTime);
      const nextStart = parseTime(outbound.legs[i].startTime);
      const connectionMinutes = (nextStart - prevEnd) * 60;
      minConnectionMinutes = Math.min(minConnectionMinutes, connectionMinutes);
    }
  }
  for (let i = 1; i < returnItin.legs.length; i++) {
    if (!returnItin.legs[i].interlineWithPreviousLeg) {
      const prevEnd = parseTime(returnItin.legs[i - 1].endTime);
      const nextStart = parseTime(returnItin.legs[i].startTime);
      const connectionMinutes = (nextStart - prevEnd) * 60;
      minConnectionMinutes = Math.min(minConnectionMinutes, connectionMinutes);
    }
  }

  if (minConnectionMinutes < Infinity) {
    const bufferScore = minConnectionMinutes < prefs.connectionBuffer
      ? 0
      : Math.min(1, (minConnectionMinutes - prefs.connectionBuffer) / 30);
    components.connectionTime = bufferScore;
  } else {
    components.connectionTime = 1.0; // No connections needed
  }

  // 5. Total duration score (prefer shorter total journey)
  const totalHours = (returnArrivalTime >= departureTime)
    ? returnArrivalTime - departureTime
    : (24 - departureTime) + returnArrivalTime;

  // Penalize trips over 14 hours
  components.totalDuration = Math.max(0, 1 - (totalHours - 10) / 10);

  // Calculate weighted total
  const total =
    components.departureTime * prefs.weights.departureTime +
    components.hikeDuration * prefs.weights.hikeDuration +
    components.returnOptions * prefs.weights.returnOptions +
    components.connectionTime * prefs.weights.connectionTime +
    components.totalDuration * prefs.weights.totalDuration;

  // Normalize by sum of weights
  const weightSum = Object.values(prefs.weights).reduce((a, b) => a + b, 0);

  return {
    total: total / weightSum,
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
  prefs: UserPreferences = DEFAULT_PREFERENCES,
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
          score.total = Object.entries(score.components)
            .reduce((sum, [key, val]) => sum + val * prefs.weights[key as keyof typeof prefs.weights], 0) / weightSum;
        }

        scored.push({ outbound, return: returnItin, score });
      }
    }
  }

  // Sort by score and return top results
  scored.sort((a, b) => b.score.total - a.score.total);
  return scored.slice(0, maxResults);
}
