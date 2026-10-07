import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  ShieldCheck, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Headphones,
  User,
  AtSign,
  FileQuestion,
  Sparkles
} from 'lucide-react';

export default function ContactPage({ onBackToHome }) {
  const { user, profile, submitSupportTicket, showToast } = useLottery();

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Deposit / Payment Issue (USDT / Crypto)');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    } else if (user?.email) {
      setUsername(user.email.split('@')[0]);
    }

    if (user?.email) {
      setEmail(user.email);
    }
  }, [user, profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Please enter your full name', 'error');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      showToast('Please provide details about your issue (at least 10 characters)', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitSupportTicket({
        name,
        username,
        email,
        subject,
        message
      });

      if (res.success) {
        setSubmittedTicket({
          id: res.ticketId,
          name,
          email,
          subject,
          message,
          timestamp: Date.now()
        });
        // Clear message
        setMessage('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setMessage('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
      
      {/* Top Breadcrumb / Back button */}
      <button
        onClick={onBackToHome}
        className="mb-8 px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-xs font-bold text-[#f5c451] border border-[rgba(245,196,81,0.25)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Lottery Lobby</span>
      </button>

      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 mb-8 border border-[rgba(245,196,81,0.3)] bg-gradient-to-br from-[#10141e] via-[#0b0e14] to-[#121826]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700] border border-[#f5c451]/30">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono-numbers text-[#f5c451] uppercase font-bold tracking-wider">
                  24/7 SUPPORT & ASSISTANCE
                </span>
                <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-pulse" />
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
                Contact <span className="text-gold-gradient">EarnFlow Protocol</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-numbers px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-[#272a31] text-[#9b8f7c]">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Response SLA: &lt; 2 Hours</span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#9b8f7c] leading-relaxed mt-4 max-w-2xl">
          Encountered an issue with your USDT deposit, 24-hour withdrawal SLA, or provably fair lottery tickets? 
          Submit your query below. Our administrative team receives all tickets directly and replies promptly to your email.
        </p>
      </div>

      {/* Main Grid: Form + Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Support Submission Form (8 Cols) */}
        <div className="lg:col-span-8">
          {submittedTicket ? (
            /* Ticket Submitted Success Card */
            <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-emerald-500/40 bg-gradient-to-br from-[#0c1613] to-[#0b0e14] space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-mono-numbers text-emerald-400 uppercase font-bold tracking-wider">
                  TICKET RECEIVED SUCCESSFULLY
                </span>
                <h3 className="font-display font-extrabold text-2xl text-white mt-1">
                  Inquiry Dispatched to Admin Desk
                </h3>
              </div>

              <div className="bg-[#0b0e14] p-5 rounded-xl border border-[#272a31] text-left space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-[#1f2737]">
                  <span className="text-[#9b8f7c]">Ticket Reference ID:</span>
                  <span className="font-mono-numbers font-black text-[#ffd700] text-sm">
                    #{submittedTicket.id}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9b8f7c]">Recipient Name:</span>
                  <span className="text-white font-bold">{submittedTicket.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9b8f7c]">Reply Email Address:</span>
                  <span className="font-mono-numbers text-emerald-400 font-bold">{submittedTicket.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9b8f7c]">Topic / Category:</span>
                  <span className="text-white">{submittedTicket.subject}</span>
                </div>
              </div>

              <p className="text-xs text-[#9b8f7c] leading-relaxed max-w-md mx-auto">
                Our support team is reviewing your query. A response will be sent directly to <strong className="text-white">{submittedTicket.email}</strong>.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1e2638] text-xs font-bold text-white border border-[#272a31] transition-all cursor-pointer"
                >
                  Submit Another Inquiry
                </button>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-[#f5c451]/20"
                >
                  Back to Lottery Lobby
                </button>
              </div>
            </div>
          ) : (
            /* Inquiry Form */
            <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-[#272a31]">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-5 h-5 text-[#ffd700]" />
                <h2 className="font-display font-extrabold text-xl text-white">
                  Submit a Support Ticket
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* 2-Column Name & User ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Real Name */}
                  <div>
                    <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#ffd700]" />
                      <span>Your Real Name <span className="text-amber-400">*</span></span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      required
                      className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3 text-white text-xs outline-none transition-colors"
                    />
                  </div>

                  {/* User ID / Username */}
                  <div>
                    <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5 flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-[#05d5aa]" />
                      <span>EarnFlow User ID / Username</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. Player77 (optional for guests)"
                      className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3 text-white font-mono-numbers text-xs outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#00f2fe]" />
                    <span>Your Email Address <span className="text-amber-400">*</span></span>
                    <span className="text-[10px] text-[#9b8f7c] font-normal">(Admin replies to this email)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    required
                    className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3 text-white font-mono-numbers text-xs outline-none transition-colors"
                  />
                </div>

                {/* Problem Category */}
                <div>
                  <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5 flex items-center gap-1.5">
                    <FileQuestion className="w-3.5 h-3.5 text-[#ffd700]" />
                    <span>Inquiry Topic / Category <span className="text-amber-400">*</span></span>
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="Deposit / Payment Issue (USDT / Crypto)">
                      💳 Deposit / Payment Issue (USDT / NOWPayments)
                    </option>
                    <option value="Withdrawal / 24-Hour SLA Payout Inquiry">
                      ⏱️ Withdrawal / 24-Hour SLA Payout Inquiry
                    </option>
                    <option value="Lottery Ticket / Provably Fair Oracle Draw">
                      🎟️ Lottery Ticket / Provably Fair Oracle Draw
                    </option>
                    <option value="Account Access / Login OTP Issue">
                      🔐 Account Access / Login OTP Issue
                    </option>
                    <option value="Bug Report & Technical Glitch">
                      🐛 Bug Report & Technical Glitch
                    </option>
                    <option value="General Inquiry / Feedback">
                      💡 General Inquiry / Partnership / Feedback
                    </option>
                  </select>
                </div>

                {/* Problem Description / Message */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="text-[#9b8f7c] font-semibold flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Detailed Description of Problem <span className="text-amber-400">*</span></span>
                    </label>
                    <span className="font-mono-numbers text-[10px] text-[#9b8f7c]">
                      {message.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail. If this is about a deposit or withdrawal, please include the approximate time, amount, and transaction hash if available."
                    required
                    className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl p-4 text-white text-xs outline-none transition-colors leading-relaxed resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold w-full py-4 rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/25 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      <span>Sending to Admin Desk...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Inquiry to Admin Desk</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-[#9b8f7c]">
                  Your request is securely dispatched directly to the EarnFlow administration console.
                </p>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Official Support Channels & Security (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Card 1: Official Email */}
          <div className="glass-panel p-6 rounded-2xl border border-[rgba(245,196,81,0.25)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700]">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono-numbers text-[#f5c451] uppercase font-bold">
                  DIRECT DESK
                </span>
                <h3 className="font-display font-bold text-white text-base">
                  Official Support Email
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#9b8f7c] leading-relaxed">
              You can also reach out to us directly from your personal email client:
            </p>

            <a
              href="mailto:support@earnflow.in"
              className="block p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] hover:border-[#ffd700] font-mono-numbers text-xs text-center text-[#05d5aa] font-bold transition-colors"
            >
              support@earnflow.in
            </a>
          </div>

          {/* Card 2: 24h SLA Payout Guarantee */}
          <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="w-5 h-5" />
              <h4 className="font-display font-bold text-sm text-white">
                24-Hour SLA Payout Guarantee
              </h4>
            </div>
            <p className="text-xs text-[#9b8f7c] leading-relaxed">
              All winner claims and USDT withdrawals are processed within 24 hours under multi-sig cryptographic safety protocols. If your withdrawal exceeds 24 hours, include your Order ID above for urgent priority.
            </p>
          </div>

          {/* Card 3: Security & Anti-Phishing Warning */}
          <div className="glass-panel p-6 rounded-2xl border border-red-500/30 bg-red-950/10 space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="font-display font-bold text-sm text-white">
                Security & Anti-Phishing
              </h4>
            </div>
            <ul className="text-xs text-[#9b8f7c] space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-red-400 font-bold">•</span>
                <span>EarnFlow administrators will <strong>NEVER</strong> ask for your private key, password, or seed phrase.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-red-400 font-bold">•</span>
                <span>Always ensure you are visiting the official sovereign domain: <strong className="text-white">earnflow.in</strong>.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
