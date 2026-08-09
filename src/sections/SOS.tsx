import { useEffect, useState, useCallback } from 'react';
import {
  Siren,
  MapPin,
  Loader2,
  AlertTriangle,
  Crosshair,
  CheckCircle2,
  Clock,
  Navigation,
  TrendingUp,
  Shield,
  X,
  Phone,
  MessageSquare,
  WifiOff,
  Wifi,
  Radio,
  Activity,
  Gauge,
  Car,
  Flame,
  Truck,
  Plus,
  Power,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  reverseGeocode,
  formatRelativeTime,
  haversineKm,
  cacheEmergencyContacts,
  getCachedEmergencyContacts,
  isContactsCacheFresh,
  findNearestContact,
  buildEmergencySmsUri,
  queueOfflineSos,
  getOfflineSosQueue,
  removeOfflineSos,
  type CachedEmergencyContact,
  type OfflineSosAlert,
} from '@/lib/api';
import {
  buildEmergencyIncidentMessage,
  getStatusLabel,
  getStatusColor,
  EMERGENCY_THRESHOLD,
  type CrashAnalysis,
  type CrashSeverity,
  type IncidentType,
} from '@/lib/crashDetection';
import type { SosAlert, EmergencyContact, EmergencyIncident, UserMedicalInfo } from '@/types/database';
import LeafletMap, { type MapMarker, type MarkerColor } from '@/components/LeafletMap';
import SectionHeader from '@/components/SectionHeader';
import CrashDetectionOverlay from '@/components/CrashDetectionOverlay';
import { useCrashDetection } from '@/hooks/useCrashDetection';
import { useAuth } from '@/context/AuthContext';

interface NearestService {
  contact: CachedEmergencyContact;
  distanceKm: number;
}

