import { useState } from 'react';
import { useStadium } from '../context/StadiumContext';

/* Colors for density levels */
const densityColor = (d) => {
  if (d < 0.3) return '#10b981';
  if (d < 0.55) return '#f59e0b';
  if (d < 0.75) return '#f97316';
  return '#ef4444';
};

const densityLabel = (d) => {
  if (d < 0.3) return 'Low';
  if (d < 0.55) return 'Moderate';
  if (d < 0.75) return 'High';
  return 'Critical';
};

/* Zone icon by type */
const zoneIcon = (type) =>
  ({ gate: '🚪', concourse: '🏗️', food: '🍔', restroom: '🚻' }[type] || '📍');

export default function StadiumMap() {
  const { mapZones } = useStadium();
  const [hoveredZone, setHoveredZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const hovered = hoveredZone
    ? mapZones.find((z) => z.id === hoveredZone)
    : null;
  const selected = selectedZone
    ? mapZones.find((z) => z.id === selectedZone)
    : null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">
          🗺️ Live Heatmap
        </h2>
        <div className="flex items-center gap-2">
          {['Low', 'Moderate', 'High', 'Critical'].map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: ['#10b981', '#f59e0b', '#f97316', '#ef4444'][i] }}
              />
              <span className="text-[9px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Stadium Map */}
      <div className="relative w-full aspect-square max-h-[350px] bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Stadium outline — elliptical bowl */}
          <ellipse cx="50" cy="50" rx="46" ry="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          <ellipse cx="50" cy="50" rx="38" ry="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />

          {/* Field / pitch */}
          <rect x="30" y="35" width="40" height="30" rx="3" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" strokeWidth="0.3" />
          <line x1="50" y1="35" x2="50" y2="65" stroke="rgba(16,185,129,0.15)" strokeWidth="0.2" />
          <circle cx="50" cy="50" r="5" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="0.2" />

          {/* Compass labels */}
          <text x="50" y="3" textAnchor="middle" className="fill-gray-600 text-[3px] font-bold">N</text>
          <text x="50" y="99" textAnchor="middle" className="fill-gray-600 text-[3px] font-bold">S</text>
          <text x="98" y="51" textAnchor="end" className="fill-gray-600 text-[3px] font-bold">E</text>
          <text x="2" y="51" textAnchor="start" className="fill-gray-600 text-[3px] font-bold">W</text>

          {/* Heatmap zones */}
          {mapZones.map((zone) => {
            const p = zone.position;
            if (!p) return null;
            const color = densityColor(zone.crowdDensity);
            const isHovered = hoveredZone === zone.id;
            const isSelected = selectedZone === zone.id;

            return (
              <g key={zone.id}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  rx="1.5"
                  fill={color}
                  fillOpacity={0.15 + zone.crowdDensity * 0.45}
                  className="heatmap-zone"
                  style={{
                    stroke: isHovered || isSelected ? color : undefined,
                    strokeWidth: isHovered || isSelected ? 1.5 : undefined,
                    filter: isHovered ? `drop-shadow(0 0 4px ${color}60)` : undefined,
                  }}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
                />
                {/* Zone label */}
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2 + 1}
                  textAnchor="middle"
                  className="fill-white/70 text-[2.5px] font-semibold pointer-events-none select-none"
                >
                  {zone.type === 'gate' ? zone.id.replace('gate_', 'G') :
                   zone.type === 'food' ? zone.id.replace('food_', 'F') :
                   zone.type === 'restroom' ? 'WC' :
                   zone.id.replace('concourse_', '').toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-lg rounded-lg p-2.5 border border-white/10 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{zoneIcon(hovered.type)}</span>
                <div>
                  <div className="text-xs font-semibold text-white">{hovered.name}</div>
                  <div className="text-[10px] text-gray-400">
                    {Math.round(hovered.crowdDensity * 100)}% full · ~{hovered.queueMinutes}min wait
                  </div>
                </div>
              </div>
              <span
                className="badge border"
                style={{
                  color: densityColor(hovered.crowdDensity),
                  borderColor: densityColor(hovered.crowdDensity) + '40',
                  background: densityColor(hovered.crowdDensity) + '20',
                }}
              >
                {densityLabel(hovered.crowdDensity)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Selected zone detail */}
      {selected && (
        <div className="mt-3 p-3 bg-accent/5 border border-accent/20 rounded-lg animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">
              {zoneIcon(selected.type)} {selected.name}
            </span>
            <button
              onClick={() => setSelectedZone(null)}
              className="text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold font-display" style={{ color: densityColor(selected.crowdDensity) }}>
                {Math.round(selected.crowdDensity * 100)}%
              </div>
              <div className="text-[9px] text-gray-500 uppercase">Density</div>
            </div>
            <div>
              <div className="text-lg font-bold font-display text-amber-400">
                ~{selected.queueMinutes}m
              </div>
              <div className="text-[9px] text-gray-500 uppercase">Wait</div>
            </div>
            <div>
              <div className="text-lg font-bold font-display text-accent-light">
                {selected.currentPeople}
              </div>
              <div className="text-[9px] text-gray-500 uppercase">People</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
