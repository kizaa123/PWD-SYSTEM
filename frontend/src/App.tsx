import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./lib/auth";
import { isStaffPortalUser } from "./lib/portalAccess";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { ApplicantsPage } from "./pages/Applicants";
import { ApplicantNewPage } from "./pages/ApplicantNew";
import { ApplicantEditPage } from "./pages/ApplicantEdit";
import { ApplicationsPage } from "./pages/Applications";
import { ApplicationNewPage } from "./pages/ApplicationNew";
import { ApplicationDetailPage } from "./pages/ApplicationDetail";
import { ReportsPage } from "./pages/Reports";
import { UsersPage } from "./pages/Users";
import { AuditPage } from "./pages/Audit";
import { SettingsPage } from "./pages/Settings";
import { AppBootScreen } from "./components/GlobalLoadingBar";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  if (loading) return <AppBootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaffPortalUser(user.roles)) {
    logout();
    return <Navigate to="/login" replace state={{ staffOnly: true }} />;
  }
  return <>{children}</>;
}

function StaffPermission({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { has } = useAuth();
  if (!has(perm)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/applicants"
          element={
            <StaffPermission perm="applicants.create">
              <ApplicantsPage />
            </StaffPermission>
          }
        />
        <Route
          path="/applicants/new"
          element={
            <StaffPermission perm="applicants.create">
              <ApplicantNewPage />
            </StaffPermission>
          }
        />
        <Route
          path="/applicants/:id/edit"
          element={
            <StaffPermission perm="applicants.create">
              <ApplicantEditPage />
            </StaffPermission>
          }
        />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route
          path="/apply"
          element={
            <StaffPermission perm="applications.create">
              <ApplicationNewPage />
            </StaffPermission>
          }
        />
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
