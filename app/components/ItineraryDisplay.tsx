import type { Itinerary } from "results/schema";
import { formatDuration, parseTime } from "~/time-utils";

interface ItineraryDisplayProps {
  itinerary: Itinerary;
  type: "outbound" | "return";
}

export function ItineraryDisplay({ itinerary, type }: ItineraryDisplayProps) {
  const startTime = parseTime(itinerary.startTime);
  let endTime = parseTime(itinerary.endTime);

  // Handle overnight journeys
  if (endTime < startTime) {
    endTime += 24;
  }

  const durationMinutes = Math.round((endTime - startTime) * 60);

  // Build entries including waits between legs
  const entries: Array<{ type: 'leg' | 'wait'; startTime: string; endTime: string; leg?: typeof itinerary.legs[0]; waitMinutes?: number }> = [];
  
  itinerary.legs.forEach((leg, i) => {
    // Add wait if there's a gap from previous leg
    if (i > 0) {
      const prevLeg = itinerary.legs[i - 1];
      const prevEndTime = parseTime(prevLeg.endTime);
      const currentStartTime = parseTime(leg.startTime);
      const waitMinutes = Math.round((currentStartTime - prevEndTime) * 60);
      
      if (waitMinutes > 0) {
        entries.push({
          type: 'wait',
          startTime: prevLeg.endTime,
          endTime: leg.startTime,
          waitMinutes
        });
      }
    }
    
    entries.push({
      type: 'leg',
      startTime: leg.startTime,
      endTime: leg.endTime,
      leg
    });
  });

  return (
    <div className="text-[13px]">
      <div className="text-gray-600 mb-1.5">
        {itinerary.startTime.slice(0, 5)} → {itinerary.endTime.slice(0, 5)}
        <span className="text-xs text-gray-500 ml-1">
          ({formatDuration(durationMinutes)})
        </span>
      </div>

      <div className="space-y-0.5">
        {entries.map((entry, i) => {
          if (entry.type === 'wait') {
            return (
              <div key={`wait-${i}`} className="text-xs text-gray-500 leading-relaxed italic">
                <span className="text-gray-400 inline-block w-10">{entry.startTime.slice(0, 5)}</span>
                <span>Wait {formatDuration(entry.waitMinutes!)} until {entry.endTime.slice(0, 5)}</span>
              </div>
            );
          }
          
          const leg = entry.leg!;
          return (
            <div key={`leg-${i}`} className="text-xs text-gray-600 leading-relaxed">
              <span className="text-gray-400 inline-block w-10">{leg.startTime.slice(0, 5)}</span>
              <span className="font-medium">{getModeLabel(leg.mode)}</span>
              <span>
                {" "}
                {leg.from.name} → {leg.to.name}
              </span>
              {leg.routeName && (
                <span className="text-gray-500">
                  {" "}
                  ({leg.routeName})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    RAIL: "Train:",
    BUS: "Bus:",
    COACH: "Coach:",
    FERRY: "Ferry:",
    BICYCLE: "Bike:",
    WALK: "Walk:",
    TRAM: "Tram:",
  };
  return labels[mode] || "Walk:";
}
