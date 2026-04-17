import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchEntryRoute, fetchExitRoute, fetchFoodRoute, fetchRestroomRoute, resetChat, sendChat } from '../api';
import { useStadium } from '../context/StadiumContext';

const QUICK_PROMPTS = [
  'Where should I enter?',
  'Which food stall is fastest?',
  'How do I reach Gate B?',
  'Where is the nearest restroom?',
  'What is the best way to exit the stadium?',
  'Is there any crowd alert right now?',
];

function routeTitle(intent) {
  if (intent === 'FOOD') return 'Food Route';
  if (intent === 'RESTROOM') return 'Restroom Route';
  if (intent === 'EXIT') return 'Exit Route';
  return 'Entry Route';
}

function RoutePreview({ routeData, intent }) {
  if (!routeData?.data) return null;

  const payload = routeData.data;
  const previewTitle = routeTitle(intent || routeData.intent || 'NAVIGATION');

  if (Array.isArray(payload)) {
    const best = payload[0];
    if (!best) return null;

    return (
      <div className="glass-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{previewTitle}</span>
          <span className="badge bg-accent/15 text-accent-light border border-accent/30">Best</span>
        </div>
        <div className="text-sm font-semibold text-white">{best.name}</div>
        <div className="mt-1 text-xs text-gray-400">
          ~{best.waitMinutes || best.queueMinutes || 0} min wait · {best.travelMinutes || 0} min walk
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-gray-400">
          {payload.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <span className="truncate pr-2">{item.name}</span>
              <span>~{item.waitMinutes || item.queueMinutes || 0}m</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const recommendedGate = payload.recommendedGate;
  const steps = payload.route?.steps || payload.route || [];

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{previewTitle}</span>
        {payload.routeScore !== undefined && (
          <span className="badge bg-teal/20 text-teal border border-teal/30">Score {payload.routeScore}</span>
        )}
      </div>
      <div className="text-sm font-semibold text-white">{recommendedGate?.name || payload.tip || 'Best route'}</div>
      {payload.reasoning && <div className="mt-1 text-xs text-gray-400">{payload.reasoning}</div>}
      <div className="mt-2 space-y-1 text-[11px] text-gray-400">
        {(steps || []).slice(0, 4).map((step) => (
          <div key={`${step.step}-${step.nodeId || step.location}`} className="flex items-center gap-2">
            <span className="badge bg-white/10 text-white border border-white/10">{step.step || '•'}</span>
            <span>{step.location || step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssistantPanel({
  currentLocation,
  onLocationChange,
  preferredGate,
  onPreferredGateChange,
  userId,
}) {
  const { summary, gates, notifications } = useStadium();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Ask me where to enter, which stall is fastest, or how to move through the stadium safely.',
    },
  ]);
  const [input, setInput] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [routeIntent, setRouteIntent] = useState('NAVIGATION');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const gateOptions = useMemo(() => gates || [], [gates]);
  const activeAlerts = notifications?.filter((item) => item.priority === 'critical' || item.priority === 'high').slice(0, 3) || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, routeData]);

  useEffect(() => {
    let mounted = true;

    const preloadRoutes = async () => {
      const [entry, food, restroom, exit] = await Promise.all([
        fetchEntryRoute(currentLocation),
        fetchFoodRoute(currentLocation),
        fetchRestroomRoute(currentLocation),
        fetchExitRoute(currentLocation),
      ]);

      if (!mounted) return;
      setRouteData({
        intent: 'NAVIGATION',
        data: entry,
        alternatives: {
          food,
          restroom,
          exit,
        },
      });
      setRouteIntent('NAVIGATION');
    };

    preloadRoutes().catch(() => null);
    return () => {
      mounted = false;
    };
  }, [currentLocation]);

  const submitMessage = async (message) => {
    const text = message.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const result = await sendChat(text, userId, currentLocation);
      if (result) {
        setMessages((prev) => [...prev, { role: 'assistant', text: result.response, intent: result.intent }]);
        setRouteIntent(result.intent || 'NAVIGATION');
        if (result.structuredData) {
          setRouteData({ intent: result.intent, data: result.structuredData });
        }
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', text: 'I could not reach the assistant service right now.' }]);
      }
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const onReset = async () => {
    await resetChat(userId);
    setMessages([
      {
        role: 'assistant',
        text: 'Conversation cleared. Ask me where to enter, which queue is fastest, or how to reach a specific gate.',
      },
    ]);
    setRouteData(null);
  };

  return (
    <div className="glass-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">🤖 AI Assistant</h2>
          <p className="text-[11px] text-gray-500 mt-1">
            Context-aware answers based on live crowd, queue, and route data.
          </p>
        </div>
        <button onClick={onReset} className="btn-ghost" type="button">
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-[10px] uppercase tracking-wider text-gray-500">
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

        <label className="text-[10px] uppercase tracking-wider text-gray-500">
          Preferred gate
          <select
            value={preferredGate || ''}
            onChange={(event) => onPreferredGateChange(event.target.value || null)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">Auto</option>
            {gateOptions.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => submitMessage(prompt)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-gray-200 hover:border-accent/30 hover:bg-accent/10 transition-colors"
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      {summary && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 uppercase tracking-wider">Live context</span>
            <span className="text-accent-light">{summary.matchPhase}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
            <span>{activeAlerts.length} priority alerts</span>
            <span>{summary.alertCount || 0} total alerts</span>
          </div>
        </div>
      )}

      <RoutePreview routeData={routeData} intent={routeIntent} />

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 min-h-[300px] flex flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`chat-bubble ${message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                {message.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitMessage(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a stadium question..."
            className="input-field rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            maxLength={500}
          />
          <button className="btn-primary shrink-0" type="submit" disabled={loading}>
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
