import type { Itinerary } from "results/schema";
import { ItineraryDisplay } from "./ItineraryDisplay";
import { getPercentileClasses } from "~/utils/itinerary";
import {
  formatDuration,
  parseTime,
  pluralize,
  formatDayLabel,
  formatTime,
} from "~/utils/format";
import React from "react";
import { formatModes } from "~/utils/transport";

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
  const [showAll, setShowAll] = React.useState(false);

  // Smart filter: determine how many to show by default
  const goodOptions = options.filter((opt) => opt.score >= 0.5);
  const defaultCount = goodOptions.length > 0 ? goodOptions.length : 1;

  const displayOptions = showAll ? options : options.slice(0, defaultCount);

  return (
    <div className="pb-6">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
              Outbound
            </th>
            <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
              Return
            </th>
            <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3"></th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {displayOptions.map((option, idx) => {
            // Calculate time at target
            let outboundEnd = parseTime(option.outbound.endTime);
            const outboundStart = parseTime(option.outbound.startTime);
            if (outboundEnd < outboundStart) outboundEnd += 24;

            let returnStart = parseTime(option.return.startTime);
            const isNextDayReturn = returnStart < outboundEnd;
            if (isNextDayReturn) returnStart += 24;

            const timeAtTarget = Math.round((returnStart - outboundEnd) * 60);

            const outboundDuration = Math.round(
              (outboundEnd - outboundStart) * 60
            );
            let returnEnd = parseTime(option.return.endTime);
            if (returnEnd < returnStart) returnEnd += 24;
            const returnDuration = Math.round((returnEnd - returnStart) * 60);

            const outboundModes = formatModes(option.outbound.modes);
            const returnModes = formatModes(option.return.modes);

            const { label: percentileLabel, textClass: percentileClass } =
              getPercentileClasses(option.score);

            if (expandedIndex === idx) {
              return (
                <React.Fragment key={idx}>
                  <tr className="border-b border-gray-200">
                    <td colSpan={4} className="py-3">
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
                      <button
                        onClick={() => setExpandedIndex(null)}
                        className="text-theme-navy-700 underline text-xs hover:no-underline"
                      >
                        hide
                      </button>
                      <span className="text-xs text-gray-400 ml-3">
                        score: {(option.score * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              );
            }

            return (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 pr-3 align-top text-[13px]">
                  <div className="text-gray-700">
                    {formatTime(option.outbound.startTime)} –{" "}
                    {formatTime(option.outbound.endTime)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(outboundDuration)} via {outboundModes}
                  </div>
                </td>
                <td className="py-3 pr-3 align-top text-[13px]">
                  <div className="text-gray-700">
                    {formatTime(option.return.startTime)} –{" "}
                    {formatTime(option.return.endTime)}
                    {isNextDayReturn && (
                      <span className="text-xs text-gray-500 ml-1">+1 day</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(returnDuration)} via {returnModes}
                  </div>
                </td>
                <td className="py-3 pr-3 align-top text-xs text-gray-600">
                  <span className={`font-medium ${percentileClass}`}>
                    {percentileLabel}
                  </span>
                  <span className="text-gray-600"> · </span>
                  <span>{formatDuration(timeAtTarget)} hike window</span>
                </td>
                <td className="py-3 align-top">
                  <button
                    onClick={() => setExpandedIndex(idx)}
                    className="text-gray-400 hover:text-theme-navy-700 text-xs"
                    aria-label="Show details"
                  >
                    ⋯
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {options.length > defaultCount && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-theme-navy-700 underline text-xs hover:no-underline mt-3"
        >
          {showAll
            ? goodOptions.length > 0
              ? `Show top ${defaultCount} only`
              : `Show best only`
            : `Show ${pluralize(options.length - defaultCount, "more option")}`}
        </button>
      )}
    </div>
  );
}
