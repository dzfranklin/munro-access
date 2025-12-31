import { targetMap, startMap } from "results/parse";
import type { Route } from "./+types/target";
import { data, Link } from "react-router";
import { getBestItinerariesForTarget } from "results/best-itineraries";
import { DEFAULT_RANKING_PREFERENCES } from "results/scoring";
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

  // Get best itineraries for this target
  const bestItineraries = getBestItinerariesForTarget(params.id, DEFAULT_RANKING_PREFERENCES);

  const gmapsEmbedKey = process.env.GOOGLE_MAPS_EMBED_KEY;

  // Get all unique start locations with their names
  const startIdsSet = new Set<string>();
  if (bestItineraries) {
    for (const option of bestItineraries.bestOptions) {
      startIdsSet.add(option.startId);
    }
  }

  const starts: StartInfo[] = Array.from(startIdsSet)
    .sort()
    .map((id) => ({
      id,
      name: startMap.get(id)?.name || id,
    }));

  return { target, bestItineraries, gmapsEmbedKey, starts };
}

export default function Target({ loaderData }: Route.ComponentProps) {
  const { target, bestItineraries, gmapsEmbedKey, starts } = loaderData;
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
          className="text-theme-navy-700 underline text-sm hover:no-underline"
        >
          Back to all routes
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b-[3px] border-theme-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0 mb-2.5">
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
      <section className="mb-12">
        <h2 className="font-serif text-2xl font-normal text-theme-navy-900 border-b-2 border-gray-300 pb-2 mb-6">
          Routes from {target.name}
        </h2>

        {target.routes.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No routes available.
          </div>
        ) : (
          <div className="space-y-3">
            {target.routes.map((route) => (
              <div key={route.page}>
                <div className="font-serif text-sm text-gray-700">
                  {route.name}
                  <span className="text-gray-500"> • </span>
                  <a
                    href={route.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-theme-navy-700 underline text-[13px] font-sans"
                  >
                    walkhighlands
                  </a>
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
                  <span className="text-gray-600">
                    {" "}
                    • {route.stats.distanceKm}km • {route.stats.timeHours.min}-
                    {route.stats.timeHours.max}h • {route.stats.ascentM}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Public Transport Options */}
      <section>
        <h2 className="font-serif text-2xl font-normal text-theme-navy-900 border-b-2 border-gray-300 pb-2 mb-6">
          Public Transport to {target.name}
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
                const dayOrder = [
                  "WEDNESDAY",
                  "FRIDAY",
                  "SATURDAY",
                  "SUNDAY",
                ];
                const sortedDays = Array.from(optionsByDay.keys()).sort(
                  (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
                );

                return sortedDays.map((day) => (
                  <DayItineraryCard
                    key={day}
                    day={day}
                    options={optionsByDay.get(day)!}
                  />
                ));
              })()}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
