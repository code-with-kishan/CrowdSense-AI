import { useState } from 'react';
import { useStadium } from '../context/StadiumContext';

export default function AlertBanner() {
  const { alerts, notifications } = useStadium();
  const [dismissed, setDismissed] = useState(new Set());

  // Combine crowd alerts with notification service alerts
  const allAlerts = [
    ...(alerts || []).map((a) => ({
      id: a.locationId,
      message: a.message,
      type: a.type,
      color: a.color,
    })),
    ...(notifications || [])
      .filter((n) => n.priority === 'critical' || n.priority === 'high')
      .slice(0, 3)
      .map((n) => ({
        id: n.id,
        message: n.message,
        type: n.type,
        color: n.color,
        icon: n.icon,
      })),
  ];

  const visible = allAlerts.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-1.5 px-4 animate-slide-down">
      {visible.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border animate-fade-in"
          style={{
            background: `${alert.color || '#f97316'}10`,
            borderColor: `${alert.color || '#f97316'}30`,
          }}
        >
          <span className="text-sm flex-shrink-0">{alert.icon || '⚠️'}</span>
          <span className="text-xs font-medium text-amber-100 flex-1">
            {alert.message}
          </span>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
            className="text-gray-500 hover:text-white text-xs flex-shrink-0 transition-colors"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
