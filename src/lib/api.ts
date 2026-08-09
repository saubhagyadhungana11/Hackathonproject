import type { GeocodeResult, WeatherData } from '@/types/database';

const GEOCODING_USER = 'nepal-disaster-management';

// Search any location across Nepal (and beyond) via OpenStreetMap Nominatim.
export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '8',
    addressdetails: '1',
    'accept-language': 'en',
  });
  // Scope to Nepal with viewbox for relevance, but allow global fallback if query is specific.
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': GEOCODING_USER },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return (data as any[]).map((r) => ({
    displayName: r.display_name as string,
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    raw: {
      place_id: r.place_id,
      type: r.type,
      address: r.address,
    },
  }));
}

// Reverse geocode coordinates into a readable place name.
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'json',
    'accept-language': 'en',
  });
  const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': GEOCODING_USER } });
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    return (data.display_name as string) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// Fetch live weather from Open-Meteo (free, no key required).
export async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'visibility',
    ].join(','),
    timezone: 'auto',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const data = await res.json();
  const c = data.current;
  const code = c.weather_code as number;
  return {
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    weatherCode: code,
    description: weatherCodeToText(code),
    icon: weatherCodeToIcon(code, c.is_day === 1),
    precipitation: c.precipitation,
    cloudCover: c.cloud_cover,
    visibility: c.visibility,
    pressure: c.pressure_msl,
    isDay: c.is_day === 1,
  };
}

export function weatherCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return map[code] ?? 'Unknown';
}

export function weatherCodeToIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? 'sun' : 'moon';
  if (code <= 2) return isDay ? 'sun-cloud' : 'moon-cloud';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return 'cloud';
}

// Overpass API: search for all hospitals/clinics within a radius (metres) of a point.
export interface OverpassHospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  phone?: string;
}