export default function SOS() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [contacts, setContacts] = useState<CachedEmergencyContact[]>([]);
  const [nearestPolice, setNearestPolice] = useState<NearestService | null>(null);
  const [nearestFire, setNearestFire] = useState<NearestService | null>(null);
  const [nearestAmbulance, setNearestAmbulance] = useState<NearestService | null>(null);
  const [nearestHospital, setNearestHospital] = useState<NearestService | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSosAlert[]>([]);
  const [medicalInfo, setMedicalInfo] = useState<UserMedicalInfo | null>(null);
  const [activeIncident, setActiveIncident] = useState<EmergencyIncident | null>(null);

  // Crash detection
  const handleEmergencyConfirmed = useCallback((analysis: CrashAnalysis) => {
    escalateEmergency(analysis);
  }, [currentPos, profile, medicalInfo, contacts]);

  const crash = useCrashDetection(handleEmergencyConfirmed);

  useEffect(() => {
    loadContacts();
    loadAlerts();
    loadIncidents();
    loadMedicalInfo();
    setOfflineQueue(getOfflineSosQueue());

    const interval = setInterval(() => {
      loadAlerts();
      loadIncidents();
    }, 15000);

    const handleOnline = () => {
      setOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function loadContacts() {
    try {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('id, name, role, phone, region, latitude, longitude, is_official')
        .order('is_official', { ascending: false });
      const list = (data as EmergencyContact[]) ?? [];
      const mapped: CachedEmergencyContact[] = list.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        phone: c.phone,
        region: c.region,
        latitude: c.latitude,
        longitude: c.longitude,
        is_official: c.is_official,
      }));
      setContacts(mapped);
      cacheEmergencyContacts(mapped);
    } catch {
      setContacts(getCachedEmergencyContacts());
    }
  }

  async function loadAlerts() {
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('sos_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAlerts((data as SosAlert[]) ?? []);
    setLoading(false);
  }

  async function loadIncidents() {
    if (!navigator.onLine) return;
    const { data } = await supabase
      .from('emergency_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setIncidents((data as EmergencyIncident[]) ?? []);
    const mine = (data as EmergencyIncident[])?.find(
      (i) => i.user_id === profile?.id && !['resolved', 'false_alarm'].includes(i.incident_status),
    );
    setActiveIncident(mine ?? null);
  }

  async function loadMedicalInfo() {
    if (!profile) return;
    const { data } = await supabase
      .from('user_medical_info')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    setMedicalInfo(data as UserMedicalInfo | null);
  }

  function trackLocation() {
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        const pos2 = { lat: pos.coords.latitude, lng: pos.coords.longitude, name };
        setCurrentPos(pos2);
        updateNearestServices(pos2.lat, pos2.lng);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}. Make sure location access is enabled.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function updateNearestServices(lat: number, lng: number) {
    const pool = contacts.length > 0 ? contacts : getCachedEmergencyContacts();
    setNearestPolice(findNearestByRole(pool, lat, lng, 'Police'));
    setNearestFire(findNearestByRole(pool, lat, lng, 'Fire'));
    setNearestAmbulance(findNearestByRole(pool, lat, lng, 'Ambulance'));
    setNearestHospital(findNearestByRole(pool, lat, lng, 'Hospital'));
  }

  function findNearestByRole(
    pool: CachedEmergencyContact[],
    lat: number,
    lng: number,
    role: string,
  ): NearestService | null {
    const result = findNearestContact(pool, lat, lng, role);
    if (!result) return null;
    return { contact: result.contact, distanceKm: result.distanceKm };
  }

  // ===== EMERGENCY ESCALATION =====
  async function escalateEmergency(analysis: CrashAnalysis) {
    setError(null);

    let lat = currentPos?.lat ?? 0;
    let lng = currentPos?.lng ?? 0;
    let locationName = currentPos?.name ?? '';

    if (!currentPos) {
      // Try to get location immediately
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        locationName = await reverseGeocode(lat, lng);
        setCurrentPos({ lat, lng, name: locationName });
        updateNearestServices(lat, lng);
      } catch {
        setError('Could not acquire GPS location for emergency alert.');
      }
    }

    const incidentType: IncidentType = analysis.score >= EMERGENCY_THRESHOLD && analysis.impactMagnitude > 15
      ? 'vehicle_crash'
      : 'manual_sos';

    let batteryLevel: number | null = null;
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        batteryLevel = Math.round(battery.level * 100);
      }
    } catch {
      // Battery API not available
    }

    // Build emergency message
    const message = buildEmergencyIncidentMessage({
      username: profile?.username ?? 'Unknown',
      lat,
      lng,
      locationName,
      crashScore: analysis.score,
      impactSeverity: analysis.severity,
      incidentType,
      batteryLevel,
      speedBefore: null,
      medicalInfo: medicalInfo
        ? [medicalInfo.blood_type, medicalInfo.allergies, medicalInfo.chronic_conditions]
            .filter(Boolean)
            .join('; ')
        : null,
      nearbyHospitals: nearestHospital ? [nearestHospital.contact.name] : [],
      nearbyPolice: nearestPolice ? [nearestPolice.contact.name] : [],
      nearbyFire: nearestFire ? [nearestFire.contact.name] : [],
      userResponse: analysis.signals.includes('Manual SOS triggered by user')
        ? 'Manual trigger'
        : 'No response to verification prompt',
    });

    // 1. Queue locally first
    const offlineAlert = queueOfflineSos({
      latitude: lat,
      longitude: lng,
      location_name: locationName,
      severity: 'critical',
      message,
      created_at: new Date().toISOString(),
    });
    setOfflineQueue(getOfflineSosQueue());

    // 2. Create emergency incident in database
    if (navigator.onLine) {
      try {
        const { data: incidentData, error: incidentError } = await supabase
          .from('emergency_incidents')
          .insert({
            incident_type: incidentType,
            latitude: lat,
            longitude: lng,
            location_name: locationName,
            crash_score: analysis.score,
            impact_severity: analysis.severity,
            verification_status: analysis.score >= 81 ? 'no_response' : 'user_confirmed',
            user_response: analysis.signals.includes('Manual SOS triggered by user')
              ? 'confirmed'
              : 'no_response',
            battery_level: batteryLevel,
            medical_info: medicalInfo
              ? [medicalInfo.blood_type, medicalInfo.allergies, medicalInfo.chronic_conditions]
                  .filter(Boolean)
                  .join('; ')
              : null,
            assigned_police: nearestPolice?.contact.name ?? null,
            assigned_fire: nearestFire?.contact.name ?? null,
            assigned_ambulance: nearestAmbulance?.contact.name ?? null,
            assigned_hospital: nearestHospital?.contact.name ?? null,
            incident_status: 'authorities_notified',
          })
          .select()
          .single();

        if (!incidentError && incidentData) {
          const incident = incidentData as EmergencyIncident;
          setActiveIncident(incident);

          // Create SOS alert linked to incident
          await supabase.from('sos_alerts').insert({
            latitude: lat,
            longitude: lng,
            location_name: locationName,
            severity: 'critical',
            message,
            status: 'active',
            incident_id: incident.id,
          });

          // Audit log
          await supabase.from('incident_audit_log').insert({
            incident_id: incident.id,
            action: 'emergency_confirmed',
            details: `Crash score: ${analysis.score}, Severity: ${analysis.severity ?? 'unknown'}`,
          });

          removeOfflineSos(offlineAlert.id);
          setOfflineQueue(getOfflineSosQueue());
          loadAlerts();
          loadIncidents();
        }
      } catch {
        // DB sync failed — offline queue has it
      }
    }

    // 3. Open SMS to all relevant emergency services
    const services: NearestService[] = [
      nearestPolice,
      nearestFire,
      nearestAmbulance,
    ].filter((s): s is NearestService => s !== null);

    if (services.length > 0) {
      // Open SMS to the first available service (police priority)
      const primary = nearestPolice ?? nearestAmbulance ?? nearestFire;
      if (primary) {
        const smsUri = buildEmergencySmsUri(primary.contact.phone, message);
        window.location.href = smsUri;
      }
    }

    // 4. Notify emergency contacts if configured
    if (medicalInfo?.emergency_contact_phone) {
      const contactSmsUri = buildEmergencySmsUri(
        medicalInfo.emergency_contact_phone,
        `EMERGENCY: ${profile?.username ?? 'Your contact'} may have been in an accident. Location: ${lat.toFixed(5)},${lng.toFixed(5)}. Map: https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`,
      );
      // Can't open multiple SMS URIs simultaneously, so we provide a link
    }
  }

  async function syncOfflineQueue() {
    const queue = getOfflineSosQueue().filter((s) => !s.synced);
    if (queue.length === 0) return;
    for (const alert of queue) {
      try {
        const { error } = await supabase.from('sos_alerts').insert({
          latitude: alert.latitude,
          longitude: alert.longitude,
          location_name: alert.location_name,
          severity: alert.severity,
          message: alert.message,
          status: 'active',
        });
        if (!error) removeOfflineSos(alert.id);
      } catch {
        break;
      }
    }
    setOfflineQueue(getOfflineSosQueue());
    loadAlerts();
  }

  async function cancelActiveIncident() {
    if (!activeIncident) return;
    await supabase
      .from('emergency_incidents')
      .update({ incident_status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', activeIncident.id);
    await supabase
      .from('sos_alerts')
      .update({ status: 'resolved' })
      .eq('incident_id', activeIncident.id);
    setActiveIncident(null);
    loadAlerts();
    loadIncidents();
  }

  async function incrementResponders(alert: SosAlert) {
    await supabase
      .from('sos_alerts')
      .update({ responder_count: alert.responder_count + 1, updated_at: new Date().toISOString() })
      .eq('id', alert.id);
    loadAlerts();
  }

  // ===== MARKERS FOR MAP =====
  const markers: MapMarker[] = [
    ...(currentPos
      ? [{
          id: 'me',
          position: [currentPos.lat, currentPos.lng] as [number, number],
          color: 'blue' as MarkerColor,
          icon: 'dot' as const,
          popup: `<b>Your location</b><br/>${currentPos.name}`,
        }]
      : []),
    ...(nearestPolice?.contact.latitude ? [{
        id: 'police',
        position: [nearestPolice.contact.latitude!, nearestPolice.contact.longitude!] as [number, number],
        color: 'blue' as MarkerColor,
        icon: 'pin' as const,
        popup: `<b>Police: ${nearestPolice.contact.name}</b><br/>${nearestPolice.distanceKm.toFixed(1)} km`,
      }] : []),
    ...(nearestFire?.contact.latitude ? [{
        id: 'fire',
        position: [nearestFire.contact.latitude!, nearestFire.contact.longitude!] as [number, number],
        color: 'orange' as MarkerColor,
        icon: 'pin' as const,
        popup: `<b>Fire: ${nearestFire.contact.name}</b><br/>${nearestFire.distanceKm.toFixed(1)} km`,
      }] : []),
    ...(nearestAmbulance?.contact.latitude ? [{
        id: 'ambulance',
        position: [nearestAmbulance.contact.latitude!, nearestAmbulance.contact.longitude!] as [number, number],
        color: 'cyan' as MarkerColor,
        icon: 'pin' as const,
        popup: `<b>Ambulance: ${nearestAmbulance.contact.name}</b><br/>${nearestAmbulance.distanceKm.toFixed(1)} km`,
      }] : []),
    ...alerts
      .filter((a) => a.status === 'active')
      .map((a) => ({
        id: a.id,
        position: [a.latitude, a.longitude] as [number, number],
        color: 'red' as MarkerColor,
        icon: 'dot' as const,
        pulsing: true,
        popup: `<b>SOS Distress Signal</b><br/>${a.location_name ?? ''}<br/>${formatRelativeTime(a.created_at)}`,
      })),
  ];

  // Show crash detection overlay when in alert/countdown state
  const showCrashOverlay = crash.state === 'alert' || crash.state === 'countdown';

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Siren className="w-6 h-6 text-slate-900" />}
        title="Emergency SOS & Crash Detection"
        subtitle="Automatic crash detection with multi-service emergency dispatch"
        accent="from-red-500 to-rose-600"
      />

      {/* Crash Detection Overlay */}
      {showCrashOverlay && crash.analysis && (
        <CrashDetectionOverlay
          analysis={crash.analysis}
          countdownSeconds={crash.countdownSeconds}
          onConfirm={crash.confirmEmergency}
          onCancel={crash.cancelEmergency}
        />
      )}

      {/* Connection status banner */}
      <div
        className={`rounded-2xl border p-4 flex items-center gap-3 transition-all ${
          online ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-300'
        }`}
      >
        {online ? <Wifi className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0" />}
        <div className="flex-1">
          <div className={`text-sm font-bold ${online ? 'text-emerald-700' : 'text-amber-700'}`}>
            {online ? 'Online — SOS syncs to all responders' : 'Offline — SOS sends via cellular SMS only'}
          </div>
          <div className={`text-xs ${online ? 'text-emerald-600' : 'text-amber-600'}`}>
            {online
              ? 'Emergency alerts go to police, fire, and ambulance simultaneously.'
              : 'Alerts are saved on your device and sent via SMS. They sync when back online.'}
          </div>
        </div>
        {offlineQueue.length > 0 && (
          <button
            onClick={syncOfflineQueue}
            disabled={!online}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
          >
            <Radio className="w-3 h-3" />
            Sync {offlineQueue.length} queued
          </button>
        )}
      </div>

      {/* Active incident banner */}
      {activeIncident && (
        <div className="rounded-2xl bg-red-50 border border-red-300 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center animate-sos-pulse">
                <Siren className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-700">Emergency Active</h3>
                <p className="text-sm text-red-600">
                  Police, fire, and ambulance have been notified. Stay where you are if safe.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${getStatusColor(activeIncident.incident_status)}`}>
                    {getStatusLabel(activeIncident.incident_status)}
                  </span>
                  <span className="text-[10px] text-red-400">
                    Crash score: {activeIncident.crash_score}%
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={cancelActiveIncident}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold px-4 py-2 rounded-xl transition-all text-sm border border-slate-300"
            >
              <X className="w-4 h-4" />
              Cancel Emergency
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Crash detection + SOS sender */}
        <div className="space-y-4">
          {/* Crash Detection Panel */}
          <div className={`rounded-2xl border p-5 transition-all ${
            crash.state === 'monitoring'
              ? 'bg-emerald-50 border-emerald-200'
              : crash.state === 'alert' || crash.state === 'countdown'
                ? 'bg-red-50 border-red-300'
                : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-red-500" />
                Automatic Crash Detection
              </h3>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                crash.state === 'monitoring' ? 'text-emerald-600' :
                crash.state === 'alert' || crash.state === 'countdown' ? 'text-red-600' :
                'text-slate-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  crash.state === 'monitoring' ? 'bg-emerald-500 animate-pulse' :
                  crash.state === 'alert' || crash.state === 'countdown' ? 'bg-red-500 animate-pulse' :
                  'bg-slate-300'
                }`} />
                {crash.state === 'monitoring' ? 'Monitoring' :
                 crash.state === 'alert' || crash.state === 'countdown' ? 'ALERT' :
                 'Off'}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Uses your phone's motion sensors and GPS to automatically detect vehicle crashes,
              falls, and severe impacts. Multi-sensor fusion prevents false alarms.
            </p>

            {/* Live score gauge */}
            {crash.state === 'monitoring' && (
              <div className="mb-4 rounded-xl bg-white p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" />
                    Crash Risk Score
                  </span>
                  <span className={`text-lg font-bold ${
                    crash.currentScore >= 81 ? 'text-red-600' :
                    crash.currentScore >= 61 ? 'text-orange-600' :
                    crash.currentScore >= 31 ? 'text-amber-600' :
                    'text-emerald-600'
                  }`}>
                    {crash.currentScore}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`sensor-bar h-full rounded-full ${
                      crash.currentScore >= 81 ? 'bg-red-500' :
                      crash.currentScore >= 61 ? 'bg-orange-500' :
                      crash.currentScore >= 31 ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${crash.currentScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                  <span>Normal 0-30</span>
                  <span>Suspicious 31-60</span>
                  <span>Possible 61-80</span>
                  <span>High 81+</span>
                </div>
              </div>
            )}

            {/* Live sensor data */}
            {crash.state === 'monitoring' && crash.readings.length > 0 && (
              <div className="mb-3 space-y-1.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Live Sensor Data</div>
                {crash.readings.slice(-3).map((r, i) => {
                  const totalAccel = Math.sqrt(r.accelX ** 2 + r.accelY ** 2 + r.accelZ ** 2);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                      <Zap className="w-2.5 h-2.5 text-amber-500" />
                      <span>Accel: {totalAccel.toFixed(1)} m/s²</span>
                      {r.speedKmh !== null && <span>· Speed: {r.speedKmh.toFixed(0)} km/h</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {crash.error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-amber-600">{crash.error}</span>
              </div>
            )}

            <button
              onClick={crash.state === 'monitoring' ? crash.stopMonitoring : crash.startMonitoring}
              className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all text-sm ${
                crash.state === 'monitoring'
                  ? 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/20'
              }`}
            >
              {crash.state === 'monitoring' ? (
                <><Power className="w-4 h-4" /> Stop Crash Detection</>
              ) : (
                <><Car className="w-4 h-4" /> Enable Crash Detection</>
              )}
            </button>
          </div>

          {/* Manual SOS Panel */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="text-base font-bold text-slate-900 mb-1">Manual Emergency SOS</h3>
            <p className="text-xs text-slate-500 mb-4">
              Press to immediately send an SOS with your GPS location to police, fire brigade, and ambulance.
            </p>

            <button
              onClick={trackLocation}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-all text-sm border border-slate-300 mb-3"
            >
              <Crosshair className="w-4 h-4" />
              {currentPos ? 'Update GPS location' : 'Get my GPS location'}
            </button>

            {currentPos && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 mb-3">
                <div className="text-xs text-blue-700 font-semibold flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  GPS location acquired
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">{currentPos.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
                </div>
              </div>
            )}

            <button
              onClick={crash.triggerManualSOS}
              disabled={!!activeIncident}
              className="w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-extrabold py-6 rounded-2xl transition-all shadow-lg shadow-red-600/20 animate-sos-pulse"
            >
              <Siren className="w-8 h-8" />
              <span className="text-lg tracking-wide">
                {activeIncident ? 'EMERGENCY ACTIVE' : 'SEND SOS'}
              </span>
            </button>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
          </div>

          {/* Emergency Hotlines */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-red-500" />
              Emergency Hotlines
            </h3>
            <div className="space-y-2">
              {(contacts.length > 0 ? contacts : getCachedEmergencyContacts())
                .filter((c) => c.is_official)
                .slice(0, 8)
                .map((c) => {
                  const icon = c.role === 'Police' ? <Shield className="w-4 h-4 text-blue-600" /> :
                               c.role === 'Fire' ? <Flame className="w-4 h-4 text-orange-600" /> :
                               c.role === 'Ambulance' ? <Truck className="w-4 h-4 text-cyan-600" /> :
                               <Activity className="w-4 h-4 text-red-600" />;
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                          {icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.role}{c.region ? ` · ${c.region}` : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`sms:${c.phone.replace(/[\s\-()]/g, '')}?&body=${encodeURIComponent('Emergency SOS - need immediate help')}`}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-all"
                          title="Send SMS"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                        <a
                          href={`tel:${c.phone.replace(/[\s\-()]/g, '')}`}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-all"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>
            {!isContactsCacheFresh() && contacts.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                No cached contacts — connect once to download for offline use.
              </p>
            )}
          </div>
        </div>

        {/* Right: Map + nearest services + active alerts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Nearest Emergency Services */}
          {currentPos && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NearestServiceCard
                title="Nearest Police"
                icon={<Shield className="w-5 h-5 text-blue-600" />}
                service={nearestPolice}
                bgClass="bg-blue-50 border-blue-200"
                iconBg="bg-blue-100"
              />
              <NearestServiceCard
                title="Nearest Fire Brigade"
                icon={<Flame className="w-5 h-5 text-orange-600" />}
                service={nearestFire}
                bgClass="bg-orange-50 border-orange-200"
                iconBg="bg-orange-100"
              />
              <NearestServiceCard
                title="Nearest Ambulance"
                icon={<Truck className="w-5 h-5 text-cyan-600" />}
                service={nearestAmbulance}
                bgClass="bg-cyan-50 border-cyan-200"
                iconBg="bg-cyan-100"
              />
              <NearestServiceCard
                title="Nearest Hospital"
                icon={<Activity className="w-5 h-5 text-red-600" />}
                service={nearestHospital}
                bgClass="bg-red-50 border-red-200"
                iconBg="bg-red-100"
              />
            </div>
          )}

          {/* Map */}
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden h-80">
            <LeafletMap
              center={currentPos ? [currentPos.lat, currentPos.lng] : [28.3949, 84.124]}
              zoom={currentPos ? 13 : 7}
              markers={markers}
              fitBounds={markers.length > 1}
            />
          </div>

          {/* Offline queue */}
          {offlineQueue.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-1">
                <WifiOff className="w-4 h-4" />
                {offlineQueue.length} SOS queued offline
              </h3>
              <p className="text-xs text-amber-600 mb-3">
                These alerts were saved while offline. They'll sync automatically when you reconnect.
              </p>
              <div className="space-y-2">
                {offlineQueue.map((q) => (
                  <div key={q.id} className="rounded-lg bg-white border border-amber-200 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">
                        {q.location_name ?? `${q.latitude.toFixed(3)}, ${q.longitude.toFixed(3)}`}
                      </div>
                      <div className="text-[11px] text-slate-400">{formatRelativeTime(q.created_at)}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase">
                      Queued
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Emergency Incidents */}
          {incidents.filter((i) => !['resolved', 'false_alarm'].includes(i.incident_status)).length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Siren className="w-4 h-4 text-red-500" />
                Active Emergency Incidents
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {incidents
                  .filter((i) => !['resolved', 'false_alarm'].includes(i.incident_status))
                  .slice(0, 10)
                  .map((inc) => (
                    <div key={inc.id} className="rounded-xl bg-red-50 border border-red-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {inc.location_name ?? `${inc.latitude.toFixed(2)}, ${inc.longitude.toFixed(2)}`}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 capitalize">
                            {inc.incident_type.replace(/_/g, ' ')} · Score: {inc.crash_score}%
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${getStatusColor(inc.incident_status)}`}>
                              {getStatusLabel(inc.incident_status)}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(inc.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Active Distress Signals */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Siren className="w-4 h-4 text-red-500" />
                Active Distress Signals
              </h3>
              {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
            </div>
            {alerts.filter((a) => a.status === 'active').length === 0 ? (
              <div className="py-8 text-center">
                <Shield className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No active distress signals. Everyone is safe for now.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {alerts
                  .filter((a) => a.status === 'active')
                  .map((a) => (
                    <div key={a.id} className="rounded-xl bg-red-50 border border-red-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <Siren className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {a.location_name ?? `${a.latitude.toFixed(2)}, ${a.longitude.toFixed(2)}`}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(a.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {a.responder_count} responder{a.responder_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {a.message && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{a.message}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Navigate
                        </a>
                        <button
                          onClick={() => incrementResponders(a)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          I'm responding
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Nearest Service Card Component =====
function NearestServiceCard({
  title,
  icon,
  service,
  bgClass,
  iconBg,
}: {
  title: string;
  icon: React.ReactNode;
  service: NearestService | null;
  bgClass: string;
  iconBg: string;
}) {
  if (!service) {
    return (
      <div className={`rounded-xl border p-3 ${bgClass}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
            {icon}
          </div>
          <span className="text-xs font-bold text-slate-700">{title}</span>
        </div>
        <p className="text-[11px] text-slate-400">No nearby service found</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <span className="text-xs font-bold text-slate-700">{title}</span>
      </div>
      <div className="text-sm font-semibold text-slate-900 truncate">{service.contact.name}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-slate-500">
          {isFinite(service.distanceKm) ? `${service.distanceKm.toFixed(1)} km away` : 'Distance unknown'}
        </span>
        <div className="flex gap-1">
          <a
            href={`sms:${service.contact.phone.replace(/[\s\-()]/g, '')}`}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white text-red-600 hover:bg-red-100 transition-all"
            title="Send SMS"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </a>
          <a
            href={`tel:${service.contact.phone.replace(/[\s\-()]/g, '')}`}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white text-blue-600 hover:bg-blue-100 transition-all"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
