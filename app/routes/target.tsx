import {
  targetMap,
  startMap,
  munroMap,
  resultMap,
  targetCacheForDefaultPrefs,
  percentileMapForDefaultPrefs,
} from "results/parse.server";
import type { Route } from "./+types/target";
import { data, Link, useSearchParams } from "react-router";
import { getBestItinerariesForTarget } from "results/best-itineraries";
import { DEFAULT_PREFERENCES } from "results/scoring";
import { DayItineraryCard } from "~/components/DayItineraryCard";
import { TimelineModal } from "~/components/TimelineModal";
import React from "react";
import { START_LOCATION_ORDER } from "~/utils/constants";
import { formatDayLabel } from "~/utils/format";
import { parsePreferencesFromCookie } from "~/utils/preferences.server";

type StartInfo = {
  id: string;
  name: string;
};

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData.target.name} - Munro Access` },
    {
      name: "description",
      content: `Public transport routes to ${loaderData.target.description}`,
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const target = targetMap.get(params.id);
  if (!target) {
    throw data(null, { status: 404 });
  }

  // Parse preferences from cookie
  const cookieHeader = request.headers.get("Cookie");
  const preferences = parsePreferencesFromCookie(cookieHeader);

  // Determine if we're using default preferences (for optimization)
  const isDefaultPrefs =
    JSON.stringify(preferences) === JSON.stringify(DEFAULT_PREFERENCES);

  // Get best itineraries for this target with user preferences
  const bestItineraries = getBestItinerariesForTarget(
    params.id,
    resultMap,
    targetMap,
    munroMap,
    preferences.ranking,
    10,
    isDefaultPrefs ? percentileMapForDefaultPrefs : undefined,
    isDefaultPrefs ? targetCacheForDefaultPrefs : undefined
  );

  const gmapsEmbedKey = process.env.GOOGLE_MAPS_EMBED_KEY;

  // Get all unique start locations with their names
  const startIdsSet = new Set<string>();
  if (bestItineraries) {
    for (const option of bestItineraries.bestOptions) {
      startIdsSet.add(option.startId);
    }
  }

  const starts: StartInfo[] = Array.from(startIdsSet)
    .sort((a, b) => {
      const aName = startMap.get(a)?.name || a;
      const bName = startMap.get(b)?.name || b;
      return (
        START_LOCATION_ORDER.indexOf(aName as any) -
        START_LOCATION_ORDER.indexOf(bName as any)
      );
    })
    .map((id) => ({
      id,
      name: startMap.get(id)?.name || id,
    }));

  // Get start locations for preferences panel
  const startLocations = starts.map(({ id, name }) => ({
    id,
    name,
  }));

  return {
    target,
    bestItineraries,
    gmapsEmbedKey,
    starts,
    preferences,
    startLocations,
  };
}

export default function Target({ loaderData }: Route.ComponentProps) {
  const { target, bestItineraries, gmapsEmbedKey, starts, preferences } =
    loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [timelineModalOpen, setTimelineModalOpen] = React.useState(false);
  const [timelineDay, setTimelineDay] = React.useState<string | null>(null);

  // Read start from URL
  const urlStart = searchParams.get("start");

  // Priority: URL > preferredStartLocation > first available start
  const selectedStart = (() => {
    if (urlStart && starts.some((s) => s.id === urlStart)) {
      return urlStart;
    }
    if (
      preferences.ui.preferredStartLocation &&
      starts.some((s) => s.id === preferences.ui.preferredStartLocation)
    ) {
      return preferences.ui.preferredStartLocation;
    }
    return starts.length > 0 ? starts[0].id : null;
  })();

  // Track when content is switching for fade effect
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const prevStartRef = React.useRef(selectedStart);

  React.useEffect(() => {
    if (prevStartRef.current !== selectedStart) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        prevStartRef.current = selectedStart;
      }, 75);
      return () => clearTimeout(timer);
    }
  }, [selectedStart]);

  // When user clicks a tab, update URL but don't scroll
  const handleStartChange = (startId: string) => {
    setSearchParams({ start: startId }, { preventScrollReset: true });
  };

  // Open timeline modal for a specific day
  const openTimeline = (day: string) => {
    setTimelineDay(day);
    setTimelineModalOpen(true);
  };

  // Get options for selected start and timeline day
  const timelineOptions =
    bestItineraries && selectedStart && timelineDay
      ? bestItineraries.bestOptions.filter(
          (opt) => opt.startId === selectedStart && opt.day === timelineDay
        )
      : [];

  return (
    <>
      {/* Navigation */}
      <nav className="mb-6 flex justify-between items-center">
        <Link
          to={urlStart ? `/?start=${urlStart}` : "/"}
          className="text-theme-navy-700 underline text-sm hover:no-underline"
        >
          Back to best options
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b-[3px] border-theme-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0 mb-2.5">
          {target.name}
        </h1>
        {target.description !== target.name && (
          <p className="font-sans text-base text-gray-600 m-0">
            {target.description}
          </p>
        )}
      </header>

      {/* Map */}
      {gmapsEmbedKey && (
        <div className="mb-8">
          <iframe
            width="100%"
            height="250"
            className="border border-gray-300"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen={true}
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?q=${target.lngLat[1]}%2C${target.lngLat[0]}&zoom=10&key=${gmapsEmbedKey}`}
          ></iframe>
        </div>
      )}

      {/* Routes */}
      <section className="mb-8">
        <h2 className="font-serif text-2xl font-normal text-theme-navy-900 border-b-2 border-gray-300 pb-2 mb-6">
          Routes from {target.name}
        </h2>

        {target.routes.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No routes available.
          </div>
        ) : (
          <div className="space-y-3 font-serif text-gray-700">
            {target.routes.map((route) => (
              <div key={route.page}>
                <div className="text-sm font-medium">{route.name}</div>
                <div className="text-[13px]">
                  <span className="text-gray-600">
                    {route.stats.distanceKm}km • {route.stats.timeHours.min}-
                    {route.stats.timeHours.max}h • {route.stats.ascentM}m •{" "}
                    <a
                      href={route.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-theme-navy-700 underline"
                    >
                      walkhighlands
                    </a>
                  </span>
                </div>
                <div className="text-[13px]">
                  {route.munros.map((munro, idx) => (
                    <span key={munro.number}>
                      {idx > 0 && <span className="text-gray-400"> • </span>}
                      <Link
                        to={`/munro/${munro.number}-${munro.name
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, "")}`}
                        className="text-theme-navy-700 underline"
                      >
                        {munro.name}
                      </Link>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Public Transport Options */}
      <section>
        <h2 className="flex justify-between items-baseline font-serif text-2xl font-normal text-theme-navy-900 border-b-2 border-gray-300 pb-2 mb-6">
          Public Transport to {target.name}{" "}
          <Link
            to={
              urlStart
                ? `/target/${target.id}/all-itineraries?start=${urlStart}`
                : `/target/${target.id}/all-itineraries`
            }
            className="text-theme-navy-700 underline text-sm hover:no-underline"
          >
            View all transport options
          </Link>
        </h2>

        {!bestItineraries || bestItineraries.bestOptions.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No viable public transport options found.
          </div>
        ) : (
          <div>
            {/* Start location tabs */}
            {starts.length > 1 && (
              <div className="border-b-2 border-gray-200 mb-6">
                <div className="flex gap-1">
                  {starts.map((start) => (
                    <button
                      key={start.id}
                      onClick={() => handleStartChange(start.id)}
                      className={`px-4 py-2 text-sm font-bold border-b-2 -mb-0.5 ${
                        selectedStart === start.id
                          ? "border-theme-navy-700 text-theme-navy-900"
                          : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300"
                      }`}
                    >
                      {start.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Itineraries for selected start location */}
            <div
              className="space-y-6 transition-opacity duration-75"
              style={{ opacity: isTransitioning ? 0 : 1 }}
            >
              {(() => {
                // Filter options for selected start location
                const optionsForStart = bestItineraries.bestOptions.filter(
                  (opt) => opt.startId === selectedStart
                );

                if (optionsForStart.length === 0) {
                  return (
                    <div className="text-center py-10 text-gray-500">
                      No options available from this location.
                    </div>
                  );
                }

                // Group by day
                const optionsByDay = new Map<string, typeof optionsForStart>();
                for (const option of optionsForStart) {
                  if (!optionsByDay.has(option.day)) {
                    optionsByDay.set(option.day, []);
                  }
                  optionsByDay.get(option.day)!.push(option);
                }

                // Sort days
                const dayOrder = ["WEDNESDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
                const sortedDays = Array.from(optionsByDay.keys()).sort(
                  (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
                );

                return sortedDays.map((day) => (
                  <div key={day}>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-sans text-base font-bold text-theme-navy-900">
                        {formatDayLabel(day)}
                      </h3>
                      <button
                        onClick={() => openTimeline(day)}
                        className="text-[13px] text-theme-navy-700 underline hover:no-underline"
                      >
                        View Timeline
                      </button>
                    </div>
                    <DayItineraryCard
                      day={day}
                      options={optionsByDay.get(day)!}
                    />
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </section>

      {/* Timeline Modal */}
      <TimelineModal
        isOpen={timelineModalOpen}
        onClose={() => setTimelineModalOpen(false)}
        key={`${selectedStart}-${timelineDay}`} // Reset state when start/day changes
        options={timelineOptions}
        day={timelineDay || ""}
        startName={
          selectedStart
            ? starts.find((s) => s.id === selectedStart)?.name || selectedStart
            : ""
        }
        targetName={target.name}
        routes={bestItineraries?.routes || []}
      />
    </>
  );
}
