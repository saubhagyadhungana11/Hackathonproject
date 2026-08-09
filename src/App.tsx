import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/pages/Login';
import AppLayout, { type SectionId } from '@/components/AppLayout';
import Dashboard from '@/sections/Dashboard';
import Weather from '@/sections/Weather';
import NavigationSection from '@/sections/Navigation';
import HospitalFinder from '@/sections/HospitalFinder';
import Incidents from '@/sections/Incidents';
import SOS from '@/sections/SOS';
import Soil from '@/sections/Soil';
import Contacts from '@/sections/Contacts';
import AdminPanel from '@/sections/AdminPanel';

function AppContent() {
  const { session, profile, loading, adminLoginRequested, clearAdminLoginFlag } = useAuth();
  const [active, setActive] = useState<SectionId>('dashboard');

  // Admin portal sign-in lands directly on the admin panel
  useEffect(() => {
    if (adminLoginRequested && profile?.is_admin) {
      setActive('admin');
      clearAdminLoginFlag();
    } else if (adminLoginRequested && profile && !profile.is_admin) {
      clearAdminLoginFlag();
    }
  }, [adminLoginRequested, profile, clearAdminLoginFlag]);

  // Non-admin users trying to access admin section get redirected to dashboard
  useEffect(() => {
    if (active === 'admin' && !profile?.is_admin) {
      setActive('dashboard');
    }
  }, [active, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const sections: Record<SectionId, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setActive} />,
    weather: <Weather />,
    navigation: <NavigationSection />,
    hospital: <HospitalFinder />,
    incidents: <Incidents />,
    sos: <SOS />,
    soil: <Soil />,
    contacts: <Contacts />,
    admin: profile?.is_admin ? <AdminPanel /> : <Dashboard onNavigate={setActive} />,
  };

  return (
    <AppLayout active={active} onNavigate={setActive}>
      {sections[active]}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
