import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  HiSquares2X2,
  HiMap,
  HiBellAlert,
  HiUsers,
  HiCpuChip,
  HiWrenchScrewdriver,
  HiBriefcase,
  HiDocumentChartBar,
  HiBars3,
  HiXMark,
  HiArrowRightOnRectangle,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
} from "react-icons/hi2";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/Map";
import ReportsPage from "./pages/ReportsPage";
import ProjectsPage from "./pages/ProjectsPage";
import CommissioningsPage from "./pages/CommissioningsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import ContactsPage from "./pages/ContactsPage";
import MappingsPage from "./pages/MappingsPage";
import MappingEditorPage from "./pages/MappingEditorPage";
import PlantReportPage from "./pages/PlantReportPage";
import ShareReportPage from "./pages/ShareReportPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorBoundary from "./components/ErrorBoundary";

// ─── Navigation model ─────────────────────────────────────────────────────────

const NAV_GROUPS: {
  label: string;
  items: { to: string; label: string; Icon: React.ElementType; end?: boolean }[];
}[] = [
  {
    label: "Prospecting",
    items: [
      { to: "/", label: "Dashboard", Icon: HiSquares2X2, end: true },
      { to: "/map", label: "Map", Icon: HiMap },
      { to: "/follow-ups", label: "Follow-ups", Icon: HiBellAlert },
      { to: "/contacts", label: "Contacts", Icon: HiUsers },
    ],
  },
  {
    label: "Field Work",
    items: [
      { to: "/mappings", label: "Mappings", Icon: HiCpuChip },
      { to: "/commissionings", label: "Commissionings", Icon: HiWrenchScrewdriver },
    ],
  },
  {
    label: "Sales",
    items: [
      { to: "/projects", label: "Projects", Icon: HiBriefcase },
      { to: "/reports", label: "Reports", Icon: HiDocumentChartBar },
    ],
  },
];

const ROUTE_TITLES: Record<string, string> = {
  "": "Dashboard",
  map: "Map",
  "follow-ups": "Follow-ups",
  contacts: "Contacts",
  mappings: "Mappings",
  commissionings: "Commissionings",
  projects: "Projects",
  reports: "Reports",
  login: "Sign in",
  register: "Register",
};

// Keeps the browser tab title in sync with the current route
function TitleSync() {
  const location = useLocation();
  useEffect(() => {
    const seg = location.pathname.split("/")[1] ?? "";
    const page = ROUTE_TITLES[seg];
    if (seg === "s") {
      document.title = "Shared Report · I&I Automation";
      return;
    }
    document.title = page ? `${page} · I&I Internal` : "I&I Internal";
  }, [location.pathname]);
  return null;
}

// Wraps any route that requires authentication
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: "thin" }}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          {collapsed ? (
            <div className="mx-3 mb-1.5 h-px bg-white/10" />
          ) : (
            <p className="px-5 mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/25">
              {group.label}
            </p>
          )}
          {group.items.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 text-sm font-semibold border-l-2 transition-colors ${
                  collapsed ? "justify-center px-0" : "px-5"
                } ${
                  isActive
                    ? "border-brand-lime text-brand-lime bg-white/5"
                    : "border-transparent text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ onLogout, collapsed = false }: { onLogout: () => void; collapsed?: boolean }) {
  const { user } = useAuth();
  if (collapsed) {
    return (
      <div className="border-t border-white/10 py-4 flex justify-center">
        <button
          onClick={onLogout}
          title={user ? `Sign out (${user.email})` : "Sign out"}
          className="p-2 text-white/60 hover:text-brand-lime transition-colors"
        >
          <HiArrowRightOnRectangle className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="border-t border-white/10 px-5 py-4">
      {user && (
        <p className="text-[11px] text-white/40 truncate mb-2" title={user.email}>
          {user.email}
        </p>
      )}
      <button
        onClick={onLogout}
        className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-brand-lime transition-colors"
      >
        <HiArrowRightOnRectangle className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "1");
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  // Close the mobile drawer on navigation
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f0f2ef]">
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 bg-brand-navy z-40 transition-[width] duration-200 ${
          collapsed ? "w-[4.25rem]" : "w-60"
        }`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center pt-4 pb-3 border-b border-white/10 gap-3">
            <NavLink to="/" title="I&I Automation" className="flex items-center justify-center">
              <img src="/brand/favicon.svg" alt="I&I Automation" className="h-9 w-9" />
            </NavLink>
          </div>
        ) : (
          <div className="px-5 pt-5 pb-4 border-b border-white/10 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <NavLink to="/">
                <img src="/brand/logo-horizontal-white.svg" alt="I&I Automation" className="h-9 w-auto" />
              </NavLink>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-brand-lime">
                Internal Platform
              </p>
            </div>
            <button
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="mt-1 p-1.5 text-white/40 hover:text-brand-lime hover:bg-white/5 transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <HiChevronDoubleLeft className="w-4 h-4" />
            </button>
          </div>
        )}
        <SidebarNav collapsed={collapsed} />
        <SidebarFooter onLogout={handleLogout} collapsed={collapsed} />

        {/* Edge rail toggle — always visible on the sidebar seam */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 flex h-10 w-6 items-center justify-center border border-brand-navy bg-brand-lime text-brand-navy shadow-sm hover:brightness-110 transition"
        >
          {collapsed ? (
            <HiChevronDoubleRight className="w-3.5 h-3.5" />
          ) : (
            <HiChevronDoubleLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden sticky top-0 z-40 bg-brand-navy">
        <div className="flex items-center justify-between px-4 h-14">
          <NavLink to="/">
            <img src="/brand/logo-horizontal-white.svg" alt="I&I Automation" className="h-7 w-auto" />
          </NavLink>
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="p-2 -mr-2 text-white/80 hover:text-white"
            aria-expanded={drawerOpen}
            aria-label="Toggle menu"
          >
            {drawerOpen ? <HiXMark className="w-6 h-6" /> : <HiBars3 className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex flex-col w-72 max-w-[85vw] bg-brand-navy shadow-2xl">
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/10">
              <img src="/brand/logo-horizontal-white.svg" alt="I&I Automation" className="h-7 w-auto" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 text-white/80 hover:text-white"
                aria-label="Close menu"
              >
                <HiXMark className="w-6 h-6" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter onLogout={handleLogout} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* ── Main content ── */}
      <main className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[4.25rem]" : "lg:pl-60"}`}>
        <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/map" element={<RequireAuth><MapPage /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
            <Route path="/projects/:id" element={<RequireAuth><ProjectDetailPage /></RequireAuth>} />
            <Route path="/follow-ups" element={<RequireAuth><FollowUpsPage /></RequireAuth>} />
            <Route path="/contacts" element={<RequireAuth><ContactsPage /></RequireAuth>} />
            <Route path="/commissionings" element={<RequireAuth><CommissioningsPage /></RequireAuth>} />
            <Route path="/mappings" element={<RequireAuth><MappingsPage /></RequireAuth>} />
            <Route path="/mappings/plant/:plantId" element={<RequireAuth><PlantReportPage /></RequireAuth>} />
            <Route path="/mappings/:id" element={<RequireAuth><MappingEditorPage /></RequireAuth>} />
            <Route path="*" element={<RequireAuth><NotFoundPage /></RequireAuth>} />
          </Routes>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <TitleSync />
      <Routes>
        {/* Public auth routes — no shell */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/s/:token" element={<ShareReportPage />} />
        {/* Everything else goes through the app shell */}
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
