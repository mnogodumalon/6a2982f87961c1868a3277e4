import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import StellenPage from '@/pages/StellenPage';
import StellenDetailPage from '@/pages/StellenDetailPage';
import BewerbungenPage from '@/pages/BewerbungenPage';
import BewerbungenDetailPage from '@/pages/BewerbungenDetailPage';
import BewerberPage from '@/pages/BewerberPage';
import BewerberDetailPage from '@/pages/BewerberDetailPage';
import PublicFormStellen from '@/pages/public/PublicForm_Stellen';
import PublicFormBewerbungen from '@/pages/public/PublicForm_Bewerbungen';
import PublicFormBewerber from '@/pages/public/PublicForm_Bewerber';
// <public:imports>
// </public:imports>
// <custom:imports>
const BewerbungErfassenPage = lazy(() => import('@/pages/intents/BewerbungErfassenPage'));
const BewerbungsprozessPage = lazy(() => import('@/pages/intents/BewerbungsprozessPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a2982e111372d67f5b18879" element={<PublicFormStellen />} />
              <Route path="public/6a2982e6a0e4b3f4310368fe" element={<PublicFormBewerbungen />} />
              <Route path="public/6a2982e55e971adb7e10b746" element={<PublicFormBewerber />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="stellen" element={<StellenPage />} />
                <Route path="stellen/:id" element={<StellenDetailPage />} />
                <Route path="bewerbungen" element={<BewerbungenPage />} />
                <Route path="bewerbungen/:id" element={<BewerbungenDetailPage />} />
                <Route path="bewerber" element={<BewerberPage />} />
                <Route path="bewerber/:id" element={<BewerberDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/bewerbung-erfassen" element={<Suspense fallback={null}><BewerbungErfassenPage /></Suspense>} />
                <Route path="intents/bewerbungsprozess" element={<Suspense fallback={null}><BewerbungsprozessPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
