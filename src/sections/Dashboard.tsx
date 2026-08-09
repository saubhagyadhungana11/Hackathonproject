import { useEffect, useState } from 'react';
import {
  Siren,
  Camera,
  Droplets,
  AlertTriangle,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime } from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import type { Incident, SosAlert, SoilReading, EmergencyContact } from '@/types/database';
import type { SectionId } from '@/components/AppLayout';

export default function Dashboard({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const { t } = useLang();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [soilReadings, setSoilReadings] = useState<SoilReading[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [inc, sos, soil, cont] = await Promise.all([
        supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('sos_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(20),
        supabase.from('soil_readings').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('emergency_contacts').select('*').order('is_official', { ascending: false }).limit(6),
      ]);
      setIncidents((inc.data as Incident[]) ?? []);
      setSosAlerts((sos.data as SosAlert[]) ?? []);
      setSoilReadings((soil.data as SoilReading[]) ?? []);
      setContacts((cont.data as EmergencyContact[]) ?? []);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeIncidents = incidents.filter((i) => i.status === 'active');
  const criticalSos = sosAlerts.filter((s) => s.severity === 'critical');
  const highRiskSoil = soilReadings.filter((s) => s.risk_level === 'high' || s.risk_level === 'critical');

  const stats = [
    {
      label: t.dashboard.activeIncidents,
      value: activeIncidents.length,
      icon: <Camera className="w-5 h-5" />,
      bg: 'bg-orange-100',
      text: 'text-orange-600',
      section: 'incidents' as SectionId,
    },
    {
      label: t.dashboard.activeSos,
      value: sosAlerts.length,
      icon: <Siren className="w-5 h-5" />,
      bg: 'bg-red-100',
      text: 'text-red-600',
      section: 'sos' as SectionId,
    },
    {
      label: t.dashboard.highRiskSoil,
      value: highRiskSoil.length,
      icon: <Droplets className="w-5 h-5" />,
      bg: 'bg-emerald-100',
      text: 'text-emerald-600',
      section: 'soil' as SectionId,
    },
    {
      label: t.dashboard.emergencyContacts,
      value: contacts.length,
      icon: <Phone className="w-5 h-5" />,
      bg: 'bg-blue-100',
      text: 'text-blue-600',
      section: 'contacts' as SectionId,
    },
  ];

  const sevColor: Record<string, string> = {
    low: 'text-emerald-700 bg-emerald-100',
    moderate: 'text-yellow-700 bg-yellow-100',
    high: 'text-orange-700 bg-orange-100',
    critical: 'text-red-700 bg-red-100',
  };
  const sevBg: Record<string, string> = {
    low: 'bg-emerald-500',
    moderate: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const sevLabel = (s: string) => (t.severity as Record<string, string>)[s] ?? s;
  const incTypeLabel = (s: string) => (t.incidentType as Record<string, string>)[s] ?? s;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{t.dashboard.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 self-start">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700">{t.common.live} · {t.common.autoRefresh}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => onNavigate(s.section)}
            className="group text-left rounded-2xl bg-white border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.text}`}>
                {s.icon}
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{loading ? '—' : s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Critical alert banner */}
      {(criticalSos.length > 0 || highRiskSoil.length > 0) && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-bold text-red-700">{t.dashboard.criticalAlerts}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criticalSos.length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                <div className="text-2xl font-extrabold text-red-600">{criticalSos.length}</div>
                <div className="text-sm text-red-600">{t.dashboard.criticalSos}</div>
              </div>
            )}
            {highRiskSoil.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <div className="text-2xl font-extrabold text-amber-600">{highRiskSoil.length}</div>
                <div className="text-sm text-amber-700">{t.dashboard.highRiskZones}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent incidents */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              {t.dashboard.recentIncidents}
            </h2>
            <button
              onClick={() => onNavigate('incidents')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {t.common.viewAll}
            </button>
          </div>
          {incidents.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t.dashboard.noIncidents}</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {incidents.slice(0, 6).map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className={`w-2 h-10 rounded-full ${sevBg[inc.severity] ?? 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 capitalize">{incTypeLabel(inc.type)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${sevColor[inc.severity] ?? 'bg-slate-100 text-slate-600'}`}>
                        {sevLabel(inc.severity)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {inc.location_name ?? `${inc.latitude.toFixed(2)}, ${inc.longitude.toFixed(2)}`}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">{formatRelativeTime(inc.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active SOS */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Siren className="w-4 h-4 text-red-500" />
              {t.dashboard.activeSosSignals}
            </h2>
            <button
              onClick={() => onNavigate('sos')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {t.common.viewAll}
            </button>
          </div>
          {sosAlerts.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t.dashboard.noSos}</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {sosAlerts.slice(0, 6).map((sos) => (
                <div key={sos.id} className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 p-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Siren className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {sos.location_name ?? `${sos.latitude.toFixed(2)}, ${sos.longitude.toFixed(2)}`}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(sos.created_at)}
                      <span className="text-red-600">· {sevLabel(sos.severity)}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 flex-shrink-0">
                    <TrendingUp className="w-3 h-3" />
                    {sos.responder_count} {t.dashboard.responders}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
