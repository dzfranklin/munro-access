import type { Route } from "./+types/home";
import { getTopTargetsPerStart } from "results/best-itineraries";
import { DEFAULT_PREFERENCES } from "results/scoring";
import { ItinerarySummary } from "~/components/ItinerarySummary";
import { Link } from "react-router";
import { getSampleDates, startMap, munroMap, targetMap } from "results/parse";
import { formatSamplePeriod } from "results/format-dates";
import React from "react";
import { usePreferences } from "~/preferences-context";
import { PreferencesPanel } from "~/components/PreferencesPanel";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Munro Access - Find munros accessible by public transport" },
    {
      name: "description",
      content:
        "Discover munros you can reach by public transport from Edinburgh, Glasgow, and Stirling",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  // Get top targets (trailheads) for each starting location
  const targetsByStart = getTopTargetsPerStart(10, DEFAULT_PREFERENCES);
  const sampleDates = getSampleDates();

  // Convert Map to array with start names
  const targetsData = Array.from(targetsByStart.entries()).map(
    ([startId, targets]) => ({
      startId,
      startName: startMap.get(startId)?.name || startId,
      targets,
    })
  );

  // Get all munros and targets for search
  const allMunros = Array.from(munroMap.values());
  const allTargets = Array.from(targetMap.values());

  return { targetsData, sampleDates, allMunros, allTargets };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { targetsData, sampleDates, allMunros, allTargets } = loaderData;
  const { preferences } = usePreferences();

  // Initialize selectedStart from preferences or default to first option
  const [selectedStart, setSelectedStart] = React.useState(
    preferences.preferredStartLocation || targetsData[0]?.startId
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  // When user clicks a tab, just update local state (don't save to preferences)
  // Preferences are only updated when explicitly set in the PreferencesPanel
  const handleStartChange = (startId: string) => {
    setSelectedStart(startId);
  };

  const selectedData = targetsData.find((r) => r.startId === selectedStart);

  // Get all available start locations for preferences panel
  const startLocations = targetsData.map(({ startId, startName }) => ({
    id: startId,
    name: startName,
  }));

  // Filter munros and targets based on search query
  const filteredMunros = searchQuery
    ? allMunros.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];
  const filteredTargets = searchQuery
    ? allTargets.filter(
        (t) =>
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const showSearchResults = searchQuery.length > 0;
  const hasSearchResults =
    filteredMunros.length > 0 || filteredTargets.length > 0;

  return (
    <>
      {/* Header */}
      <header className="border-b-[3px] border-theme-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0 mb-2.5">
          Munro Access
        </h1>
        <p className="font-sans text-base text-gray-600 m-0">
          Public transport connections to munros from Glasgow, Edinburgh, and
          Stirling
        </p>
      </header>

      {/* Search */}
      <div className="mb-6">
        <label
          htmlFor="search"
          className="block text-sm font-bold text-gray-700 mb-2"
        >
          Search for a munro or route
        </label>
        <input
          id="search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter munro or route name..."
          className="w-full px-3 py-2 border-2 border-gray-300 text-sm focus:outline-none focus:border-theme-navy-700"
        />
      </div>

      {/* Search Results */}
      {showSearchResults && (
        <div className="mb-8">
          {hasSearchResults ? (
            <div className="bg-gray-50 border border-gray-300 p-5">
              {filteredMunros.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-base font-bold text-gray-800 mb-2">
                    Munros
                  </h3>
                  <ul className="list-none m-0 p-0 space-y-1">
                    {filteredMunros.slice(0, 10).map((munro) => (
                      <li key={munro.number}>
                        <Link
                          to={`/munro/${munro.slug}`}
                          className="text-theme-green-600 underline text-sm"
                        >
                          {munro.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {filteredMunros.length > 10 && (
                    <p className="text-xs text-gray-500 mt-2">
                      + {filteredMunros.length - 10} more
                    </p>
                  )}
                </div>
              )}
              {filteredTargets.length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-gray-800 mb-2">
                    Routes
                  </h3>
                  <ul className="list-none m-0 p-0 space-y-1">
                    {filteredTargets.slice(0, 10).map((target) => (
                      <li key={target.id}>
                        <Link
                          to={`/target/${target.id}`}
                          className="text-theme-navy-700 underline text-sm"
                        >
                          {target.description}
                        </Link>
                        <span className="text-gray-500 text-xs ml-2">
                          ({target.name})
                        </span>
                      </li>
                    ))}
                  </ul>
                  {filteredTargets.length > 10 && (
                    <p className="text-xs text-gray-500 mt-2">
                      + {filteredTargets.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-300 p-5 text-sm text-gray-600">
              No results found for "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Preferences */}
      <PreferencesPanel startLocations={startLocations} />

      {/* How it works */}
      <div className="bg-gray-50 border border-gray-300 p-5 mb-8 leading-relaxed">
        <h2 className="text-lg font-bold text-gray-800 m-0 mb-3">
          How it works
        </h2>
        <p className="text-sm text-gray-600 m-0 mb-3">
          I used National Rail and bus timetable data to compute public
          transport itineraries to every Munro route on walkhighlands for a few
          sample days. Itineraries are ranked based on how early you have to
          leave, how well the return matches the hike duration, whether there
          are backup options if you take longer than expected, transit time, and
          some other factors.
        </p>
        <p className="text-sm text-gray-600 m-0 mb-3">
          Walkhighlands data on this site will be outdated, any errors
          introduced are mine. My goal is to help you find interesting routes to
          look into further on{" "}
          <a
            href="http://walkhighlands.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            walkhighlands.co.uk
          </a>
          .
        </p>
        <p className="text-[13px] text-gray-600 m-0">
          <strong>Note:</strong> These results are based on sample schedules
          from {formatSamplePeriod(sampleDates)}. They are intended to help you
          find options to look into further.
        </p>
      </div>

      {/* Tabs */}
      {targetsData.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No routes found with viable public transport options.
        </div>
      ) : (
        <div>
          {/* Tab navigation */}
          <div className="border-b-2 border-gray-200 mb-6">
            <div className="flex gap-1">
              {targetsData.map(({ startId, startName }) => (
                <button
                  key={startId}
                  onClick={() => handleStartChange(startId)}
                  className={`px-4 py-2 text-sm font-bold border-b-2 -mb-0.5 ${
                    selectedStart === startId
                      ? "border-theme-navy-700 text-theme-navy-900"
                      : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  {startName}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {selectedData && (
            <section>
              <table className="w-full border-collapse mb-8 text-sm table-fixed">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-40" />
                  <col className="w-56" />
                  <col className="w-80" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="py-2.5 px-2.5 text-left font-bold">#</th>
                    <th className="py-2.5 px-2.5 text-left font-bold">
                      Starting point
                    </th>
                    <th className="py-2.5 px-2.5 text-left font-bold">
                      Routes
                    </th>
                    <th className="py-2.5 px-2.5 text-left font-bold">
                      Best Options
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedData.targets.map((targetData, idx) => {
                    if (targetData.displayOptions.length === 0) return null;

                    return (
                      <tr
                        key={targetData.targetId}
                        className="border-b border-gray-200"
                      >
                        <td className="py-4 px-2.5 align-top text-gray-600">
                          {idx + 1}
                        </td>
                        <td className="py-4 px-2.5 align-top">
                          <div>
                            <div className="text-[13px] leading-normal">
                              <Link
                                to={`/target/${targetData.targetId}`}
                                className="text-theme-navy-700 underline font-bold"
                              >
                                {targetData.targetName}
                              </Link>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {targetData.targetDescription}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2.5 align-top">
                          {targetData.routes.map((routeData, i) => (
                            <div
                              key={routeData.route.name}
                              className={
                                i > 0
                                  ? "mt-3 pt-3 border-t border-gray-200"
                                  : ""
                              }
                            >
                              <div className="font-serif text-sm text-gray-700">
                                {routeData.route.name}
                                <span className="text-gray-500"> • </span>
                                <a
                                  href={routeData.route.page}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-theme-navy-700 underline text-[13px] font-sans"
                                >
                                  walkhighlands
                                </a>
                              </div>
                              <div className="mt-1.5">
                                {routeData.munros.map((munro, j) => (
                                  <span key={munro.number}>
                                    <Link
                                      to={`/munro/${munro.slug}`}
                                      className="text-theme-navy-700 underline text-[13px]"
                                    >
                                      {munro.name}
                                    </Link>
                                    {j < routeData.munros.length - 1 && (
                                      <span className="text-gray-400"> • </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-1.5 text-gray-600 text-[13px]">
                                {routeData.route.stats.distanceKm}km •{" "}
                                {routeData.route.stats.timeHours.min}-
                                {routeData.route.stats.timeHours.max}h •{" "}
                                {routeData.route.stats.ascentM}m
                              </div>
                            </div>
                          ))}
                        </td>
                        <td className="py-4 px-2.5 align-top text-[13px]">
                          <div className="space-y-2">
                            {targetData.displayOptions?.map((option, i) => (
                              <ItinerarySummary
                                key={i}
                                outbound={option.outbound}
                                return={option.return}
                                day={option.day}
                              />
                            ))}
                          </div>
                          {targetData.displayOptions &&
                            targetData.bestOptions.length >
                              targetData.displayOptions.length && (
                              <div className="mt-2 text-xs">
                                <Link
                                  to={`/target/${targetData.targetId}`}
                                  className="text-gray-500 underline"
                                >
                                  +{" "}
                                  {targetData.bestOptions.length -
                                    targetData.displayOptions.length}{" "}
                                  more option
                                  {targetData.bestOptions.length -
                                    targetData.displayOptions.length >
                                  1
                                    ? "s"
                                    : ""}
                                </Link>
                              </div>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </>
  );
}
