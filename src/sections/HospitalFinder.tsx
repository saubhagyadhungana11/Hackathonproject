import { useEffect, useState, useRef } from 'react';
import {
  Cross,
  MapPin,
  Loader2,
  AlertTriangle,
  Crosshair,
  Clock,
  Navigation,
  Send,
  CheckCircle2,
  Activity,
  Camera,
  X,
  Stethoscope,
  Brain,
  Heart,
  Baby,
  Flame,
  Bone,
  Search,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { searchNearbyHospitals, reverseGeocode, haversineKm } from '@/lib/api';
import { matchCondition, getAllConditions, type ConditionMatch } from '@/lib/crashDetection';
import { supabase } from '@/lib/supabase';
import type { GeocodeResult, Severity, HospitalNotification, HospitalAlertPhoto } from '@/types/database';
import LeafletMap, { type MapMarker, type MarkerColor } from '@/components/LeafletMap';
import LocationSearch from '@/components/LocationSearch';
import SectionHeader from '@/components/SectionHeader';
import { useAuth } from '@/context/AuthContext';

interface NearbyHospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  etaMin: number;
  phone?: string;
  tags: string[];
  matchScore: number;
  matchReason: string;
}

interface UploadedPhoto {
  url: string;
  description: string;
  file?: File;
}

const KATHMANDU: [number, number] = [27.7172, 85.324];
const DRIVING_SPEED_KMH = 30;

// Facility type → icon mapping for the AI recommendation badge
const facilityIcons: Record<string, React.ReactNode> = {
  'Cardiac center': <Heart className="w-3.5 h-3.5" />,
  'Stroke center': <Brain className="w-3.5 h-3.5" />,
  'Trauma center': <Stethoscope className="w-3.5 h-3.5" />,
  'Orthopedic hospital': <Bone className="w-3.5 h-3.5" />,
  'Burn unit': <Flame className="w-3.5 h-3.5" />,
  'Maternity hospital': <Baby className="w-3.5 h-3.5" />,
  'General hospital': <Cross className="w-3.5 h-3.5" />,
};

