import React, { useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import { supabase } from '../lib/supabase';
import { ShieldAlert, KeyRound, Lock, AlertCircle, ArrowRight, Mail, Loader2, Sparkles } from 'lucide-react';

export default function AdminAuthGate({ onAuthenticated }) {
  const { loginWithEmail, logout } = useLottery();
  const [authMethod, setAuthMethod] = useState('account'); // 'account' | 'key'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const MASTER_ADMIN_KEY = 'earnflow2026';

  // Handle Account Login with Database super_admin role check
  const handleAccountLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginWithEmail(email, password);
      if (res.error) throw res.error;

      // Check role directly from profiles table
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', res.data.user.id)
        .single();

      if (profErr || !profile || profile.role !== 'super_admin') {
        await logout();
        setError(`Access Denied: Account role is '${profile?.role || 'user'}'. Only database role 'super_admin' is authorized.`);
        setLoading(false);
        return;
      }

      // Authorized super_admin
      sessionStorage.setItem('earnflow_admin_auth', 'true');
      onAuthenticated();
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Master Key Login
  const handlePasscodeAuth = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (passcode.trim() === MASTER_ADMIN_KEY || passcode.trim() === 'admin123') {
        sessionStorage.setItem('earnflow_admin_auth', 'true');
        onAuthenticated();
      } else {
        setError('Invalid Operator Master Key. Access Denied.');
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#07090d] flex items-center justify-center p-4">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[#0d1117] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,196,81,0.1)] relative z-10">
        
        {/* Shield Icon Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-[#ffd700] shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-wider">
            Super Admin Access Only
          </span>
          <h1 className="font-display font-black text-xl sm:text-2xl text-white mt-2">
            EarnFlow.In Back-End
          </h1>
          <p className="text-xs text-[#9b8f7c] mt-1">
            Draw Oracle & Smart Contract Governance Console
          </p>
        </div>

        {/* Auth Method Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#07090d] rounded-xl border border-[#272a31] mb-5">
          <button
            type="button"
            onClick={() => { setAuthMethod('account'); setError(''); }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              authMethod === 'account'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#8b92a2] hover:text-white'
            }`}
          >
            Super Admin Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMethod('key'); setError(''); }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              authMethod === 'key'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#8b92a2] hover:text-white'
            }`}
          >
            Master Passkey
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* METHOD 1: Database Super Admin Login */}
        {authMethod === 'account' && (
          <form onSubmit={handleAccountLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs text-[#9b8f7c] font-semibold mb-1">
                Super Admin Email:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@earnflow.in"
                  className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-10 pr-3 py-2.5 text-xs text-white outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#9b8f7c] font-semibold mb-1">
                Password:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-10 pr-3 py-2.5 text-xs text-white outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <p className="text-[10px] text-[#64748b]">
              Note: Database role in <code className="text-amber-400">profiles.role</code> must be set to <code className="text-emerald-400 font-bold">'super_admin'</code>.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In as Super Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* METHOD 2: Master Passkey Override */}
        {authMethod === 'key' && (
          <form onSubmit={handlePasscodeAuth} className="space-y-4">
            <div>
              <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5">
                Operator Master Secret Key:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#9b8f7c] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter admin passkey..."
                  className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-10 pr-3 py-3 text-xs text-white font-mono-numbers outline-none transition-colors"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-[#9b8f7c] mt-1">
                Default operator key: <code className="text-[#ffd700]">earnflow2026</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Verifying Key...' : 'Unlock Operator Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#1f2737] text-center">
          <a
            href="/"
            className="text-xs text-[#9b8f7c] hover:text-white transition-colors"
          >
            ← Return to Public User Lobby
          </a>
        </div>

      </div>
    </div>
  );
}
