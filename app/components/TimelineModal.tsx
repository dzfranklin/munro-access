import React from "react";
import type { Itinerary, Route, Munro } from "results/schema";
import { ItineraryDisplay } from "./ItineraryDisplay";
import {
  formatDuration,
  parseTime,
  isSameDay,
  formatTime,
  formatDayLabel,
} from "~/utils/format";
import { formatMode } from "~/utils/transport";
import { getViableReturns } from "results/itinerary-utils";

interface ItineraryOption {
  outbound: Itinerary;
  return: Itinerary;
  score: number;
}

interface TimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ItineraryOption[];
  day: string;
  startName: string;
  targetName: string;
  routes: Array<{
    route: Route;
    munros: Munro[];
  }>;
}

export function TimelineModal({
  isOpen,
  onClose,
  options,
  day,
  startName,
  targetName,
  routes,
}: TimelineModalProps) {
  const [selectedOutbound, setSelectedOutbound] =
    React.useState<Itinerary | null>(null);
  const [selectedReturn, setSelectedReturn] = React.useState<Itinerary | null>(
    null
  );

  // Get unique outbound itineraries
  const outbounds = Array.from(
    new Map(
      options.map((opt) => [opt.outbound.startTime, opt.outbound])
    ).values()
  ).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  // Get all unique returns from options
  const allReturns = Array.from(
    new Map(options.map((opt) => [opt.return.startTime, opt.return])).values()
  );

  // Use the shortest route time (most conservative for showing returns)
  const longestRoute = routes.reduce((longest, r) => {
    const longestMax = longest.route.stats.timeHours.max;
    const routeMax = r.route.stats.timeHours.max;
    return routeMax > longestMax ? r : longest;
  }, routes[0]);

  // Get returns viable for selected outbound (50% of shorter route time)
  // Filter to same-day returns only for timeline view
  const compatibleReturns =
    selectedOutbound && longestRoute
      ? getViableReturns(
          selectedOutbound,
          allReturns,
          longestRoute.route
        ).filter((ret) => {
          // Only show same-day returns in timeline view
          return isSameDay(selectedOutbound, ret);
        })
      : [];

  // Find the best-scored return from the compatible options
  const getBestReturn = (
    outbound: Itinerary,
    viable: Itinerary[]
  ): Itinerary | null => {
    if (viable.length === 0) return null;

    // Find returns from original scored options that match this outbound
    const scoredReturnsForOutbound = options
      .filter((opt) => opt.outbound.startTime === outbound.startTime)
      .sort((a, b) => b.score - a.score); // Sort by score descending

    // Return the highest-scored viable return, or first viable if none scored
    for (const scored of scoredReturnsForOutbound) {
      const match = viable.find((v) => v.startTime === scored.return.startTime);
      if (match) return match;
    }

    return viable[0]; // Fallback to earliest viable return
  };

  // Auto-select best outbound when modal opens
  React.useEffect(() => {
    if (isOpen && outbounds.length > 0 && !selectedOutbound) {
      // Find the best-scored outbound from options
      const bestOption = options.reduce(
        (best, opt) => (opt.score > best.score ? opt : best),
        options[0]
      );
      setSelectedOutbound(bestOption.outbound);
    }
  }, [isOpen, outbounds.length]);

  // Auto-select best return when outbound changes
  React.useEffect(() => {
    if (selectedOutbound && compatibleReturns.length > 0) {
      const best = getBestReturn(selectedOutbound, compatibleReturns);
      if (best) setSelectedReturn(best);
    } else if (selectedOutbound && compatibleReturns.length === 0) {
      // Clear selection if no compatible returns
      setSelectedReturn(null);
    }
  }, [selectedOutbound?.startTime, compatibleReturns.length]);

  if (!isOpen) return null;

  // Timeline configuration
  const START_HOUR = 4;
  const END_HOUR = 24; // Midnight
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  // Calculate position and width for timeline bar, with clipping at midnight
  function getTimelineStyle(startTime: string, endTime: string) {
    const start = parseTime(startTime);
    let end = parseTime(endTime);

    // Handle overnight journeys (end time after midnight)
    if (end < start) {
      end += 24;
    }

    // Clip at midnight
    const clippedEnd = Math.min(end, END_HOUR);
    const isClipped = end > END_HOUR;

    const left = ((start - START_HOUR) / TOTAL_HOURS) * 100;
    const width = ((clippedEnd - start) / TOTAL_HOURS) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(0, width)}%`,
      isClipped,
    };
  }

  // Helper function to format mode labels for display in timeline
  function getModeLabel(modes: string[]): string {
    const uniqueModes = new Set(modes);
    uniqueModes.delete("WALK");
    return Array.from(uniqueModes)
      .map((m) => formatMode(m))
      .join(" + ");
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-theme-navy-700 max-w-[1200px] w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b-2 border-gray-300 p-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-serif text-2xl font-normal text-theme-navy-900 m-0">
                Timeline View
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {startName} to {targetName} • {formatDayLabel(day)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800 text-2xl leading-none px-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Sticky Timeline Header */}
          <div className="sticky top-0 bg-white z-10 py-3 mb-4 border-b-2 border-gray-300 -mx-5 px-5">
            {/* Timeline axis */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-shrink-0 w-28"></div>
              <div className="relative flex-1 h-8">
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                  const hour = START_HOUR + i;
                  const position = (i / TOTAL_HOURS) * 100;
                  const isMajor = hour % 2 === 0;
                  return (
                    <div
                      key={hour}
                      className="absolute text-[11px] text-gray-600"
                      style={{
                        left: `${position}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div
                        className={`${isMajor ? "border-l-2 border-gray-400 h-3" : "border-l border-gray-300 h-2"} mb-1`}
                        style={{ marginLeft: "50%" }}
                      />
                      {isMajor && <div className="font-bold">{hour}:00</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex-shrink-0 w-20"></div>
            </div>

            {/* Hike window */}
            {selectedOutbound &&
              selectedReturn &&
              (() => {
                const outboundEnd = parseTime(selectedOutbound.endTime);
                const returnStart = parseTime(selectedReturn.startTime);

                // Don't show if return starts before outbound ends
                if (returnStart < outboundEnd) return null;

                const hikeStart = outboundEnd;
                const hikeEnd = returnStart;
                const style = getTimelineStyle(
                  `${Math.floor(hikeStart)}:${Math.round((hikeStart % 1) * 60)
                    .toString()
                    .padStart(2, "0")}`,
                  `${Math.floor(hikeEnd)}:${Math.round((hikeEnd % 1) * 60)
                    .toString()
                    .padStart(2, "0")}`
                );
                const hikeMinutes = Math.round((hikeEnd - hikeStart) * 60);
                const startTimeStr = formatTime(
                  `${Math.floor(hikeStart)}:${Math.round((hikeStart % 1) * 60)
                    .toString()
                    .padStart(2, "0")}`
                );
                const endTimeStr = formatTime(
                  `${Math.floor(hikeEnd)}:${Math.round((hikeEnd % 1) * 60)
                    .toString()
                    .padStart(2, "0")}`
                );

                return (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-shrink-0 w-28 text-right">
                      <div className="text-xs font-bold text-gray-700">
                        Hike Window
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatDuration(hikeMinutes)}
                      </div>
                    </div>
                    <div className="relative flex-1 h-7 bg-gray-50 border border-gray-300 flex items-center">
                      {/* Start time - left of bar */}
                      <div
                        className="absolute text-xs text-gray-700 pr-1 text-right"
                        style={{ right: `${100 - parseFloat(style.left)}%` }}
                      >
                        {startTimeStr}
                      </div>
                      {/* Gray bar */}
                      <div
                        className="absolute inset-y-0 bg-gray-400"
                        style={{ left: style.left, width: style.width }}
                      />
                      {/* End time - right of bar */}
                      <div
                        className="absolute text-xs text-gray-700 pl-1 text-left"
                        style={{ left: `calc(${style.left} + ${style.width})` }}
                      >
                        {endTimeStr}
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-20"></div>
                  </div>
                );
              })()}
          </div>
          {/* Outbound Section */}
          <section className="mb-8">
            <h3 className="font-sans text-base font-bold text-theme-navy-900 mb-4">
              Select Outbound Journey
            </h3>

            {/* Outbound timeline bars */}
            <div className="space-y-2.5">
              {outbounds.map((outbound, idx) => {
                const style = getTimelineStyle(
                  outbound.startTime,
                  outbound.endTime
                );
                const isSelected =
                  selectedOutbound?.startTime === outbound.startTime;
                let durationMinutes = Math.round(
                  (parseTime(outbound.endTime) -
                    parseTime(outbound.startTime)) *
                    60
                );
                // Handle overnight journeys
                if (durationMinutes < 0) {
                  durationMinutes += 24 * 60;
                }
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedOutbound(outbound)}
                    className={`flex items-center gap-2 cursor-pointer p-2 -m-2 transition-colors ${
                      isSelected ? "bg-gray-200" : "hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex-shrink-0 w-28 text-right text-[13px]">
                      <div
                        className={`font-bold ${isSelected ? "text-gray-800" : "text-gray-800"}`}
                      >
                        {formatTime(outbound.startTime)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {getModeLabel(outbound.modes)}
                      </div>
                    </div>
                    <div className="relative flex-1 h-10 bg-gray-50 flex items-center">
                      <div
                        className={`absolute inset-y-2 transition-all ${
                          isSelected ? "bg-gray-500 shadow-md" : "bg-gray-400"
                        }`}
                        style={{ left: style.left, width: style.width }}
                      />
                    </div>
                    <div className="flex-shrink-0 w-20 text-left text-[13px]">
                      <div
                        className={`font-bold ${isSelected ? "text-gray-800" : "text-gray-800"}`}
                      >
                        {formatTime(outbound.endTime)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatDuration(durationMinutes)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          {/* Return Section */}
          {selectedOutbound && (
            <section className="mb-6">
              <h3 className="font-sans text-base font-bold text-theme-navy-900 mb-4">
                Available Returns
              </h3>

              {/* Return timeline bars */}
              <div className="space-y-2.5 mb-6">
                {compatibleReturns.map((returnItinerary, idx) => {
                  const style = getTimelineStyle(
                    returnItinerary.startTime,
                    returnItinerary.endTime
                  );
                  const isSelected =
                    selectedReturn?.startTime === returnItinerary.startTime;
                  let durationMinutes = Math.round(
                    (parseTime(returnItinerary.endTime) -
                      parseTime(returnItinerary.startTime)) *
                      60
                  );
                  // Handle overnight journeys
                  if (durationMinutes < 0) {
                    durationMinutes += 24 * 60;
                  }
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedReturn(returnItinerary)}
                      className={`flex items-center gap-2 cursor-pointer p-2 -m-2 transition-colors ${
                        isSelected ? "bg-gray-200" : "hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex-shrink-0 w-28 text-right text-[13px]">
                        <div
                          className={`font-bold ${isSelected ? "text-gray-800" : "text-gray-800"}`}
                        >
                          {formatTime(returnItinerary.startTime)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {getModeLabel(returnItinerary.modes)}
                        </div>
                      </div>
                      <div className="relative flex-1 h-10 bg-gray-50 flex items-center">
                        <div
                          className={`absolute inset-y-2 transition-all ${
                            isSelected ? "bg-gray-500 shadow-md" : "bg-gray-400"
                          }`}
                          style={{ left: style.left, width: style.width }}
                        />
                        {style.isClipped && (
                          <div className="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-center bg-gradient-to-r from-transparent to-white pointer-events-none">
                            <span className="text-gray-600 font-bold text-lg">
                              →
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 w-20 text-left text-[13px]">
                        <div
                          className={`font-bold ${isSelected ? "text-gray-800" : "text-gray-800"}`}
                        >
                          {formatTime(returnItinerary.endTime)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatDuration(durationMinutes)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed view */}
              {selectedReturn && (
                <div className="border-t-2 border-gray-300 pt-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <div className="text-sm font-bold text-theme-navy-900 mb-3">
                        Outbound Journey
                      </div>
                      <ItineraryDisplay
                        itinerary={selectedOutbound}
                        type="outbound"
                      />
                    </div>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <div className="text-sm font-bold text-theme-navy-900 mb-3">
                        Return Journey
                      </div>
                      <ItineraryDisplay
                        itinerary={selectedReturn}
                        type="return"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          {!selectedOutbound && (
            <div className="text-center py-10 text-gray-500">
              Select an outbound journey to see return options
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
