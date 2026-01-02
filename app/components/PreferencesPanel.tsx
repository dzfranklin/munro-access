import { useState, useEffect } from "react";
import { useNavigation, useActionData, useSubmit } from "react-router";
import { START_LOCATION_ORDER } from "~/utils/constants";
import {
  type UserPreferences,
  type RankingPreferences,
  DEFAULT_PREFERENCES,
} from "~/results/scoring";
import { PreferencesControls } from "./PreferencesControls";

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
  const [preferences, setPreferences] =
    useState<UserPreferences>(initialPreferences);

  const navigation = useNavigation();
  const actionData = useActionData();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData) {
      setIsOpen(false);
    }
  }, [actionData]);

  const handlePreferencesChange = (newPrefs: RankingPreferences) => {
    setPreferences({ ...preferences, ranking: newPrefs });
  };

  const submitPreferences = (prefs: UserPreferences) => {
    setPreferences(prefs);

    const formData = new FormData();
    formData.append("action", "update");
    formData.append("preferences", JSON.stringify(prefs));
    submit(formData, { method: "post" });
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
        <div className="mt-4 p-5 bg-gray-50 border border-gray-300">
          <div className="border-b-2 border-gray-300 pb-3 mb-5">
            <h3 className="font-serif text-lg font-bold text-theme-navy-900 inline">
              Your Preferences
            </h3>
            <button
              onClick={() => submitPreferences(DEFAULT_PREFERENCES)}
              className="text-sm text-theme-navy-700 underline hover:no-underline float-right"
            >
              Reset to defaults
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                Preferred Start Location
              </label>
              <select
                value={preferences.ui.preferredStartLocation || ""}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    ui: {
                      ...preferences.ui,
                      preferredStartLocation: e.target.value || null,
                    },
                  })
                }
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

            <PreferencesControls
              preferences={preferences.ranking}
              onChange={handlePreferencesChange}
            />
          </div>

          <div className="mt-5 pt-4 border-t border-gray-300">
            <button
              onClick={() => submitPreferences(preferences)}
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
        </div>
      )}
    </div>
  );
}
