import { useMemo } from 'react';
import { StadiumProvider, useStadium } from './context/StadiumContext';
import { usePreferences } from './hooks/usePreferences';
import Header from './components/Header';
import AlertBanner from './components/AlertBanner';
import Dashboard from './components/Dashboard';
import GateCards from './components/GateCards';
import QueuePanel from './components/QueuePanel';
import StadiumMap from './components/StadiumMap';
import VirtualQueue from './components/VirtualQueue';
import AssistantPanel from './components/AssistantPanel';

function NotificationRail() {
  const { notifications } = useStadium();
  const latest = useMemo(() => (notifications || []).slice(0, 5), [notifications]);

  if (!latest.length) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">
          📢 Notifications
        </h2>
        <span className="badge bg-white/10 text-white border border-white/10">{latest.length}</span>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {latest.map((notification) => (
          <div
            key={notification.id}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300"
          >
            <div className="flex items-center gap-2">
              <span>{notification.icon || 'ℹ️'}</span>
              <span className="font-semibold text-white">{notification.type}</span>
              <span className="ml-auto text-[10px] text-gray-500">{notification.priority}</span>
            </div>
            <p className="mt-1 text-gray-400">{notification.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreferencesRail({ currentLocation, preferredGate, onLocationChange, onPreferredGateChange }) {
  const { summary } = useStadium();

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">
          🎛 Personalization
        </h2>
      </div>

      <div className="space-y-3">
        <label className="block text-[10px] uppercase tracking-wider text-gray-500">
          Current location
          <select
            value={currentLocation}
            onChange={(event) => onLocationChange(event.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="concourse_n">North Concourse</option>
            <option value="concourse_s">South Concourse</option>
            <option value="concourse_e">East Concourse</option>
            <option value="concourse_w">West Concourse</option>
            <option value="parking_north">Parking North</option>
            <option value="parking_south">Parking South</option>
          </select>
        </label>

        <label className="block text-[10px] uppercase tracking-wider text-gray-500">
          Preferred gate
          <select
            value={preferredGate || ''}
            onChange={(event) => onPreferredGateChange(event.target.value || null)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">Auto</option>
            {Array.from({ length: 6 }).map((_, index) => {
              const gateId = `gate_${index + 1}`;
              return (
                <option key={gateId} value={gateId}>
                  Gate {index + 1}
                </option>
              );
            })}
          </select>
        </label>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <span>Match phase</span>
            <span className="text-accent-light">{summary?.matchPhase || 'loading'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { preferences, setLocation, setPreferredGate } = usePreferences();

  return (
    <div className="min-h-screen text-gray-100">
      <Header />
      <AlertBanner />

      <main className="mx-auto max-w-[1600px] px-4 py-4 pb-8">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <Dashboard />
            <GateCards />
            <QueuePanel />
            <VirtualQueue />
          </section>

          <section className="space-y-4">
            <StadiumMap />
            <PreferencesRail
              currentLocation={preferences.currentLocation}
              preferredGate={preferences.preferredGate}
              onLocationChange={setLocation}
              onPreferredGateChange={setPreferredGate}
            />
          </section>

          <aside className="space-y-4">
            <AssistantPanel
              currentLocation={preferences.currentLocation}
              preferredGate={preferences.preferredGate}
              onLocationChange={setLocation}
              onPreferredGateChange={setPreferredGate}
              userId={preferences.userId}
            />
            <NotificationRail />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StadiumProvider>
      <AppShell />
    </StadiumProvider>
  );
}
