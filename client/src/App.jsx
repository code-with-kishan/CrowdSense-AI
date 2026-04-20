import { useEffect, useMemo, useRef, useState } from 'react';
import { computePath, crowdColor, crowdLevel, findBestGate, nearestByType } from './data/navigation';
import { edges, graphNodes, movementTrack, zones as initialZones } from './data/stadiumData';
import SectionCard from './components/SectionCard';
import InsightCard from './components/InsightCard';
import { sendAssistantMessage } from './api/assistantApi';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const viewBox = '0 0 1000 700';
const PIXELS_PER_METER = 3.6;
const BASE_WALK_SPEED_MPS = 1.35;

function nextCrowdValue(value) {
  const drift = Math.round((Math.random() - 0.48) * 18);
  return clamp(value + drift, 10, 95);
}

function statusText(crowd) {
  if (crowd >= 70) return 'High Congestion';
  if (crowd >= 40) return 'Medium Congestion';
  return 'Low Congestion';
}

function distanceInMeters(pxDistance) {
  return Math.max(1, Math.round(pxDistance / PIXELS_PER_METER));
}

function formatDistance(pxDistance) {
  const meters = distanceInMeters(pxDistance);
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

function estimateEta(pxDistance, crowd = 40) {
  const meters = distanceInMeters(pxDistance);
  const crowdFactor = crowd >= 70 ? 0.72 : crowd >= 40 ? 0.86 : 1;
  const seconds = meters / (BASE_WALK_SPEED_MPS * crowdFactor);
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function Popup({ zone, onClose }) {
  if (!zone) return null;

  return (
    <div className="absolute left-4 top-4 z-20 w-[240px] overflow-hidden rounded-[1.4rem] border border-white/15 bg-slate-950/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-amber-300 to-orange-400" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Selected Point</p>
          <h3 className="mt-1 text-base font-semibold text-white">{zone.label}</h3>
        </div>
        <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white" type="button">
          ×
        </button>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Crowd</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-semibold text-white">{crowdLevel(zone.crowd)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Wait</span>
          <span className="font-semibold text-white">{zone.wait ? `${zone.wait} min` : 'NA'}</span>
        </div>
      </div>
    </div>
  );
}

function handleSvgKeyActivate(event, handler) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler();
  }
}

