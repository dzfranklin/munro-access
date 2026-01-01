import { describe, it, expect } from "vitest";
import { getViableReturns } from "./itinerary-utils";
import type { Itinerary, Route } from "./schema";

describe("itinerary-utils", () => {
  describe("getViableReturns", () => {
    const route: Route = {
      stats: {
        timeHours: { min: 4, max: 6 },
        distanceKm: 10,
        ascentM: 800,
      },
    } as Route;

    const outbound: Itinerary = {
      date: "2026-02-14",
      startTime: "09:00",
      endTime: "11:00",
    } as Itinerary;

    it("filters returns that allow at least 50% of min route time", () => {
      const returns: Itinerary[] = [
        { date: "2026-02-14", startTime: "13:00", endTime: "15:00" } as Itinerary, // 2h window - viable (exactly 50%)
        { date: "2026-02-14", startTime: "14:00", endTime: "16:00" } as Itinerary, // 3h window - viable
        { date: "2026-02-14", startTime: "16:00", endTime: "18:00" } as Itinerary, // 5h window - viable
      ];

      const viable = getViableReturns(outbound, returns, route);

      expect(viable.length).toBe(3);
      expect(viable[0].startTime).toBe("13:00");
      expect(viable[1].startTime).toBe("14:00");
      expect(viable[2].startTime).toBe("16:00");
    });

    it("sorts returns by start time", () => {
      const returns: Itinerary[] = [
        { date: "2026-02-14", startTime: "16:00", endTime: "18:00" } as Itinerary,
        { date: "2026-02-14", startTime: "14:00", endTime: "16:00" } as Itinerary,
        { date: "2026-02-14", startTime: "15:00", endTime: "17:00" } as Itinerary,
      ];

      const viable = getViableReturns(outbound, returns, route);

      expect(viable.map(r => r.startTime)).toEqual(["14:00", "15:00", "16:00"]);
    });

    it("handles overnight returns", () => {
      const returns: Itinerary[] = [
        { date: "2026-02-15", startTime: "09:00", endTime: "11:00" } as Itinerary, // next day
      ];

      const viable = getViableReturns(outbound, returns, route);

      expect(viable.length).toBe(1);
    });
  });
});
