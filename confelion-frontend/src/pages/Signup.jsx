import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import GoogleLogo from '../components/GoogleLogo';
import { useAuth } from '../lib/AuthContext';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp, signInWithGoogle } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const redirectTarget = queryParams.get('redirect') || null;

  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSuccess = (role) => {
    if (redirectTarget) {
      navigate(redirectTarget);
    } else if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/account');
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setGoogleLoading(true);
    const { data, error: err } = await signInWithGoogle();
    setGoogleLoading(false);

    if (err) {
      return setError(err.message || 'Google registration could not be completed');
    }
    handleSuccess(data?.user?.role);
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');

    const cleanName = f.name.trim();
    const cleanEmail = f.email.trim();

    if (!cleanName) {
      return setError('Please enter your full name');
    }
    if (!cleanEmail) {
      return setError('Please enter your email address');
    }
    if (f.password.length < 6) {
      return setError('Password must be at least 6 characters long');
    }

    setLoading(true);
    const { data, error: err } = await signUp(cleanEmail, f.password, cleanName);
    setLoading(false);

    if (err) {
      return setError(err.message || 'Registration failed. Please check your information.');
    }

    handleSuccess(data?.user?.role);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between px-4 py-10 selection:bg-white selection:text-black">
      {/* Subtle atmospheric ambient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04)_0%,transparent_60%)]" />

      {/* Top Bar / Navigation Back */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between text-xs text-zinc-500 z-10">
        <Link to="/" className="flex items-center gap-1.5 hover:text-white transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Return to Store</span>
        </Link>
        <span className="text-[11px] font-mono tracking-widest text-zinc-600 uppercase">
          Confelion Atelier
        </span>
      </div>

      {/* Center Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10 animate-fade-in py-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center mb-3 group">
            <img 
              src="/images/confelion-logo.png" 
              alt="CONFELION" 
              className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105" 
            />
          </Link>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400 font-semibold">
            Join the Atelier Collective
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-zinc-950/90 backdrop-blur-md border border-white/15 p-6 sm:p-9 shadow-2xl rounded-sm">
          <div className="mb-6 pb-4 border-b border-white/10">
            <h1 className="text-sm font-bold uppercase tracking-widest text-white">
              Create Account
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Register for private drop invitations, priority ordering, and archived order history.
            </p>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 text-red-200 text-xs leading-relaxed flex items-start gap-2.5 rounded-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {/* Full Name field */}
            <div>
              <label htmlFor="signup-name" className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="e.g. Elena Rostova"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-black border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  required
                  disabled={loading || googleLoading}
                />
              </div>
            </div>

            {/* Email Address field */}
            <div>
              <label htmlFor="signup-email" className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-black border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  required
                  disabled={loading || googleLoading}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="signup-password" className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Password (Min. 6 Characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  className="w-full pl-10 pr-10 py-3 bg-black border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  required
                  minLength={6}
                  disabled={loading || googleLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms Notice */}
            <p className="text-[11px] text-zinc-500 leading-normal pt-1">
              By registering, you agree to receive atelier releases and accept our{' '}
              <span className="text-zinc-400 underline cursor-pointer">Terms of Service</span> and{' '}
              <span className="text-zinc-400 underline cursor-pointer">Privacy Policy</span>.
            </p>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-3.5 text-xs font-bold uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  CREATING ACCOUNT...
                </span>
              ) : (
                <>
                  CREATE ACCOUNT <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Separator */}
          <div className="relative flex items-center justify-center my-5">
            <div className="border-t border-white/15 w-full" />
            <span className="bg-zinc-950 px-3 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
              OR
            </span>
            <div className="border-t border-white/15 w-full" />
          </div>

          {/* Google Sign-up */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading || googleLoading}
            className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider bg-black hover:bg-zinc-900 active:scale-[0.99] text-white border border-white/25 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting to Google...
              </span>
            ) : (
              <>
                <GoogleLogo className="w-4 h-4" />
                Continue with Google
              </>
            )}
          </button>

          {/* Sign In Link */}
          <div className="pt-6 mt-4 text-center border-t border-white/10">
            <p className="text-xs text-zinc-400">
              Already have an account?{' '}
              <Link 
                to={redirectTarget ? `/login?redirect=${encodeURIComponent(redirectTarget)}` : '/login'} 
                className="text-white font-bold tracking-wide hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] text-zinc-600 z-10 pt-4">
        <span>© {new Date().getFullYear()} CONFELION ARCHIVAL COUTURE. ALL RIGHTS RESERVED.</span>
      </div>
    </div>
  );
}
