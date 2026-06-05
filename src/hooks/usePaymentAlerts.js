import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';

// ── Config ─────────────────────────────────────────────────────
const WARN_DAYS  = 3;
const REMIND_MS  = 4 * 60 * 60 * 1000;
const STORAGE_KEY = 'ce3_dismissed_alerts';

// ── localStorage helpers ───────────────────────────────────────
function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveDismissed(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); }
  catch {}
}
// Unique key per installment alert — stable across reloads
function alertKey(item) {
  return `${item.clientId}_${item.instIdx}_${item.due.getTime()}`;
}

// ── Helpers ────────────────────────────────────────────────────
function instAmount(inst, deal) {
  if (!deal) return 0;
  return (inst.amount != null && inst.amount !== 0 && inst.amount !== '0')
    ? Number(inst.amount)
    : Math.round((parseFloat(inst.percentage) || 0) / 100 * deal);
}
function pushNotif(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/favicon.ico', dir: 'rtl', lang: 'he' }); }
  catch (_) {}
}
function fmtAmt(n) {
  return n ? '₪' + Number(n).toLocaleString('he-IL') : '';
}

// ── Hook ───────────────────────────────────────────────────────
export function usePaymentAlerts() {
  const { user }  = useUser();
  const userId    = user?.id;

  // Raw alerts from Supabase (before filtering dismissed)
  const [raw, setRaw]           = useState({ upcoming: [], overdue: [] });
  // Dismissed keys persisted in localStorage
  const [dismissed, setDismissed] = useState(() => loadDismissed());

  const didPush   = useRef(false);
  const remindRef = useRef(null);

  // ── Fetch & compute ──────────────────────────────────────────
  const computeAlerts = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, deal_amount, installment_plan')
        .eq('user_id', userId);

      const upcoming = [], overdue = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      for (const client of (data || [])) {
        for (let i = 0; i < (client.installment_plan || []).length; i++) {
          const inst = client.installment_plan[i];
          if (!inst.date || inst.paid) continue;

          const due  = new Date(inst.date); due.setHours(0, 0, 0, 0);
          const diff = Math.round((due - today) / 86_400_000);
          const amount = instAmount(inst, client.deal_amount);

          const item = {
            clientId:   client.id,
            clientName: client.name,
            instIdx:    i,
            label:      inst.label || `תשלום ${i + 1}`,
            amount,
            due,
            diff,
          };

          if (diff < 0)          overdue.push(item);
          else if (diff <= WARN_DAYS) upcoming.push(item);
        }
      }

      overdue.sort((a, b) => a.diff - b.diff);
      upcoming.sort((a, b) => a.diff - b.diff);
      setRaw({ upcoming, overdue });
    } catch (e) {
      console.error('[usePaymentAlerts]', e);
    }
  }, [userId]);

  useEffect(() => { computeAlerts(); }, [computeAlerts]);

  // ── Dismiss a single alert ───────────────────────────────────
  function dismiss(item) {
    const key = alertKey(item);
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(next);
      return next;
    });
  }

  // ── Visible alerts (filtered) ────────────────────────────────
  const upcoming = raw.upcoming.filter(i => !dismissed.has(alertKey(i)));
  const overdue  = raw.overdue.filter(i => !dismissed.has(alertKey(i)));
  const total    = upcoming.length + overdue.length;

  // ── Browser permission ───────────────────────────────────────
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
  }, []);

  // ── Initial push (once after first load) ─────────────────────
  useEffect(() => {
    if (didPush.current) return;
    if (overdue.length === 0 && upcoming.length === 0) return;
    didPush.current = true;

    setTimeout(() => {
      if (overdue.length === 1) {
        pushNotif(
          `תשלום באיחור — ${overdue[0].clientName}`,
          `${overdue[0].label}${overdue[0].amount ? ' · ' + fmtAmt(overdue[0].amount) : ''} · לפני ${Math.abs(overdue[0].diff)} ימים`
        );
      } else if (overdue.length > 1) {
        pushNotif(`${overdue.length} תשלומים באיחור`, overdue.map(o => o.clientName).join(', '));
      }
    }, 2000);

    setTimeout(() => {
      if (upcoming.length === 1) {
        pushNotif(
          `תשלום קרוב — ${upcoming[0].clientName}`,
          `${upcoming[0].label}${upcoming[0].amount ? ' · ' + fmtAmt(upcoming[0].amount) : ''} · ${upcoming[0].diff === 0 ? 'היום!' : `בעוד ${upcoming[0].diff} ימים`}`
        );
      } else if (upcoming.length > 1) {
        pushNotif(`${upcoming.length} תשלומים קרובים`, upcoming.map(u => u.clientName).join(', '));
      }
    }, 4000);
  }, [overdue.length, upcoming.length]); // eslint-disable-line

  // ── Periodic overdue reminders ───────────────────────────────
  useEffect(() => {
    if (remindRef.current) clearInterval(remindRef.current);
    if (overdue.length === 0) return;
    remindRef.current = setInterval(() => {
      if (overdue.length === 0) return;
      pushNotif(
        `תזכורת — ${overdue.length} תשלומים באיחור`,
        overdue.slice(0, 4).map(o => `${o.clientName}: ${o.label}`).join('\n')
      );
    }, REMIND_MS);
    return () => { if (remindRef.current) clearInterval(remindRef.current); };
  }, [overdue.length]); // eslint-disable-line

  return { upcoming, overdue, total, dismiss, reload: computeAlerts };
}
