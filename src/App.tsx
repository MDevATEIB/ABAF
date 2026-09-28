import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';

// ── Pages référentiels ────────────────────────────────────────────────────────
import SaisonsPage    from '@/pages/referentiels/saisons';
import TarifsPage     from '@/pages/referentiels/tarifs';
import PrixGasoilPage from '@/pages/referentiels/prix-gasoil';

// ── Dashboard ─────────────────────────────────────────────────────────────────
import DashboardPage from '@/pages/dashboard';

// ── Pages opérations ──────────────────────────────────────────────────────────
import PeseesPage from '@/pages/operations/pesees';
import BordereauxPage from '@/pages/operations/bordereaux';
import LivraisonsPage from '@/pages/operations/livraisons';

// ── Pages finance ─────────────────────────────────────────────────────────────
import FacturesPage from '@/pages/finance/factures';
import PaiementsPage from '@/pages/finance/paiements';
import AvancesPage from '@/pages/finance/avances';

// ── Pages rapports ────────────────────────────────────────────────────────────
import RecapitulatifPage from '@/pages/rapports/recap';
import RapportAnnuelPage from '@/pages/rapports/annuel';
import ExportExcelPage from '@/pages/rapports/export-excel';
import ExportPdfPage from '@/pages/rapports/export-pdf';

// ── Pages impression ──────────────────────────────────────────────────────────
import ImpressionBsmPage from '@/pages/impression/bsm';
import ImpressionBordereauPage from '@/pages/impression/bordereau';
import ImpressionFacturePage from '@/pages/impression/facture';
import ImpressionRelevePage from '@/pages/impression/releve';

// ── Paramètres ────────────────────────────────────────────────────────────────
import ParametresPage from '@/pages/parametres';

// ── Placeholder pour les modules à venir ─────────────────────────────────────
import ComingSoon from '@/pages/ComingSoon';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Dashboard */}
          <Route path="/" element={<DashboardPage />} />

          {/* ── Référentiels ─────────────────────────────────────────────── */}
          <Route path="/referentiels" element={<Navigate to="/referentiels/saisons" replace />} />
          <Route path="/referentiels/saisons"     element={<SaisonsPage />} />
          <Route path="/referentiels/tarifs"      element={<TarifsPage />} />
          <Route path="/referentiels/prix-gasoil" element={<PrixGasoilPage />} />
          <Route path="/referentiels/clients"     element={<ComingSoon title="Clients" />} />
          <Route path="/referentiels/camions"     element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/referentiels/chauffeurs"  element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/referentiels/usines"      element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/referentiels/cgis"        element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/referentiels/avs"         element={<Navigate to="/operations/bordereaux" replace />} />

          {/* ── Opérations ───────────────────────────────────────────────── */}
          <Route path="/operations" element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/operations/missions"   element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/operations/pesees"     element={<PeseesPage />} />
          <Route path="/operations/bsm"        element={<Navigate to="/operations/bordereaux" replace />} />
          <Route path="/operations/bordereaux" element={<BordereauxPage />} />
          <Route path="/operations/livraisons" element={<LivraisonsPage />} />

          {/* ── Finance ──────────────────────────────────────────────────── */}
          <Route path="/finance" element={<Navigate to="/finance/factures" replace />} />
          <Route path="/finance/factures"  element={<FacturesPage />} />
          <Route path="/finance/paiements" element={<PaiementsPage />} />
          <Route path="/finance/avances"   element={<AvancesPage />} />

          {/* ── Rapports ─────────────────────────────────────────────────── */}
          <Route path="/rapports" element={<Navigate to="/rapports/annuel" replace />} />
          <Route path="/rapports/recap"        element={<RecapitulatifPage />} />
          <Route path="/rapports/annuel"       element={<RapportAnnuelPage />} />
          <Route path="/rapports/export-excel" element={<ExportExcelPage />} />
          <Route path="/rapports/export-pdf"   element={<ExportPdfPage />} />

          {/* ── Impression ───────────────────────────────────────────────── */}
          <Route path="/impression/bsm/:id"       element={<ImpressionBsmPage />} />
          <Route path="/impression/bordereau/:id" element={<ImpressionBordereauPage />} />
          <Route path="/impression/facture/:id"   element={<ImpressionFacturePage />} />
          <Route path="/impression/releve"        element={<ImpressionRelevePage />} />
          <Route path="/impression/releve/:saisonId" element={<ImpressionRelevePage />} />

          {/* ── Paramètres ───────────────────────────────────────────────── */}
          <Route path="/parametres" element={<ParametresPage />} />

          {/* 404 – rediriger vers le dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
