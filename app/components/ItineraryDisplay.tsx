import type { Itinerary } from "results/schema";

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

  return (
    <div className="text-[13px]">
      <div className="text-gray-600 mb-1.5">
        {itinerary.startTime.slice(0, 5)} → {itinerary.endTime.slice(0, 5)}
        <span className="text-xs text-gray-500 ml-1">
          ({durationMinutes}min)
        </span>
      </div>

      <div className="pl-3 space-y-0.5">
        {itinerary.legs.map((leg, i) => (
          <div key={i} className="text-xs text-gray-600 leading-relaxed">
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
        ))}
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

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}
