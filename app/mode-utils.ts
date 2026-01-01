function getModeAbbrev(mode: string): string {
  const abbrevs: Record<string, string> = {
    RAIL: "Train",
    BUS: "Bus",
    COACH: "Coach",
    FERRY: "Ferry",
    BICYCLE: "Bike",
    WALK: "Walk",
    TRAM: "Tram",
  };
  return abbrevs[mode] || mode;
}

export function getUniqueModes(modes: string[]): string[] {
  const modeSet = new Set(modes);
  modeSet.delete("WALK");
  return Array.from(modeSet).map(getModeAbbrev);
}

export function formatModes(modes: string[]): string {
  return getUniqueModes(modes).join(" + ");
}
