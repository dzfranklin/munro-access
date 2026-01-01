import type { Itinerary } from "results/schema";
import { ItineraryDisplay } from "./ItineraryDisplay";
import { formatDuration, formatTime } from "~/utils/format";
import { formatModes } from "~/utils/transport";
import React from "react";

interface AllItinerariesListProps {
  outbounds: Itinerary[];
  returns: Itinerary[];
}

function ItineraryRow({
  itinerary,
  type,
}: {
  itinerary: Itinerary;
  type: "outbound" | "return";
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const startTime = formatTime(itinerary.startTime);
  const endTime = formatTime(itinerary.endTime);

  // Calculate duration handling overnight journeys
  let duration: number;
  const startMs = new Date(
    `${itinerary.date}T${itinerary.startTime}`
  ).getTime();
  let endMs = new Date(`${itinerary.date}T${itinerary.endTime}`).getTime();

  // If end time is before start time, it's an overnight journey
  if (endMs < startMs) {
    endMs += 24 * 60 * 60 * 1000; // Add 24 hours
  }

  duration = Math.round((endMs - startMs) / 60000);
  const transfers =
    itinerary.legs.filter((leg) => leg.mode !== "WALK").length - 1;
  const modes = formatModes(itinerary.modes);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left py-2.5 px-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between text-xs gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-theme-navy-900 whitespace-nowrap">
                {startTime} → {endTime}
              </span>
              <span className="text-gray-500 whitespace-nowrap">
                ({formatDuration(duration)})
              </span>
            </div>
            <div className="text-gray-600">
              <span>{modes}</span>
              <span className="mx-1.5">·</span>
              <span>
                {transfers} {transfers === 1 ? "transfer" : "transfers"}
              </span>
            </div>
          </div>
          <span className="text-gray-500 shrink-0 pt-0.5">
            {isExpanded ? "−" : "+"}
          </span>
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3">
          <ItineraryDisplay itinerary={itinerary} type={type} />
        </div>
      )}
    </div>
  );
}

export function AllItinerariesList({
  outbounds,
  returns,
}: AllItinerariesListProps) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Outbound itineraries */}
      <div>
        <h4 className="font-sans text-sm font-normal text-gray-600 mb-2">
          Outbound Options ({outbounds.length})
        </h4>
        <div className="border border-gray-300 bg-white">
          {outbounds.map((itinerary, idx) => (
            <ItineraryRow key={idx} itinerary={itinerary} type="outbound" />
          ))}
        </div>
      </div>

      {/* Return itineraries */}
      <div>
        <h4 className="font-sans text-sm font-normal text-gray-600 mb-2">
          Return Options ({returns.length})
        </h4>
        <div className="border border-gray-300 bg-white">
          {returns.map((itinerary, idx) => (
            <ItineraryRow key={idx} itinerary={itinerary} type="return" />
          ))}
        </div>
      </div>
    </div>
  );
}
