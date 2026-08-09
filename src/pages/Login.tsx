import { useState, type FormEvent } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  CloudRain,
  MapPin,
  Siren,
  Activity,
  Users,
  Cross,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import Logo from '@/components/Logo';
import LanguageToggle from '@/components/LanguageToggle';

type Mode = 'signin' | 'signup';
type Portal = 'user' | 'admin';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const { t } = useLang();
  const [portal, setPortal] = useState<Portal>('user');
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup' && portal === 'user') {
        if (!username || !email || !password || !phone) {
          setError(t.login.fillAll);
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError(t.login.passwordShort);
          setLoading(false);
          return;
        }
        const { error: err } = await signUp({ username, email, password, phone });
        if (err) setError(err);
      } else {
        const { error: err } = await signIn(email, password, isAdminPortal);
        if (err) setError(err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const isAdminPortal = portal === 'admin';

  const userFeatures = [
    { icon: CloudRain, label: t.loginHero.features.weather },
    { icon: MapPin, label: t.loginHero.features.navigation },
    { icon: Siren, label: t.loginHero.features.sos },
    { icon: Activity, label: t.loginHero.features.soil },
  ];

  const adminFeatures = [
    { icon: Users, label: t.loginHero.features.users },
    { icon: Activity, label: t.loginHero.features.incidents },
    { icon: Siren, label: t.loginHero.features.sosControl },
    { icon: ShieldCheck, label: t.loginHero.features.contacts },
  ];

  const features = isAdminPortal ? adminFeatures : userFeatures;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Left hero panel */}
      <div className={`relative lg:w-1/2 min-h-[38vh] lg:min-h-screen overflow-hidden flex flex-col justify-between p-8 lg:p-12 transition-all duration-500 ${
        isAdminPortal
          ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950'
          : 'bg-gradient-to-br from-sky-700 via-blue-800 to-slate-900'
      }`}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl bg-white" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl bg-cyan-300" />
        </div>

        {/* Top: logo + language toggle */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={44} className="ring-2 ring-white/20" />
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">{t.app.name}</h1>
              <p className={`text-[11px] ${isAdminPortal ? 'text-amber-200' : 'text-blue-100'}`}>
                {isAdminPortal ? t.app.adminTagline : t.app.tagline}
              </p>
            </div>
          </div>
          <LanguageToggle dark />
        </div>

        {/* Middle: hero */}
        <div className="relative z-10 max-w-lg">
          <h2 className="text-2xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
            {isAdminPortal ? t.loginHero.adminTitle : t.loginHero.userTitle}
          </h2>
          <p className={`mt-3 text-sm lg:text-base leading-relaxed ${isAdminPortal ? 'text-slate-300' : 'text-blue-100'}`}>
            {isAdminPortal ? t.loginHero.adminDesc : t.loginHero.userDesc}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {features.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2.5 rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 backdrop-blur-sm"
              >
                <f.icon className="w-4 h-4 text-cyan-200 flex-shrink-0" />
                <span className="text-xs text-white font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className={`relative z-10 text-[11px] ${isAdminPortal ? 'text-slate-400' : 'text-blue-200'}`}>
          {isAdminPortal ? t.loginHero.adminFooter : t.loginHero.userFooter}
        </div>
      </div>

      {/* Right form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <Logo size={36} />
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{t.app.name}</h1>
              <p className="text-[11px] text-slate-400">
                {isAdminPortal ? t.app.adminTagline : t.app.tagline}
              </p>
            </div>
          </div>

          {/* Portal switcher */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 border border-slate-200">
            <button
              type="button"
              onClick={() => { setPortal('user'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                portal === 'user'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              {t.login.userPortal}
            </button>
            <button
              type="button"
              onClick={() => { setPortal('admin'); setMode('signin'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                portal === 'admin'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              {t.login.adminPortal}
            </button>
          </div>

          <div className="mb-5">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 mb-3 ${
              isAdminPortal
                ? 'bg-amber-50 border-amber-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              {isAdminPortal ? (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className={`text-[11px] font-medium ${
                isAdminPortal ? 'text-amber-700' : 'text-blue-700'
              }`}>
                {isAdminPortal ? t.login.adminAccessRequired : t.login.secureAccess}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {isAdminPortal
                ? t.login.adminSignIn
                : mode === 'signin'
                  ? t.login.welcomeBack
                  : t.login.createAccount}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {isAdminPortal
                ? t.login.adminCredentials
                : mode === 'signin'
                  ? t.login.signInToAccount
                  : t.login.joinPlatform}
            </p>
          </div>

          {/* Mode toggle (user portal only) */}
          {!isAdminPortal && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 border border-slate-200">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'signin'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.common.signIn}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.common.signUp}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && !isAdminPortal && (
              <Field
                icon={<UserIcon className="w-4 h-4" />}
                label={t.login.username}
                type="text"
                value={username}
                onChange={setUsername}
                placeholder="ram_thapa"
              />
            )}
            <Field
              icon={<Mail className="w-4 h-4" />}
              label={t.login.email}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <Field
              icon={<Lock className="w-4 h-4" />}
              label={t.login.password}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
            {mode === 'signup' && !isAdminPortal && (
              <Field
                icon={<Phone className="w-4 h-4" />}
                label={t.login.phone}
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="98XXXXXXXX"
              />
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg ${
                isAdminPortal
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 shadow-slate-900/30'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/30'
              }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isAdminPortal
                    ? t.login.adminSignInBtn
                    : mode === 'signin'
                      ? t.login.signInBtn
                      : t.login.createAccountBtn}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {isAdminPortal && (
            <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  {t.login.adminNotice}
                </p>
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-[11px] text-slate-400">
            {t.login.agreeNotice}
          </p>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

function Field({ icon, label, type, value, onChange, placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
        />
      </div>
    </div>
  );
}
