import { useEffect, useState } from 'react';
import {
  Navigation,
  MapPin,
  Loader2,
  AlertTriangle,
  Clock,
  Route,
  Crosshair,
  Shield,
  Zap,
  ExternalLink,
  Siren,
} from 'lucide-react';
import {
  fetchRoute,
  fetchRoadHazards,
  fetchWeatherHazards,
  reverseGeocode,
  haversineKm,
  formatRelativeTime,
  type RouteInfo,
  type HazardAlongRoute,
} from '@/lib/api';
import type { GeocodeResult, Incident } from '@/types/database';
import { supabase } from '@/lib/supabase';
import LeafletMap, { type MapMarker, type MapRoute } from '@/components/LeafletMap';
import LocationSearch from '@/components/LocationSearch';
import SectionHeader from '@/components/SectionHeader';

const KATHMANDU: [number, number] = [27.7172, 85.324];

export default function NavigationSection() {
  const [from, setFrom] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [to, setTo] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    supabase
      .from('incidents')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setIncidents((data as Incident[]) ?? []));

    // Live subscription: new or updated incidents appear without re-fetching.
    const channel = supabase
      .channel('incidents-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((i) => i.id !== (payload.old as Incident).id);
            }
            const updated = payload.new as Incident;
            const exists = prev.find((i) => i.id === updated.id);
            if (exists) return prev.map((i) => (i.id === updated.id ? updated : i));
            return [updated, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude, name });
        setLocating(false);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function calculateRoute() {
    if (!from || !to) {
      setError('Please set both your location and destination.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetchRoute(from, to);

      // 1. User-reported incidents (live, realtime-subscribed).
      // Only show incidents that are near the route road (within 1.5 km of any
      // route point) OR within the destination area (within 2 km of destination).
      const incidentHazards: HazardAlongRoute[] = [];
      for (const inc of incidents) {
        const incPos = { lat: inc.latitude, lng: inc.longitude };
        const destDist = haversineKm(incPos, to);
        let nearRoute = false;
        for (const point of r.geometry) {
          if (haversineKm(incPos, { lat: point[0], lng: point[1] }) < 1.5) {
            nearRoute = true;
            break;
          }
        }
        if (!nearRoute && destDist >= 2) continue;
        const offsetKm = haversineKm(from, incPos);
        incidentHazards.push({
          latitude: inc.latitude,
          longitude: inc.longitude,
          type: inc.type,
          severity: inc.severity,
          description: inc.description ?? inc.type,
          offsetKm,
          source: 'incident',
        });
      }

      // 2. Live road hazards from OpenStreetMap (closures, construction, barriers, landslide/flood zones).
      // 3. Live weather hazards along the route (heavy rain, storms, fog, high winds).
      const [osmHazards, weatherHazards] = await Promise.all([
        fetchRoadHazards(r.geometry, from, to).catch(() => [] as HazardAlongRoute[]),
        fetchWeatherHazards(r.geometry, from, to).catch(() => [] as HazardAlongRoute[]),
      ]);

      const all = [...incidentHazards, ...osmHazards, ...weatherHazards].sort(
        (a, b) => a.offsetKm - b.offsetKm,
      );
      setRoute({ ...r, hazardPoints: all });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate route.');
    } finally {
      setLoading(false);
    }
  }

  const handleFromSelect = (r: GeocodeResult) =>
    setFrom({ lat: r.latitude, lng: r.longitude, name: r.displayName.split(',').slice(0, 3).join(', ') });
  const handleToSelect = (r: GeocodeResult) =>
    setTo({ lat: r.latitude, lng: r.longitude, name: r.displayName.split(',').slice(0, 3).join(', ') });

  // Build map markers + routes
  const markers: MapMarker[] = [];
  if (from) {
    markers.push({
      id: 'from',
      position: [from.lat, from.lng],
      color: 'blue',
      icon: 'dot',
      popup: `<b>Start</b><br/>${from.name}`,
    });
  }
  if (to) {
    markers.push({
      id: 'to',
      position: [to.lat, to.lng],
      color: 'green',
      icon: 'pin',
      popup: `<b>Destination</b><br/>${to.name}`,
    });
  }
  if (route) {
    route.hazardPoints.forEach((h, i) => {
      markers.push({
        id: `hazard-${i}`,
        position: [h.latitude, h.longitude],
        color: h.severity === 'critical' || h.severity === 'high' ? 'red' : 'orange',
        icon: 'square',
        popup: `<b>${h.type}</b><br/>${h.description}<br/>${h.severity} severity`,
      });
    });
  }
  const routes: MapRoute[] = [];
  if (route) {
    routes.push({ id: 'route', positions: route.geometry, color: '#22c55e', weight: 6 });
  }

  const googleMapsUrl = from && to
    ? `https://www.google.com/maps/dir/${from.lat},${from.lng}/${to.lat},${to.lng}`
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Navigation className="w-6 h-6 text-white" />}
        title="Live Map Navigation"
        subtitle="Safest & quickest routes with live hazard detection"
        accent="from-blue-500 to-indigo-500"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
            <LocationSearch
              label="From (your location)"
              placeholder="Search starting point..."
              onSelect={handleFromSelect}
              value={from?.name}
              icon={<MapPin className="w-4 h-4 text-blue-500" />}
            />
            <button
              onClick={useMyLocation}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-medium py-2 rounded-xl transition-all text-sm border border-slate-200"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              Use my current location
            </button>
            <LocationSearch
              label="To (destination)"
              placeholder="Search destination..."
              onSelect={handleToSelect}
              value={to?.name}
              icon={<MapPin className="w-4 h-4 text-green-500" />}
            />
            <button
              onClick={calculateRoute}
              disabled={loading || !from || !to}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Route className="w-5 h-5" />}
              {loading ? 'Calculating...' : 'Find Safest Route'}
            </button>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
          </div>

          {/* Route summary */}
          {route && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 animate-slide-up shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Route className="w-4 h-4 text-blue-600" />
                Route Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 flex items-center gap-2">
                    <Route className="w-4 h-4 text-slate-400" /> Distance
                  </span>
                  <span className="text-lg font-bold text-slate-900">{route.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> Est. time
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {Math.floor(route.durationMin)} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400" /> Hazards on route
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      route.hazardPoints.length > 0 ? 'text-orange-600' : 'text-emerald-600'
                    }`}
                  >
                    {route.hazardPoints.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1"><Siren className="w-3 h-3" /> Reported</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Map data</span>
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Weather</span>
                </div>
              </div>

              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-all text-sm border border-slate-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Google Maps
                </a>
              )}
            </div>
          )}

          {/* Hazards list */}
          {route && route.hazardPoints.length > 0 && (
            <div className="rounded-2xl bg-orange-50 border border-orange-200 p-5 animate-slide-up">
              <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Live Hazards Along Route
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {route.hazardPoints
                  .sort((a, b) => a.offsetKm - b.offsetKm)
                  .map((h, i) => (
                    <div key={i} className="rounded-lg bg-white border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900 capitalize">{h.type}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                            h.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : h.severity === 'high'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {h.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{h.description}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{h.offsetKm.toFixed(1)} km from start</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {route && route.hazardPoints.length === 0 && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 animate-slide-up">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-800">Route is clear</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                No hazards detected along this route from live reports, map data, or weather.
              </p>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden h-[500px] sm:h-[600px] shadow-sm">
            <LeafletMap
              center={from ? [from.lat, from.lng] : KATHMANDU}
              zoom={13}
              markers={markers}
              routes={routes}
              fitBounds={!!route}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500" /> Your location
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-green-500" /> Destination
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-orange-500" /> Hazard
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-blue-500" /> Routes via OSRM · hazards from live incident data
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
