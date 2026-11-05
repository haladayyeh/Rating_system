import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Avatar, Logo } from "./ui";

const STUDENT_NAV = [
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/rate", label: "Rate peers", icon: "★" },
  { to: "/leaderboard", label: "Top students", icon: "▲" },
];

const STAFF_NAV = [
  { to: "/staff", label: "Overview", icon: "◉", end: true },
  { to: "/staff/students", label: "Students", icon: "☰" },
  { to: "/staff/ratings", label: "Ratings", icon: "★" },
  { to: "/staff/participation", label: "Participation", icon: "◔" },
  { to: "/staff/abuse", label: "Abuse cases", icon: "⚑" },
  { to: "/staff/leaderboard", label: "Leaderboard", icon: "▲" },
  { to: "/staff/labels", label: "Labels", icon: "#" },
  { to: "/staff/windows", label: "Voting windows", icon: "◷" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isStaff = user.role === "STAFF";
  const nav = isStaff ? STAFF_NAV : STUDENT_NAV;

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Logo />
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <span className="role-pill">{isStaff ? "Staff console" : "Student"}</span>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.name} size={36} />
          <div className="sidebar-user-info">
            <strong>{user.name}</strong>
            <span className="mono">@{user.login}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
            ⏻
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <Logo />
          <Avatar name={user.name} size={32} />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
