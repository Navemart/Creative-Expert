import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';

// Session ID — persists for the browser tab lifetime
let _sessionId = null;
function getSessionId() {
  if (!_sessionId) {
    _sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return _sessionId;
}

// Fire-and-forget event to backend
export function track(clerkUserId, event, page, metadata) {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clerk_user_id: clerkUserId || null,
      event,
      page:       page       || window.location.pathname,
      metadata:   metadata   || null,
      session_id: getSessionId(),
    }),
  }).catch(() => {});
}

// Hook: call at the top of any page to track page_view automatically
export function useTrackPage(pageName) {
  const { user } = useUser();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track(user?.id, 'page_view', window.location.pathname, pageName ? { page_name: pageName } : null);
  }, [user?.id, pageName]);

  // Return track bound to current user for feature tracking
  return (event, metadata) => track(user?.id, event, window.location.pathname, metadata);
}