export async function searchNearbyHospitals(
  lat: number,
  lng: number,
  radiusM = 8000,
): Promise<OverpassHospital[]> {
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"="hospital"](around:${radiusM},${lat},${lng});
      way["amenity"="hospital"](around:${radiusM},${lat},${lng});
      node["amenity"="clinic"](around:${radiusM},${lat},${lng});
      way["amenity"="clinic"](around:${radiusM},${lat},${lng});
      node["healthcare"="hospital"](around:${radiusM},${lat},${lng});
      way["healthcare"="hospital"](around:${radiusM},${lat},${lng});
      node["healthcare"="clinic"](around:${radiusM},${lat},${lng});
      way["healthcare"="clinic"](around:${radiusM},${lat},${lng});
    );
    out center tags;
  `;
  const body = 'data=' + encodeURIComponent(query);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 429 || res.status === 504) {
        lastError = new Error(`Overpass rate limited (${res.status})`);
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`Overpass query failed (${res.status})`);
        continue;
      }
      const data = await res.json();
      return (data.elements as any[])
        .map((el) => {
          const eLat = el.lat ?? el.center?.lat;
          const eLng = el.lon ?? el.center?.lon;
          if (eLat == null || eLng == null) return null;
          return {
            id: `${el.type}/${el.id}`,
            name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed facility',
            lat: eLat,
            lng: eLng,
            phone: el.tags?.phone || el.tags?.['contact:phone'],
          } as OverpassHospital;
        })
        .filter((h): h is OverpassHospital => h !== null);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Overpass request failed');
      continue;
    }
  }
  throw lastError ?? new Error('All Overpass servers are unavailable. Please try again.');
}

// OSRM public routing server — driving routes with geometry + duration.
export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
  hazardPoints: HazardAlongRoute[];
}

export interface HazardAlongRoute {
  latitude: number;
  longitude: number;
  type: string;
  severity: string;
  description: string;
  offsetKm: number;
  source: 'incident' | 'osm' | 'weather';
}

export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteInfo> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found between these points.');
  }
  const route = data.routes[0];
  const geometry: [number, number][] = route.geometry.coordinates.map(
    (c: [number, number]) => [c[1], c[0]],
  );
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry,
    hazardPoints: [],
  };
}

// Fetch road-related hazards from OpenStreetMap near a route, using Overpass.
// These come from map data — road closures, construction, barriers, fords,
// landslide/flood-prone areas — independent of any user report.
export async function fetchRoadHazards(
  geometry: [number, number][],
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<HazardAlongRoute[]> {
  // Compute a bounding box around the route for the Overpass query.
  const lats = geometry.map((p) => p[0]);
  const lngs = geometry.map((p) => p[1]);
  lats.push(from.lat, to.lat);
  lngs.push(from.lng, to.lng);
  const minLat = Math.min(...lats) - 0.02;
  const maxLat = Math.max(...lats) + 0.02;
  const minLng = Math.min(...lngs) - 0.02;
  const maxLng = Math.max(...lngs) + 0.02;

  const query = `
    [out:json][timeout:20];
    (
      way["highway"]["access"="no"](${minLat},${minLng},${maxLat},${maxLng});
      way["highway"]["construction"](${minLat},${minLng},${maxLat},${maxLng});
      way["highway"]["disused"="yes"](${minLat},${minLng},${maxLat},${maxLng});
      way["barrier"](${minLat},${minLng},${maxLat},${maxLng});
      node["barrier"](${minLat},${minLng},${maxLat},${maxLng});
      way["natural"="landslide"](${minLat},${minLng},${maxLat},${maxLng});
      node["natural"="landslide"](${minLat},${minLng},${maxLat},${maxLng});
      way["hazard"~"flood|landslide|rockfall|avalanche"](${minLat},${minLng},${maxLat},${maxLng});
      node["hazard"~"flood|landslide|rockfall|avalanche"](${minLat},${minLng},${maxLat},${maxLng});
      way["flood_prone"="yes"](${minLat},${minLng},${maxLat},${maxLng});
      way["waterway"="river"]["flood_prone"="yes"](${minLat},${minLng},${maxLat},${maxLng});
      way["highway"]["tunnel"]["indoor"="yes"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out center tags;
  `;
  const body = 'data=' + encodeURIComponent(query);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 429 || res.status === 504 || !res.ok) continue;
      const data = await res.json();
      return mapOsmHazards(data.elements as any[], geometry, to);
    } catch {
      continue;
    }
  }
  return [];
}

function mapOsmHazards(
  elements: any[],
  geometry: [number, number][],
  to: { lat: number; lng: number },
): HazardAlongRoute[] {
  const DEST_RADIUS_KM = 2;
  const ROUTE_RADIUS_KM = 1.5;
  const hazards: HazardAlongRoute[] = [];
  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (elLat == null || elLng == null) continue;

    const tags = el.tags || {};
    let type = 'road hazard';
    let description = '';
    let severity: string = 'moderate';

    if (tags.access === 'no') {
      type = 'road closed';
      description = tags.description || tags.name || 'Road is closed to access';
      severity = 'critical';
    } else if (tags.construction) {
      type = 'road construction';
      description = tags.construction === 'construction' ? 'Road under construction' : `Construction: ${tags.construction}`;
      severity = 'high';
    } else if (tags.disused === 'yes') {
      type = 'disused road';
      description = 'Road is disused / out of service';
      severity = 'high';
    } else if (tags.natural === 'landslide') {
      type = 'landslide area';
      description = tags.description || 'Mapped landslide area';
      severity = 'critical';
    } else if (tags.hazard) {
      type = `${tags.hazard} hazard`;
      description = tags.description || `Known ${tags.hazard} hazard zone`;
      severity = 'high';
    } else if (tags.flood_prone === 'yes') {
      type = 'flood-prone road';
      description = tags.description || 'Road prone to flooding';
      severity = 'high';
    } else if (tags.barrier) {
      type = 'barrier';
      description = tags.description || `Barrier: ${tags.barrier}`;
      severity = tags.barrier === 'gate' || tags.barrier === 'bollard' ? 'moderate' : 'high';
    } else {
      description = tags.description || tags.name || 'Potential road obstruction';
    }

    // Include if within 1.5 km of any route point (near the road) OR
    // within 2 km of the destination (at the destination area).
    let minDist = Infinity;
    let offsetKm = 0;
    for (const point of geometry) {
      const d = haversineKm({ lat: elLat, lng: elLng }, { lat: point[0], lng: point[1] });
      if (d < minDist) {
        minDist = d;
        offsetKm = d;
      }
    }
    const destDist = haversineKm({ lat: elLat, lng: elLng }, to);
    if (minDist < ROUTE_RADIUS_KM || destDist < DEST_RADIUS_KM) {
      hazards.push({
        latitude: elLat,
        longitude: elLng,
        type,
        severity,
        description,
        offsetKm,
        source: 'osm',
      });
    }
  }
  // Deduplicate by approximate location.
  const seen: HazardAlongRoute[] = [];
  for (const h of hazards) {
    const dup = seen.find(
      (s) => haversineKm(s, h) < 0.05 && s.type === h.type,
    );
    if (!dup) seen.push(h);
  }
  return seen;
}

// Fetch weather conditions at points along a route and flag hazards.
// Uses Open-Meteo (free, no key). Samples up to 5 evenly spaced points.
export async function fetchWeatherHazards(
  geometry: [number, number][],
  from: { lat: number; lng: number },
  to?: { lat: number; lng: number },
): Promise<HazardAlongRoute[]> {
  if (geometry.length === 0) return [];
  const sampleCount = Math.min(5, geometry.length);
  const step = Math.max(1, Math.floor(geometry.length / sampleCount));
  const samplePoints: { lat: number; lng: number; offsetKm: number }[] = [];
  let cumulativeKm = 0;
  let prev: { lat: number; lng: number } | null = null;
  for (let i = 0; i < geometry.length; i += step) {
    const pt = geometry[i];
    if (prev) cumulativeKm += haversineKm(prev, { lat: pt[0], lng: pt[1] });
    samplePoints.push({ lat: pt[0], lng: pt[1], offsetKm: cumulativeKm });
    prev = { lat: pt[0], lng: pt[1] };
  }
  // Always sample weather at the destination so hazards there are detected.
  if (to) {
    const last = geometry[geometry.length - 1];
    const destOffset = cumulativeKm + haversineKm(
      { lat: last[0], lng: last[1] },
      to,
    );
    samplePoints.push({ lat: to.lat, lng: to.lng, offsetKm: destOffset });
  }

  const hazards: HazardAlongRoute[] = [];
  for (const sp of samplePoints) {
    try {
      const params = new URLSearchParams({
        latitude: sp.lat.toFixed(4),
        longitude: sp.lng.toFixed(4),
        current: ['weather_code', 'wind_speed_10m', 'precipitation', 'visibility'].join(','),
        timezone: 'auto',
      });
      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const c = data.current;
      const code = c.weather_code as number;
      const wind = c.wind_speed_10m as number;
      const precip = c.precipitation as number;
      const vis = c.visibility as number;

      let type = '';
      let description = '';
      let severity = '';

      if (code >= 95) {
        type = 'thunderstorm';
        description = 'Active thunderstorm with possible hail — dangerous driving conditions';
        severity = 'critical';
      } else if (code === 65 || code === 82) {
        type = 'heavy rain';
        description = 'Heavy rain — reduced visibility and slippery roads';
        severity = 'high';
      } else if (code >= 61 && code <= 67) {
        type = 'rain';
        description = 'Rainfall affecting road conditions';
        severity = 'moderate';
      } else if (code === 45 || code === 48) {
        type = 'fog';
        description = 'Fog — severely reduced visibility';
        severity = vis < 1000 ? 'critical' : 'high';
      } else if (code >= 71 && code <= 77) {
        type = 'snow';
        description = 'Snow on roadway — slippery conditions';
        severity = 'high';
      }

      // High winds even with clear sky.
      if (wind > 50) {
        if (!type) {
          type = 'high winds';
          description = `Wind speed ${Math.round(wind)} km/h — hazardous for vehicles`;
          severity = wind > 75 ? 'critical' : 'high';
        } else {
          description += `; wind ${Math.round(wind)} km/h`;
          severity = wind > 75 ? 'critical' : severity;
        }
      }

      // Heavy precipitation even if weather code is generic.
      if (precip > 5 && !type) {
        type = 'heavy precipitation';
        description = `Precipitation rate ${precip} mm — hazardous driving`;
        severity = 'high';
      }

      if (type) {
        hazards.push({
          latitude: sp.lat,
          longitude: sp.lng,
          type,
          severity,
          description,
          offsetKm: sp.offsetKm,
          source: 'weather',
        });
      }
    } catch {
      continue;
    }
  }
  return hazards;
}

// Haversine distance in km.
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

// ===== OFFLINE EMERGENCY CONTACT CACHE =====
// Contacts are cached in localStorage so the SOS system can find the nearest
// authority even with no internet connection. GPS works offline, and the
// cached contacts provide the phone numbers for SMS/call via cellular network.

const CONTACTS_CACHE_KEY = 'emergency_contacts_cache';
const CONTACTS_CACHE_TIME_KEY = 'emergency_contacts_cache_time';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedEmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  is_official: boolean;
}

export function cacheEmergencyContacts(contacts: CachedEmergencyContact[]): void {
  try {
    localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(contacts));
    localStorage.setItem(CONTACTS_CACHE_TIME_KEY, Date.now().toString());
  } catch {
    // localStorage may be unavailable in private browsing — silently ignore.
  }
}

export function getCachedEmergencyContacts(): CachedEmergencyContact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CachedEmergencyContact[];
  } catch {
    return [];
  }
}

export function isContactsCacheFresh(): boolean {
  try {
    const time = localStorage.getItem(CONTACTS_CACHE_TIME_KEY);
    if (!time) return false;
    return Date.now() - parseInt(time, 10) < ONE_WEEK_MS;
  } catch {
    return false;
  }
}

// Find the nearest emergency contact to a given position.
// Optionally filter by role (e.g. 'Police', 'Ambulance', 'Hospital', 'Rescue', 'Disaster Authority').
// Falls back to national hotlines (no coordinates) if no geo-located contacts are found.
export function findNearestContact(
  contacts: CachedEmergencyContact[],
  lat: number,
  lng: number,
  roleFilter?: string,
): { contact: CachedEmergencyContact; distanceKm: number } | null {
  const pool = roleFilter
    ? contacts.filter((c) => c.role === roleFilter)
    : contacts;

  if (pool.length === 0) return null;

  const withCoords = pool.filter((c) => c.latitude != null && c.longitude != null);
  const withoutCoords = pool.filter((c) => c.latitude == null || c.longitude == null);

  let nearest: { contact: CachedEmergencyContact; distanceKm: number } | null = null;

  for (const c of withCoords) {
    const d = haversineKm({ lat, lng }, { lat: c.latitude!, lng: c.longitude! });
    if (!nearest || d < nearest.distanceKm) {
      nearest = { contact: c, distanceKm: d };
    }
  }

  // If we found a geo-located contact, return it.
  if (nearest) return nearest;

  // Fallback: return the first contact without coordinates (national hotline).
  if (withoutCoords.length > 0) {
    return { contact: withoutCoords[0], distanceKm: Infinity };
  }

  return null;
}

// Build an SMS URI for emergency SOS. Uses the sms: protocol which opens the
// phone's native messaging app pre-filled with the number and body. This works
// over the cellular network — no WiFi or internet required.
export function buildEmergencySmsUri(
  phone: string,
  message: string,
): string {
  // Clean the phone number (remove spaces, dashes, parentheses).
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  const body = encodeURIComponent(message);
  // Use ; for iOS and ? for Android — most modern browsers handle both,
  // but ?body= is the more widely supported form.
  return `sms:${cleanPhone}?&body=${body}`;
}

// Build the emergency SMS message body with location info.
export function buildEmergencyMessage(opts: {
  username?: string;
  lat: number;
  lng: number;
  locationName?: string;
  nearestContact?: CachedEmergencyContact;
  distanceKm?: number;
}): string {
  const name = opts.username || 'Unknown';
  const { lat, lng } = opts;
  const mapsLink = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
  const lines = [
    'EMERGENCY SOS',
    `From: ${name}`,
    `Location: ${lat.toFixed(5)},${lng.toFixed(5)}`,
  ];
  if (opts.locationName) {
    lines.push(`Area: ${opts.locationName}`);
  }
  if (opts.nearestContact) {
    lines.push(`Nearest authority: ${opts.nearestContact.name} (${opts.nearestContact.role})`);
    if (opts.distanceKm != null && isFinite(opts.distanceKm)) {
      lines.push(`Distance: ${opts.distanceKm.toFixed(1)} km`);
    }
  }
  lines.push(`Map: ${mapsLink}`);
  lines.push('Send help immediately.');
  return lines.join('\n');
}

// ===== OFFLINE SOS QUEUE =====
// When an SOS is triggered with no internet, it's saved locally and synced
// to the database once connectivity returns.

const SOS_QUEUE_KEY = 'offline_sos_queue';

export interface OfflineSosAlert {
  id: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  severity: string;
  message: string | null;
  created_at: string;
  synced: boolean;
}

export function queueOfflineSos(alert: Omit<OfflineSosAlert, 'id' | 'synced'>): OfflineSosAlert {
  const queued: OfflineSosAlert = {
    ...alert,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    synced: false,
  };
  try {
    const existing = getOfflineSosQueue();
    existing.push(queued);
    localStorage.setItem(SOS_QUEUE_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
  return queued;
}

export function getOfflineSosQueue(): OfflineSosAlert[] {
  try {
    const raw = localStorage.getItem(SOS_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineSosAlert[];
  } catch {
    return [];
  }
}

export function removeOfflineSos(id: string): void {
  try {
    const existing = getOfflineSosQueue().filter((s) => s.id !== id);
    localStorage.setItem(SOS_QUEUE_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}
