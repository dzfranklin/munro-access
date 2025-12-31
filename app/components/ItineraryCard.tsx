import type { Itinerary } from "results/schema";
import { ItinerarySummary } from "./ItinerarySummary";
import { ItineraryDisplay } from "./ItineraryDisplay";
import React from "react";

interface ItineraryCardProps {
  outbound: Itinerary;
  return: Itinerary;
  day: string;
  startName: string;
  score?: number;
}

export function ItineraryCard({ outbound, return: returnItin, day, startName, score }: ItineraryCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="bg-gray-50 border border-gray-300 p-4">
      <div className="mb-3 pb-3 border-b border-gray-200">
        <span className="font-bold text-sm text-gray-800">
          From {startName}
        </span>
        <span className="text-gray-400 mx-2">•</span>
        <span className="text-sm text-gray-600">
          {day.charAt(0) + day.slice(1).toLowerCase()}
        </span>
      </div>

      {isExpanded ? (
        <div>
          <div className="grid md:grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs font-bold text-gray-700 mb-2">
                Outbound
              </div>
              <ItineraryDisplay
                itinerary={outbound}
                type="outbound"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-700 mb-2">
                Return
              </div>
              <ItineraryDisplay
                itinerary={returnItin}
                type="return"
              />
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-theme-navy-700 underline text-sm hover:no-underline"
          >
            Show less
          </button>
          {score !== undefined && (
            <span className="text-xs text-gray-400 ml-3">
              score: {(score * 100).toFixed(0)}%
            </span>
          )}
        </div>
      ) : (
        <div>
          <ItinerarySummary
            outbound={outbound}
            return={returnItin}
            day={day}
            score={score}
          />
          <button
            onClick={() => setIsExpanded(true)}
            className="text-theme-navy-700 underline text-sm hover:no-underline mt-3"
          >
            Show details
          </button>
        </div>
      )}
    </div>
  );
}
