import type { Itinerary } from "results/schema";
import { getPercentileClasses } from "~/utils/itinerary";
import {
  formatDuration,
  isSameDay,
  getDaysBetween,
  calculateDuration,
  formatDayLabel,
  formatTime,
} from "~/utils/format";
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
  // If endTime < startTime, the journey crosses midnight to the next day
  const getEndDate = (
    startDate: string,
    startTime: string,
    endTime: string
  ) => {
    if (endTime < startTime) {
      const nextDay = new Date(startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return nextDay.toISOString().slice(0, 10);
    }
    return startDate;
  };

  const outboundDuration = Math.round(
    calculateDuration(
      outbound.date,
      outbound.startTime,
      getEndDate(outbound.date, outbound.startTime, outbound.endTime),
      outbound.endTime
    ) * 60
  );

  const returnDuration = Math.round(
    calculateDuration(
      returnItin.date,
      returnItin.startTime,
      getEndDate(returnItin.date, returnItin.startTime, returnItin.endTime),
      returnItin.endTime
    ) * 60
  );

  // Calculate time at target (arrival to return departure)
  // Outbound might end on the next day if it crossed midnight
  const outboundEndDate = getEndDate(
    outbound.date,
    outbound.startTime,
    outbound.endTime
  );

  const timeAtTarget = Math.round(
    calculateDuration(
      outboundEndDate,
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
    <div className="text-[13px] leading-snug">
      <div className="font-bold text-gray-700">
        {formatDayLabel(day)}
        <span className="text-xs text-gray-500 font-normal ml-1.5">
          {formatDuration(timeAtTarget)} hike window
        </span>
      </div>
      <div className="text-gray-700">
        Out: {formatTime(outbound.startTime)} - {formatTime(outbound.endTime)}{" "}
        <span className="text-gray-500">
          ({formatDuration(outboundDuration)}) {outboundModes}
        </span>
      </div>
      <div className="text-gray-700">
        Return: {formatTime(returnItin.startTime)} -{" "}
        {formatTime(returnItin.endTime)}{" "}
        <span className="text-gray-500">
          ({formatDuration(returnDuration)}) {returnModes}
        </span>
        {!isSameDay(outbound, returnItin) && (
          <span className="text-xs text-gray-500 ml-1">
            +{getDaysBetween(outbound, returnItin)}d
          </span>
        )}
      </div>
    </div>
  );
}
