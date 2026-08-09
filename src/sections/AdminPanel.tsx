import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Users,
  Siren,
  Camera,
  Phone,
  Activity,
  Cross,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Clock,
  MapPin,
  Search,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Radio,
  Building2,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type {
  Profile,
  Incident,
  SosAlert,
  EmergencyContact,
  HospitalNotification,
  EmergencyIncident,
} from '@/types/database';

type AdminTab = 'overview' | 'users' | 'incidents' | 'sos' | 'contacts' | 'hospital';

interface AdminStats {
  totalUsers: number;
  totalIncidents: number;
  activeSos: number;
  totalContacts: number;
  hospitalAlerts: number;
  pendingIncidents: number;
}

export default function AdminPanel() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalIncidents: 0,
    activeSos: 0,
    totalContacts: 0,
    hospitalAlerts: 0,
    pendingIncidents: 0,
  });

  const [users, setUsers] = useState<Profile[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [hospitalNotifs, setHospitalNotifs] = useState<HospitalNotification[]>([]);
  const [emergencyIncidents, setEmergencyIncidents] = useState<EmergencyIncident[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, incidentsRes, sosRes, contactsRes, hospitalRes, emergRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('sos_alerts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('emergency_contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('hospital_notifications').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('emergency_incidents').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (usersRes.error) throw usersRes.error;

      const u = (usersRes.data as Profile[]) ?? [];
      const inc = (incidentsRes.data as Incident[]) ?? [];
      const sos = (sosRes.data as SosAlert[]) ?? [];
      const con = (contactsRes.data as EmergencyContact[]) ?? [];
      const hos = (hospitalRes.data as HospitalNotification[]) ?? [];
      const emi = (emergRes.data as EmergencyIncident[]) ?? [];

      setUsers(u);
      setIncidents(inc);
      setSosAlerts(sos);
      setContacts(con);
      setHospitalNotifs(hos);
      setEmergencyIncidents(emi);

      setStats({
        totalUsers: u.length,
        totalIncidents: inc.length,
        activeSos: sos.filter((s) => s.status === 'active').length,
        totalContacts: con.length,
        hospitalAlerts: hos.length,
        pendingIncidents: inc.filter((i) => i.status === 'pending' || i.status === 'reported').length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function toggleAdmin(user: Profile) {
    const { error: err } = await supabase.from('profiles').update({ is_admin: !user.is_admin }).eq('id', user.id);
    if (err) { setError(err.message); return; }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_admin: !u.is_admin } : u)));
  }

  async function updateIncidentStatus(id: string, status: string) {
    const { error: err } = await supabase.from('incidents').update({ status }).eq('id', id);
    if (err) { setError(err.message); return; }
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  async function deleteIncident(id: string) {
    const { error: err } = await supabase.from('incidents').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setIncidents((prev) => prev.filter((i) => i.id !== id));
  }

  async function updateSosStatus(id: string, status: string) {
    const { error: err } = await supabase.from('sos_alerts').update({ status }).eq('id', id);
    if (err) { setError(err.message); return; }
    setSosAlerts((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function deleteSos(id: string) {
    const { error: err } = await supabase.from('sos_alerts').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setSosAlerts((prev) => prev.filter((s) => s.id !== id));
  }

  async function deleteContact(id: string) {
    const { error: err } = await supabase.from('emergency_contacts').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function updateHospitalStatus(id: string, status: string) {
    const { error: err } = await supabase.from('hospital_notifications').update({ status }).eq('id', id);
    if (err) { setError(err.message); return; }
    setHospitalNotifs((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)));
  }

  async function deleteHospitalNotif(id: string) {
    const { error: err } = await supabase.from('hospital_notifications').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setHospitalNotifs((prev) => prev.filter((h) => h.id !== id));
  }

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" />, count: users.length },
    { id: 'incidents', label: 'Incidents', icon: <Camera className="w-4 h-4" />, count: incidents.length },
    { id: 'sos', label: 'SOS Alerts', icon: <Siren className="w-4 h-4" />, count: sosAlerts.length },
    { id: 'contacts', label: 'Contacts', icon: <Phone className="w-4 h-4" />, count: contacts.length },
    { id: 'hospital', label: 'Hospital Alerts', icon: <Cross className="w-4 h-4" />, count: hospitalNotifs.length },
  ];

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    reported: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    resolved: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    active: 'bg-red-500/20 text-red-300 border-red-500/30',
    responded: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    dismissed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    received: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    preparing: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  function StatusBadge({ status }: { status: string }) {
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${statusColors[status] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
        {status}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 border border-slate-700/50 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Command Center</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Signed in as <span className="text-amber-400 font-semibold">{profile?.username}</span> — full platform oversight
              </p>
            </div>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 font-medium px-4 py-2.5 rounded-xl transition-all text-sm"
          >
            <Activity className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-sm text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-xs underline text-red-400">Dismiss</button>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-700/50 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.id
                ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.id ? 'bg-slate-900/20 text-slate-900' : 'bg-slate-700 text-slate-300'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={<Users className="w-5 h-5" />} label="Total Users" value={stats.totalUsers} color="blue" />
            <StatCard icon={<Camera className="w-5 h-5" />} label="Incidents Reported" value={stats.totalIncidents} color="orange" />
            <StatCard icon={<Siren className="w-5 h-5" />} label="Active SOS Alerts" value={stats.activeSos} color="red" />
            <StatCard icon={<Phone className="w-5 h-5" />} label="Emergency Contacts" value={stats.totalContacts} color="emerald" />
            <StatCard icon={<Cross className="w-5 h-5" />} label="Hospital Alerts" value={stats.hospitalAlerts} color="rose" />
            <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Pending Incidents" value={stats.pendingIncidents} color="amber" />
          </div>

          {/* Recent emergency incidents */}
          <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              Recent Emergency Incidents (Auto-detected)
            </h3>
            {emergencyIncidents.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No emergency incidents detected.</p>
            ) : (
              <div className="space-y-2">
                {emergencyIncidents.slice(0, 8).map((ei) => (
                  <div key={ei.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ei.impact_severity === 'critical' ? 'bg-red-500/20' :
                      ei.impact_severity === 'severe' ? 'bg-orange-500/20' :
                      ei.impact_severity === 'moderate' ? 'bg-yellow-500/20' : 'bg-slate-700/50'
                    }`}>
                      <Siren className={`w-4 h-4 ${
                        ei.impact_severity === 'critical' ? 'text-red-400' :
                        ei.impact_severity === 'severe' ? 'text-orange-400' :
                        ei.impact_severity === 'moderate' ? 'text-yellow-400' : 'text-slate-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white capitalize">
                        {ei.incident_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatDate(ei.created_at)}
                        {ei.location_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ei.location_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={ei.incident_status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin capabilities */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Admin Capabilities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Users, text: 'View all users and grant/revoke admin privileges' },
                { icon: Camera, text: 'Verify, update status, or delete reported incidents' },
                { icon: Siren, text: 'Manage SOS alerts — mark responded or dismiss false alarms' },
                { icon: Phone, text: 'Delete outdated or incorrect emergency contacts' },
                { icon: Cross, text: 'Track and update hospital notification statuses' },
                { icon: Radio, text: 'Monitor auto-detected emergency incidents' },
              ].map((cap, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700/30 px-3 py-2.5">
                  <cap.icon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{cap.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== USERS ===== */}
      {tab === 'users' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or email..."
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
                  <th className="pb-2 font-semibold">User</th>
                  <th className="pb-2 font-semibold hidden sm:table-cell">Phone</th>
                  <th className="pb-2 font-semibold hidden md:table-cell">Joined</th>
                  <th className="pb-2 font-semibold">Role</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          u.is_admin ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{u.username}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-slate-400 hidden sm:table-cell">{u.phone}</td>
                    <td className="py-3 text-slate-400 hidden md:table-cell text-xs">{formatDate(u.created_at)}</td>
                    <td className="py-3">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold uppercase border border-amber-500/30">
                          <Shield className="w-3 h-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 font-semibold uppercase">
                          User
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => toggleAdmin(u)}
                        disabled={u.id === profile?.id}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          u.is_admin
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                        }`}
                      >
                        {u.is_admin ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {u.is_admin ? 'Revoke' : 'Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">No users found.</p>
          )}
        </div>
      )}

      {/* ===== INCIDENTS ===== */}
      {tab === 'incidents' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-400" />
            Reported Incidents
          </h3>
          {incidents.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No incidents reported.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => (
                <div key={inc.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30">
                  <button
                    onClick={() => setExpandedRow(expandedRow === inc.id ? null : inc.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    {expandedRow === inc.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      inc.severity === 'critical' ? 'bg-red-500/20' :
                      inc.severity === 'high' ? 'bg-orange-500/20' :
                      inc.severity === 'moderate' ? 'bg-yellow-500/20' : 'bg-emerald-500/20'
                    }`}>
                      <Camera className={`w-4 h-4 ${
                        inc.severity === 'critical' ? 'text-red-400' :
                        inc.severity === 'high' ? 'text-orange-400' :
                        inc.severity === 'moderate' ? 'text-yellow-400' : 'text-emerald-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white capitalize">
                        {inc.type} — {inc.severity}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatDate(inc.created_at)}
                        {inc.location_name && <span className="truncate">· {inc.location_name}</span>}
                      </div>
                    </div>
                    <StatusBadge status={inc.status} />
                  </button>
                  {expandedRow === inc.id && (
                    <div className="px-3 pb-3 space-y-3 border-t border-slate-700/30 pt-3">
                      {inc.description && <p className="text-sm text-slate-400">{inc.description}</p>}
                      {inc.media_url && (
                        <img src={inc.media_url} alt="Incident" className="rounded-lg max-h-48 object-cover" />
                      )}
                      <div className="flex flex-wrap gap-2">
                        {['pending', 'verified', 'resolved'].map((s) => (
                          <button
                            key={s}
                            onClick={() => updateIncidentStatus(inc.id, s)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize border ${
                              inc.status === s
                                ? 'bg-amber-500 text-slate-900 border-amber-500'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700/50'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            {s}
                          </button>
                        ))}
                        <button
                          onClick={() => deleteIncident(inc.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 ml-auto"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SOS ===== */}
      {tab === 'sos' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Siren className="w-4 h-4 text-red-400" />
            SOS Distress Alerts
          </h3>
          {sosAlerts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No SOS alerts received.</p>
          ) : (
            <div className="space-y-2">
              {sosAlerts.map((sos) => (
                <div key={sos.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    sos.status === 'active' ? 'bg-red-500/20' : 'bg-slate-700/50'
                  }`}>
                    <Siren className={`w-4 h-4 ${sos.status === 'active' ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white capitalize">
                      SOS — {sos.severity}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {formatDate(sos.created_at)}
                      {sos.location_name && <span className="truncate">· {sos.location_name}</span>}
                    </div>
                    {sos.message && <p className="text-xs text-slate-400 mt-1 truncate">{sos.message}</p>}
                  </div>
                  <StatusBadge status={sos.status} />
                  <div className="flex gap-1">
                    {sos.status === 'active' && (
                      <button
                        onClick={() => updateSosStatus(sos.id, 'responded')}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                      >
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />
                        Respond
                      </button>
                    )}
                    <button
                      onClick={() => deleteSos(sos.id)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONTACTS ===== */}
      {tab === 'contacts' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-400" />
            Emergency Contacts Directory
          </h3>
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No contacts registered.</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{c.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{c.phone}</span>
                      <span>·</span>
                      <span className="capitalize">{c.role}</span>
                      {c.region && <span>· {c.region}</span>}
                    </div>
                  </div>
                  {c.is_official && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold uppercase border border-emerald-500/30">
                      Official
                    </span>
                  )}
                  <button
                    onClick={() => deleteContact(c.id)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== HOSPITAL ALERTS ===== */}
      {tab === 'hospital' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 animate-fade-in">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-400" />
            Hospital Pre-arrival Alerts
          </h3>
          {hospitalNotifs.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No hospital alerts sent.</p>
          ) : (
            <div className="space-y-2">
              {hospitalNotifs.map((hn) => (
                <div key={hn.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                      <Cross className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{hn.hospital_name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatDate(hn.created_at)}
                        <span>·</span>
                        <span className="capitalize">{hn.severity}</span>
                        {hn.estimated_eta_min && <span>· ETA {hn.estimated_eta_min}min</span>}
                      </div>
                    </div>
                    <StatusBadge status={hn.status} />
                  </div>
                  {(hn.condition_description || hn.condition_tags || hn.photo_urls) && (
                    <div className="mt-2 pl-11 space-y-1.5">
                      {hn.condition_description && (
                        <p className="text-xs text-slate-400">Condition: {hn.condition_description}</p>
                      )}
                      {hn.condition_tags && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {hn.condition_tags.split(',').map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/30">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {hn.photo_urls && hn.photo_urls.length > 0 && (
                        <div className="flex gap-1.5">
                          {hn.photo_urls.slice(0, 4).map((url, i) => (
                            <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-12 h-12 rounded-lg object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 pl-11 flex gap-1.5">
                    {['sent', 'received', 'preparing', 'ready'].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateHospitalStatus(hn.id, s)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-all capitalize border ${
                          hn.status === s
                            ? 'bg-amber-500 text-slate-900 border-amber-500'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700/50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => deleteHospitalNotif(hn.id)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-500 shadow-blue-500/20',
    orange: 'from-orange-500 to-amber-500 shadow-orange-500/20',
    red: 'from-red-500 to-rose-500 shadow-red-500/20',
    emerald: 'from-emerald-500 to-green-500 shadow-emerald-500/20',
    rose: 'from-rose-500 to-red-500 shadow-rose-500/20',
    amber: 'from-amber-500 to-yellow-500 shadow-amber-500/20',
  };
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white shadow-lg mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
