export function formatMode(mode: string): string {
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

function getUniqueModesFormatted(modes: string[]): string[] {
  const modeSet = new Set(modes);
  modeSet.delete("WALK");
  return Array.from(modeSet).sort().map(formatMode);
}

export function formatModes(modes: string[]): string {
  return getUniqueModesFormatted(modes).join(", ");
}
