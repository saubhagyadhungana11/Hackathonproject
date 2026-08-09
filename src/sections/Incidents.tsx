import { useEffect, useState, type FormEvent } from 'react';
import {
  Camera,
  MapPin,
  Loader2,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Crosshair,
  ImageIcon,
  Video,
  Trash2,
  X,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { reverseGeocode, formatRelativeTime } from '@/lib/api';
import type { Incident, IncidentType, Severity } from '@/types/database';
import LeafletMap from '@/components/LeafletMap';
import LocationSearch from '@/components/LocationSearch';
import SectionHeader from '@/components/SectionHeader';
import type { GeocodeResult } from '@/types/database';

const incidentTypes: { value: IncidentType; label: string; color: string }[] = [
  { value: 'flood', label: 'Flood', color: 'bg-blue-100 text-blue-700' },
  { value: 'landslide', label: 'Landslide', color: 'bg-amber-100 text-amber-700' },
  { value: 'earthquake', label: 'Earthquake', color: 'bg-purple-100 text-purple-700' },
  { value: 'fire', label: 'Fire', color: 'bg-red-100 text-red-700' },
  { value: 'roadblock', label: 'Road Blockage', color: 'bg-orange-100 text-orange-700' },
  { value: 'avalanche', label: 'Avalanche', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'rockfall', label: 'Rockfall', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'other', label: 'Other', color: 'bg-slate-100 text-slate-600' },
];

const severities: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' },
];

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // form state
  const [type, setType] = useState<IncidentType>('flood');
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  useEffect(() => {
    loadIncidents();
  }, []);

  async function loadIncidents() {
    setLoading(true);
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setIncidents((data as Incident[]) ?? []);
    setLoading(false);
  }

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, name });
        setLocating(false);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum 50MB.');
      return;
    }
    setMediaFile(file);
    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setError(null);
  }

  function clearMedia() {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  }

  function handleSelect(r: GeocodeResult) {
    setLocation({
      lat: r.latitude,
      lng: r.longitude,
      name: r.displayName.split(',').slice(0, 3).join(', '),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!location) {
      setError('Please set a location for this incident.');
      return;
    }
    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      let storedMediaType: string | null = null;
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('incident-media')
          .upload(fileName, mediaFile);
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from('incident-media').getPublicUrl(fileName).data.publicUrl;
        storedMediaType = mediaType;
      }
      const { error: insertError } = await supabase.from('incidents').insert({
        type,
        severity,
        description: description || null,
        latitude: location.lat,
        longitude: location.lng,
        location_name: location.name,
        media_url: mediaUrl,
        media_type: storedMediaType,
        status: 'active',
      });
      if (insertError) throw insertError;

      setSuccess(true);
      setDescription('');
      clearMedia();
      setLocation(null);
      loadIncidents();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit incident.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteIncident(id: string) {
    await supabase.from('incidents').delete().eq('id', id);
    loadIncidents();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Camera className="w-6 h-6 text-slate-900" />}
        title="Incident Reports"
        subtitle="Upload photos & videos of disasters or road conditions"
        accent="from-orange-500 to-red-500"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit form */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Report an Incident</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Incident Type</label>
              <div className="grid grid-cols-4 gap-2">
                {incidentTypes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all border ${
                      type === t.value
                        ? `${t.color} border-current`
                        : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Severity</label>
              <div className="grid grid-cols-4 gap-2">
                {severities.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all border ${
                      severity === s.value ? s.color : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <LocationSearch
                label="Incident location"
                placeholder="Search the location of incident..."
                onSelect={handleSelect}
                value={location?.name}
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-medium py-2 rounded-xl transition-all text-sm border border-slate-300"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                Use my current location
              </button>
              {location && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what's happening — road conditions, flood level, injuries, etc."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
              />
            </div>

            {/* Media upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Photo or Video</label>
              {mediaPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-300">
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} controls className="w-full max-h-48 object-cover" />
                  ) : (
                    <img src={mediaPreview} alt="preview" className="w-full max-h-48 object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-slate-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-500/50 bg-slate-50 py-6 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">Click to upload photo or video</span>
                  <span className="text-xs text-slate-500">Max 50MB</span>
                  <input type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
                </label>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">Incident reported successfully. Thank you.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !location}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-600/20"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              {submitting ? 'Submitting...' : 'Submit Incident Report'}
            </button>
          </form>
        </div>

        {/* Recent reports */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">Recent Reports</h2>
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-orange-600 animate-spin" />
              </div>
            ) : incidents.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No incidents reported yet.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {incidents.map((inc) => (
                  <div key={inc.id} className="rounded-xl bg-slate-50 p-3 group">
                    {inc.media_url && inc.media_type === 'image' && (
                      <img src={inc.media_url} alt={inc.type} className="w-full h-32 object-cover rounded-lg mb-2" />
                    )}
                    {inc.media_url && inc.media_type === 'video' && (
                      <video src={inc.media_url} controls className="w-full h-32 object-cover rounded-lg mb-2" />
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-900 capitalize">{inc.type}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                            inc.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : inc.severity === 'high'
                                ? 'bg-orange-100 text-orange-700'
                                : inc.severity === 'moderate'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(inc.created_at)}
                        </span>
                      </div>
                    </div>
                    {inc.description && (
                      <p className="text-xs text-slate-500 mt-1">{inc.description}</p>
                    )}
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {inc.location_name ?? `${inc.latitude.toFixed(2)}, ${inc.longitude.toFixed(2)}`}
                    </div>
                    {inc.media_url && (
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        {inc.media_type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                        {inc.media_type} attached
                      </div>
                    )}
                    <button
                      onClick={() => deleteIncident(inc.id)}
                      className="mt-2 text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Incident map */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden h-80">
        <LeafletMap
          center={[27.7172, 85.324]}
          zoom={7}
          markers={incidents.map((inc) => ({
            id: inc.id,
            position: [inc.latitude, inc.longitude],
            color:
              inc.severity === 'critical'
                ? 'red'
                : inc.severity === 'high'
                  ? 'orange'
                  : inc.severity === 'moderate'
                    ? 'yellow'
                    : 'green',
            icon: 'square',
            popup: `<b>${inc.type}</b><br/>${inc.location_name ?? ''}<br/>${inc.severity}`,
          }))}
          fitBounds={incidents.length > 0}
        />
      </div>
    </div>
  );
}
