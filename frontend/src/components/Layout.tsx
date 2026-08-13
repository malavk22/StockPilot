// client/src/components/Layout.tsx

import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="app-nav-brand">📦 StockPilot</div>
        <nav className="app-nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          {user?.role === "ADMIN" && (
            <NavLink to="/warehouses" className={({ isActive }) => (isActive ? "active" : "")}>
              Warehouses
            </NavLink>
          )}
        </nav>
        <div className="app-nav-user">
          <span className="role-badge" data-role={user?.role}>
            {user?.role}
          </span>
          <span>{user?.email}</span>
          <button onClick={logout} className="btn btn-ghost">
            Log out
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
