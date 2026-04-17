import { useState, useEffect, useCallback } from 'react';

/**
 * User Preferences Hook — Personalization via localStorage
 * Saves gate preference, location, dietary needs, and notification settings.
 */
const STORAGE_KEY = 'stadium_preferences';

const DEFAULT_PREFS = {
  preferredGate: null,
  currentLocation: 'concourse_n',
  dietaryPrefs: [],          // ['vegetarian', 'halal', etc.]
  notificationTypes: ['CONGESTION', 'GATE_CLOSURE', 'QUEUE_READY', 'SUGGESTION'],
  simpleMode: false,
  theme: 'dark',
  userId: null,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Generate userId if not present
        if (!parsed.userId) {
          parsed.userId = 'user_' + Math.random().toString(36).slice(2, 9);
        }
        return { ...DEFAULT_PREFS, ...parsed };
      }
    } catch (e) {
      // ignore
    }
    return {
      ...DEFAULT_PREFS,
      userId: 'user_' + Math.random().toString(36).slice(2, 9),
    };
  });

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      // ignore
    }
  }, [preferences]);

  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setLocation = useCallback((location) => {
    updatePreference('currentLocation', location);
  }, [updatePreference]);

  const setPreferredGate = useCallback((gateId) => {
    updatePreference('preferredGate', gateId);
  }, [updatePreference]);

  const toggleSimpleMode = useCallback(() => {
    setPreferences((prev) => ({ ...prev, simpleMode: !prev.simpleMode }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFS, userId: preferences.userId });
  }, [preferences.userId]);

  return {
    preferences,
    updatePreference,
    setLocation,
    setPreferredGate,
    toggleSimpleMode,
    resetPreferences,
  };
}
