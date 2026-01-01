import type { Itinerary, Route, MinimalItinerary } from "./schema";
import { parseTime, calculateDuration } from "../app/utils/format";

/**
 * Filter return journeys to show all returns that allow at least 50% of the shorter route time
 * This gives users flexibility to explore faster hiking options
 */
export function getViableReturns<T extends MinimalItinerary>(
  outbound: T,
  allReturns: T[],
  route: Route
): T[] {
  const minHikeTime = route.stats.timeHours.min * 0.5; // 50% of shorter time estimate

  return allReturns
    .filter(ret => {
      // Calculate actual hike window using dates
      const hikeWindow = calculateDuration(
        outbound.date,
        outbound.endTime,
        ret.date,
        ret.startTime
      );

      return hikeWindow >= minHikeTime;
    })
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
}
