import type { Itinerary } from "results/schema";
import { getPercentileClasses } from "~/utils/itinerary";
import { formatDuration, isSameDay, getDaysBetween, calculateDuration, formatDayLabel } from "~/utils/format";
import { formatModes } from "~/utils/transport";

interface ItinerarySummaryProps {
  outbound: Itinerary;
  return: Itinerary;
  day: string;
  score?: number;
}

export function ItinerarySummary({
  outbound,
  return: returnItin,
  day,
  score,
}: ItinerarySummaryProps) {
  // Calculate durations using date-based calculations
  const outboundDuration = Math.round(
    calculateDuration(
      outbound.date,
      outbound.startTime,
      outbound.date,
      outbound.endTime
    ) * 60
  );

  const returnDuration = Math.round(
    calculateDuration(
      returnItin.date,
      returnItin.startTime,
      returnItin.date,
      returnItin.endTime
    ) * 60
  );

  // Calculate time at target (arrival to return departure)
  const timeAtTarget = Math.round(
    calculateDuration(
      outbound.date,
      outbound.endTime,
      returnItin.date,
      returnItin.startTime
    ) * 60
  );

  // Get unique transport modes
  const outboundModes = formatModes(outbound.modes);
  const returnModes = formatModes(returnItin.modes);

  // Get percentile label and class if score is provided
  let percentileLabel = null;
  let percentileClass = "";
  if (score !== undefined) {
    const { label, textClass } = getPercentileClasses(score);
    percentileLabel = label;
    percentileClass = textClass;
  }

  return (
    <div className="text-[13px] leading-relaxed">
      <div className="text-gray-700">
        <span className="font-medium">{formatDayLabel(day)}:</span>{" "}
        {outbound.startTime.slice(0, 5)}–{outbound.endTime.slice(0, 5)} (
        {formatDuration(outboundDuration)})
        {outboundModes.length > 0 && (
          <span className="text-gray-500"> via {outboundModes}</span>
        )}
      </div>
      <div className="text-gray-700">
        <span className="font-medium">Return:</span>{" "}
        {returnItin.startTime.slice(0, 5)}–{returnItin.endTime.slice(0, 5)} (
        {formatDuration(returnDuration)})
        {!isSameDay(outbound, returnItin) && (
          <span className="text-xs text-gray-500 ml-1">
            +{getDaysBetween(outbound, returnItin)} day
            {getDaysBetween(outbound, returnItin) > 1 ? "s" : ""}
          </span>
        )}
        {returnModes.length > 0 && (
          <span className="text-gray-500"> via {returnModes}</span>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {percentileLabel && (
          <>
            <span className={`font-medium ${percentileClass}`}>
              {percentileLabel}
            </span>
            <span className="text-gray-600"> · </span>
          </>
        )}
        <span>{formatDuration(timeAtTarget)} until departure</span>
      </div>
    </div>
  );
}
