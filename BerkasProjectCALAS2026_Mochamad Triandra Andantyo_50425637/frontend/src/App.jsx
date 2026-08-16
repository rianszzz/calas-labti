import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Folders from './pages/Folders';
import FolderDetail from './pages/FolderDetail';
import Chat from './pages/Chat';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
        <Route path="/folders" element={<ProtectedRoute><Layout><Folders /></Layout></ProtectedRoute>} />
        <Route path="/folders/:id" element={<ProtectedRoute><Layout><FolderDetail /></Layout></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
        <Route path="/documents/:document_id/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
