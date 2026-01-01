import { targetMap, startMap, resultMap } from "results/parse.server";
import type { Route } from "./+types/target.$id.all-itineraries";
import { data, Link, useSearchParams } from "react-router";
import { AllItinerariesList } from "~/components/AllItinerariesList";
import React from "react";
import { usePreferences } from "~/preferences-context";
import { START_LOCATION_ORDER } from "~/constants";
import { resultID } from "results/schema";

type StartInfo = {
  id: string;
  name: string;
};

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `All Transport Options - ${loaderData.target.description} - Munro Access`,
    },
    {
      name: "description",
      content: `All outbound and return transport options to ${loaderData.target.description}`,
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const target = targetMap.get(params.id);
  if (!target) {
    throw data(null, { status: 404 });
  }

  // Get raw itineraries for each start location and day
  const rawItineraries: Record<
    string,
    Record<string, { outbounds: any[]; returns: any[] }>
  > = {};
  const startIdsSet = new Set<string>();

  for (const [key, result] of resultMap.entries()) {
    const [startId, targetId] = key.split(":");
    if (targetId === params.id) {
      startIdsSet.add(startId);
      rawItineraries[startId] = {};
      for (const [day, itins] of Object.entries(result.itineraries)) {
        rawItineraries[startId][day] = {
          outbounds: itins.outbounds,
          returns: itins.returns,
        };
      }
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

  return { target, starts, rawItineraries };
}

export default function AllItineraries({ loaderData }: Route.ComponentProps) {
  const { target, starts, rawItineraries } = loaderData;
  const { preferences } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read start from URL
  const urlStart = searchParams.get("start");

  // Priority: URL > preferredStartLocation > first available start
  const selectedStart = (() => {
    if (urlStart && starts.some((s) => s.id === urlStart)) {
      return urlStart;
    }
    if (
      preferences.preferredStartLocation &&
      starts.some((s) => s.id === preferences.preferredStartLocation)
    ) {
      return preferences.preferredStartLocation;
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

  return (
    <>
      {/* Navigation */}
      <nav className="mb-6">
        <Link
          to={
            urlStart
              ? `/target/${target.id}?start=${urlStart}`
              : `/target/${target.id}`
          }
          className="text-theme-navy-700 underline text-sm hover:no-underline"
        >
          Back to {target.name}
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b-[3px] border-theme-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0 mb-2.5">
          All Transport Options
        </h1>
        <p className="font-sans text-base text-gray-600 m-0">
          {target.description}
        </p>
      </header>

      {/* Content */}
      <section>
        {starts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No transport options available.
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

            {/* Days for selected start */}
            <div
              className="space-y-8 transition-opacity duration-75"
              style={{ opacity: isTransitioning ? 0 : 1 }}
            >
              {selectedStart &&
                rawItineraries[selectedStart] &&
                (() => {
                  const dayOrder = [
                    "WEDNESDAY",
                    "FRIDAY",
                    "SATURDAY",
                    "SUNDAY",
                  ];
                  const dayData = rawItineraries[selectedStart];
                  return dayOrder
                    .filter((day) => day in dayData)
                    .map((day) => {
                      const itins = dayData[day];
                      if (
                        itins.outbounds.length === 0 &&
                        itins.returns.length === 0
                      ) {
                        return null;
                      }
                      return (
                        <div key={day}>
                          <h2 className="font-sans text-base font-normal text-gray-700 mb-3">
                            {day.charAt(0) + day.slice(1).toLowerCase()}
                          </h2>
                          <AllItinerariesList
                            outbounds={itins.outbounds}
                            returns={itins.returns}
                          />
                        </div>
                      );
                    });
                })()}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
