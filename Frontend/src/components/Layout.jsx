import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Avatar, Logo } from "./ui";
import { ThemeToggle } from "../lib/theme";
import PixelIcon from "./PixelIcon";
import NameBadge, { BadgeEditor } from "./NameBadge";

const STAFF_NAV = [
  { to: "/staff", label: "Overview", icon: "house", end: true },
  { to: "/staff/students", label: "Students", icon: "heart" },
  { to: "/staff/ratings", label: "Ratings", icon: "star-gold" },
  { to: "/staff/participation", label: "Participation", icon: "check" },
  { to: "/staff/abuse", label: "Abuse cases", icon: "exclamation" },
  { to: "/staff/leaderboard", label: "Leaderboard", icon: "trophy" },
  { to: "/staff/labels", label: "Labels", icon: "pin" },
  { to: "/staff/windows", label: "Voting windows", icon: "clock" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState(false);
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
            <UserInfo user={user} className="topbar-user-info" onEdit={() => setEditingBadge(true)} />
            <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
              ⏻
            </button>
          </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        {editingBadge && <BadgeEditor onClose={() => setEditingBadge(false)} />}
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
              <span className="nav-icon"><PixelIcon name={n.icon} size={20} /></span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.name} size={36} />
          <UserInfo user={user} className="sidebar-user-info" onEdit={() => setEditingBadge(true)} />
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
      {editingBadge && <BadgeEditor onClose={() => setEditingBadge(false)} />}
    </div>
  );
}

// Name + badge of whoever is signed in. Clicking it opens the badge editor.
function UserInfo({ user, className, onEdit }) {
  return (
    <button
      type="button"
      className={`${className} user-edit`}
      onClick={onEdit}
      title={user.nickname ? "Edit your name badge" : "Add a name badge"}
    >
      <strong>{user.name}</strong>
      {user.nickname ? (
        <NameBadge nickname={user.nickname} icon={user.nicknameIcon} size="sm" />
      ) : (
        <span className="mono">@{user.login}</span>
      )}
      <span className="user-edit-hint">{user.nickname ? "Edit badge" : "+ Add badge"}</span>
    </button>
  );
}
