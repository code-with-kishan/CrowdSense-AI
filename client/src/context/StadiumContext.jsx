import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchSummary, fetchZones, fetchAlerts, fetchMapZones, fetchNotifications } from '../api';

const StadiumContext = createContext(null);

const POLL_INTERVAL = 15000; // 15s for real-time feel

export function StadiumProvider({ children }) {
  const [summary, setSummary] = useState(null);
  const [gates, setGates] = useState([]);
  const [foodCourts, setFoodCourts] = useState([]);
  const [restrooms, setRestrooms] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [mapZones, setMapZones] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const refreshData = useCallback(async () => {
    try {
      const [sum, g, f, r, a, mz, notifs] = await Promise.all([
        fetchSummary(),
        fetchZones('gate'),
        fetchZones('food'),
        fetchZones('restroom'),
        fetchAlerts(),
        fetchMapZones(),
        fetchNotifications(null, 10),
      ]);

      if (sum) setSummary(sum);
      if (g) setGates(g);
      if (f) setFoodCourts(f);
      if (r) setRestrooms(r);
      if (a) setAlerts(a);
      if (mz) setMapZones(mz);
      if (notifs) setNotifications(notifs);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    intervalRef.current = setInterval(refreshData, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [refreshData]);

  const value = {
    summary,
    gates,
    foodCourts,
    restrooms,
    alerts,
    mapZones,
    notifications,
    loading,
    error,
    refreshData,
  };

  return (
    <StadiumContext.Provider value={value}>
      {children}
    </StadiumContext.Provider>
  );
}

export function useStadium() {
  const ctx = useContext(StadiumContext);
  if (!ctx) throw new Error('useStadium must be used within StadiumProvider');
  return ctx;
}

export default StadiumContext;
