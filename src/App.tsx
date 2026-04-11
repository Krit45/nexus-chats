import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { connectionError } from './firebase';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatDashboard from './pages/ChatDashboard';
import { AlertCircle, ExternalLink } from 'lucide-react';

const FirebaseConfigError = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
    <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 p-8 text-center">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Firebase Connection Error</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
        {message}
      </p>
      <div className="space-y-4">
        <a 
          href="https://console.firebase.google.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Open Firebase Console
          <ExternalLink className="ml-2 w-4 h-4" />
        </a>
        <button 
          onClick={() => window.location.reload()}
          className="w-full px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        {connectionError ? (
          <FirebaseConfigError message={connectionError} />
        ) : (
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <ChatDashboard darkMode={darkMode} setDarkMode={setDarkMode} />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Router>
        )}
      </div>
    </AuthProvider>
  );
}
