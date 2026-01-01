import type { Itinerary } from "results/schema";
import { getPercentileClasses } from "~/itineraryQuality";
import { formatDuration, parseTime } from "~/time-utils";
import { getUniqueModes } from "~/mode-utils";

interface ItinerarySummaryProps {
  outbound: Itinerary;
  return: Itinerary;
  day: string;
  score?: number;
}

export function ItinerarySummary({ outbound, return: returnItin, day, score }: ItinerarySummaryProps) {
  // Calculate durations
  const outboundStart = parseTime(outbound.startTime);
  let outboundEnd = parseTime(outbound.endTime);
  if (outboundEnd < outboundStart) outboundEnd += 24;
  const outboundDuration = Math.round((outboundEnd - outboundStart) * 60);

  let returnStart = parseTime(returnItin.startTime);
  let returnEnd = parseTime(returnItin.endTime);
  if (returnStart < outboundEnd) returnStart += 24;
  if (returnEnd < returnStart) returnEnd += 24;
  const returnDuration = Math.round((returnEnd - returnStart) * 60);

  // Calculate time at target (arrival to return departure)
  const timeAtTarget = Math.round((returnStart - outboundEnd) * 60);

  // Get unique transport modes
  const outboundModes = getUniqueModes(outbound.modes);
  const returnModes = getUniqueModes(returnItin.modes);

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
        <span className="font-medium">{day}:</span> {outbound.startTime.slice(0, 5)}–{outbound.endTime.slice(0, 5)} ({formatDuration(outboundDuration)})
        {outboundModes.length > 0 && (
          <span className="text-gray-500"> via {outboundModes.join(", ")}</span>
        )}
      </div>
      <div className="text-gray-700">
        <span className="font-medium">Return:</span> {returnItin.startTime.slice(0, 5)}–{returnItin.endTime.slice(0, 5)} ({formatDuration(returnDuration)})
        {returnModes.length > 0 && (
          <span className="text-gray-500"> via {returnModes.join(", ")}</span>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {percentileLabel && (
          <>
            <span className={`font-medium ${percentileClass}`}>{percentileLabel}</span>
            <span className="text-gray-600"> · </span>
          </>
        )}
        <span>{formatDuration(timeAtTarget)} until departure</span>
      </div>
    </div>
  );
}
