import { useState, useCallback } from 'react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

export function useAttendanceAlerts() {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!ADMIN_ID) return;
    setLoading(true);
    try {
      const res = await fetch('/api/zoom/attendance-alerts', {
        headers: { 'x-admin-id': ADMIN_ID },
      });
      if (res.ok) {
        const d = await res.json();
        setAlerts(d.alerts || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  return { alerts, loading, reload, total: alerts.length };
}
