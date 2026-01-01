import type { Itinerary } from "results/schema";
import {
  formatDuration,
  parseTime,
  isOvernightJourney,
  formatTime,
} from "~/utils/format";
import { formatMode } from "~/utils/transport";

interface ItineraryDisplayProps {
  itinerary: Itinerary;
  type: "outbound" | "return";
}

export function ItineraryDisplay({ itinerary, type }: ItineraryDisplayProps) {
  const startTime = parseTime(itinerary.startTime);
  let endTime = parseTime(itinerary.endTime);

  // Handle overnight journeys
  if (isOvernightJourney(itinerary)) {
    endTime += 24;
  }

  const durationMinutes = Math.round((endTime - startTime) * 60);

  // Build entries including waits between legs
  const entries: Array<{
    type: "leg" | "wait";
    startTime: string;
    endTime: string;
    leg?: (typeof itinerary.legs)[0];
    waitMinutes?: number;
  }> = [];

  itinerary.legs.forEach((leg, i) => {
    // Add wait if there's a gap from previous leg
    if (i > 0) {
      const prevLeg = itinerary.legs[i - 1];
      const prevEndTime = parseTime(prevLeg.endTime);
      const currentStartTime = parseTime(leg.startTime);
      const waitMinutes = Math.round((currentStartTime - prevEndTime) * 60);

      if (waitMinutes > 0) {
        entries.push({
          type: "wait",
          startTime: prevLeg.endTime,
          endTime: leg.startTime,
          waitMinutes,
        });
      }
    }

    entries.push({
      type: "leg",
      startTime: leg.startTime,
      endTime: leg.endTime,
      leg,
    });
  });

  return (
    <div className="text-[13px]">
      <div className="text-gray-600 mb-1.5">
        {formatTime(itinerary.startTime)} → {formatTime(itinerary.endTime)}
        <span className="text-xs text-gray-500 ml-1">
          ({formatDuration(durationMinutes)})
        </span>
      </div>

      <div className="space-y-0.5">
        {entries.map((entry, i) => {
          if (entry.type === "wait") {
            return (
              <div
                key={`wait-${i}`}
                className="text-xs text-gray-500 leading-relaxed italic"
              >
                <span className="text-gray-400 inline-block w-10">
                  {formatTime(entry.startTime)}
                </span>
                <span>
                  Wait {formatDuration(entry.waitMinutes!)} until{" "}
                  {formatTime(entry.endTime)}
                </span>
              </div>
            );
          }

          const leg = entry.leg!;
          return (
            <div
              key={`leg-${i}`}
              className="text-xs text-gray-600 leading-relaxed"
            >
              <span className="text-gray-400 inline-block w-10">
                {formatTime(leg.startTime)}
              </span>
              <span className="font-medium">{formatMode(leg.mode)}:</span>
              <span>
                {" "}
                {leg.from.name} → {leg.to.name}
              </span>
              {(leg.agencyName || leg.routeName) && (
                <span className="text-gray-500">
                  {" "}
                  ({leg.agencyName && leg.agencyName + " "}
                  {leg.routeName})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
