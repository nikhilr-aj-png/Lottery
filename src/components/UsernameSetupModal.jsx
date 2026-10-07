import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { User, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function UsernameSetupModal() {
  const { user, profile, needsUsernameSetup, setPermanentUsername, checkUsernameAvailability } = useLottery();

  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState({ valid: false, message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-populate with cleaned email prefix as initial suggestion
  useEffect(() => {
    if (user?.email && !username) {
      const suggested = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
      if (suggested && suggested.length >= 3) {
        setUsername(suggested);
      }
    }
  }, [user]);

  // Debounced availability check
  useEffect(() => {
    if (!username.trim()) {
      setAvailability({ valid: false, message: 'Please enter a username' });
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailability(username);
      setAvailability(res);
      setChecking(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  if (!user || !needsUsernameSetup) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!availability.valid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await setPermanentUsername(username);
      if (res.success) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#05d5aa', '#ffd700', '#00f2fe', '#ffffff']
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="glass-modal w-full max-w-md rounded-3xl p-6 sm:p-8 border border-[rgba(245,196,81,0.35)] shadow-[0_20px_60px_rgba(0,0,0,0.85)] relative flex flex-col text-left">
        
        {/* Glow Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(245,196,81,0.15)] border border-[#f5c451]/30 flex items-center justify-center text-[#ffd700] shadow-[0_0_20px_rgba(245,196,81,0.25)] shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono-numbers text-[#f5c451] uppercase font-bold tracking-wider">
              <Sparkles className="w-3 h-3 text-[#ffd700]" />
              <span>One-Time Setup · Permanent ID</span>
            </div>
            <h2 className="font-display font-black text-xl text-white">
              Choose Player Username
            </h2>
          </div>
        </div>

        <p className="text-xs text-[#9b8f7c] leading-relaxed mb-5">
          Welcome to EarnFlow.In! Please choose your permanent player username. This ID will appear on your draw tickets, leaderboards, and prize announcements.
        </p>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white mb-1.5">
              Player Username / User ID:
            </label>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#ffd700] font-mono-numbers">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_@]/g, ''))}
                placeholder="lucky_winner"
                maxLength={20}
                required
                autoFocus
                className="w-full bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-9 pr-10 py-3 text-white font-mono-numbers text-sm font-bold outline-none transition-colors"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {checking ? (
                  <Loader2 className="w-4 h-4 text-[#9b8f7c] animate-spin" />
                ) : availability.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-[#05d5aa]" />
                ) : username.trim().length >= 3 ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : null}
              </div>
            </div>

            {/* Availability / Validation Status */}
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className={availability.valid ? 'text-[#05d5aa] font-medium' : 'text-red-400 font-medium'}>
                {availability.message || '3-20 characters: letters, numbers, _ only'}
              </span>
              <span className="text-[10px] text-[#6b7280] font-mono-numbers">
                {username.length}/20
              </span>
            </div>
          </div>

          {/* Permanent Warning Box */}
          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/35 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              <strong>Permanent Selection:</strong> Once confirmed, your username is cryptographically locked and <strong>cannot be changed</strong>.
            </p>
          </div>

          {/* Confirm Button */}
          <button
            type="submit"
            disabled={!availability.valid || checking || isSubmitting}
            className="btn-gold w-full py-3.5 rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Locking Permanent Username...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Lock Username</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
