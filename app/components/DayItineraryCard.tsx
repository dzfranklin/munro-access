import type { Itinerary } from "results/schema";
import { ItinerarySummary } from "./ItinerarySummary";
import { ItineraryDisplay } from "./ItineraryDisplay";
import React from "react";

interface ItineraryOption {
  outbound: Itinerary;
  return: Itinerary;
  score: number;
}

interface DayItineraryCardProps {
  day: string;
  options: ItineraryOption[];
}

export function DayItineraryCard({ day, options }: DayItineraryCardProps) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const dayLabel = day.charAt(0) + day.slice(1).toLowerCase();

  function parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + minutes / 60;
  }

  function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  return (
    <div className="border-b border-gray-200 pb-6">
      <h5 className="font-bold text-sm text-gray-800 mb-3">
        {dayLabel}
      </h5>

      <div className="space-y-3">
        {options.map((option, idx) => {
          // Calculate time at target
          let outboundEnd = parseTime(option.outbound.endTime);
          const outboundStart = parseTime(option.outbound.startTime);
          if (outboundEnd < outboundStart) outboundEnd += 24;
          
          let returnStart = parseTime(option.return.startTime);
          if (returnStart < outboundEnd) returnStart += 24;
          
          const timeAtTarget = Math.round((returnStart - outboundEnd) * 60);

          return (
            <div key={idx} className="bg-gray-50 border border-gray-300 p-4">
              {expandedIndex === idx ? (
                <div>
                  <div className="grid md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs font-bold text-gray-700 mb-2">
                        Outbound
                      </div>
                      <ItineraryDisplay
                        itinerary={option.outbound}
                        type="outbound"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-700 mb-2">
                        Return
                      </div>
                      <ItineraryDisplay
                        itinerary={option.return}
                        type="return"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mb-3 pb-3 border-b border-gray-300">
                    {formatDuration(timeAtTarget)} until departure
                  </div>
                  <button
                    onClick={() => setExpandedIndex(null)}
                    className="text-traditional-navy-700 underline text-sm hover:no-underline"
                  >
                    Show less
                  </button>
                </div>
              ) : (
                <div>
                  <ItinerarySummary
                    outbound={option.outbound}
                    return={option.return}
                    day={day}
                  />
                  <button
                    onClick={() => setExpandedIndex(idx)}
                    className="text-traditional-navy-700 underline text-sm hover:no-underline mt-3"
                  >
                    Show details
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
