// client/src/components/Layout.tsx

import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, Warehouse, LogOut, PackageSearch } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <PackageSearch size={22} strokeWidth={2.25} />
          <span>StockPilot</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => (isActive ? "active" : "")}>
            <Package size={18} />
            Products
          </NavLink>
          {user?.role === "ADMIN" && (
            <NavLink to="/warehouses" className={({ isActive }) => (isActive ? "active" : "")}>
              <Warehouse size={18} />
              Warehouses
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-email">{user?.email}</span>
              <span className="role-badge" data-role={user?.role}>
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={logout} className="btn btn-ghost sidebar-logout">
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
