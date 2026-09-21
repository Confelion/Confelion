import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import GoogleLogo from '../components/GoogleLogo';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, resetPassword } = useAuth();

  // Redirect destination query or state
  const queryParams = new URLSearchParams(location.search);
  const redirectTarget = queryParams.get('redirect') || location.state?.from?.pathname || null;

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & feedback states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password flow
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState({ loading: false, success: false, message: '' });

  // Load remembered email if previously stored
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('confelion_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleSuccessfulAuth = (role, authEmail = email) => {
    if (rememberMe && authEmail) {
      localStorage.setItem('confelion_remembered_email', authEmail);
    } else {
      localStorage.removeItem('confelion_remembered_email');
    }

    const clean = (authEmail || '').toLowerCase().trim();
    const isAdminAuth = role === 'admin' || clean === 'confelion@gmail.com' || clean === 'admin.confelion@gmail.com';

    if (redirectTarget) {
      navigate(redirectTarget);
    } else if (isAdminAuth) {
      navigate('/admin');
    } else {
      navigate('/account');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return setError('Please enter your email address');
    }
    if (!password) {
      return setError('Please enter your password');
    }

    setLoading(true);
    const { data, error: err } = await signIn(cleanEmail, password);
    setLoading(false);

    if (err) {
      return setError(err.message || 'Authentication failed. Please check your credentials.');
    }

    handleSuccessfulAuth(data?.user?.role, cleanEmail);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    const { data, error: err } = await signInWithGoogle();
    setGoogleLoading(false);

    if (err) {
      return setError(err.message || 'Google sign-in could not be completed');
    }

    handleSuccessfulAuth(data?.user?.role, data?.user?.email);
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim() || email.trim();
    if (!targetEmail) {
      setForgotStatus({ loading: false, success: false, message: 'Please enter your email address' });
      return;
    }

    setForgotStatus({ loading: true, success: false, message: '' });
    const { success, error: err } = await resetPassword(targetEmail);
    
    if (err) {
      setForgotStatus({ loading: false, success: false, message: err.message });
    } else {
      setForgotStatus({ 
        loading: false, 
        success: true, 
        message: `Password reset instructions sent to ${targetEmail}. Please check your inbox and spam folder.` 
      });
    }
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
          Confelion Client Portal
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
            {isForgotMode ? 'Account Recovery' : 'Patron & Member Access'}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-zinc-950/90 backdrop-blur-md border border-white/15 p-6 sm:p-9 shadow-2xl rounded-sm">
          {!isForgotMode ? (
            <>
              <div className="mb-6 pb-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-bold uppercase tracking-widest text-white">
                    Sign In
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Enter your credentials to access your order archives and atelier drops.
                  </p>
                </div>
              </div>

              {/* Error Notification */}
              {error && (
                <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 text-red-200 text-xs leading-relaxed flex items-start gap-2.5 rounded-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Standard Email/Password Form */}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                {/* Email Address */}
                <div>
                  <label 
                    htmlFor="login-email" 
                    className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-black border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                      required
                      disabled={loading || googleLoading}
                    />
                  </div>
                </div>

                {/* Password with Show/Hide toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label 
                      htmlFor="login-password" 
                      className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setIsForgotMode(true);
                        setError('');
                      }}
                      className="text-[11px] text-zinc-400 hover:text-white underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-black border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                      required
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

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 accent-white rounded bg-black border-white/20"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full mt-2 py-3.5 text-xs font-bold uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      AUTHENTICATING...
                    </span>
                  ) : (
                    <>
                      SIGN IN <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Social Login Separator */}
              <div className="relative flex items-center justify-center my-5">
                <div className="border-t border-white/15 w-full" />
                <span className="bg-zinc-950 px-3 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  OR
                </span>
                <div className="border-t border-white/15 w-full" />
              </div>

              {/* Real Google OAuth Login */}
              <button
                type="button"
                onClick={handleGoogleLogin}
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

              {/* Sign Up Link */}
              <div className="pt-6 mt-4 text-center border-t border-white/10">
                <p className="text-xs text-zinc-400">
                  New to Confelion?{' '}
                  <Link 
                    to={redirectTarget ? `/signup?redirect=${encodeURIComponent(redirectTarget)}` : '/signup'} 
                    className="text-white font-bold tracking-wide hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </>
          ) : (
            /* Forgot Password Recovery Mode */
            <div className="animate-fade-in space-y-4">
              <div className="pb-3 border-b border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                  Reset Password
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter the email associated with your Confelion account and we will send you a link to reset your password.
                </p>
              </div>

              {forgotStatus.message && (
                <div className={`p-3 text-xs leading-relaxed rounded-sm ${
                  forgotStatus.success 
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200' 
                    : 'bg-red-950/60 border border-red-500/40 text-red-200'
                }`}>
                  {forgotStatus.message}
                </div>
              )}

              {!forgotStatus.success ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-1">
                  <div>
                    <label 
                      htmlFor="forgot-email" 
                      className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5"
                    >
                      Your Account Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        id="forgot-email"
                        type="email"
                        placeholder="name@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-black border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                        required
                        disabled={forgotStatus.loading}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotStatus.loading}
                    className="w-full py-3.5 text-xs font-bold uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {forgotStatus.loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        SENDING RESET LINK...
                      </span>
                    ) : (
                      'SEND RESET LINK'
                    )}
                  </button>
                </form>
              ) : (
                <div className="pt-2 text-center">
                  <p className="text-xs text-zinc-400 mb-4">
                    Didn't receive the email? Check your spam folder or try again in a few minutes.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setForgotStatus({ loading: false, success: false, message: '' });
                  }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 mx-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] text-zinc-600 z-10 pt-4">
        <span>© {new Date().getFullYear()} CONFELION ARCHIVAL COUTURE. ALL RIGHTS RESERVED.</span>
      </div>
    </div>
  );
}
