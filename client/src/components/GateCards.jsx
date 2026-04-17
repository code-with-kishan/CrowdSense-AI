import { useStadium } from '../context/StadiumContext';

const levelColor = (d) => {
  if (d < 0.3) return { bg: 'bg-green-500', text: 'text-green-400', fill: '#10b981', label: '🟢 Low' };
  if (d < 0.55) return { bg: 'bg-amber-500', text: 'text-amber-400', fill: '#f59e0b', label: '🟡 Moderate' };
  if (d < 0.75) return { bg: 'bg-orange-500', text: 'text-orange-400', fill: '#f97316', label: '🟠 High' };
  return { bg: 'bg-red-500', text: 'text-red-400', fill: '#ef4444', label: '🔴 Critical' };
};

export default function GateCards() {
  const { gates } = useStadium();
  if (!gates.length) return null;

  const sorted = [...gates].sort((a, b) => (a.score || 0) - (b.score || 0));

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">
          🚪 Gate Status
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sorted.map((gate, i) => {
          const lc = levelColor(gate.crowdDensity);
          const pct = Math.round(gate.crowdDensity * 100);
          const wait = gate.queueMinutes ?? Math.round(gate.crowdDensity * 40);
          const isBest = i === 0;

          return (
            <div
              key={gate.id}
              className={`relative bg-white/[0.03] border rounded-lg p-3 transition-all duration-200 hover:-translate-y-0.5
                ${isBest ? 'border-accent/40 bg-accent/[0.06]' : 'border-white/[0.06]'}`}
            >
              {/* Best badge */}
              {isBest && (
                <span className="absolute top-1.5 right-1.5 badge bg-accent/20 text-accent-light border border-accent/30">
                  Best
                </span>
              )}

              {/* Gate name */}
              <div className="text-[11px] font-semibold text-white mb-1 truncate pr-8">
                {gate.name}
              </div>

              {/* Density % and label */}
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-base font-bold font-display ${lc.text}`}>
                  {pct}%
                </span>
                <span className="text-[9px] text-gray-500">{lc.label}</span>
              </div>

              {/* Density bar */}
              <div className="density-bar mb-1.5">
                <div
                  className="density-fill"
                  style={{ width: `${pct}%`, background: lc.fill }}
                />
              </div>

              {/* Wait time */}
              <div className="text-[10px] text-gray-500">
                ⏱ ~{wait} min wait
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
