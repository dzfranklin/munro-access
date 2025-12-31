import type { Itinerary } from "results/schema";

interface ItinerarySummaryProps {
  outbound: Itinerary;
  return: Itinerary;
  day: string;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}

function getModeAbbrev(mode: string): string {
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

function getUniqueModes(itinerary: Itinerary): string[] {
  const modes = new Set(itinerary.modes);
  // Remove WALK as it's typically not interesting
  modes.delete("WALK");
  return Array.from(modes).map(getModeAbbrev);
}

export function ItinerarySummary({ outbound, return: returnItin, day }: ItinerarySummaryProps) {
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
  const outboundModes = getUniqueModes(outbound);
  const returnModes = getUniqueModes(returnItin);

  return (
    <div className="text-[13px] leading-relaxed">
      <div className="text-gray-700">
        <span className="font-medium">Out:</span> {outbound.startTime.slice(0, 5)}–{outbound.endTime.slice(0, 5)} ({formatDuration(outboundDuration)})
        {outboundModes.length > 0 && (
          <span className="text-gray-500"> via {outboundModes.join(", ")}</span>
        )}
      </div>
      <div className="text-gray-700">
        <span className="font-medium">Return:</span> {returnItin.startTime.slice(0, 5)}–{returnItin.endTime.slice(0, 5)} ({formatDuration(returnDuration)})
        {returnModes.length > 0 && (
          <span className="text-gray-500"> via {returnModes.join(", ")}</span>
        )}
        <span className="text-gray-600"> · </span>
        <span className="text-xs text-gray-600">{formatDuration(timeAtTarget)} until departure</span>
      </div>
    </div>
  );
}
