import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Avatar, Logo } from "./ui";
import { ThemeToggle } from "../lib/theme";

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
  const nav = STAFF_NAV;

  useEffect(() => setOpen(false), [location.pathname]);

  // Students only have two things to do (rate, see the leaderboard), so instead of a
  // sidebar they get a slim top bar: logo → home, and who's signed in + log out.
  if (!isStaff) {
    return (
      <div className="student-shell">
        <header className="topbar">
          <Link to="/" className="topbar-home" aria-label="Home">
            <Logo />
          </Link>
          <div className="topbar-actions">
            <ThemeToggle />
          <div className="topbar-user">
            <Avatar name={user.name} size={34} />
            <div className="topbar-user-info">
              <strong>{user.name}</strong>
              <span className="mono">@{user.login}</span>
            </div>
            <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
              ⏻
            </button>
          </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Logo />
          <ThemeToggle />
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
          <ThemeToggle />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
