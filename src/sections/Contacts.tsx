import { useEffect, useState, type FormEvent } from 'react';
import {
  Phone,
  MapPin,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  Shield,
  Cross,
  Siren,
  Users,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EmergencyContact } from '@/types/database';
import SectionHeader from '@/components/SectionHeader';
import { useAuth } from '@/context/AuthContext';

const roleIcons: Record<string, React.ReactNode> = {
  Police: <Shield className="w-5 h-5" />,
  Ambulance: <Siren className="w-5 h-5" />,
  Hospital: <Cross className="w-5 h-5" />,
  Rescue: <Users className="w-5 h-5" />,
  'Disaster Authority': <AlertTriangle className="w-5 h-5" />,
};

const roleColors: Record<string, string> = {
  Police: 'from-blue-500 to-indigo-500',
  Ambulance: 'from-rose-500 to-red-500',
  Hospital: 'from-red-500 to-orange-500',
  Rescue: 'from-emerald-500 to-teal-500',
  'Disaster Authority': 'from-amber-500 to-orange-500',
};

export default function Contacts() {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // form
  const [name, setName] = useState('');
  const [role, setRole] = useState('Police');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);
    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .order('is_official', { ascending: false })
      .order('name', { ascending: true });
    setContacts((data as EmergencyContact[]) ?? []);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !phone || !role) {
      setError('Name, role, and phone are required.');
      return;
    }
    try {
      const { error: insertError } = await supabase.from('emergency_contacts').insert({
        name,
        role,
        phone,
        region: region || null,
        is_official: false,
      });
      if (insertError) throw insertError;
      setName('');
      setPhone('');
      setRegion('');
      setShowForm(false);
      setSuccess(true);
      loadContacts();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact.');
    }
  }

  async function deleteContact(id: string, isOfficial: boolean) {
    if (isOfficial) return;
    await supabase.from('emergency_contacts').delete().eq('id', id);
    loadContacts();
  }

  const filtered = contacts.filter((c) => {
    if (filter !== 'all' && c.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.region ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = ['all', ...Array.from(new Set(contacts.map((c) => c.role)))];

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Phone className="w-6 h-6 text-white" />}
        title="Emergency Contacts"
        subtitle="Hotlines, hospitals, and rescue services across Nepal"
        accent="from-blue-500 to-cyan-500"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        }
      />

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5 animate-slide-up shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4">Add Emergency Contact</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Local Police Station"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              >
                <option>Police</option>
                <option>Ambulance</option>
                <option>Hospital</option>
                <option>Rescue</option>
                <option>Disaster Authority</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Region (optional)</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Kathmandu, Pokhara"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Save Contact
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-900 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
            {error && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-700">Contact added successfully.</span>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or region..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all capitalize ${
                filter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts grid */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 py-12 text-center">No contacts found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl bg-white border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                    roleColors[c.role] ?? 'from-slate-500 to-slate-600'
                  } flex items-center justify-center text-white shadow-lg flex-shrink-0`}
                >
                  {roleIcons[c.role] ?? <Phone className="w-5 h-5" />}
                </div>
                {c.is_official && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold uppercase">
                    Official
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900 truncate">{c.name}</h3>
              <div className="text-xs text-slate-500 mt-0.5">{c.role}</div>
              {c.region && (
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {c.region}
                </div>
              )}
              <a
                href={`tel:${c.phone}`}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-semibold py-2.5 rounded-xl transition-all text-sm group-hover:bg-blue-600 group-hover:text-white"
              >
                <Phone className="w-4 h-4" />
                {c.phone}
              </a>
              {!c.is_official && (
                <button
                  onClick={() => deleteContact(c.id, c.is_official)}
                  className="mt-2 w-full text-[11px] text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
