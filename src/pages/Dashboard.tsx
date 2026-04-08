import { useAuthContext } from "../context/AuthContext";
import AdminDashboard from "./admin/AdminDashboard";
import InternDashboard from "./intern/InternDashboard";

export default function Dashboard() {
  const { appUser, logout } = useAuthContext();

  if (!appUser) return <p style={{ padding: "2rem" }}>Loading profile…</p>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Task Portal</span>
        <div className="header-right">
          <span className="user-info">
            {appUser?.name} &nbsp;·&nbsp;
            <span className="role-badge">{appUser.role}</span>
          </span>
          <button className="btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        {appUser.role === "admin" ? <AdminDashboard /> : <InternDashboard />}
      </main>
    </div>
  );
}