export default function HospitalFinder() {
  const { profile } = useAuth();
  const [origin, setOrigin] = useState<{ lat: number; lng: number; name: string }>({
    lat: KATHMANDU[0],
    lng: KATHMANDU[1],
    name: 'Kathmandu, Nepal',
  });
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NearbyHospital | null>(null);
  const [severity, setSeverity] = useState<Severity>('high');
  const [condition, setCondition] = useState('');
  const [sending, setSending] = useState(false);
  const [sentNotif, setSentNotif] = useState<HospitalNotification | null>(null);
  const [notifications, setNotifications] = useState<HospitalNotification[]>([]);
  const [conditionMatch, setConditionMatch] = useState<ConditionMatch | null>(null);
  const [showConditionSuggestions, setShowConditionSuggestions] = useState(false);
  const [allConditions] = useState<string[]>(getAllConditions());
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [pastPhotos, setPastPhotos] = useState<HospitalAlertPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from('hospital_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setNotifications((data as HospitalNotification[]) ?? []));
    supabase
      .from('hospital_alert_photos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setPastPhotos((data as HospitalAlertPhoto[]) ?? []));
  }, []);

  // AI condition matching — runs as user types
  useEffect(() => {
    if (condition.trim().length >= 2) {
      const match = matchCondition(condition);
      setConditionMatch(match);
      const lower = condition.toLowerCase();
      setFilteredSuggestions(
        allConditions
          .filter((c) => c.includes(lower) || lower.includes(c))
          .slice(0, 6),
      );
    } else {
      setConditionMatch(null);
      setFilteredSuggestions([]);
    }
  }, [condition, allConditions]);

  function rankHospitals(
    found: { id: string; name: string; lat: number; lng: number; phone?: string }[],
    lat: number,
    lng: number,
    match: ConditionMatch | null,
  ): NearbyHospital[] {
    return found
      .map((h) => {
        const distanceKm = haversineKm({ lat, lng }, { lat: h.lat, lng: h.lng });

        // Derive tags from hospital name — OSM names often include specialty words
        const nameLower = h.name.toLowerCase();
        const tags: string[] = [];
        if (match) tags.push(...match.tags);
        if (/cardiac|heart|cardio/.test(nameLower)) tags.push('cardiac');
        if (/trauma|emergency|accident/.test(nameLower)) tags.push('trauma');
        if (/ortho|bone|fracture/.test(nameLower)) tags.push('ortho');
        if (/burn/.test(nameLower)) tags.push('burn');
        if (/matern|women|child|baby/.test(nameLower)) tags.push('maternity');
        if (/neuro|brain|stroke/.test(nameLower)) tags.push('neuro');
        if (/cancer|oncolog/.test(nameLower)) tags.push('oncology');
        if (/eye|ophthal/.test(nameLower)) tags.push('eye');
        if (/dental|dentist/.test(nameLower)) tags.push('dental');
        tags.push('emergency');

        // AI match score: proximity + condition tag overlap
        let matchScore = 100 - distanceKm * 2;
        let matchReason = 'Nearest facility';

        if (match) {
          const hospitalTagSet = new Set(tags);
          const overlap = match.tags.filter((t) => hospitalTagSet.has(t));
          if (overlap.length > 0) {
            matchScore += 40 + overlap.length * 10;
            matchReason = `Matches: ${overlap.join(', ')}`;
          } else {
            // Facility type hint in the reason even if no name overlap
            matchReason = `Recommended: ${match.recommendedFacilityType}`;
          }
        }

        // Penalize facilities that look like clinics for high-priority conditions
        if (match?.priority === 'high' && /clinic/.test(nameLower)) {
          matchScore -= 25;
        }

        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lng: h.lng,
          distanceKm,
          etaMin: (distanceKm / DRIVING_SPEED_KMH) * 60,
          phone: h.phone,
          tags: [...new Set(tags)],
          matchScore: Math.round(matchScore),
          matchReason,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }

  async function searchHospitals(lat: number, lng: number, name: string) {
    setLoading(true);
    setError(null);
    setOrigin({ lat, lng, name });
    try {
      const found = await searchNearbyHospitals(lat, lng, 8000);
      const results = rankHospitals(found, lat, lng, conditionMatch);
      setHospitals(results);
      if (results.length === 0) {
        setError('No hospitals or clinics found within 8 km of this location.');
      }
    } catch {
      setError('Could not reach hospital search servers. Please check your connection and try again.');
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        searchHospitals(pos.coords.latitude, pos.coords.longitude, name);
        setLocating(false);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleSelect(r: GeocodeResult) {
    searchHospitals(r.latitude, r.longitude, r.displayName.split(',').slice(0, 3).join(', '));
  }

  // ===== PHOTO UPLOAD =====
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploadingPhotos(true);
    const newPhotos: UploadedPhoto[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`Photo "${file.name}" is too large. Max 5 MB per photo.`);
        continue;
      }
      const url = URL.createObjectURL(file);
      newPhotos.push({ url, description: '', file });
    }
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 4));
    setUploadingPhotos(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  }

  function updatePhotoDescription(index: number, desc: string) {
    setPhotos((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description: desc };
      return updated;
    });
  }

  async function uploadPhotosToStorage(userId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const photo of photos) {
      if (!photo.file) {
        urls.push(photo.url);
        continue;
      }
      const ext = photo.file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('hospital-photos')
        .upload(fileName, photo.file, { contentType: photo.file.type });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('hospital-photos').getPublicUrl(fileName);
        urls.push(pub.publicUrl);
      }
    }
    return urls;
  }

  // ===== SEND NOTIFICATION =====
  async function sendNotification() {
    if (!selected || !profile) return;
    setSending(true);
    setError(null);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotosToStorage(profile.id) : [];

      const tags = conditionMatch?.tags ?? [];
      const insertData: Record<string, unknown> = {
        hospital_name: selected.name,
        hospital_lat: selected.lat,
        hospital_lng: selected.lng,
        patient_lat: origin.lat,
        patient_lng: origin.lng,
        severity,
        condition_description: condition || null,
        estimated_eta_min: Math.round(selected.etaMin),
        status: 'sent',
        condition_tags: tags.length > 0 ? tags.join(',') : null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        incident_type: conditionMatch ? conditionMatch.condition : null,
      };

      const { data, error: insertError } = await supabase
        .from('hospital_notifications')
        .insert(insertData)
        .select()
        .single();
      if (insertError) throw insertError;
      const notif = data as HospitalNotification;
      setSentNotif(notif);
      setNotifications((prev) => [notif, ...prev].slice(0, 10));

      // Save photo records
      if (photoUrls.length > 0) {
        const photoRecords = photoUrls.map((url, i) => ({
          user_id: profile.id,
          notification_id: notif.id,
          photo_url: url,
          photo_description: photos[i]?.description || null,
          condition_tags: tags.length > 0 ? tags.join(',') : null,
        }));
        await supabase.from('hospital_alert_photos').insert(photoRecords);
        // Refresh past photos
        supabase
          .from('hospital_alert_photos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
          .then(({ data: pd }) => setPastPhotos((pd as HospitalAlertPhoto[]) ?? []));
      }

      // Clean up local photo previews
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  }

  const markers: MapMarker[] = [
    {
      id: 'origin',
      position: [origin.lat, origin.lng],
      color: 'blue',
      icon: 'dot',
      popup: `<b>Your location</b><br/>${origin.name}`,
    },
    ...hospitals.map((h, i) => ({
      id: h.id,
      position: [h.lat, h.lng] as [number, number],
      color: (i === 0 ? 'green' : selected?.id === h.id ? 'cyan' : 'red') as MarkerColor,
      icon: 'pin' as const,
      popup: `<b>${h.name}</b><br/>${h.distanceKm.toFixed(1)} km · ~${Math.round(h.etaMin)} min<br/>${h.matchReason}`,
    })),
  ];

  const googleNavUrl = selected
    ? `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${selected.lat},${selected.lng}`
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Cross className="w-6 h-6 text-white" />}
        title="AI Hospital Finder"
        subtitle="Condition-based hospital matching with photo alerts"
        accent="from-rose-500 to-red-500"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: location + condition + hospital list */}
        <div className="space-y-4">
          {/* Location + Search */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <LocationSearch
              label="Your location"
              placeholder="Search your location..."
              onSelect={handleSelect}
              value={origin.name}
              icon={<MapPin className="w-4 h-4 text-blue-600" />}
            />
            <button
              onClick={useMyLocation}
              disabled={locating || loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-medium py-2 rounded-xl transition-all text-sm border border-slate-300"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              Use my current location
            </button>
            <button
              onClick={() => searchHospitals(origin.lat, origin.lng, origin.name)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-rose-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Find Matching Hospitals
            </button>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
          </div>

          {/* AI Condition Input */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-rose-500" />
              AI Condition Matching
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Describe the patient's condition. The AI matches it to the right type of facility and ranks hospitals accordingly.
            </p>

            <div className="relative">
              <textarea
                value={condition}
                onChange={(e) => {
                  setCondition(e.target.value);
                  setShowConditionSuggestions(true);
                }}
                onFocus={() => setShowConditionSuggestions(true)}
                onBlur={() => setTimeout(() => setShowConditionSuggestions(false), 200)}
                rows={2}
                placeholder="e.g. heart attack, head injury, burn, fracture..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all resize-none"
              />

              {/* Suggestion dropdown */}
              {showConditionSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-white border border-slate-200 shadow-lg max-h-44 overflow-y-auto">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      onMouseDown={() => {
                        setCondition(s);
                        setShowConditionSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 transition-all flex items-center gap-2"
                    >
                      <Sparkles className="w-3 h-3 text-rose-400 flex-shrink-0" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI match result */}
            {conditionMatch && (
              <div className="mt-3 rounded-xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 p-3 animate-slide-up">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    {facilityIcons[conditionMatch.recommendedFacilityType] ?? <Stethoscope className="w-4 h-4 text-rose-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900">
                      {conditionMatch.recommendedFacilityType}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        conditionMatch.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : conditionMatch.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {conditionMatch.priority} priority
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {conditionMatch.tags.length} match tags
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hospital list — AI ranked */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-rose-500" />
              {conditionMatch ? 'AI-Ranked Hospitals' : 'Nearest Hospitals'}
            </h3>
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
              </div>
            ) : hospitals.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                Search a location to find nearby hospitals.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {hospitals.map((h, i) => (
                  <button
                    key={h.id}
                    onClick={() => { setSelected(h); setSentNotif(null); }}
                    className={`w-full text-left rounded-xl p-3 transition-all border ${
                      selected?.id === h.id
                        ? 'bg-rose-100 border-rose-300'
                        : i === 0 && conditionMatch
                          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-50 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        i === 0 && conditionMatch
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{h.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {h.distanceKm.toFixed(1)} km
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{Math.round(h.etaMin)} min
                          </span>
                        </div>
                        {conditionMatch && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Sparkles className="w-3 h-3 text-rose-400 flex-shrink-0" />
                            <span className="text-[11px] text-slate-500 truncate">{h.matchReason}</span>
                            <span className="text-[10px] font-bold text-rose-500 ml-auto flex-shrink-0">
                              {h.matchScore}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: map + photo upload + alert panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden h-72 sm:h-80">
            <LeafletMap
              center={[origin.lat, origin.lng]}
              zoom={13}
              markers={markers}
              fitBounds={hospitals.length > 0}
            />
          </div>

          {/* Photo Upload Section */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-rose-500" />
              Upload Patient Photos
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Send photos of injuries or visible symptoms so the hospital can prepare the right treatment before you arrive.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {/* Photo grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={photo.url}
                      alt={`Patient photo ${i + 1}`}
                      className="w-full h-24 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      value={photo.description}
                      onChange={(e) => updatePhotoDescription(i, e.target.value)}
                      placeholder="Add description..."
                      className="w-full text-[10px] text-slate-600 px-2 py-1 border-t border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhotos || photos.length >= 4}
              className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 font-medium py-3 rounded-xl transition-all text-sm border-2 border-dashed border-slate-300"
            >
              {uploadingPhotos ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : photos.length >= 4 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {photos.length >= 4 ? 'Max 4 photos selected' : `Upload photos (${photos.length}/4)`}
            </button>
          </div>

          {/* Notify hospital panel */}
          {selected && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 animate-slide-up">
              {sentNotif ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Hospital Notified</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {selected.name} has been alerted and is preparing to receive a{' '}
                    <span className="font-semibold text-slate-900 capitalize">{severity}</span> severity patient.
                    ETA ~{Math.round(selected.etaMin)} minutes.
                  </p>
                  {sentNotif.condition_tags && (
                    <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                      {sentNotif.condition_tags.split(',').map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-semibold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {sentNotif.photo_urls && sentNotif.photo_urls.length > 0 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        {sentNotif.photo_urls.length} photo{sentNotif.photo_urls.length !== 1 ? 's' : ''} sent to hospital
                      </span>
                    </div>
                  )}
                  {googleNavUrl && (
                    <a
                      href={googleNavUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition-all text-sm"
                    >
                      <Navigation className="w-4 h-4" />
                      Navigate to hospital
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <Send className="w-4 h-4 text-rose-600" />
                    Notify {selected.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    The hospital will be alerted to prepare based on severity, condition, and photos you provide.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        Patient Condition Severity
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['low', 'moderate', 'high', 'critical'] as Severity[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSeverity(s)}
                            className={`py-2 rounded-lg text-xs font-semibold capitalize transition-all border ${
                              severity === s
                                ? s === 'critical'
                                  ? 'bg-red-100 border-red-300 text-red-700'
                                  : s === 'high'
                                    ? 'bg-orange-100 border-orange-300 text-orange-700'
                                    : s === 'moderate'
                                      ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                      : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {conditionMatch && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                          {facilityIcons[conditionMatch.recommendedFacilityType] ?? <Stethoscope className="w-4 h-4 text-rose-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-700">
                            AI recommends: {conditionMatch.recommendedFacilityType}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {conditionMatch.priority} priority — hospital will prepare accordingly
                          </div>
                        </div>
                      </div>
                    )}

                    {photos.length > 0 && (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center gap-2">
                        <Camera className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs text-blue-700 font-semibold">
                          {photos.length} photo{photos.length !== 1 ? 's' : ''} will be sent with this alert
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-4 h-4" />
                        Estimated arrival: <span className="text-slate-900 font-semibold">~{Math.round(selected.etaMin)} min</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="w-4 h-4" />
                        {selected.distanceKm.toFixed(1)} km away
                      </div>
                    </div>

                    <button
                      onClick={sendNotification}
                      disabled={sending}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-rose-600/20"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      {sending ? 'Sending alert...' : `Alert ${selected.name}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Past notifications with photos */}
          {notifications.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Recent Hospital Alerts
              </h3>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className="rounded-xl bg-slate-50 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                      <Cross className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{n.hospital_name}</div>
                      <div className="text-xs text-slate-500 capitalize flex items-center gap-2">
                        {n.severity} · ETA {n.estimated_eta_min} min
                        {n.photo_urls && n.photo_urls.length > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-500">
                            <ImageIcon className="w-3 h-3" />
                            {n.photo_urls.length}
                          </span>
                        )}
                      </div>
                      {n.condition_tags && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {n.condition_tags.split(',').slice(0, 4).map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 font-semibold">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-600 font-semibold uppercase">
                      {n.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past photos gallery */}
          {pastPhotos.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-500" />
                Photo History
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {pastPhotos.slice(0, 10).map((p) => (
                  <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200">
                    <img
                      src={p.photo_url}
                      alt={p.photo_description ?? 'Patient photo'}
                      className="w-full h-20 object-cover"
                    />
                    {p.photo_description && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                        <span className="text-[9px] text-white text-center leading-tight">{p.photo_description}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
