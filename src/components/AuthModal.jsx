import React, { useState, useEffect, useRef } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  X, 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  AlertCircle,
  AtSign,
  CheckCircle2,
  Loader2,
  KeyRound,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    authMode, 
    setAuthMode, 
    loginWithEmail, 
    signupWithEmail, 
    checkUsernameAvailability,
    verifyEmailOtp,
    resendSignupOtp,
    loginWithGoogle,
    showToast
  } = useLottery();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Sign up multi-step state: 1 = Form, 2 = Email OTP Verification
  const [signupStep, setSignupStep] = useState(1);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Username validation state
  // status: 'idle' | 'checking' | 'valid' | 'invalid'
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [usernameMsg, setUsernameMsg] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const debounceTimer = useRef(null);

  // Reset when modal opens or closes
  useEffect(() => {
    if (!isAuthModalOpen) {
      setErrorMsg('');
      setSignupStep(1);
      setOtpCode('');
      setUsernameStatus('idle');
      setUsernameMsg('');
    }
  }, [isAuthModalOpen]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer;
    if (signupStep === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
      setCanResend(false);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [signupStep, countdown]);

  if (!isAuthModalOpen) return null;

  // Live validation for Username (Alphabet, number, _, @ only)
  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    setErrorMsg('');

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!val.trim()) {
      setUsernameStatus('idle');
      setUsernameMsg('');
      return;
    }

    // Strict character validation: letters, numbers, underscore, and @ only
    const validCharsRegex = /^[a-zA-Z0-9_@]+$/;
    if (!validCharsRegex.test(val)) {
      setUsernameStatus('invalid');
      setUsernameMsg('Only letters (a-z, A-Z), numbers (0-9), underscore (_), and @ are allowed');
      return;
    }

    if (val.length < 3) {
      setUsernameStatus('invalid');
      setUsernameMsg('User ID must be at least 3 characters');
      return;
    }

    if (val.length > 20) {
      setUsernameStatus('invalid');
      setUsernameMsg('User ID cannot exceed 20 characters');
      return;
    }

    // Debounced check with Supabase
    setUsernameStatus('checking');
    setUsernameMsg('Checking availability...');

    debounceTimer.current = setTimeout(async () => {
      const res = await checkUsernameAvailability(val);
      if (res.valid) {
        setUsernameStatus('valid');
        setUsernameMsg('✓ User ID is available!');
      } else {
        setUsernameStatus('invalid');
        setUsernameMsg(res.message || 'User ID is already taken');
      }
    }, 350);
  };

  // Handle Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithEmail(email, password);
      if (res.error) throw res.error;
      showToast('Welcome back! Successfully logged in.', 'success');
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup Step 1: Validate & Send Email OTP
  const handleSignupStep1 = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (usernameStatus !== 'valid') {
      setErrorMsg('Please enter a valid and available User ID.');
      return;
    }

    if (!email) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await signupWithEmail(email, password, username);
      if (res.error) throw res.error;

      // Check if user is already registered (Supabase prevents enumeration by returning empty identities)
      if (res.data?.user?.identities && res.data.user.identities.length === 0) {
        setErrorMsg('This email is already registered. Please click "Sign In" or "Continue with Google".');
        return;
      }

      // Transition to Step 2: OTP Verification
      setSignupStep(2);
      setCountdown(60);
      setCanResend(false);
      showToast(`Verification code sent to ${email}`, 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initialize account.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const token = otpCode.trim();
    if (!token || token.length < 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEmailOtp(email, token, username, password);
      if (res.error) throw res.error;

      showToast('Account successfully created & verified! Welcome to EarnFlow.', 'success');
      setIsAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setErrorMsg('');
    try {
      const res = await signupWithEmail(email, password, username);
      if (res.error) throw res.error;
      setCountdown(60);
      setCanResend(false);
      showToast('New 6-digit verification code sent!', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend code. Please wait a moment.');
    }
  };

  // Handle Google OAuth Login
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
    } catch (err) {
      setErrorMsg(err.message || 'Google sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-[550px] bg-[#0f131c] border border-[rgba(245,196,81,0.3)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 no-scrollbar flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-[#1e232f] flex items-center justify-between bg-gradient-to-b from-[#141924] to-[#0f131c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full p-0.5 shadow-md shrink-0">
              <img src="/logo.png" alt="EarnFlow.In" className="w-full h-full rounded-full object-cover border border-[#ffd700]/40" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                {authMode === 'login' 
                  ? 'Sign In to EarnFlow.In' 
                  : signupStep === 2 
                    ? 'Verify Your Email OTP' 
                    : 'Create VIP Account'}
              </h3>
              <p className="text-[11px] text-[#9b8f7c]">
                {signupStep === 2 ? 'Step 2 of 2: OTP Verification' : 'USDT Secure Lottery Platform'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="w-7 h-7 rounded-lg bg-[#191f2c] hover:bg-[#252d3d] text-[#8b92a2] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switchers (only visible on step 1) */}
        {signupStep === 1 && (
          <div className="grid grid-cols-2 p-1 bg-[#0b0e14] mx-6 mt-3 rounded-xl border border-[#1e232f]">
            <button
              onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] shadow-sm'
                  : 'text-[#8b92a2] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] shadow-sm'
                  : 'text-[#8b92a2] hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Modal Form Body - Fixed min-height to maintain identical box size */}
        <div className="p-6 pt-3 space-y-3 no-scrollbar min-h-[350px] flex flex-col justify-between">
          
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 1: SIGN IN MODE                                            */}
          {/* ============================================================== */}
          {authMode === 'login' && (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              {/* Google Sign In */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#171c28] hover:bg-[#1e2536] border border-[#2d374d] text-white text-xs font-bold flex items-center justify-center gap-3 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-[#1e232f]" />
                <span className="text-[10px] font-mono-numbers text-[#64748b] uppercase tracking-wider">
                  Or with Email & Password
                </span>
                <div className="flex-1 h-px bg-[#1e232f]" />
              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#8b92a2] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#0b0e14] border border-[#232938] focus:border-[#ffd700] rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#8b92a2] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      className="w-full bg-[#0b0e14] border border-[#232938] focus:border-[#ffd700] rounded-xl pl-10 pr-10 py-2 text-xs text-white outline-none transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#ffd700] transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: SIGN UP - STEP 1 (Credentials & Unique User ID)         */}
          {/* ============================================================== */}
          {authMode === 'signup' && signupStep === 1 && (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              {/* Google Sign Up */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#171c28] hover:bg-[#1e2536] border border-[#2d374d] text-white text-xs font-bold flex items-center justify-center gap-3 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-[#1e232f]" />
                <span className="text-[10px] font-mono-numbers text-[#64748b] uppercase tracking-wider">
                  Or Create with Email & User ID
                </span>
                <div className="flex-1 h-px bg-[#1e232f]" />
              </div>

              <form onSubmit={handleSignupStep1} className="space-y-2.5">
                {/* 1. Full-width Long Email Address Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#8b92a2] mb-1">
                    Email Address (For OTP Verification)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#0b0e14] border border-[#232938] focus:border-[#ffd700] rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* 2. Side-by-Side: User ID on Left, Password (Min. 8) on Right */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* User ID Field with Live Uniqueness & Charset Verification */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#8b92a2]">
                        User ID / Username
                      </label>
                      <span className="text-[10px] text-[#64748b]">
                        (a-z, 0-9, _, @)
                      </span>
                    </div>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={handleUsernameChange}
                        placeholder="e.g. Satoshi_99"
                        maxLength={20}
                        className={`w-full bg-[#0b0e14] border rounded-xl pl-10 pr-9 py-2 text-xs text-white font-mono-numbers outline-none transition-colors ${
                          usernameStatus === 'valid'
                            ? 'border-[#05d5aa] focus:border-[#05d5aa]'
                            : usernameStatus === 'invalid'
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-[#232938] focus:border-[#ffd700]'
                        }`}
                        required
                      />

                      {/* Live status indicator */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === 'checking' && (
                          <Loader2 className="w-4 h-4 text-[#ffd700] animate-spin" />
                        )}
                        {usernameStatus === 'valid' && (
                          <CheckCircle2 className="w-4 h-4 text-[#05d5aa]" />
                        )}
                        {usernameStatus === 'invalid' && (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>

                    {/* Live Feedback Message */}
                    {usernameMsg && (
                      <div className={`mt-1 text-[10px] flex items-center gap-1 font-medium truncate ${
                        usernameStatus === 'valid' 
                          ? 'text-[#05d5aa]' 
                          : usernameStatus === 'invalid' 
                            ? 'text-red-400' 
                            : 'text-[#9b8f7c]'
                      }`}>
                        {usernameMsg}
                      </div>
                    )}
                  </div>

                  {/* Password Field (Min. 8 characters) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#8b92a2]">
                        Password
                      </label>
                      <span className="text-[10px] text-[#64748b]">
                        (Min. 8 chars)
                      </span>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={8}
                        className="w-full bg-[#0b0e14] border border-[#232938] focus:border-[#ffd700] rounded-xl pl-10 pr-10 py-2 text-xs text-white outline-none transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#ffd700] transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-1 text-[10px] text-[#64748b]">
                      Minimum 8 characters required
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || usernameStatus !== 'valid'}
                  className="w-full mt-1 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Next: Verify Email OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: SIGN UP - STEP 2 (Email OTP Verification)               */}
          {/* ============================================================== */}
          {authMode === 'signup' && signupStep === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
              <div className="p-3.5 rounded-xl bg-[#141924] border border-[#232938] text-center space-y-1">
                <div className="w-9 h-9 rounded-full bg-[rgba(5,213,170,0.15)] text-[#05d5aa] flex items-center justify-center mx-auto mb-1">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-white">
                  6-Digit OTP Sent to Email
                </div>
                <div className="text-[11px] font-mono-numbers text-[#05d5aa]">
                  {email}
                </div>
                <p className="text-[10px] text-[#9b8f7c] pt-1">
                  User ID: <strong className="text-white">@{username}</strong>
                </p>
              </div>

              <div>
                <label className="block text-center text-xs font-semibold text-[#8b92a2] mb-2">
                  Enter 6-Digit Verification Code:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  autoFocus
                  className="w-full bg-[#0b0e14] border border-[rgba(245,196,81,0.4)] focus:border-[#ffd700] rounded-xl px-4 py-3 text-center text-white font-mono-numbers font-black text-2xl tracking-[8px] outline-none shadow-inner"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify & Complete Registration</span>
                  </>
                )}
              </button>

              {/* Resend and Change Email options */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1e232f]">
                <button
                  type="button"
                  onClick={() => setSignupStep(1)}
                  className="text-[#9b8f7c] hover:text-white transition-colors cursor-pointer text-[11px]"
                >
                  ← Edit Details
                </button>

                <button
                  type="button"
                  disabled={!canResend}
                  onClick={handleResendOtp}
                  className={`flex items-center gap-1 font-semibold text-[11px] transition-colors cursor-pointer ${
                    canResend ? 'text-[#ffd700] hover:underline' : 'text-[#64748b] cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{canResend ? 'Resend Code' : `Resend in ${countdown}s`}</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer Notice */}
          <div className="pt-2 text-center text-[11px] text-[#64748b]">
            After registering, you can paste or connect your <span className="text-[#ffd700] font-bold">TRC-20 USDT</span> wallet in your profile to participate.
          </div>

        </div>
      </div>
    </div>
  );
}
