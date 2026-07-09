import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react';
import LandingPage from './pages/LandingPage.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import MemberDetail from './pages/MemberDetail.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Content from './pages/Content.jsx';
import Analytics from './pages/Analytics.jsx';
import Agents from './pages/Agents.jsx';
import Settings from './pages/Settings.jsx';
import AdminStudents from './pages/AdminStudents.jsx';
import PricingCalculator from './pages/PricingCalculator.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Diagnosis from './pages/Diagnosis.jsx';
import ContentLibrary from './pages/ContentLibrary.jsx';
import Clients from './pages/Clients.jsx';
import Transcriptions from './pages/Transcriptions.jsx';
import ZoomRecordings from './pages/ZoomRecordings.jsx';
import TaskManager from './pages/TaskManager.jsx';
import QuarterlyScorecard from './pages/QuarterlyScorecard.jsx';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

// Route-level guard — redirects non-admins away from /admin/* paths.
// AdminStudents also has its own inner check; this is defence-in-depth.
function AdminRoute({ children }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;                          // still loading
  if (user?.id !== ADMIN_ID) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="landing" element={<LandingPage />} />
      </Routes>
      <SignedIn>
        <Routes>
          <Route element={<Layout />}>
            {/* ── Student routes ─────────────────────────────── */}
            <Route index element={<Dashboard />} />
            <Route path="analytics"       element={<Analytics />} />
            <Route path="pipeline"        element={<Pipeline />} />
            <Route path="clients"         element={<Clients />} />
            <Route path="content"         element={<Content />} />
            <Route path="recordings"      element={<ZoomRecordings />} />
            <Route path="roadmap"         element={<Roadmap />} />
            <Route path="diagnosis"       element={<Diagnosis />} />
            <Route path="content-library" element={<ContentLibrary />} />
            <Route path="agents"          element={<Agents />} />
            <Route path="calculator"      element={<PricingCalculator />} />
            <Route path="transcriptions"  element={<Transcriptions />} />
            <Route path="tasks"           element={<TaskManager />} />
            <Route path="self-audit/quarterly" element={<QuarterlyScorecard />} />
            <Route path="members"         element={<Members />} />
            <Route path="members/:id"     element={<MemberDetail />} />
            <Route path="settings"        element={<Settings />} />

            {/* ── Admin-only routes ──────────────────────────── */}
            <Route
              path="admin/students/*"
              element={
                <AdminRoute>
                  <AdminStudents />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
