import React from "react";
import type { Itinerary } from "results/schema";
import { ItineraryDisplay } from "./ItineraryDisplay";

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
}

export function TimelineModal({
  isOpen,
  onClose,
  options,
  day,
  startName,
  targetName,
}: TimelineModalProps) {
  const [selectedOutbound, setSelectedOutbound] = React.useState<Itinerary | null>(null);

  if (!isOpen) return null;

  const dayLabel = day.charAt(0) + day.slice(1).toLowerCase();

  // Parse time string to decimal hours
  function parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + minutes / 60;
  }

  // Format time for display
  function formatTime(timeStr: string): string {
    return timeStr.slice(0, 5);
  }

  // Get unique outbound itineraries
  const outbounds = Array.from(
    new Map(options.map((opt) => [opt.outbound.startTime, opt.outbound])).values()
  ).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  // Get returns compatible with selected outbound
  const compatibleReturns = selectedOutbound
    ? options
        .filter((opt) => opt.outbound.startTime === selectedOutbound.startTime)
        .map((opt) => opt.return)
        .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
    : [];

  // Timeline configuration
  const START_HOUR = 6;
  const END_HOUR = 22;
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  // Calculate position and width for timeline bar
  function getTimelineStyle(startTime: string, endTime: string) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const left = ((start - START_HOUR) / TOTAL_HOURS) * 100;
    const width = ((end - start) / TOTAL_HOURS) * 100;
    return { left: `${left}%`, width: `${width}%` };
  }

  // Get mode abbreviations
  function getModeLabel(modes: string[]): string {
    const uniqueModes = new Set(modes);
    uniqueModes.delete("WALK");
    const abbrevs: Record<string, string> = {
      RAIL: "Train",
      BUS: "Bus",
      COACH: "Coach",
      FERRY: "Ferry",
    };
    return Array.from(uniqueModes)
      .map((m) => abbrevs[m] || m)
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
                {startName} to {targetName} • {dayLabel}
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
          {/* Outbound Section */}
          <section className="mb-8">
            <h3 className="font-sans text-base font-bold text-theme-navy-900 mb-4">
              Select Outbound Journey
            </h3>

            {/* Timeline axis */}
            <div className="relative mb-2 h-6">
              <div className="absolute inset-0 flex">
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                  const hour = START_HOUR + i;
                  return (
                    <div
                      key={hour}
                      className="flex-1 text-[11px] text-gray-500 border-l border-gray-300"
                      style={{ textAlign: "left", paddingLeft: "2px" }}
                    >
                      {hour}:00
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outbound timeline bars */}
            <div className="space-y-2">
              {outbounds.map((outbound, idx) => {
                const style = getTimelineStyle(outbound.startTime, outbound.endTime);
                const isSelected = selectedOutbound?.startTime === outbound.startTime;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedOutbound(outbound)}
                    className={`relative w-full h-12 border-2 ${
                      isSelected
                        ? "border-theme-navy-700 bg-theme-navy-700"
                        : "border-gray-300 bg-gray-100 hover:border-theme-navy-700"
                    }`}
                  >
                    <div
                      className={`absolute h-full ${
                        isSelected ? "bg-theme-navy-900" : "bg-theme-navy-700"
                      }`}
                      style={style}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[13px] pointer-events-none">
                      <span className={isSelected ? "text-white" : "text-gray-800"}>
                        {formatTime(outbound.startTime)} → {formatTime(outbound.endTime)}
                      </span>
                      <span className={isSelected ? "text-white" : "text-gray-600"}>
                        {getModeLabel(outbound.modes)}
                      </span>
                    </div>
                  </button>
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

              {/* Timeline axis */}
              <div className="relative mb-2 h-6">
                <div className="absolute inset-0 flex">
                  {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                    const hour = START_HOUR + i;
                    return (
                      <div
                        key={hour}
                        className="flex-1 text-[11px] text-gray-500 border-l border-gray-300"
                        style={{ textAlign: "left", paddingLeft: "2px" }}
                      >
                        {hour}:00
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Return timeline bars */}
              <div className="space-y-2 mb-6">
                {compatibleReturns.map((returnItinerary, idx) => {
                  const style = getTimelineStyle(
                    returnItinerary.startTime,
                    returnItinerary.endTime
                  );
                  return (
                    <div
                      key={idx}
                      className="relative w-full h-12 border-2 border-gray-300 bg-gray-50"
                    >
                      <div
                        className="absolute h-full bg-traditional-green-600"
                        style={style}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2 text-[13px]">
                        <span className="text-gray-800">
                          {formatTime(returnItinerary.startTime)} →{" "}
                          {formatTime(returnItinerary.endTime)}
                        </span>
                        <span className="text-gray-600">
                          {getModeLabel(returnItinerary.modes)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed view */}
              <div className="border-t-2 border-gray-300 pt-6">
                <h4 className="font-sans text-sm font-bold text-theme-navy-900 mb-4">
                  Journey Details
                </h4>
                <div className="space-y-6">
                  <div>
                    <div className="text-sm font-bold text-gray-700 mb-2">Outbound</div>
                    <ItineraryDisplay itinerary={selectedOutbound} />
                  </div>
                  {compatibleReturns.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-gray-700 mb-2">
                        First Return Option
                      </div>
                      <ItineraryDisplay itinerary={compatibleReturns[0]} />
                    </div>
                  )}
                </div>
              </div>
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
