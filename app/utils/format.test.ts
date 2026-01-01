import { describe, it, expect } from "vitest";
import {
  pluralize,
  formatDayLabel,
  slugify,
  formatTime,
  formatDuration,
  parseTime,
  isSameDay,
  isNextDay,
  getDaysBetween,
  calculateDuration,
  isOvernightJourney,
} from "./format";

describe("format utils", () => {
  describe("pluralize", () => {
    it("returns singular for count of 1", () => {
      expect(pluralize(1, "munro")).toBe("1 munro");
    });

    it("returns plural for count other than 1", () => {
      expect(pluralize(0, "munro")).toBe("0 munros");
      expect(pluralize(2, "munro")).toBe("2 munros");
      expect(pluralize(10, "route")).toBe("10 routes");
    });
  });

  describe("formatDayLabel", () => {
    it("formats day codes correctly", () => {
      expect(formatDayLabel("MONDAY")).toBe("Monday");
      expect(formatDayLabel("SATURDAY")).toBe("Saturday");
    });
  });

  describe("slugify", () => {
    it("converts text to URL-friendly slug", () => {
      expect(slugify("Ben Nevis")).toBe("ben-nevis");
      expect(slugify("Loch Ness Trail")).toBe("loch-ness-trail");
      expect(slugify("Test   Multiple   Spaces")).toBe("test-multiple-spaces");
    });
  });

  describe("formatTime", () => {
    it("formats time string to HH:MM", () => {
      expect(formatTime("09:30:00")).toBe("09:30");
      expect(formatTime("14:45")).toBe("14:45");
    });
  });

  describe("formatDuration", () => {
    it("formats minutes into hours and minutes", () => {
      expect(formatDuration(45)).toBe("45m");
      expect(formatDuration(60)).toBe("1h");
      expect(formatDuration(90)).toBe("1h 30m");
      expect(formatDuration(163)).toBe("2h 43m");
      expect(formatDuration(0)).toBe("0m");
    });
  });

  describe("parseTime", () => {
    it("converts time string to decimal hours", () => {
      expect(parseTime("09:30")).toBe(9.5);
      expect(parseTime("14:45")).toBe(14.75);
      expect(parseTime("00:00")).toBe(0);
    });
  });

  describe("isSameDay", () => {
    it("returns true for same date", () => {
      const itin1 = { date: "2026-02-14" } as any;
      const itin2 = { date: "2026-02-14" } as any;
      expect(isSameDay(itin1, itin2)).toBe(true);
    });

    it("returns false for different dates", () => {
      const itin1 = { date: "2026-02-14" } as any;
      const itin2 = { date: "2026-02-15" } as any;
      expect(isSameDay(itin1, itin2)).toBe(false);
    });
  });

  describe("isNextDay", () => {
    it("returns true when return is next day", () => {
      const outbound = { date: "2026-02-14" } as any;
      const returnItin = { date: "2026-02-15" } as any;
      expect(isNextDay(outbound, returnItin)).toBe(true);
    });

    it("returns false when not consecutive days", () => {
      const outbound = { date: "2026-02-14" } as any;
      const returnItin = { date: "2026-02-16" } as any;
      expect(isNextDay(outbound, returnItin)).toBe(false);
    });
  });

  describe("getDaysBetween", () => {
    it("calculates days between itineraries", () => {
      const outbound = { date: "2026-02-14" } as any;
      const returnItin = { date: "2026-02-15" } as any;
      expect(getDaysBetween(outbound, returnItin)).toBe(1);
    });
  });

  describe("calculateDuration", () => {
    it("calculates duration in hours for same day", () => {
      const duration = calculateDuration("2026-02-14", "09:00", "2026-02-14", "15:30");
      expect(duration).toBe(6.5);
    });

    it("handles overnight durations", () => {
      const duration = calculateDuration("2026-02-14", "20:00", "2026-02-15", "08:00");
      expect(duration).toBe(12);
    });
  });

  describe("isOvernightJourney", () => {
    it("returns true when end time is before start time", () => {
      const itin = { date: "2026-02-14", startTime: "23:00", endTime: "02:00" } as any;
      expect(isOvernightJourney(itin)).toBe(true);
    });

    it("returns false for normal same-day journey", () => {
      const itin = { date: "2026-02-14", startTime: "09:00", endTime: "15:00" } as any;
      expect(isOvernightJourney(itin)).toBe(false);
    });
  });
});