function StadiumMap({ zones, userPoint, routePoints, selectedZone, selectedPath, onSelectZone, onSelectPath, onClearSelection, bestGate, routeStart, routeTarget, routeEtaLabel }) {
  const zoneById = Object.fromEntries(zones.map((zone) => [zone.id, zone]));

  const seatingRects = [
    { id: 'seatN', x: 300, y: 80, width: 400, height: 70 },
    { id: 'seatS', x: 300, y: 550, width: 400, height: 70 },
    { id: 'seatE', x: 760, y: 220, width: 120, height: 260 },
    { id: 'seatW', x: 120, y: 220, width: 120, height: 260 },
  ];

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/40 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
      <div className="pointer-events-none absolute -right-20 top-10 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-52 w-52 rounded-full bg-orange-400/10 blur-3xl" />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Final Section</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Stadium Map</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            Stadium-only SVG map with gates, seating, food, and moving user location.
          </p>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
          SVG only · no map SDK
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#091524]">
          <svg viewBox={viewBox} className="h-auto w-full" role="img" aria-label="Stadium map">
            <defs>
              <linearGradient id="pitchFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1f7a4f" />
                <stop offset="100%" stopColor="#155136" />
              </linearGradient>
              <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width="1000" height="700" fill="url(#grid)" />
            <rect x="120" y="80" width="760" height="540" rx="130" fill="#102338" stroke="#5ba6a6" strokeWidth="4" />
            {seatingRects.map((block) => {
              const zone = zoneById[block.id];
              return (
                <rect
                  key={block.id}
                  x={block.x}
                  y={block.y}
                  width={block.width}
                  height={block.height}
                  rx="24"
                  fill={crowdColor(zone?.crowd || 0)}
                  fillOpacity="0.26"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2"
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`${zone.label}, ${crowdLevel(zone.crowd)} crowd`}
                  onClick={() => onSelectZone(zone)}
                  onKeyDown={(event) => handleSvgKeyActivate(event, () => onSelectZone(zone))}
                />
              );
            })}

            <rect x="300" y="180" width="400" height="340" rx="42" fill="url(#pitchFill)" stroke="#9ae6b4" strokeWidth="2" />
            <circle cx="500" cy="350" r="48" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <line x1="500" y1="180" x2="500" y2="520" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />

            {edges.map(([a, b]) => {
              const first = zoneById[a] || graphNodes.find((node) => node.id === a);
              const second = zoneById[b] || graphNodes.find((node) => node.id === b);
              const syntheticCrowd = Math.round(((zoneById[a]?.crowd || 30) + (zoneById[b]?.crowd || 30)) / 2);
              const selected = selectedPath?.id === `${a}-${b}` || selectedPath?.id === `${b}-${a}`;

              return (
                <line
                  key={`${a}-${b}`}
                  x1={first.x}
                  y1={first.y}
                  x2={second.x}
                  y2={second.y}
                  stroke={crowdColor(syntheticCrowd)}
                  strokeWidth={selected ? 8 : 5}
                  strokeLinecap="round"
                  className="cursor-pointer opacity-90 transition-opacity hover:opacity-100"
                  tabIndex={0}
                  role="button"
                  aria-label={`Route segment from ${a} to ${b}`}
                  onClick={() => onSelectPath({
                    id: `${a}-${b}`,
                    label: `Path ${a} to ${b}`,
                    crowd: syntheticCrowd,
                    wait: Math.max(1, Math.round(syntheticCrowd / 12)),
                    x: (first.x + second.x) / 2,
                    y: (first.y + second.y) / 2,
                  })}
                  onKeyDown={(event) => handleSvgKeyActivate(event, () => onSelectPath({
                    id: `${a}-${b}`,
                    label: `Path ${a} to ${b}`,
                    crowd: syntheticCrowd,
                    wait: Math.max(1, Math.round(syntheticCrowd / 12)),
                    x: (first.x + second.x) / 2,
                    y: (first.y + second.y) / 2,
                  }))}
                />
              );
            })}

            {routePoints.length > 1 ? (
              <polyline
                points={routePoints.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke="#f88a18"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 7"
              >
                <animate attributeName="stroke-dashoffset" values="0;34" dur="1.8s" repeatCount="indefinite" />
              </polyline>
            ) : null}

            {zones.map((zone) => {
              const isSeating = zone.type === 'seating';
              const radius = isSeating ? 8 : 15;
              const tag = zone.type === 'gate' ? 'G' : zone.type === 'food' ? 'F' : 'R';

              if (isSeating) {
                return (
                  <g
                    key={zone.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    aria-label={`${zone.label}, ${crowdLevel(zone.crowd)} crowd`}
                    onClick={() => onSelectZone(zone)}
                    onKeyDown={(event) => handleSvgKeyActivate(event, () => onSelectZone(zone))}
                  >
                    <circle cx={zone.x} cy={zone.y} r={12} fill={crowdColor(zone.crowd)} fillOpacity="0.3" />
                    <circle cx={zone.x} cy={zone.y} r={radius} fill={crowdColor(zone.crowd)} stroke="#0f172a" strokeWidth="2" />
                  </g>
                );
              }

              return (
                <g
                  key={zone.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`${zone.label}, ${crowdLevel(zone.crowd)} crowd`}
                  onClick={() => onSelectZone(zone)}
                  onKeyDown={(event) => handleSvgKeyActivate(event, () => onSelectZone(zone))}
                >
                  <circle cx={zone.x} cy={zone.y} r={radius + 4} fill={crowdColor(zone.crowd)} fillOpacity="0.2">
                    <animate attributeName="r" values={`${radius + 1};${radius + 5};${radius + 1}`} dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={zone.x} cy={zone.y} r={radius} fill={crowdColor(zone.crowd)} stroke="#0f172a" strokeWidth="2" />
                  <text x={zone.x} y={zone.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#05111f">
                    {tag}
                  </text>
                </g>
              );
            })}

            <g>
              <circle cx={userPoint.x} cy={userPoint.y} r="16" fill="rgba(80,200,120,0.25)">
                <animate attributeName="r" values="12;17;12" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle cx={userPoint.x} cy={userPoint.y} r="7" fill="#50c878" stroke="#092419" strokeWidth="2" />
            </g>
          </svg>

          <Popup zone={selectedZone} onClose={onClearSelection} />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] p-4 shadow-[0_12px_40px_rgba(2,6,23,0.25)]">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Smart Decision</p>
            <div className="mt-3 space-y-3 text-sm text-slate-200">
              <p className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2"><span className="text-slate-300">Best Gate</span><span className="font-semibold text-white">{bestGate.gate.label}</span></p>
              <p className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2"><span className="text-slate-300">Crowd</span><span className="font-semibold text-white">{statusText(bestGate.gate.crowd)}</span></p>
              <p className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2"><span className="text-slate-300">Wait</span><span className="font-semibold text-white">{bestGate.gate.wait} min</span></p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/10 to-white/[0.03] p-4 shadow-[0_12px_40px_rgba(2,6,23,0.25)]">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Route</p>
            <p className="mt-2 text-sm text-slate-200">
              {routeStart} {'->'} {routeTarget || selectedZone?.label || bestGate.gate.label}
            </p>
            <p className="mt-1 text-xs text-slate-400">The orange route line updates live and is currently estimated at {routeEtaLabel}.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] p-4 shadow-[0_12px_40px_rgba(2,6,23,0.25)]">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Map Legend</p>
            <div className="mt-3 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Low crowd</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /> Medium crowd</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" /> High crowd</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [zones, setZones] = useState(initialZones);
  const [userPoint, setUserPoint] = useState(movementTrack[0]);
  const trackIndexRef = useRef(0);
  const [selectedZoneId, setSelectedZoneId] = useState('gateB');
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask: Which gate is best? Where is the nearest food stall?' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [assistantStatus, setAssistantStatus] = useState('checking');
  const chatSessionRef = useRef(`web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const mapSectionRef = useRef(null);
  const assistantSectionRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      trackIndexRef.current = (trackIndexRef.current + 1) % movementTrack.length;
      const waypoint = movementTrack[trackIndexRef.current];
      const jitter = () => Math.round((Math.random() - 0.5) * 10);
      setUserPoint({ x: waypoint.x + jitter(), y: waypoint.y + jitter() });
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAssistantHealth() {
      try {
        const res = await fetch('/api/v1/health');
        const json = await res.json();
        if (!active) return;
        setAssistantStatus(json?.geminiConfigured ? 'online' : 'fallback');
      } catch {
        if (!active) return;
        setAssistantStatus('offline');
      }
    }

    checkAssistantHealth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setZones((current) => current.map((zone) => {
        if (zone.type === 'seating') return zone;
        const crowd = nextCrowdValue(zone.crowd);
        return {
          ...zone,
          crowd,
          wait: Math.max(1, Math.round(crowd / 8)),
        };
      }));
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const zoneById = useMemo(() => Object.fromEntries(zones.map((zone) => [zone.id, zone])), [zones]);
  const crowdLookup = useMemo(() => Object.fromEntries(zones.map((zone) => [zone.id, zone.crowd])), [zones]);
  const selectedZone = useMemo(() => zoneById[selectedZoneId] || null, [selectedZoneId, zoneById]);
  const selectedPath = useMemo(() => {
    if (!selectedPathId) return null;
    const [firstId, secondId] = selectedPathId.split('-');
    const first = zoneById[firstId] || graphNodes.find((node) => node.id === firstId);
    const second = zoneById[secondId] || graphNodes.find((node) => node.id === secondId);
    if (!first || !second) return null;

    const syntheticCrowd = Math.round(((zoneById[firstId]?.crowd || 30) + (zoneById[secondId]?.crowd || 30)) / 2);

    return {
      id: selectedPathId,
      label: `Path ${firstId} to ${secondId}`,
      crowd: syntheticCrowd,
      wait: Math.max(1, Math.round(syntheticCrowd / 12)),
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }, [selectedPathId, zoneById]);
  const route = useMemo(
    () => computePath({
      startPoint: userPoint,
      destinationId: selectedZone?.id || 'gateB',
      nodes: graphNodes,
      edges,
      zoneCrowdLookup: crowdLookup,
    }),
    [crowdLookup, selectedZone?.id, userPoint],
  );
  const bestGate = useMemo(() => findBestGate({ userPoint, zones }), [userPoint, zones]);
  const nearestGate = useMemo(() => nearestByType({ zones, userPoint, type: 'gate' }), [userPoint, zones]);
  const nearestFood = useMemo(() => nearestByType({ zones, userPoint, type: 'food' }), [userPoint, zones]);
  const nearestRestroom = useMemo(() => nearestByType({ zones, userPoint, type: 'restroom' }), [userPoint, zones]);

  const crowdSummary = useMemo(() => {
    const result = { low: 0, medium: 0, high: 0 };
    zones.forEach((zone) => {
      result[crowdLevel(zone.crowd)] += 1;
    });
    return result;
  }, [zones]);

  const selectedZoneData = selectedPath ? {
    label: selectedPath.label,
    crowd: selectedPath.crowd,
    wait: selectedPath.wait,
  } : selectedZone;

  const routeStart = nearestGate?.label || 'You';
  const routeTarget = selectedZoneData?.label || bestGate.gate.label;
  const routeDistanceLabel = formatDistance(route.distance);
  const routeEtaLabel = estimateEta(route.distance, selectedZoneData?.crowd ?? bestGate.gate.crowd);

  const queueItems = useMemo(() => {
    const foodOptions = zones.filter((zone) => zone.type === 'food').sort((a, b) => a.wait - b.wait || a.crowd - b.crowd);
    const restroomOptions = zones.filter((zone) => zone.type === 'restroom').sort((a, b) => a.wait - b.wait || a.crowd - b.crowd);

    const shortlist = [
      nearestFood,
      nearestRestroom,
      foodOptions.find((item) => item.id !== nearestFood.id),
      restroomOptions.find((item) => item.id !== nearestRestroom.id),
    ].filter(Boolean);

    const seen = new Set();
    return shortlist.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 3);
  }, [nearestFood, nearestRestroom, zones]);

  const buildLocalAssistantResponse = (text) => {
    const lower = text.toLowerCase();

    if (lower.includes('best gate') || lower.includes('entry') || lower.includes('gate')) {
      setSelectedZoneId(bestGate.gate.id);
      return `${bestGate.gate.label} is the best entry now with ${statusText(bestGate.gate.crowd).toLowerCase()} and around ${bestGate.gate.wait} minutes wait.`;
    }

    if (lower.includes('food')) {
      setSelectedZoneId(nearestFood.id);
      return `${nearestFood.label} is the nearest food option, about ${formatDistance(nearestFood.distance)} away with ${statusText(nearestFood.crowd).toLowerCase()}.`;
    }

    if (lower.includes('restroom') || lower.includes('washroom') || lower.includes('toilet')) {
      setSelectedZoneId(nearestRestroom.id);
      return `${nearestRestroom.label} is your nearest restroom, around ${formatDistance(nearestRestroom.distance)} away with ${statusText(nearestRestroom.crowd).toLowerCase()}.`;
    }

    return `Right now I recommend entering from ${bestGate.gate.label}, with an estimated ${bestGate.gate.wait} minute wait and ${statusText(bestGate.gate.crowd).toLowerCase()}.`;
  };

  const handleAsk = async (event) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || isChatLoading) return;

    setChatError('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setChatInput('');

    try {
      setIsChatLoading(true);
      const result = await sendAssistantMessage({
        message: text,
        sessionId: chatSessionRef.current,
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: result.response,
          source: result.source,
        },
      ]);
    } catch (err) {
      const message = err?.message || 'Unable to reach assistant right now.';
      setChatError(message);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: buildLocalAssistantResponse(text),
          source: 'client_fallback',
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const scrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToAssistant = () => {
    assistantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_35%),linear-gradient(180deg,_#07111f_0%,_#0f2137_50%,_#0a1220_100%)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-6%] h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute right-[-10%] top-[18%] h-80 w-80 rounded-full bg-orange-400/10 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[20%] h-96 w-96 rounded-full bg-sky-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-[1500px] px-4 py-4 md:px-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between rounded-[1.75rem] border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[0_12px_50px_rgba(2,6,23,0.32)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-400 to-cyan-300 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-400/25">
              CS
            </div>
            <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">CrowdSense AI</p>
            <h1 className="text-lg font-semibold text-white md:text-xl">Smart Stadium Assistant Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-sky-300" /> Live Simulation
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Event Live
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/12 to-white/5 text-sm font-semibold text-white shadow-inner shadow-black/20">
              U
            </div>
          </div>
        </header>

        <main className="space-y-4 pb-20 lg:pb-0">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_90px_rgba(2,6,23,0.35)] backdrop-blur-xl md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(248,138,24,0.16),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(80,200,120,0.18),_transparent_32%)]" />
            <div className="relative grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Real-time venue intelligence</p>
                <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-white md:text-5xl">
                  One screen for smarter entry, shorter queues, and faster movement.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  A polished stadium dashboard that predicts crowd pressure, recommends the best gate, and keeps the map readable at a glance.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={scrollToMap}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:bg-slate-100"
                  >
                    Jump to map
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedZoneId(bestGate.gate.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    Highlight best gate
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Best Gate', value: bestGate.gate.label, tone: 'text-emerald-200' },
                  { label: 'Crowd Level', value: statusText(bestGate.gate.crowd), tone: 'text-amber-200' },
                  { label: 'Route Distance', value: routeDistanceLabel, tone: 'text-sky-200' },
                  { label: 'Nearest Food', value: nearestFood.label, tone: 'text-rose-100' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-4 shadow-[0_12px_40px_rgba(2,6,23,0.24)]">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    <p className={`mt-2 text-lg font-semibold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Smart Decision Panel" icon="🧠">
              <div className="grid gap-3 md:grid-cols-2">
                <InsightCard
                  label="Best Entry Gate"
                  value={`${bestGate.gate.label} (${crowdLevel(bestGate.gate.crowd)})`}
                  hint="Logical recommendation based on crowd and walking distance."
                  tone="green"
                />
                <InsightCard
                  label="Crowd Status"
                  value={statusText(bestGate.gate.crowd)}
                  hint="Shows whether the venue is calm, busy, or congested."
                  tone={bestGate.gate.crowd >= 70 ? 'red' : bestGate.gate.crowd >= 40 ? 'amber' : 'green'}
                />
                <InsightCard
                  label="Alert"
                  value="Gate A overcrowded"
                  hint="This card highlights the most important real-time warning."
                  tone="red"
                />
                <InsightCard
                  label="Estimated Waiting Time"
                  value={`${bestGate.gate.wait}–${bestGate.gate.wait + 5} mins`}
                  hint="A fast estimate that helps the fan decide quickly."
                  tone="amber"
                />
              </div>
            </SectionCard>

            <SectionCard title="Route Recommendation" icon="🚶">
              <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-slate-950/55 via-slate-950/35 to-emerald-950/20 p-4 shadow-inner shadow-black/20">
                <p className="text-sm text-slate-300">Suggested Route</p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {`${routeStart} -> ${routeTarget}`}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Distance</p>
                    <p className="mt-2 text-sm font-semibold text-white">{routeDistanceLabel} estimated walk</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Estimated Time</p>
                    <p className="mt-2 text-sm font-semibold text-white">{routeEtaLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={scrollToMap}
                  className="mt-4 inline-flex rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:from-emerald-200 hover:to-cyan-200"
                >
                  View on Map
                </button>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Smart Queue Management" icon="🍔">
              <div className="space-y-3">
                {queueItems.map((item) => {
                  const isRecommended = item.id === nearestFood.id || item.id === nearestRestroom.id;
                  return (
                  <div key={item.id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 ${isRecommended ? 'border-emerald-400/30 bg-emerald-400/10 shadow-[0_10px_30px_rgba(16,185,129,0.12)]' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'}`}>
                    <div>
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.type === 'food' ? 'Food stall' : 'Restroom'} · {crowdLevel(item.crowd)} crowd</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{item.wait} min</p>
                      <p className="text-xs text-slate-400">{isRecommended ? 'Recommended' : 'Alternative'}</p>
                    </div>
                  </div>
                );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Live Event Notifications" icon="🔔">
              <div className="space-y-3">
                {[
                  'Crowd increasing near Gate A',
                  'New entry opened at Gate C',
                  'Food Stall B wait time dropped to 4 min',
                ].map((notice, index) => (
                  <div key={notice} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-300 text-[11px] font-bold text-slate-950">0{index + 1}</span>
                    {notice}
                  </div>
                ))}
              </div>
            </SectionCard>
          </section>

          <section ref={assistantSectionRef} className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard title="AI Assistant" icon="🤖">
              <div className="flex h-[380px] flex-col rounded-[1.6rem] border border-white/10 bg-slate-950/40 shadow-inner shadow-black/20">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
                  <span className="text-slate-400">Assistant status</span>
                  <span className={`font-semibold ${assistantStatus === 'online' ? 'text-emerald-300' : assistantStatus === 'fallback' ? 'text-amber-300' : assistantStatus === 'offline' ? 'text-rose-300' : 'text-slate-300'}`}>
                    {assistantStatus === 'online' ? 'AI online' : assistantStatus === 'fallback' ? 'Fallback mode' : assistantStatus === 'offline' ? 'Offline' : 'Checking...'}
                  </span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'bg-gradient-to-br from-emerald-300 to-cyan-300 text-slate-950' : 'border border-white/10 bg-white/[0.04] text-slate-100'}`}>
                        <div>{message.text}</div>
                        {message.role === 'assistant' && message.source ? (
                          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">{message.source === 'gemini' ? 'Gemini' : 'Smart fallback'}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {isChatLoading ? (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                        Thinking...
                      </div>
                    </div>
                  ) : null}
                </div>
                {chatError ? <p className="px-4 pb-2 text-xs text-rose-300">{chatError}</p> : null}
                <form onSubmit={handleAsk} className="flex gap-2 border-t border-white/10 p-3">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    disabled={isChatLoading}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-300/40 focus:bg-white/[0.06]"
                    placeholder='Ask: "Which gate is best?"'
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="rounded-2xl bg-gradient-to-br from-white to-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:from-slate-50 hover:to-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isChatLoading ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </SectionCard>

            <SectionCard title="Decision Summary" icon="📊">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Gate Status</p>
                  <p className="mt-2 text-lg font-semibold text-white">{crowdSummary.low} low / {crowdSummary.medium} medium / {crowdSummary.high} high</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Best Route Logic</p>
                  <p className="mt-2 text-sm text-slate-300">
                    The route avoids high crowd edges and points the user toward the fastest available gate or service.
                  </p>
                </div>
              </div>
            </SectionCard>
          </section>

          <div ref={mapSectionRef} />
          <StadiumMap
            zones={zones}
            userPoint={userPoint}
            routePoints={route.points}
            selectedZone={selectedZoneData}
            selectedPath={selectedPath}
            routeStart={routeStart}
            routeTarget={routeTarget}
            routeEtaLabel={routeEtaLabel}
            onSelectZone={(zone) => {
              setSelectedZoneId(zone.id);
              setSelectedPathId(null);
            }}
            onSelectPath={(path) => {
              setSelectedZoneId(null);
              setSelectedPathId(path.id);
            }}
            onClearSelection={() => {
              setSelectedZoneId(null);
              setSelectedPathId(null);
            }}
            bestGate={bestGate}
          />

          <div className="sticky bottom-3 z-30 mt-2 flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/80 p-2 shadow-2xl shadow-black/30 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setSelectedZoneId(bestGate.gate.id)}
              className="flex-1 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950"
            >
              Best Gate
            </button>
            <button
              type="button"
              onClick={scrollToMap}
              className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              Map
            </button>
            <button
              type="button"
              onClick={scrollToAssistant}
              className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              Ask AI
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
