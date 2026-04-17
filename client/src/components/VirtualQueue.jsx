import { useState } from 'react';
import { joinVirtualQueue, fetchTicketStatus } from '../api';
import { useStadium } from '../context/StadiumContext';
import { usePreferences } from '../hooks/usePreferences';

export default function VirtualQueue() {
  const { foodCourts, restrooms } = useStadium();
  const { preferences } = usePreferences();
  const [tickets, setTickets] = useState([]);
  const [joining, setJoining] = useState(null);

  const availableZones = [...(foodCourts || []), ...(restrooms || [])].sort(
    (a, b) => (a.score || 0) - (b.score || 0)
  );

  const handleJoin = async (zoneId) => {
    setJoining(zoneId);
    const result = await joinVirtualQueue(zoneId, preferences.userId);
    if (result && !result.error) {
      setTickets((prev) => {
        const exists = prev.find((t) => t.ticketId === result.ticketId);
        if (exists) return prev;
        return [...prev, result];
      });
    }
    setJoining(null);
  };

  const refreshTicket = async (ticketId) => {
    const updated = await fetchTicketStatus(ticketId);
    if (updated) {
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === ticketId ? { ...t, ...updated } : t))
      );
    }
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">
          🎫 Virtual Queue
        </h2>
        <span className="badge bg-teal/20 text-teal border border-teal/30">Skip the Line</span>
      </div>

      {/* Active Tickets */}
      {tickets.length > 0 && (
        <div className="mb-3 space-y-2">
          {tickets.map((ticket) => (
            <div
              key={ticket.ticketId}
              className={`p-3 rounded-lg border ${
                ticket.isReady || ticket.status === 'ready'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-accent/5 border-accent/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white">{ticket.zoneName}</span>
                <span className="text-[10px] font-mono text-gray-400">{ticket.ticketId}</span>
              </div>
              {ticket.isReady || ticket.status === 'ready' ? (
                <div className="text-sm font-bold text-green-400">
                  🔔 It&apos;s your turn! Head to {ticket.zoneName} now.
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Position: #{ticket.position || '—'}</span>
                  <span>Est. wait: ~{ticket.estimatedWait || '?'}min</span>
                  <button
                    onClick={() => refreshTicket(ticket.ticketId)}
                    className="text-accent-light hover:text-white transition-colors"
                  >
                    ↻ Refresh
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Join buttons */}
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {availableZones.map((zone) => {
          const hasTicket = tickets.some(
            (t) => t.zoneId === zone.id && (t.status === 'waiting' || t.status === 'joined' || t.status === 'ready')
          );
          const wait = zone.queueMinutes ?? Math.round(zone.crowdDensity * 25);

          return (
            <div
              key={zone.id}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-lg"
            >
              <span className="text-sm">{zone.type === 'food' ? '🍔' : '🚻'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white font-medium truncate">{zone.name}</div>
                <div className="text-[9px] text-gray-500">~{wait}min wait</div>
              </div>
              <button
                onClick={() => handleJoin(zone.id)}
                disabled={hasTicket || joining === zone.id}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all ${
                  hasTicket
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                    : 'bg-accent/20 text-accent-light border border-accent/30 hover:bg-accent/30'
                } disabled:opacity-60`}
              >
                {hasTicket ? '✓ Queued' : joining === zone.id ? '...' : 'Join Queue'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-gray-600 mt-2 text-center">
        Join a virtual queue and we'll notify you when it's your turn — no standing in line!
      </p>
    </div>
  );
}
