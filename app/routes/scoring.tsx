import type { Route } from "./+types/scoring";
import { data, useLoaderData } from "react-router";
import { useState, useMemo } from "react";
import { type Result, type Itinerary, resultID } from "results/schema";
import {
  selectBestItineraries,
  calculatePercentiles,
  DEFAULT_RANKING_PREFERENCES,
  type RankingPreferences,
} from "results/scoring";
import { formatTime, formatDuration, parseTime } from "~/utils/format";
import { formatModes } from "~/utils/transport";
import { ScoreDebug } from "~/components/ScoreDebug";
import { PreferencesControls } from "~/components/PreferencesControls";
import { resultMap, targetMap, startMap } from "results/parse.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Scoring Debug - Munro Access" },
    {
      name: "description",
      content: "Debug scoring algorithm and tune preferences",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Pick a sample target with good data
  const url = new URL(request.url);
  const targetId =
    url.searchParams.get("target") || "inveruglas-visitor-centre";

  const target = targetMap.get(targetId);
  if (!target) {
    throw data({ error: "Target not found" }, { status: 404 });
  }

  // Get all targets for selector
  const allTargets = Array.from(targetMap.values())
    .map((t) => ({
      id: t.id,
      name: t.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get sample route from target
  const firstRoute = target.routes[0];
  if (!firstRoute) {
    throw data({ error: "No routes found for this target" }, { status: 404 });
  }

  let sampleStart = "edinburgh";
  let sampleResult = resultMap.get(resultID(sampleStart, targetId));
  if (!sampleResult) {
    throw data({ error: "Missing result" }, { status: 404 });
  }

  const startInfo = startMap.get(sampleStart);

  // Get sample day itineraries
  const days: Array<keyof typeof sampleResult.itineraries> = [
    "SATURDAY",
    "SUNDAY",
    "FRIDAY",
    "WEDNESDAY",
  ];
  let sampleDay = "SATURDAY";
  let outbounds: Itinerary[] = [];
  let allReturns: Itinerary[] = [];

  for (const day of days) {
    const dayData = sampleResult.itineraries[day];
    if (dayData && dayData.outbounds.length > 0 && dayData.returns.length > 0) {
      sampleDay = day;
      outbounds = dayData.outbounds;
      allReturns = dayData.returns;
      break;
    }
  }

  if (outbounds.length === 0) {
    throw data({ error: "No itineraries found" }, { status: 404 });
  }

  return {
    target: {
      id: target.id,
      name: target.name,
    },
    allTargets,
    route: firstRoute,
    start: {
      id: sampleStart,
      name: startInfo?.name || sampleStart,
    },
    date: sampleDay,
    outbounds,
    allReturns,
  };
}

export default function ScoringDebugPage({ loaderData }: Route.ComponentProps) {
  const { target, allTargets, route, start, date, outbounds, allReturns } =
    loaderData;

  const [preferences, setPreferences] = useState<RankingPreferences>(
    DEFAULT_RANKING_PREFERENCES
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Calculate scored pairs client-side
  const scoredPairs = useMemo(() => {
    // Use selectBestItineraries with a high maxResults to get all pairs with scoring
    const pairs = selectBestItineraries(
      outbounds,
      allReturns,
      route,
      preferences,
      10000 // High number to get all results
    );

    // Calculate percentiles
    const scores = pairs.map((p) => p.score.rawScore);
    const percentileMap = calculatePercentiles(scores);

    // Update percentiles in scores
    pairs.forEach((pair) => {
      pair.score.percentile = percentileMap.get(pair.score.rawScore) || 0;
    });

    return pairs;
  }, [outbounds, allReturns, route, preferences]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="border-b-2 border-gray-300 pb-4 mb-6">
        <h1 className="font-serif text-3xl font-bold text-theme-navy-900 mb-2">
          Scoring Debug
        </h1>
        <p className="text-gray-700">
          Test scoring algorithm and tune preference weights
        </p>
      </header>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-300">
        <h2 className="font-serif text-lg font-bold text-theme-navy-900 mb-3">
          Sample Data
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-gray-600 mb-1">Target</label>
            <select
              value={target.id}
              onChange={(e) => {
                window.location.href = `/scoring?target=${e.target.value}`;
              }}
              className="w-full px-3 py-2 border-2 border-gray-300 bg-white"
            >
              {allTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-gray-600 mb-1">Details</span>
            <div className="text-gray-700">
              From: {start.name} • Date: {date}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              {outbounds.length} outbound × {allReturns.length} return ={" "}
              {scoredPairs.length} valid pairs
            </div>
          </div>
        </div>
      </div>

      <PreferencesControls
        preferences={preferences}
        onChange={setPreferences}
      />

      <pre className="max-h-30 mt-6 p-4 bg-gray-100 border border-gray-300 overflow-x-auto text-sm select-all">
        <code>{JSON.stringify(preferences, null, 2)}</code>
      </pre>

      <div className="mt-6">
        <h2 className="font-serif text-xl font-bold text-theme-navy-900 mb-3">
          Route: {route.name}{" "}
          <a href={route.page} className="underline text-sm" target="_blank">
            (walkhighlands)
          </a>
        </h2>
        <div className="text-sm text-gray-700">
          {Object.entries(route.stats).map(([key, value]) => (
            <div key={key} className="flex">
              <div className="font-medium text-gray-600 w-32">{key}</div>
              <div className="text-gray-700">{JSON.stringify(value)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-serif text-xl font-bold text-theme-navy-900 mb-3">
          Ranked Itineraries ({scoredPairs.length})
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
                #
              </th>
              <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
                Score
              </th>
              <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
                Outbound
              </th>
              <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
                Return
              </th>
              <th className="text-left text-xs font-bold text-gray-700 pb-2 pr-3">
                Window
              </th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {scoredPairs.map((pair, idx) => {
              const outboundStart = parseTime(pair.outbound.startTime);
              let outboundEnd = parseTime(pair.outbound.endTime);
              if (outboundEnd < outboundStart) outboundEnd += 24;

              let returnStart = parseTime(pair.return.startTime);
              if (returnStart < outboundEnd) returnStart += 24;

              let returnEnd = parseTime(pair.return.endTime);
              if (returnEnd < returnStart) returnEnd += 24;

              const hikeWindow = Math.round((returnStart - outboundEnd) * 60);
              const outboundDuration = Math.round(
                (outboundEnd - outboundStart) * 60
              );
              const returnDuration = Math.round((returnEnd - returnStart) * 60);

              const isExpanded = expandedIndex === idx;

              return (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-3 pr-3 align-top text-sm text-gray-600">
                    {idx + 1}
                  </td>
                  <td className="py-3 pr-3 align-top text-sm">
                    <div className="font-mono">
                      {pair.score.rawScore.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(pair.score.percentile * 100).toFixed(0)}%ile
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top text-sm">
                    <div>
                      {formatTime(pair.outbound.startTime)} –{" "}
                      {formatTime(pair.outbound.endTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDuration(outboundDuration)} via{" "}
                      {formatModes(pair.outbound.modes)}
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top text-sm">
                    <div>
                      {formatTime(pair.return.startTime)} –{" "}
                      {formatTime(pair.return.endTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDuration(returnDuration)} via{" "}
                      {formatModes(pair.return.modes)}
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top text-sm text-gray-600">
                    {formatDuration(hikeWindow)}
                  </td>
                  <td className="py-3 align-top">
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className="text-gray-400 hover:text-theme-navy-700 text-xs"
                    >
                      {isExpanded ? "−" : "+"}
                    </button>
                  </td>
                  {isExpanded && (
                    <td colSpan={6} className="pb-4">
                      <ScoreDebug
                        score={pair.score}
                        preferences={preferences}
                        visible={true}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
