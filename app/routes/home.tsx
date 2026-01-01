import type { Route } from "./+types/home";
import { getTopTargetsPerStart } from "results/best-itineraries";
import { DEFAULT_RANKING_PREFERENCES } from "results/scoring";
import { ItinerarySummary } from "~/components/ItinerarySummary";
import { Link, useSearchParams } from "react-router";
import {
  getSampleDates,
  startMap,
  munroMap,
  targetMap,
  resultMap,
} from "results/parse.server";
import { formatSamplePeriod } from "~/utils/format";
import React from "react";
import { usePreferences } from "~/preferences-context";
import { PreferencesPanel } from "~/components/PreferencesPanel";
import { START_LOCATION_ORDER } from "~/utils/constants";

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
  // Get all targets (trailheads) for each starting location with default preferences
  const targetsByStart = getTopTargetsPerStart(
    resultMap,
    targetMap,
    munroMap,
    Infinity,
    DEFAULT_RANKING_PREFERENCES
  );
  const sampleDates = getSampleDates();

  // Convert Map to array with start names, sorted by standard order
  const targetsData = Array.from(targetsByStart.entries())
    .map(([startId, targets]) => ({
      startId,
      startName: startMap.get(startId)?.name || startId,
      targets,
    }))
    .sort((a, b) => {
      return (
        START_LOCATION_ORDER.indexOf(a.startName as any) -
        START_LOCATION_ORDER.indexOf(b.startName as any)
      );
    });

  // Get all munros and targets for search
  const allMunros = Array.from(munroMap.values());
  const allTargets = Array.from(targetMap.values());

  // Return maps for client-side re-computation
  return {
    targetsData,
    sampleDates,
    allMunros,
    allTargets,
    resultMap,
    targetMap,
    munroMap,
    startMap,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    targetsData: initialTargetsData,
    sampleDates,
    allMunros,
    allTargets,
    resultMap,
    targetMap,
    munroMap,
    startMap,
  } = loaderData;
  const { preferences, updatePreferences } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = React.useState("");
  const itemsPerPage = 10;

  // Recompute targets when preferences change
  const targetsData = React.useMemo(() => {
    // Check if preferences differ from defaults
    const prefsChanged = Object.keys(DEFAULT_RANKING_PREFERENCES).some(
      (key) =>
        preferences[key as keyof typeof DEFAULT_RANKING_PREFERENCES] !==
        DEFAULT_RANKING_PREFERENCES[
          key as keyof typeof DEFAULT_RANKING_PREFERENCES
        ]
    );

    if (!prefsChanged) {
      return initialTargetsData;
    }

    // Re-compute with user preferences
    const targetsByStart = getTopTargetsPerStart(
      resultMap,
      targetMap,
      munroMap,
      Infinity,
      preferences
    );

    return Array.from(targetsByStart.entries())
      .map(([startId, targets]) => ({
        startId,
        startName: startMap.get(startId)?.name || startId,
        targets,
      }))
      .sort((a, b) => {
        return (
          START_LOCATION_ORDER.indexOf(a.startName as any) -
          START_LOCATION_ORDER.indexOf(b.startName as any)
        );
      });
  }, [
    preferences,
    initialTargetsData,
    resultMap,
    targetMap,
    munroMap,
    startMap,
  ]);

  // Read current state from URL
  const urlStart = searchParams.get("start");
  const urlPage = searchParams.get("page");

  // Priority: URL > preferredStartLocation > lastViewedStartLocation > first tab
  const selectedStart =
    urlStart ||
    preferences.preferredStartLocation ||
    preferences.lastViewedStartLocation ||
    targetsData[0]?.startId;
  const currentPage = urlPage ? parseInt(urlPage, 10) : 1;

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

  // When user clicks a tab, update lastViewed and URL, reset to page 1, but don't scroll
  const handleStartChange = (startId: string) => {
    updatePreferences({ lastViewedStartLocation: startId });
    setSearchParams(
      { start: startId, page: "1" },
      { preventScrollReset: true }
    );
  };

  // When user changes page, update URL and scroll to top
  const handlePageChange = (newPage: number) => {
    setSearchParams({ start: selectedStart, page: newPage.toString() });
    window.scrollTo(0, 0);
  };

  const selectedData = targetsData.find((r) => r.startId === selectedStart);

  // Pagination calculations
  const totalItems = selectedData?.targets.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTargets =
    selectedData?.targets.slice(startIndex, endIndex) || [];

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
                          to={`/target/${target.id}?start=${selectedStart}`}
                          className="text-theme-navy-700 underline text-sm"
                        >
                          {target.description}
                        </Link>
                        {target.description !== target.name && (
                          <span className="text-gray-500 text-xs ml-2">
                            ({target.name})
                          </span>
                        )}
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
          some other factors. The algorithm presumes summer conditions.
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

      <PreferencesPanel startLocations={startLocations} />

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
            <section
              className="transition-opacity duration-75"
              style={{ opacity: isTransitioning ? 0 : 1 }}
            >
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
                  {paginatedTargets.map((targetData, idx) => {
                    if (
                      !targetData.displayOptions ||
                      targetData.displayOptions.length === 0
                    )
                      return null;

                    return (
                      <tr
                        key={targetData.targetId}
                        className="border-b border-gray-200"
                      >
                        <td className="py-4 px-2.5 align-top text-gray-600">
                          {startIndex + idx + 1}
                        </td>
                        <td className="py-4 px-2.5 align-top">
                          <div>
                            <div className="text-[13px] leading-normal">
                              <Link
                                to={`/target/${targetData.targetId}?start=${selectedStart}`}
                                className="text-theme-navy-700 underline font-bold"
                              >
                                {targetData.targetName}
                              </Link>
                            </div>
                            {targetData.targetDescription !==
                              targetData.targetName && (
                              <div className="mt-1 text-xs text-gray-500">
                                {targetData.targetDescription}
                              </div>
                            )}
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
                          <div className="space-y-2.5">
                            {targetData.displayOptions?.map((option, i) => (
                              <div
                                key={i}
                                className={
                                  i > 0 ? "pt-2.5 border-t border-gray-200" : ""
                                }
                              >
                                <ItinerarySummary
                                  outbound={option.outbound}
                                  return={option.return}
                                  day={option.day}
                                  score={option.score}
                                />
                              </div>
                            ))}
                          </div>
                          {targetData.displayOptions &&
                            targetData.bestOptions.length >
                              targetData.displayOptions.length && (
                              <div className="mt-2.5 text-xs">
                                <Link
                                  to={`/target/${targetData.targetId}?start=${selectedStart}`}
                                  className="text-theme-navy-700 underline"
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

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mb-8 text-sm">
                  <div className="text-gray-600">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
                    {totalItems} routes
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handlePageChange(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 border border-gray-300 ${
                        currentPage === 1
                          ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                          : "text-theme-navy-700 bg-white hover:bg-gray-50"
                      }`}
                    >
                      Previous
                    </button>
                    <div className="flex items-center px-3 text-gray-700">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1.5 border border-gray-300 ${
                        currentPage === totalPages
                          ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                          : "text-theme-navy-700 bg-white hover:bg-gray-50"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
