import { useState, useEffect } from "react";
import { Form, useNavigation, useActionData } from "react-router";
import { START_LOCATION_ORDER } from "~/utils/constants";
import { type UserPreferences } from "results/scoring";

type StartLocation = {
  id: string;
  name: string;
};

type PreferencesPanelProps = {
  startLocations: StartLocation[];
  initialPreferences: UserPreferences;
};

export function PreferencesPanel({
  startLocations,
  initialPreferences,
}: PreferencesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigation = useNavigation();
  const actionData = useActionData();

  const isSubmitting = navigation.state === "submitting";

  // Close panel after successful submission
  useEffect(() => {
    if (actionData) {
      setIsOpen(false);
    }
  }, [actionData]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const formData = new FormData(form);
    const action = formData.get("action");

    if (action === "reset") {
      // Let form submit normally for reset
      return;
    }

    // Prevent default and build preferences JSON
    e.preventDefault();

    // Parse time inputs (HH:MM format) to decimal hours
    const parseTime = (timeStr: string | null): number => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours + minutes / 60;
    };

    const preferences = {
      preferredStartLocation: formData.get("preferredStartLocation") || null,
      lastViewedStartLocation: initialPreferences.lastViewedStartLocation,
      earliestDeparture: parseTime(formData.get("earliestDeparture") as string),
      latestArrival: parseTime(formData.get("latestArrival") as string),
      walkingSpeed: parseFloat(formData.get("walkingSpeed") as string),
      returnBuffer: parseFloat(formData.get("returnBuffer") as string) / 60, // Convert minutes to hours
      preferredLatestEnd: parseTime(formData.get("preferredLatestEnd") as string),
      hardLatestEnd: parseTime(formData.get("hardLatestEnd") as string),
      allowCycling: formData.get("allowCycling") === "on",
      overnightPenalty: parseFloat(formData.get("overnightPenalty") as string),
      weights: {
        departureTime: parseFloat(formData.get("weight_departureTime") as string),
        returnTime: parseFloat(formData.get("weight_returnTime") as string),
        hikeDuration: parseFloat(formData.get("weight_hikeDuration") as string),
        returnOptions: parseFloat(formData.get("weight_returnOptions") as string),
        totalDuration: parseFloat(formData.get("weight_totalDuration") as string),
        finishTime: parseFloat(formData.get("weight_finishTime") as string),
      },
    };

    // Create new FormData with JSON
    const submitData = new FormData();
    submitData.append("action", "update");
    submitData.append("preferences", JSON.stringify(preferences));

    // Submit using fetch
    fetch(form.action || window.location.pathname, {
      method: "POST",
      body: submitData,
    }).then(() => {
      window.location.reload();
    });
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-theme-navy-700 text-white text-sm hover:bg-theme-navy-900 underline"
        data-testid="preferences-toggle"
      >
        {isOpen ? "Hide" : "Show"} Preferences
      </button>

      {isOpen && (
        <Form
          method="post"
          className="mt-4 p-5 bg-gray-50 border border-gray-300"
          onSubmit={handleSubmit}
        >
          <div className="border-b-2 border-gray-300 pb-3 mb-5">
            <h3 className="font-serif text-lg font-bold text-theme-navy-900 inline">
              Your Preferences
            </h3>
            <button
              type="submit"
              name="action"
              value="reset"
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
                  name="preferredStartLocation"
                  defaultValue={initialPreferences.preferredStartLocation || ""}
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm bg-white"
                >
                  <option value="">No preference</option>
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
                    name="allowCycling"
                    defaultChecked={initialPreferences.allowCycling}
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
                  {Math.round(initialPreferences.overnightPenalty * 100)}%
                </label>
                <input
                  type="range"
                  name="overnightPenalty"
                  min="0"
                  max="1"
                  step="0.1"
                  defaultValue={initialPreferences.overnightPenalty}
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
                  Earliest Departure Time (hard cutoff)
                </label>
                <input
                  type="time"
                  name="earliestDeparture"
                  defaultValue={`${String(Math.floor(initialPreferences.earliestDeparture)).padStart(2, "0")}:${String(Math.round((initialPreferences.earliestDeparture % 1) * 60)).padStart(2, "0")}`}
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Itineraries departing before this time are excluded entirely
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Latest preferred return arrival time
                </label>
                <input
                  type="time"
                  name="preferredLatestArrival"
                  defaultValue={`${String(Math.floor(initialPreferences.preferredLatestArrival)).padStart(2, "0")}:${String(Math.round((initialPreferences.preferredLatestArrival % 1) * 60)).padStart(2, "0")}`}
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Arrivals home after this time are penalized (not excluded)
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Preferred latest hike finish time
                </label>
                <input
                  type="time"
                  name="preferredLatestEnd"
                  defaultValue={`${String(Math.floor(initialPreferences.preferredLatestEnd)).padStart(2, "0")}:${String(Math.round((initialPreferences.preferredLatestEnd % 1) * 60)).padStart(2, "0")}`}
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
                  name="hardLatestEnd"
                  defaultValue={`${String(Math.floor(initialPreferences.hardLatestEnd)).padStart(2, "0")}:${String(Math.round((initialPreferences.hardLatestEnd % 1) * 60)).padStart(2, "0")}`}
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
                  name="returnBuffer"
                  step="5"
                  min="15"
                  max="240"
                  defaultValue={Math.round(
                    initialPreferences.returnBuffer * 60
                  )}
                  className="w-full px-3 py-2 border-2 border-gray-300 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Time needed after hike completion before catching return
                  transport
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Walking Speed: {initialPreferences.walkingSpeed.toFixed(1)}x
                </label>
                <input
                  type="range"
                  name="walkingSpeed"
                  min="0.6"
                  max="1.4"
                  step="0.1"
                  defaultValue={initialPreferences.walkingSpeed}
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
                {Object.entries(initialPreferences.weights).map(
                  ([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm text-gray-600 mb-1">
                        {(key[0].toUpperCase() + key.slice(1))
                          .replace(/([A-Z])/g, " $1")
                          .trim()}
                        : {value.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        name={`weight_${key}`}
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={value}
                        className="w-full"
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-300">
            <button
              type="submit"
              name="action"
              value="update"
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm font-bold ${
                !isSubmitting
                  ? "bg-theme-navy-700 text-white hover:bg-theme-navy-900"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Applying..." : "Apply Changes"}
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-300 bg-gray-100 -mx-5 -mb-5 px-5 py-4">
            <p className="text-sm text-gray-700 m-0">
              <strong>Note:</strong> These preferences are saved in your browser
              and affect how routes are ranked.
            </p>
          </div>
        </Form>
      )}
    </div>
  );
}
