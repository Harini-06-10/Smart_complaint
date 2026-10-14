import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { useAuth, homeFor } from './context/AuthContext';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Track from './pages/Track';
import Transparency from './pages/Transparency';
import ComplaintDetail from './pages/ComplaintDetail';
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import NewComplaint from './pages/citizen/NewComplaint';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminOfficers from './pages/admin/AdminOfficers';
import StaffDashboard from './pages/staff/StaffDashboard';
import RoutePlanner from './pages/staff/RoutePlanner';
import AssignBoard from './pages/admin/AssignBoard';
import Leaderboard from './pages/Leaderboard';
import Receipt from './pages/Receipt';
import Assistant from './components/Assistant';

/** Only lets a user in if they are logged in with one of the given roles. */
function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:gid" element={<Track />} />
          <Route path="/transparency" element={<Transparency />} />
          <Route path="/leaderboard" element={<Leaderboard />} />

          <Route path="/citizen" element={<Protected roles={['citizen']}><CitizenDashboard /></Protected>} />
          <Route path="/citizen/new" element={<Protected roles={['citizen']}><NewComplaint /></Protected>} />

          <Route path="/staff" element={<Protected roles={['staff']}><StaffDashboard /></Protected>} />
          <Route path="/staff/route" element={<Protected roles={['staff']}><RoutePlanner /></Protected>} />

          <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
          <Route path="/admin/board" element={<Protected roles={['admin']}><AssignBoard /></Protected>} />
          <Route path="/admin/complaints" element={<Protected roles={['admin']}><AdminComplaints /></Protected>} />
          <Route path="/admin/officers" element={<Protected roles={['admin']}><AdminOfficers /></Protected>} />

          <Route path="/complaints/:id" element={<Protected><ComplaintDetail /></Protected>} />
          <Route path="/receipt/:id" element={<Protected><Receipt /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        Smart Complaint Registration System v3 · Department of CSE, Prathyusha Engineering College
      </footer>
      <Assistant />
    </>
  );
}
