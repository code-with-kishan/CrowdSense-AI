import { useStadium } from '../context/StadiumContext';

const PHASE_LABELS = {
  pre_event: 'Pre-Event',
  gates_open: 'Gates Open',
  pre_match: 'Pre-Match',
  first_half: '1st Half',
  half_time: 'Half Time',
  second_half: '2nd Half',
  post_match: 'Post-Match',
  post_event: 'Event Ended',
};

export default function Header() {
  const { summary, notifications } = useStadium();
  const criticalCount = notifications?.filter((n) => n.priority === 'critical').length || 0;

  return (
    <header className="sticky top-0 z-50 h-14 bg-[#0a0a14]/85 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-[1440px] mx-auto h-full px-4 flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏟️</span>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold text-sm text-white">CrowdSense AI</span>
            <span className="text-[10px] text-gray-400">
              {summary?.stadiumName || 'Kishan Sports Arena'}
            </span>
          </div>
        </div>

        {/* Status badges — center */}
        <div className="hidden sm:flex items-center gap-2.5 ml-auto">
          {/* Match Phase Pill */}
          <div className="flex items-center gap-1.5 bg-accent/15 border border-accent/30 rounded-full px-3 py-1">
            <span className="status-dot bg-green-400 status-dot-pulse" />
            <span className="text-[11px] font-semibold text-accent-light uppercase tracking-wide">
              {PHASE_LABELS[summary?.matchPhase] || 'Loading...'}
            </span>
          </div>

          {/* Attendance */}
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-white font-display">
              {summary?.totalAttendance?.toLocaleString() || '—'}
            </span>
            <span className="text-[10px] text-gray-500">fans</span>
          </div>
        </div>

        {/* Emergency + Notification */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {criticalCount > 0 && (
            <span className="badge bg-red-500/20 text-red-300 border border-red-500/30">
              {criticalCount} Alert{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          <button className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-all hover:-translate-y-0.5">
            🚨 Emergency
          </button>
        </div>
      </div>
    </header>
  );
}
