import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  CloudSun,
  Navigation,
  Cross,
  Camera,
  Siren,
  Droplets,
  Phone,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import Logo from '@/components/Logo';
import LanguageToggle from '@/components/LanguageToggle';

export type SectionId =
  | 'dashboard'
  | 'weather'
  | 'navigation'
  | 'hospital'
  | 'incidents'
  | 'sos'
  | 'soil'
  | 'contacts'
  | 'admin';

interface NavItem {
  id: SectionId;
  label: string;
  icon: ReactNode;
  description: string;
}

export interface AppLayoutProps {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
  children: ReactNode;
}

export default function AppLayout({ active, onNavigate, children }: AppLayoutProps) {
  const { profile, signOut } = useAuth();
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdminMode = active === 'admin';

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="w-5 h-5" />, description: t.navDesc.dashboard },
    { id: 'weather', label: t.nav.weather, icon: <CloudSun className="w-5 h-5" />, description: t.navDesc.weather },
    { id: 'navigation', label: t.nav.navigation, icon: <Navigation className="w-5 h-5" />, description: t.navDesc.navigation },
    { id: 'hospital', label: t.nav.hospital, icon: <Cross className="w-5 h-5" />, description: t.navDesc.hospital },
    { id: 'incidents', label: t.nav.incidents, icon: <Camera className="w-5 h-5" />, description: t.navDesc.incidents },
    { id: 'sos', label: t.nav.sos, icon: <Siren className="w-5 h-5" />, description: t.navDesc.sos },
    { id: 'soil', label: t.nav.soil, icon: <Droplets className="w-5 h-5" />, description: t.navDesc.soil },
    { id: 'contacts', label: t.nav.contacts, icon: <Phone className="w-5 h-5" />, description: t.navDesc.contacts },
  ];

  const adminNavItem: NavItem = {
    id: 'admin',
    label: t.nav.admin,
    icon: <Shield className="w-5 h-5" />,
    description: t.navDesc.admin,
  };

  const visibleNavItems = profile?.is_admin ? [...navItems, adminNavItem] : navItems;
  const activeItem = visibleNavItems.find((n) => n.id === active);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 shadow-lg lg:shadow-none ${
          isAdminMode
            ? 'bg-slate-900 border-r border-slate-700/50'
            : 'bg-white border-r border-slate-200'
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center justify-between p-5 border-b ${isAdminMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <Logo size={40} className="ring-2 ring-white/20" />
            <div>
              <h1 className={`text-lg font-extrabold tracking-tight ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
                {t.app.name}
              </h1>
              <p className={`text-[10px] uppercase tracking-wider ${isAdminMode ? 'text-amber-400' : 'text-slate-400'}`}>
                {isAdminMode ? t.app.adminTagline : t.app.tagline}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className={`lg:hidden ${isAdminMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = item.id === active;
            const isAdminItem = item.id === 'admin';
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group border ${
                  isActive
                    ? isAdminItem
                      ? 'bg-amber-500 border-amber-500 text-slate-900'
                      : isAdminMode
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                    : isAdminItem
                      ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 border-transparent'
                      : isAdminMode
                        ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
                }`}
              >
                <span className={`flex-shrink-0 ${
                  isActive
                    ? isAdminItem ? 'text-slate-900' : isAdminMode ? 'text-white' : 'text-blue-600'
                    : isAdminItem ? 'text-amber-400' : isAdminMode ? 'text-slate-500' : ''
                }`}>
                  {item.icon}
                </span>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className={`text-[11px] truncate ${isAdminMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                    isAdminItem ? 'text-slate-900' : isAdminMode ? 'text-white' : 'text-blue-600'
                  }`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User card + actions */}
        <div className={`p-3 border-t ${isAdminMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl flex-1 min-w-0 ${isAdminMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                isAdminMode ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
              }`}>
                {profile?.username?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate flex items-center gap-1.5 ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
                  {profile?.username ?? 'User'}
                  {profile?.is_admin && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold uppercase border border-amber-500/30">
                      <Shield className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  )}
                </div>
                <div className={`text-[11px] truncate ${isAdminMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {profile?.phone}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle dark={isAdminMode} compact />
            <button
              onClick={signOut}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isAdminMode
                  ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-slate-500 hover:text-red-500 hover:bg-red-50'
              }`}
            >
              <LogOut className="w-4 h-4" />
              {t.common.signOut}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`lg:hidden flex items-center justify-between px-4 py-3 border-b ${
          isAdminMode ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
        }`}>
          <button onClick={() => setMobileOpen(true)} className={isAdminMode ? 'text-slate-400' : 'text-slate-600'}>
            <Menu className="w-6 h-6" />
          </button>
          <span className={`text-sm font-semibold ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
            {activeItem?.label}
          </span>
          <LanguageToggle dark={isAdminMode} compact />
        </header>

        <main className={`flex-1 overflow-y-auto ${isAdminMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
