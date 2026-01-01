import type { Route } from "./+types/scoring";
import { data, useLoaderData } from "react-router";
import { useState, useMemo } from "react";
import {
  resultMap,
  targetMap,
  munroMap,
  startMap,
} from "results/parse.server";
import {
  scoreItineraryPair,
  DEFAULT_RANKING_PREFERENCES,
  type RankingPreferences,
} from "results/scoring";
import { formatTime, formatDuration, parseTime } from "~/utils/format";
import { formatModes } from "~/utils/transport";
import { getViableReturns } from "results/itinerary-utils";
import { ScoreDebug } from "~/components/ScoreDebug";
import { PreferencesControls } from "~/components/PreferencesControls";

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
  const targetId = url.searchParams.get("target") || "ben-lomond-ptarmigan";

  const target = targetMap.get(targetId);
  if (!target) {
    throw data(null, { status: 404 });
  }

  const result = resultMap.get(targetId);
  if (!result) {
    throw data(null, { status: 404 });
  }

  // Get all targets for selector
  const allTargets = Array.from(targetMap.values())
    .map((t) => ({
      id: t.id,
      name: t.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get sample data from one route
  const firstRoute = result.routes[0];
  if (!firstRoute) {
    throw data({ error: "No routes found" }, { status: 404 });
  }

  // Get sample start location
  const firstStart = Object.keys(firstRoute.byStart)[0];
  if (!firstStart) {
    throw data({ error: "No start locations found" }, { status: 404 });
  }

  const startInfo = startMap.get(firstStart);
  const itineraries = firstRoute.byStart[firstStart];

  // Sample one day
  const sampleDate = Object.keys(itineraries.outbound)[0];
  const outbounds = itineraries.outbound[sampleDate] || [];
  const allReturns = itineraries.return[sampleDate] || [];

  return {
    target: {
      id: target.id,
      name: target.name,
    },
    allTargets,
    route: firstRoute,
    start: {
      id: firstStart,
      name: startInfo?.name || firstStart,
    },
    date: sampleDate,
    outbounds,
    allReturns,
  };
}

export default function ScoringDebugPage() {
  const { target, allTargets, route, start, date, outbounds, allReturns } =
    useLoaderData<typeof loader>();

  const [preferences, setPreferences] = useState<RankingPreferences>(
    DEFAULT_RANKING_PREFERENCES
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Calculate scored pairs client-side
  const scoredPairs = useMemo(() => {
    const pairs: Array<{
      outbound: any;
      return: any;
      score: any;
    }> = [];

    for (const outbound of outbounds) {
      const viableReturns = getViableReturns(
        outbound,
        allReturns,
        route,
        preferences.walkingSpeed,
        preferences.returnBuffer
      );

      for (const returnItin of viableReturns) {
        const score = scoreItineraryPair(
          outbound,
          returnItin,
          route,
          preferences
        );
        if (score) {
          pairs.push({ outbound, return: returnItin, score });
        }
      }
    }

    // Sort by score descending
    pairs.sort((a, b) => b.score.rawScore - a.score.rawScore);

    // Calculate percentiles
    const scores = pairs.map((p) => p.score.rawScore);
    const sortedScores = [...scores].sort((a, b) => a - b);
    const percentileMap = new Map<number, number>();
    
    for (let i = 0; i < sortedScores.length; i++) {
      const score = sortedScores[i];
      if (!percentileMap.has(score)) {
        const percentile = i / Math.max(1, sortedScores.length - 1);
        percentileMap.set(score, percentile);
      }
    }

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
                      onClick={() =>
                        setExpandedIndex(isExpanded ? null : idx)
                      }
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
