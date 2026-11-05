import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import StudentHome from "./pages/student/Home";
import Rate from "./pages/student/Rate";
import StudentLeaderboard from "./pages/student/Leaderboard";
import Overview from "./pages/staff/Overview";
import Students from "./pages/staff/Students";
import StudentDetail from "./pages/staff/StudentDetail";
import Ratings from "./pages/staff/Ratings";
import Participation from "./pages/staff/Participation";
import Abuse from "./pages/staff/Abuse";
import StaffLeaderboard from "./pages/staff/Leaderboard";
import Labels from "./pages/staff/Labels";
import Windows from "./pages/staff/Windows";

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="fullscreen-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (user.role === "STAFF") {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/staff" element={<Overview />} />
          <Route path="/staff/students" element={<Students />} />
          <Route path="/staff/students/:id" element={<StudentDetail />} />
          <Route path="/staff/ratings" element={<Ratings />} />
          <Route path="/staff/participation" element={<Participation />} />
          <Route path="/staff/abuse" element={<Abuse />} />
          <Route path="/staff/leaderboard" element={<StaffLeaderboard />} />
          <Route path="/staff/labels" element={<Labels />} />
          <Route path="/staff/windows" element={<Windows />} />
        </Route>
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<StudentHome />} />
        <Route path="/rate" element={<Rate />} />
        <Route path="/leaderboard" element={<StudentLeaderboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
