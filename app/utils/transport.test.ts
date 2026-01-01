import { describe, it, expect } from "vitest";
import { formatMode, formatModes } from "./transport";

describe("transport utils", () => {
  describe("formatMode", () => {
    it("should format standard modes", () => {
      expect(formatMode("RAIL")).toBe("Train");
      expect(formatMode("BUS")).toBe("Bus");
      expect(formatMode("COACH")).toBe("Coach");
      expect(formatMode("FERRY")).toBe("Ferry");
      expect(formatMode("BICYCLE")).toBe("Bike");
      expect(formatMode("WALK")).toBe("Walk");
      expect(formatMode("TRAM")).toBe("Tram");
    });

    it("should return original string for unknown modes", () => {
      expect(formatMode("SPACESHIP")).toBe("SPACESHIP");
    });
  });

  describe("formatModes", () => {
    it("should join unique modes excluding WALK", () => {
      // Set removes duplicates, array map formats them
      // Order depends on set iteration, which is insertion order for strings usually
      const result = formatModes(["RAIL", "WALK", "BUS", "RAIL"]);
      expect(result).toBe("Bus, Train");
    });

    it("should handle single mode", () => {
      expect(formatModes(["BUS"])).toBe("Bus");
    });

    it("should return empty string if only WALK", () => {
      expect(formatModes(["WALK"])).toBe("");
    });

    it("should return empty string for empty input", () => {
      expect(formatModes([])).toBe("");
    });
  });
});
