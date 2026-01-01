import type { Itinerary, Route } from "./schema";
import { parseTime } from "~/time-utils";

/**
 * Filter return journeys to show all returns that allow at least 50% of the shorter route time
 * This gives users flexibility to explore faster hiking options
 */
export function getViableReturns(
  outbound: Itinerary,
  allReturns: Itinerary[],
  route: Route
): Itinerary[] {
  const outboundEnd = parseTime(outbound.endTime);
  const minHikeTime = route.stats.timeHours.min * 0.5; // 50% of shorter time estimate

  return allReturns
    .filter(ret => {
      const returnStart = parseTime(ret.startTime);
      let hikeWindow = returnStart - outboundEnd;
      
      // Handle overnight returns
      if (hikeWindow < 0) {
        hikeWindow += 24;
      }
      
      return hikeWindow >= minHikeTime;
    })
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
}
