import { type RankingPreferences } from "~/results/scoring";

type PreferencesControlsProps = {
  preferences: RankingPreferences;
  onChange: (prefs: RankingPreferences) => void;
};

function getScoringExplanation(key: string): string {
  const explanations: Record<string, string> = {
    departureTime:
      "Penalizes departures before your preferred earliest departure time",
    returnTime: "Penalizes late returns",
    hikeDurationFit: "Penalizes having much longer than the hike duration",
    returnOptions: "Prefers multiple return options in case you miss the first",
    finishTime: "Prefers finishing hike before your preferred latest end time",
  };
  return explanations[key] || "";
}

function formatScoringLabel(key: string): string {
  return (key[0].toUpperCase() + key.slice(1))
    .replace(/([A-Z])/g, " $1")
    .trim();
}

export function PreferencesControls({
  preferences,
  onChange,
}: PreferencesControlsProps) {
  const handleChange = (updates: Partial<RankingPreferences>) => {
    onChange({ ...preferences, ...updates });
  };

  const formatTimeValue = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const parseTimeValue = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + minutes / 60;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={preferences.allowCycling}
              onChange={(e) => handleChange({ allowCycling: e.target.checked })}
              className="mr-2"
            />
            Allow cycling
          </label>
          <p className="text-xs text-gray-500 mt-1.5">
            Include routes that involve cycling as part of the journey
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Overnight trip penalty
            <span className="ml-2 text-xs text-gray-500">
              ({(preferences.overnightPenalty * 100).toFixed(0)}%)
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={preferences.overnightPenalty}
            onChange={(e) =>
              handleChange({ overnightPenalty: parseFloat(e.target.value) })
            }
            list="overnight-penalty-ticks"
            className="w-full"
          />
          <datalist id="overnight-penalty-ticks">
            <option value="0" label="0%"></option>
            <option value="0.3" label="30%"></option>
            <option value="1" label="100%"></option>
          </datalist>
          <div className="flex justify-between text-xs text-gray-500">
            <span>No penalty</span>
            <span>Exclude</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Penalty applied to trips spanning multiple days. Set to 100% to
            effectively exclude them.
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Earliest Departure Time (hard cutoff)
          </label>
          <input
            type="time"
            value={formatTimeValue(preferences.earliestDeparture)}
            onChange={(e) =>
              handleChange({
                earliestDeparture: parseTimeValue(e.target.value),
              })
            }
            className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Itineraries departing before this time are excluded entirely
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Earliest departure time (preferred)
          </label>
          <input
            type="time"
            value={formatTimeValue(preferences.preferredEarliestDeparture)}
            onChange={(e) =>
              handleChange({
                preferredEarliestDeparture: parseTimeValue(e.target.value),
              })
            }
            className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Departures before this time are penalized (not excluded)
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Latest return arrival time (preferred)
          </label>
          <input
            type="time"
            value={formatTimeValue(preferences.preferredLatestArrival)}
            onChange={(e) =>
              handleChange({
                preferredLatestArrival: parseTimeValue(e.target.value),
              })
            }
            className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Arrivals home after this time are penalized (not excluded)
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Latest hike finish time (preferred)
          </label>
          <input
            type="time"
            value={formatTimeValue(preferences.preferredLatestEnd)}
            onChange={(e) =>
              handleChange({
                preferredLatestEnd: parseTimeValue(e.target.value),
              })
            }
            className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Hikes finishing after this are penalized (not excluded)
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Latest hike finish time (hard cutoff)
          </label>
          <input
            type="time"
            value={formatTimeValue(preferences.hardLatestEnd)}
            onChange={(e) =>
              handleChange({ hardLatestEnd: parseTimeValue(e.target.value) })
            }
            className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Hikes finishing after this are excluded entirely
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Buffer before return transport (minutes)
          </label>
          <input
            type="number"
            step="5"
            min="15"
            max="240"
            value={Math.round(preferences.returnBuffer * 60)}
            onChange={(e) =>
              handleChange({ returnBuffer: parseInt(e.target.value) / 60 })
            }
            className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Time needed after hike completion before catching return transport
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">
            Walking Speed
            <span className="ml-2 text-xs text-gray-500">
              ({preferences.walkingSpeed.toFixed(1)}x)
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="2.0"
            step="0.25"
            value={preferences.walkingSpeed}
            onChange={(e) =>
              handleChange({ walkingSpeed: parseFloat(e.target.value) })
            }
            list="walking-speed-ticks"
            className="w-full"
          />
          <datalist id="walking-speed-ticks">
            {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((val) => (
              <option
                key={val}
                value={val}
                label={val === 1 ? "1.0 (standard)" : val.toString()}
              ></option>
            ))}
          </datalist>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Slower</span>
            <span>Standard</span>
            <span>Faster</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Relative to walkhighlands time estimates
          </p>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-300">
        <h4 className="font-sans text-sm font-bold text-gray-800 mb-2">
          Scoring
        </h4>
        <p className="text-xs text-gray-500 mb-3">
          How important are these factors? (0 = ignore, 1 = most important)
        </p>

        <div className="space-y-3">
          {Object.entries(preferences.weights).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm text-gray-600 mb-1">
                {formatScoringLabel(key)}
                <span className="ml-2 text-xs text-gray-500">
                  ({value.toFixed(1)})
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={value}
                onChange={(e) =>
                  handleChange({
                    weights: {
                      ...preferences.weights,
                      [key]: parseFloat(e.target.value),
                    },
                  })
                }
                list={`weight-${key}-ticks`}
                className="w-full"
              />
              <datalist id={`weight-${key}-ticks`}>
                <option value="0" label="0"></option>
                <option value="0.5" label="0.5"></option>
                <option value="1" label="1"></option>
              </datalist>
              <p className="text-xs text-gray-500 mt-1">
                {getScoringExplanation(key)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
