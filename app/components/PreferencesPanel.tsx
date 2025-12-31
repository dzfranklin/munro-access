import { useState } from "react";
import { usePreferences } from "~/preferences-context";
import { START_LOCATION_ORDER } from "~/constants";

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
            {/* Start Location Preference */}
            <div>
              <h4 className="font-sans text-sm font-bold text-gray-800 mb-3">
                Preferred Start Location
              </h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Default starting point
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
                    .sort((a, b) => 
                      START_LOCATION_ORDER.indexOf(a.name as any) - START_LOCATION_ORDER.indexOf(b.name as any)
                    )
                    .map((start) => (
                      <option key={start.id} value={start.id}>
                        {start.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  This will be the default tab when viewing routes. If not set,
                  the site will remember your most recent selection.
                </p>
              </div>
            </div>

            {/* Timing Preferences */}
            <div>
              <h4 className="font-sans text-sm font-bold text-gray-800 mb-3">
                Timing
              </h4>
              <div className="space-y-4">
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
                    Sunset Time (summer)
                  </label>
                  <input
                    type="time"
                    value={`${String(Math.floor(preferences.sunset)).padStart(2, "0")}:${String(Math.round((preferences.sunset % 1) * 60)).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value
                        .split(":")
                        .map(Number);
                      updatePreferences({
                        sunset: hours + minutes / 60,
                      });
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                  />
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
                    Time needed after hike completion (using max Walkhighlands
                    time) before catching return transport
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Preferences */}
            <div>
              <h4 className="font-sans text-sm font-bold text-gray-800 mb-3">
                Performance
              </h4>

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

              <div className="mt-5 pt-5 border-t border-gray-300">
                <h5 className="font-sans text-sm font-bold text-gray-800 mb-2">
                  Priorities
                </h5>
                <p className="text-xs text-gray-500 mb-3">
                  How important are these factors? (0 = ignore, 1 = critical)
                </p>

                <div className="space-y-3">
                  {Object.entries(preferences.weights).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm text-gray-600 mb-1">
                        {key.replace(/([A-Z])/g, " $1").trim()}:{" "}
                        {value.toFixed(1)}
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
