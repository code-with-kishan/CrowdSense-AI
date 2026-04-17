import { useStadium } from '../context/StadiumContext';

export default function Dashboard() {
  const { summary, loading } = useStadium();

  if (loading || !summary) {
    return (
      <div className="glass-card p-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-40 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Avg Density',
      value: `${Math.round((summary.averageDensity || 0) * 100)}%`,
      color: summary.averageDensity > 0.6 ? 'text-orange-400' : 'text-green-400',
    },
    {
      label: 'Total Zones',
      value: summary.totalZones || 18,
      color: 'text-accent-light',
    },
    {
      label: 'Active Alerts',
      value: summary.alertCount || 0,
      color: summary.alertCount > 0 ? 'text-red-400' : 'text-green-400',
      highlight: summary.alertCount > 0,
    },
    {
      label: 'Last Update',
      value: summary.lastUpdated
        ? new Date(summary.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—',
      color: 'text-gray-400',
    },
  ];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">
          📊 Stadium Overview
        </h2>
        <span className="badge bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse-slow">
          LIVE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white/[0.03] border rounded-lg p-3 flex flex-col gap-0.5
              ${stat.highlight ? 'border-orange-500/25 bg-orange-500/5' : 'border-white/[0.06]'}`}
          >
            <span className={`text-lg font-bold font-display ${stat.color}`}>
              {stat.value}
            </span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
