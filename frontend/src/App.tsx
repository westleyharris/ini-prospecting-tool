import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/Map";
import ReportsPage from "./pages/ReportsPage";
import ProjectsPage from "./pages/ProjectsPage";
import CommissioningsPage from "./pages/CommissioningsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
    isActive
      ? "bg-gray-100 text-gray-900"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
  }`;

const navLinkClassMobile = ({ isActive }: { isActive: boolean }) =>
  `block w-full text-left px-4 py-3 text-base font-medium rounded-lg ${
    isActive
      ? "bg-gray-100 text-gray-900"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
  }`;

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-semibold text-gray-800">
                INI Prospecting
              </span>
            </div>

            {/* Desktop nav: horizontal links */}
            <div className="hidden md:flex md:items-center md:space-x-1 lg:space-x-4">
              <NavLink to="/" className={navLinkClass}>Dashboard</NavLink>
              <NavLink to="/map" className={navLinkClass}>Map</NavLink>
              <NavLink to="/reports" className={navLinkClass}>Reports</NavLink>
              <NavLink to="/projects" className={navLinkClass}>Projects</NavLink>
              <NavLink to="/commissionings" className={navLinkClass}>Commissionings</NavLink>
            </div>

            {/* Mobile: hamburger */}
            <div className="flex md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle menu"
              >
                <span className="sr-only">Toggle menu</span>
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu panel */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white py-2">
              <div className="pt-2 pb-3 space-y-0.5">
                <NavLink to="/" className={navLinkClassMobile} onClick={() => setMobileMenuOpen(false)}>Dashboard</NavLink>
                <NavLink to="/map" className={navLinkClassMobile} onClick={() => setMobileMenuOpen(false)}>Map</NavLink>
                <NavLink to="/reports" className={navLinkClassMobile} onClick={() => setMobileMenuOpen(false)}>Reports</NavLink>
                <NavLink to="/projects" className={navLinkClassMobile} onClick={() => setMobileMenuOpen(false)}>Projects</NavLink>
                <NavLink to="/commissionings" className={navLinkClassMobile} onClick={() => setMobileMenuOpen(false)}>Commissionings</NavLink>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="w-full max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/commissionings" element={<CommissioningsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
