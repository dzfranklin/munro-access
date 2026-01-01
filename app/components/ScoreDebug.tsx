import type { RankingPreferences } from "results/scoring";

interface ScoreDebugProps {
  score: {
    rawScore: number;
    percentile: number;
    components: {
      departureTime: number;
      returnTime: number;
      hikeDuration: number;
      returnOptions: number;
      totalDuration: number;
      finishTime: number;
    };
  };
  preferences: RankingPreferences;
  visible?: boolean;
}

export function ScoreDebug({ score, preferences, visible = false }: ScoreDebugProps) {
  if (!visible) return null;

  const { components } = score;
  const weights = preferences.weights;

  // Calculate weighted values for each component
  const weighted = {
    departureTime: components.departureTime * weights.departureTime,
    returnTime: components.returnTime * weights.returnTime,
    hikeDuration: components.hikeDuration * weights.hikeDuration,
    returnOptions: components.returnOptions * weights.returnOptions,
    totalDuration: components.totalDuration * weights.totalDuration,
    finishTime: components.finishTime * weights.finishTime,
  };

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

  // Format number to 2 decimal places
  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="border border-gray-300 bg-gray-50 p-3 text-xs font-mono">
      <div className="font-bold mb-2">Score Breakdown (Debug)</div>
      
      <div className="mb-2">
        <strong>Final Score:</strong> {fmt(score.rawScore)} (percentile: {fmt(score.percentile * 100)}%)
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1">Component</th>
            <th className="text-right py-1">Raw</th>
            <th className="text-right py-1">Weight</th>
            <th className="text-right py-1">Weighted</th>
            <th className="text-right py-1">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(components).map(([key, value]) => {
            const weight = weights[key as keyof typeof weights];
            const weightedValue = weighted[key as keyof typeof weighted];
            const percentOfTotal = (weightedValue / score.rawScore) * 100;
            
            return (
              <tr key={key} className="border-b border-gray-200">
                <td className="py-1">{key}</td>
                <td className="text-right">{fmt(value)}</td>
                <td className="text-right">{fmt(weight)}</td>
                <td className="text-right">{fmt(weightedValue)}</td>
                <td className="text-right">{fmt(percentOfTotal)}%</td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className="py-1">TOTAL</td>
            <td className="text-right">-</td>
            <td className="text-right">{fmt(weightSum)}</td>
            <td className="text-right">{fmt(Object.values(weighted).reduce((a, b) => a + b, 0))}</td>
            <td className="text-right">100%</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 text-gray-600">
        Components with highest impact: {
          Object.entries(weighted)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([key]) => key)
            .join(", ")
        }
      </div>
    </div>
  );
}
