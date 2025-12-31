import { createContext, useContext, useState, useLayoutEffect, type ReactNode } from "react";
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
  userPreferencesSchema,
} from "results/scoring";

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load from localStorage synchronously before paint to avoid flash
  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("munro-access-preferences");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate and merge with defaults
          const validated = userPreferencesSchema.parse({
            ...DEFAULT_PREFERENCES,
            ...parsed,
          });
          setPreferences(validated);
        } catch (error) {
          // If validation fails, clear the corrupted data and use defaults
          console.warn("Invalid preferences in localStorage, resetting:", error);
          localStorage.removeItem("munro-access-preferences");
        }
      }
    }
  }, []);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    try {
      const newPrefs = { ...preferences, ...updates };
      // Validate before saving
      const validated = userPreferencesSchema.parse(newPrefs);
      setPreferences(validated);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "munro-access-preferences",
          JSON.stringify(validated)
        );
      }
    } catch (error) {
      console.error("Invalid preference update:", error);
      // Don't update if validation fails
    }
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    if (typeof window !== "undefined") {
      localStorage.removeItem("munro-access-preferences");
    }
  };

  return (
    <PreferencesContext.Provider
      value={{ preferences, updatePreferences, resetPreferences }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
