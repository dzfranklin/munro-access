import { targetMap, startMap } from "results/parse";
import type { Route } from "./+types/target";
import { data, Link } from "react-router";
import { getBestItinerariesForRoute } from "results/best-itineraries";
import { DEFAULT_PREFERENCES } from "results/scoring";
import { DayItineraryCard } from "~/components/DayItineraryCard";
import React from "react";
import { usePreferences } from "~/preferences-context";

type StartInfo = {
  id: string;
  name: string;
};

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData.target.description} - Munro Access` },
    {
      name: "description",
      content: `Public transport routes to ${loaderData.target.description}`,
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const target = targetMap.get(params.id);
  if (!target) {
    throw data(null, { status: 404 });
  }

  // Get best itineraries for each route from this target
  const routesWithItineraries = target.routes.map((route) => {
    const best = getBestItinerariesForRoute(
      params.id,
      route.name,
      DEFAULT_PREFERENCES
    );
    return { route, bestItineraries: best };
  });

  const gmapsEmbedKey = process.env.GOOGLE_MAPS_EMBED_KEY;

  // Get all unique start locations with their names
  const startIdsSet = new Set<string>();
  for (const { bestItineraries } of routesWithItineraries) {
    if (bestItineraries) {
      for (const option of bestItineraries.bestOptions) {
        startIdsSet.add(option.startId);
      }
    }
  }

  const starts: StartInfo[] = Array.from(startIdsSet)
    .sort()
    .map((id) => ({
      id,
      name: startMap.get(id)?.name || id,
    }));

  return { target, routesWithItineraries, gmapsEmbedKey, starts };
}

export default function Target({ loaderData }: Route.ComponentProps) {
  const { target, routesWithItineraries, gmapsEmbedKey, starts } = loaderData;
  const { preferences } = usePreferences();

  // Initialize selectedStart from preferences if available, otherwise use first option
  const [selectedStart, setSelectedStart] = React.useState<string | null>(
    () => {
      if (
        preferences.preferredStartLocation &&
        starts.some((s) => s.id === preferences.preferredStartLocation)
      ) {
        return preferences.preferredStartLocation;
      }
      return starts.length > 0 ? starts[0].id : null;
    }
  );

  // When user clicks a tab, just update local state (don't save to preferences)
  // Preferences are only updated when explicitly set in the PreferencesPanel
  const handleStartChange = (startId: string) => {
    setSelectedStart(startId);
  };

  return (
    <>
      {/* Navigation */}
      <nav className="mb-6">
        <Link
          to="/"
          className="text-traditional-navy-700 underline text-sm hover:no-underline"
        >
          Back to all routes
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b-[3px] border-traditional-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-traditional-navy-900 m-0 mb-2.5">
          {target.name}
        </h1>
        <p className="font-sans text-base text-gray-600 m-0">
          {target.description}
        </p>
      </header>

      {/* Map */}
      {gmapsEmbedKey && (
        <div className="mb-8">
          <iframe
            width="100%"
            height="400"
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
      <section>
        <h2 className="font-serif text-2xl font-normal text-traditional-navy-900 border-b-2 border-gray-300 pb-2 mb-6">
          Routes from {target.name}
        </h2>

        {starts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No routes found with viable public transport options.
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
                          ? "border-traditional-navy-700 text-traditional-navy-900"
                          : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300"
                      }`}
                    >
                      {start.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Routes for selected start location */}
            <div className="space-y-8">
              {routesWithItineraries
                .map(({ route, bestItineraries }) => {
                  if (
                    !bestItineraries ||
                    bestItineraries.bestOptions.length === 0
                  ) {
                    return null;
                  }

                  // Filter options for selected start location
                  const optionsForStart = bestItineraries.bestOptions.filter(
                    (opt) => opt.startId === selectedStart
                  );

                  if (optionsForStart.length === 0) return null;

                  // Group by day
                  const optionsByDay = new Map<
                    string,
                    typeof optionsForStart
                  >();
                  for (const option of optionsForStart) {
                    if (!optionsByDay.has(option.day)) {
                      optionsByDay.set(option.day, []);
                    }
                    optionsByDay.get(option.day)!.push(option);
                  }

                  // Sort days
                  const dayOrder = [
                    "WEDNESDAY",
                    "FRIDAY",
                    "SATURDAY",
                    "SUNDAY",
                  ];
                  const sortedDays = Array.from(optionsByDay.keys()).sort(
                    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
                  );

                  return { route, optionsByDay, sortedDays };
                })
                .filter((item) => item !== null)
                .map((item, idx, arr) => {
                  const isLast = idx === arr.length - 1;

                  return (
                    <div
                      key={item.route.page}
                      className={
                        isLast ? "pb-6" : "border-b border-gray-200 pb-6"
                      }
                    >
                      {/* Route header */}
                      <div className="mb-4">
                        <h3 className="font-serif text-base mb-2">
                          <span className="font-semibold text-gray-700">
                            {item.route.name}
                          </span>
                          <span className="text-gray-500"> • </span>
                          <a
                            href={item.route.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-traditional-navy-700 underline text-[13px] font-sans"
                          >
                            walkhighlands
                          </a>
                        </h3>
                        <div className="text-sm text-gray-600 mb-2">
                          Distance: {item.route.stats.distanceKm}km | Time:{" "}
                          {item.route.stats.timeHours.min}-
                          {item.route.stats.timeHours.max}h | Ascent:{" "}
                          {item.route.stats.ascentM}m
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Munros: </span>
                          {item.route.munros.map((munro, idx) => (
                            <span key={munro.number}>
                              {idx > 0 && (
                                <span className="text-gray-400"> • </span>
                              )}
                              <Link
                                to={`/munro/${munro.number}-${munro.name
                                  .toLowerCase()
                                  .replace(/\s+/g, "-")
                                  .replace(/[^a-z0-9-]/g, "")}`}
                                className="text-traditional-green-600 underline text-[13px]"
                              >
                                {munro.name}
                              </Link>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Options grouped by day */}
                      <div className="space-y-6">
                        {item.sortedDays.map((day) => (
                          <DayItineraryCard
                            key={day}
                            day={day}
                            options={item.optionsByDay.get(day)!}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
