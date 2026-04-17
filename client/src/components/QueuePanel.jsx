import { useStadium } from '../context/StadiumContext';

const levelColor = (d) => {
  if (d < 0.3) return '#10b981';
  if (d < 0.55) return '#f59e0b';
  if (d < 0.75) return '#f97316';
  return '#ef4444';
};

function ZoneList({ title, icon, zones }) {
  if (!zones.length) return null;
  const sorted = [...zones].sort((a, b) => (a.score || 0) - (b.score || 0));

  return (
    <div className="glass-card p-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display mb-3">
        {icon} {title}
      </h2>
      <div className="flex flex-col gap-1.5">
        {sorted.map((zone, i) => {
          const color = levelColor(zone.crowdDensity);
          const wait = zone.queueMinutes ?? Math.round(zone.crowdDensity * 30);
          return (
            <div
              key={zone.id}
              className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.05] hover:border-accent/20 transition-all"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-white font-medium flex-1 truncate">{zone.name}</span>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">~{wait}m</span>
              {i === 0 && (
                <span className="badge bg-accent/15 text-accent-light border border-accent/30">
                  BEST
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QueuePanel() {
  const { foodCourts, restrooms } = useStadium();

  return (
    <>
      <ZoneList title="Food Courts" icon="🍔" zones={foodCourts} />
      <ZoneList title="Restrooms" icon="🚻" zones={restrooms} />
    </>
  );
}
