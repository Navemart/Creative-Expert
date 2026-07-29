import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

export function useCheckinAlerts() {
  const { user } = useUser();
  const [overdue,  setOverdue]  = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  const load = useCallback(() => {
    if (!user || user.id !== ADMIN_ID) return;
    fetch('/api/admin/checkins', { headers: { 'x-admin-id': ADMIN_ID || '' } })
      .then(r => r.ok ? r.json() : { students: [] })
      .then(({ students = [] }) => {
        const now = Date.now();
        const od = [];
        const up = [];
        for (const s of students) {
          if (s.column === 'overdue') {
            od.push(s);
          } else if (s.column === 'upcoming' && s.next_due) {
            const hoursUntil = (new Date(s.next_due).getTime() - now) / 3600000;
            if (hoursUntil <= 48) up.push(s); // within 2 days
          }
        }
        setOverdue(od);
        setUpcoming(up);
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return {
    checkinOverdue:  overdue,
    checkinUpcoming: upcoming,
    checkinTotal:    overdue.length + upcoming.length,
    reloadCheckins:  load,
  };
}
