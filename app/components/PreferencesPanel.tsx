import { useState } from "react";
import { usePreferences } from "~/preferences-context";
import { START_LOCATION_ORDER } from "~/utils/constants";

type StartLocation = {
  id: string;
  name: string;
};

type PreferencesPanelProps = {
  startLocations: StartLocation[];
};

export function PreferencesPanel({ startLocations }: PreferencesPanelProps) {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-theme-navy-700 text-white text-sm hover:bg-theme-navy-900 underline"
      >
        {isOpen ? "Hide" : "Show"} Preferences
      </button>

      {isOpen && (
        <div className="mt-4 p-5 bg-gray-50 border border-gray-300">
          <div className="border-b-2 border-gray-300 pb-3 mb-5">
            <h3 className="font-serif text-lg font-bold text-theme-navy-900 inline">
              Your Preferences
            </h3>
            <button
              onClick={resetPreferences}
              className="text-sm text-theme-navy-700 underline hover:no-underline float-right"
            >
              Reset to defaults
            </button>
          </div>

          <div className="space-y-6">
            {/* General preferences */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Preferred Start Location
                </label>
                <select
                  value={preferences.preferredStartLocation || ""}
                  onChange={(e) =>
                    updatePreferences({
                      preferredStartLocation: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">Use most recently selected location</option>
                  {[...startLocations]
                    .sort(
                      (a, b) =>
                        START_LOCATION_ORDER.indexOf(a.name as any) -
                        START_LOCATION_ORDER.indexOf(b.name as any)
                    )
                    .map((start) => (
                      <option key={start.id} value={start.id}>
                        {start.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Default tab when viewing routes
                </p>
              </div>

              <div>
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={preferences.allowCycling}
                    onChange={(e) =>
                      updatePreferences({
                        allowCycling: e.target.checked,
                      })
                    }
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
                  Overnight trip penalty:{" "}
                  {Math.round(preferences.overnightPenalty * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={preferences.overnightPenalty}
                  onChange={(e) =>
                    updatePreferences({
                      overnightPenalty: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>No penalty (0%)</span>
                  <span>Default (30%)</span>
                  <span>Exclude (100%)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Penalty applied to trips spanning multiple days. Set to 100%
                  to effectively exclude them.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Earliest Departure Time
                </label>
                <input
                  type="time"
                  value={`${String(Math.floor(preferences.earliestDeparture)).padStart(2, "0")}:${String(Math.round((preferences.earliestDeparture % 1) * 60)).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value
                      .split(":")
                      .map(Number);
                    updatePreferences({
                      earliestDeparture: hours + minutes / 60,
                    });
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Preferred latest hike finish time
                </label>
                <input
                  type="time"
                  value={`${String(Math.floor(preferences.preferredLatestEnd)).padStart(2, "0")}:${String(Math.round((preferences.preferredLatestEnd % 1) * 60)).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value
                      .split(":")
                      .map(Number);
                    updatePreferences({
                      preferredLatestEnd: hours + minutes / 60,
                    });
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Hikes finishing after this are penalized (not excluded)
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Hard latest hike finish time
                </label>
                <input
                  type="time"
                  value={`${String(Math.floor(preferences.hardLatestEnd)).padStart(2, "0")}:${String(Math.round((preferences.hardLatestEnd % 1) * 60)).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value
                      .split(":")
                      .map(Number);
                    updatePreferences({
                      hardLatestEnd: hours + minutes / 60,
                    });
                  }}
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
                    updatePreferences({
                      returnBuffer: parseInt(e.target.value) / 60,
                    })
                  }
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Time needed after hike completion before catching return
                  transport
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Walking Speed: {preferences.walkingSpeed.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.1"
                  value={preferences.walkingSpeed}
                  onChange={(e) =>
                    updatePreferences({
                      walkingSpeed: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Slower (0.6x)</span>
                  <span>Standard (1.0x)</span>
                  <span>Faster (1.4x)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Relative to walkhighlands time estimates
                </p>
              </div>
            </div>

            {/* Scoring */}
            <div className="pt-5 border-t border-gray-300">
              <h4 className="font-sans text-sm font-bold text-gray-800 mb-2">
                Scoring
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                How important are these factors? (0 = ignore, 1 = critical)
              </p>

              <div className="space-y-3">
                {Object.entries(preferences.weights).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm text-gray-600 mb-1">
                      {(key[0].toUpperCase() + key.slice(1))
                        .replace(/([A-Z])/g, " $1")
                        .trim()}
                      : {value.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={value}
                      onChange={(e) =>
                        updatePreferences({
                          weights: {
                            ...preferences.weights,
                            [key]: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-300 bg-gray-100 -mx-5 -mb-5 px-5 py-4">
            <p className="text-sm text-gray-700 m-0">
              <strong>Note:</strong> These preferences are saved in your browser
              and affect how routes are ranked.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
