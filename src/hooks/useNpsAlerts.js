import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';

const ADMIN_ID    = import.meta.env.VITE_ADMIN_USER_ID;
const STORAGE_KEY = 'ce3_nps_dismissed';

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveDismissed(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); }
  catch {}
}

function fmtMonth(d) {
  if (!d) return '';
  try {
    const s = /^\d{4}-\d{2}$/.test(String(d)) ? d + '-01' : d;
    return new Date(s).toLocaleString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return String(d); }
}

export function useNpsAlerts() {
  const { user }   = useUser();
  const isAdmin    = user?.id === ADMIN_ID;
  const [alerts,    setAlerts]    = useState([]);
  const [dismissed, setDismissed] = useState(() => loadDismissed());

  const fetchAlerts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch('/api/admin/students', {
        headers: { 'x-admin-id': ADMIN_ID || '' },
      });
      if (!r.ok) return;
      const { students } = await r.json();
      const found = [];
      for (const s of (students || [])) {
        for (const m of (s.monthly || [])) {
          const nps = Number(m.nps);
          if (m.nps != null && !isNaN(nps) && nps <= 8 && !m.nps_handled) {
            found.push({ id: m.id, name: s.name, nps, month: fmtMonth(m.month) });
          }
        }
      }
      setAlerts(found);
    } catch {}
  }, [isAdmin]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Realtime — refresh on new submission
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel('nps-header')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monthly_submissions' }, payload => {
        const nps = Number(payload.new?.nps);
        if (payload.new?.nps != null && !isNaN(nps) && nps <= 8) fetchAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, fetchAlerts]);

  function dismiss(id) {
    setDismissed(prev => { const n = new Set(prev); n.add(id); saveDismissed(n); return n; });
    supabase.from('monthly_submissions').update({ nps_handled: true }).eq('id', id).then(fetchAlerts);
  }

  const visible = alerts.filter(a => !dismissed.has(a.id));
  return { npsAlerts: visible, dismissNps: dismiss, npsTotal: visible.length };
}
