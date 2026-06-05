import { useUser } from '@clerk/clerk-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

/**
 * Returns true only for the single admin user.
 * Use this to gate admin-only UI (edit buttons, playbooks, etc.).
 * Real data isolation is enforced by Supabase RLS — this is only UX.
 */
export function useIsAdmin() {
  const { user } = useUser();
  return user?.id === ADMIN_ID;
}
