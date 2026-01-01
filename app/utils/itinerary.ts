/**
 * Utility for consistently applying percentile-based colors to itineraries.
 * Uses traffic light colors to indicate how an option ranks globally.
 */

export type PercentileLevel = "top" | "good" | "fair" | "bottom";

export interface PercentileColors {
  text: string;
  border?: string;
}

/**
 * Get percentile level from a normalized percentile score (0-1)
 */
export function getPercentileLevel(percentile: number): PercentileLevel {
  if (percentile >= 0.75) return "top";
  if (percentile >= 0.5) return "good";
  if (percentile >= 0.25) return "fair";
  return "bottom";
}

/**
 * Format percentile as "Top X%" or "Bottom X%" label
 */
export function formatPercentileLabel(percentile: number): string {
  const percent = Math.round(percentile * 100);
  const topPercent = 100 - percent;

  // Use "Bottom" for lower half, "Top" for upper half
  if (topPercent > 50) {
    return `Bottom ${topPercent}%`;
  }
  return `Top ${topPercent}%`;
}

/**
 * Get Tailwind CSS classes for percentile-based text color
 */
export function getPercentileTextClass(level: PercentileLevel): string {
  const classes = {
    top: "text-percentile-top",
    good: "text-percentile-good",
    fair: "text-percentile-fair",
    bottom: "text-percentile-bottom",
  };
  return classes[level];
}

/**
 * Get Tailwind CSS classes for percentile-based border color
 */
export function getPercentileBorderClass(level: PercentileLevel): string {
  const classes = {
    top: "border-percentile-top",
    good: "border-percentile-good",
    fair: "border-percentile-fair",
    bottom: "border-percentile-bottom",
  };
  return classes[level];
}

/**
 * Get all percentile classes for an itinerary score (0-1 percentile)
 */
export function getPercentileClasses(percentile: number): {
  level: PercentileLevel;
  label: string;
  textClass: string;
  borderClass: string;
} {
  const level = getPercentileLevel(percentile);
  return {
    level,
    label: formatPercentileLabel(percentile),
    textClass: getPercentileTextClass(level),
    borderClass: getPercentileBorderClass(level),
  };
}
