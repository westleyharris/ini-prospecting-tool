import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/Map";
import ReportsPage from "./pages/ReportsPage";
import ProjectsPage from "./pages/ProjectsPage";
import CommissioningsPage from "./pages/CommissioningsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-semibold text-gray-800">
                  INI Prospecting
                </span>
              </div>
              <div className="ml-6 flex space-x-4">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/map"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  Map
                </NavLink>
                <NavLink
                  to="/reports"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  Reports
                </NavLink>
                <NavLink
                  to="/projects"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  Projects
                </NavLink>
                <NavLink
                  to="/commissionings"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  Commissionings
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
