/**
 * ============================================================================
 * PLAYER SUPPORT, RESPONSIBLE GAMING & TICKET DESK — EARNFLOW.IN
 * ============================================================================
 * 1. Live Support Tickets stored in public.support_tickets with admin reply tracking
 * 2. FAQ Accordion for casino rules & Provably Fair verification
 * 3. Responsible Social Gaming Controls: Daily Wager Limit, Session Timer, Self-Exclusion
 * 4. Free-to-Play Social Gaming Compliance Disclaimers
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { useSoundFX } from '../hooks/useSoundFX';
import { 
  Headphones, 
  HelpCircle, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  HeartHandshake, 
  Lock,
  Mail,
  MessageSquare,
  Clock,
  Sparkles,
  User,
  RefreshCw,
  Sliders,
  AlertCircle,
  Coins
} from 'lucide-react';

const FAQS = [
  {
    q: 'What are Flow Coins (FC) and can they be withdrawn?',
    a: 'Flow Coins (FC) are 100% non-transferable, non-redeemable virtual social credits designed exclusively for free social entertainment. They hold zero monetary value and cannot be exchanged, deposited, cashed out, or redeemed for fiat currency or cryptocurrency.'
  },
  {
    q: 'How does the Provably Fair system work?',
    a: 'Every round across all 12 games and the Four-Digit Lottery uses cryptographic SHA-256 and HMAC-SHA256 commit-reveal algorithms. The server publishes a pre-committed hash before the round begins. Once the round ends, the server seed is revealed so you can independently verify that the outcome was never manipulated.'
  },
  {
    q: 'How often can I claim free Flow Coins?',
    a: 'All registered players can claim free Flow Coins every 24 hours through our daily faucet and Lucky Wheel! Additionally, players receive a 500 FC welcome grant upon registration and bonus Flow Coins through achievement milestones and VIP loyalty rank-ups.'
  },
  {
    q: 'Can I install this app on Android or iOS?',
    a: 'Yes! The platform is a Progressive Web App (PWA) that installs on any Android or iOS device directly from your browser. We also provide an official native Flutter Android APK download in the navbar.'
  },
  {
    q: 'What are the RTP (Return to Player) percentages for the games?',
    a: 'Our games feature industry-leading fair math models: Blackjack (99.5% RTP / 0.5% house edge), Dice (99.0% RTP / 1% edge), Crash (99.0% RTP), Mines (99.0% RTP), Limbo (99.0% RTP), and European Roulette (97.3% RTP).'
  }
];

export default function SupportView() {
  const { user, profile, wallet, showToast, setIsAuthModalOpen } = useLottery();
  const { playClick, playChipBet } = useSoundFX();
  
  // Active Support Tab: 'faq' | 'tickets' | 'responsible'
  const [activeTab, setActiveTab] = useState('faq');

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Support form state
  const [ticketCategory, setTicketCategory] = useState('Provably Fair Verification');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<any>(null);

  // Player's existing tickets
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Responsible Gaming Controls
  const [dailyLimit, setDailyLimit] = useState(() => {
    return localStorage.getItem('ef_responsible_wager_limit') || 'none';
  });
  const [sessionReminder, setSessionReminder] = useState(() => {
    return localStorage.getItem('ef_responsible_session_reminder') || '60';
  });
  const [exclusionUntil, setExclusionUntil] = useState(() => {
    return localStorage.getItem('ef_self_exclusion_until') || null;
  });

  // Fetch Player's Tickets from Database
  const fetchMyTickets = async () => {
    if (!wallet?.address && !user?.id) return;
    setLoadingTickets(true);
    try {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (user?.id) {
        query = query.or(`user_id.eq.${user.id},user_address.eq.${wallet?.address || ''}`);
      } else if (wallet?.address) {
        query = query.eq('user_address', wallet.address);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        setMyTickets(data);
      }
    } catch (err) {
      console.warn('fetchMyTickets error:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchMyTickets();
  }, [wallet?.address, user?.id]);

  // Submit Support Ticket to Database
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      showToast('Please fill in both subject and message.', 'error');
      return;
    }

    setIsSubmitting(true);
    playClick();

    try {
      const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
      const payload = {
        id: ticketId,
        user_id: user?.id || null,
        user_address: wallet?.address || 'Anonymous',
        name: profile?.username || user?.user_metadata?.username || 'Player',
        username: profile?.username || 'Player',
        email: user?.email || contactEmail || 'support@earnflow.in',
        subject: `[${ticketCategory}] ${ticketSubject.trim()}`,
        message: ticketMessage.trim(),
        status: 'open',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('support_tickets')
        .insert(payload);

      if (error) throw error;

      setSubmittedTicket(payload);
      setTicketSubject('');
      setTicketMessage('');
      showToast(`Support Ticket #${ticketId} submitted to our team!`, 'success');
      playChipBet();
      fetchMyTickets();
    } catch (err) {
      console.error('handleSubmitTicket error:', err);
      showToast(err.message || 'Error submitting ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Responsible Gaming Preferences
  const handleSaveResponsibleLimits = (newLimit, newReminder) => {
    setDailyLimit(newLimit);
    setSessionReminder(newReminder);
    localStorage.setItem('ef_responsible_wager_limit', newLimit);
    localStorage.setItem('ef_responsible_session_reminder', newReminder);
    playClick();
    showToast('Responsible gaming limits updated successfully!', 'success');
  };

  // Self-Exclusion Cooling Off Handler
  const handleSetSelfExclusion = (hours) => {
    playClick();
    const until = Date.now() + hours * 3600 * 1000;
    const dateStr = new Date(until).toLocaleString();
    localStorage.setItem('ef_self_exclusion_until', String(until));
    setExclusionUntil(String(until));
    showToast(`Self-exclusion activated until ${dateStr}. Game wagers are paused.`, 'info');
  };

  const isCurrentlyExcluded = exclusionUntil && parseInt(exclusionUntil, 10) > Date.now();

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left">
      
      {/* 1. HERO HEADER */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono-numbers font-bold">
            <Headphones className="w-3.5 h-3.5 text-purple-400" />
            <span>PLAYER SUPPORT, RESPONSIBLE GAMING & TICKETS</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
            Customer Support & Compliance
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Need help with game rules, Provably Fair verification, or responsible gaming controls? Our support desk and compliance tools are available 24/7.
          </p>
        </div>
      </div>

      {/* 2. SUBTAB SWITCHER */}
      <div className="flex items-center gap-1.5 p-1 bg-[#111827] rounded-2xl border border-[#1F2737] max-w-md">
        <button
          onClick={() => { playClick(); setActiveTab('faq'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'faq'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>FAQ & Rules</span>
        </button>

        <button
          onClick={() => { playClick(); setActiveTab('tickets'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'tickets'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>My Tickets ({myTickets.length})</span>
        </button>

        <button
          onClick={() => { playClick(); setActiveTab('responsible'); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'responsible'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black shadow-md'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Responsible Gaming</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: FAQ ACCORDION & SUBMIT TICKET FORM                             */}
      {/* ==================================================================== */}
      {activeTab === 'faq' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: FAQ ACCORDION */}
          <div className="lg:col-span-7 rounded-3xl bg-[#111827] border border-[#1F2737] p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="pb-3 border-b border-[#1F2737] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <h2 className="font-display font-extrabold text-base sm:text-lg text-white">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-2.5">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[#0B0F19] border border-[#1F2737] overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => { playClick(); setOpenFaq(isOpen ? null : idx); }}
                      className="w-full p-4 flex items-center justify-between text-left text-xs sm:text-sm font-bold text-white hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0 ml-2" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 text-xs text-[#94A3B8] leading-relaxed border-t border-[#1F2737]/60 animate-in fade-in duration-150">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: SUBMIT TICKET FORM */}
          <div className="lg:col-span-5 rounded-3xl bg-[#111827] border border-[#1F2737] p-5 sm:p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="pb-3 border-b border-[#1F2737] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <h2 className="font-display font-extrabold text-base sm:text-lg text-white">
                  Submit Support Ticket
                </h2>
              </div>

              {submittedTicket ? (
                <div className="my-6 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-2 animate-in zoom-in-95">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h3 className="font-display font-bold text-sm text-white">
                    Ticket #{submittedTicket.id} Submitted!
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Your ticket has been recorded in the database. Our support agents will reply shortly.
                  </p>
                  <button
                    onClick={() => setSubmittedTicket(null)}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold transition-colors cursor-pointer"
                  >
                    Submit Another Ticket
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-3 pt-3">
                  <div>
                    <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                      Inquiry Category:
                    </label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="Provably Fair Verification">Provably Fair Verification</option>
                      <option value="Account & Profile">Account & Username</option>
                      <option value="Game Rules & Workstation">Game Rules & Workstation</option>
                      <option value="VIP & Rewards">VIP & Faucet Rewards</option>
                      <option value="General Feedback">General Feedback</option>
                    </select>
                  </div>

                  {!user && (
                    <div>
                      <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                        Contact Email:
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                      Subject:
                    </label>
                    <input
                      type="text"
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="Brief summary of your question..."
                      className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                      Message Details:
                    </label>
                    <textarea
                      rows={4}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Please provide details, round nonces, or error messages..."
                      className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl btn-gold text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Send className="w-3.5 h-3.5 text-black" />
                    <span>{isSubmitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}</span>
                  </button>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-[#1F2737] text-[11px] text-[#64748B]">
              Direct support email: <span className="text-amber-300 font-mono">support@earnflow.in</span>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: MY TICKETS LIST                                               */}
      {/* ==================================================================== */}
      {activeTab === 'tickets' && (
        <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1F2737]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <h2 className="font-display font-extrabold text-base sm:text-lg text-white">
                My Support Ticket History
              </h2>
            </div>
            <button
              onClick={() => { playClick(); fetchMyTickets(); }}
              className="px-3 py-1.5 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#272a31] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {myTickets.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0B0F19] border border-[#272a31] flex items-center justify-center mx-auto text-[#64748B]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs text-[#94A3B8]">
                You have no open or past support tickets.
              </p>
              <button
                onClick={() => setActiveTab('faq')}
                className="px-4 py-2 rounded-xl btn-gold text-xs font-bold text-black cursor-pointer shadow"
              >
                Create a Ticket
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myTickets.map(t => (
                <div key={t.id} className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1F2737] space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-300">#{t.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        t.status === 'resolved' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : t.status === 'in_review'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{t.subject}</h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed bg-[#141924] p-3 rounded-xl border border-[#272a31]">
                    {t.message}
                  </p>

                  {t.admin_reply && (
                    <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 space-y-1">
                      <span className="font-bold text-[10px] uppercase text-purple-400 block">Official Support Response:</span>
                      <p>{t.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: RESPONSIBLE SOCIAL GAMING CENTER                              */}
      {/* ==================================================================== */}
      {activeTab === 'responsible' && (
        <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-6 space-y-6 shadow-xl">
          <div className="pb-3 border-b border-[#1F2737] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HeartHandshake className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="font-display font-extrabold text-base sm:text-lg text-white">
                  Responsible Social Gaming Controls
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Set personal limits, session timers, and cooling-off intervals for healthy entertainment.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Player Protection Active</span>
            </div>
          </div>

          {/* Cooling-off Notice if currently excluded */}
          {isCurrentlyExcluded && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-bold block">Cooling-Off Period Active:</span>
                <span>You have paused your game participation until {new Date(parseInt(exclusionUntil, 10)).toLocaleString()}.</span>
              </div>
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Setting 1: Daily Wagering Cap */}
            <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1F2737] space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Daily Flow Coin Wagering Limit</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Caps the maximum amount of Flow Coins you can wager across all games in a 24-hour cycle.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {['none', '500', '1000', '2500', '5000'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSaveResponsibleLimits(val, sessionReminder)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      dailyLimit === val
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-[#151C2B] text-[#94A3B8] border border-[#272a31] hover:text-white'
                    }`}
                  >
                    {val === 'none' ? 'No Limit' : `${val} FC`}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 2: Session Timer */}
            <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1F2737] space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Session Duration Reality Check</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Receive an automatic visual reminder when your active gameplay session reaches this length.
              </p>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'off', label: 'Off' },
                  { id: '30', label: '30 Min' },
                  { id: '60', label: '60 Min' },
                  { id: '120', label: '120 Min' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSaveResponsibleLimits(dailyLimit, item.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      sessionReminder === item.id
                        ? 'bg-emerald-400 text-black shadow-md'
                        : 'bg-[#151C2B] text-[#94A3B8] border border-[#272a31] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 3: Self-Exclusion Cooling Off */}
            <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1F2737] space-y-3 md:col-span-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                <Lock className="w-4 h-4 text-purple-400" />
                <span>Voluntary Cooling-Off Pause</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Temporarily pause your ability to place wagers on all games. You can still access customer support and review past tickets.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSetSelfExclusion(24)}
                  className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold cursor-pointer transition-all"
                >
                  Take 24-Hour Break
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSelfExclusion(168)}
                  className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold cursor-pointer transition-all"
                >
                  7-Day Cooling Off
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSelfExclusion(720)}
                  className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold cursor-pointer transition-all"
                >
                  30-Day Timeout
                </button>
                {isCurrentlyExcluded && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('ef_self_exclusion_until');
                      setExclusionUntil(null);
                      showToast('Cooling-off pause ended.', 'info');
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 text-[#94A3B8] text-xs font-bold hover:text-white cursor-pointer"
                  >
                    Clear Pause
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Legal Compliance Disclaimer */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1F2737] text-[11px] text-[#94A3B8] space-y-1">
            <span className="font-bold text-white block uppercase tracking-wider text-[10px]">
              Social Gaming Entertainment Disclaimer:
            </span>
            <p>
              EarnFlow.In is strictly a free-to-play social entertainment platform using virtual Flow Coins (FC). Flow Coins cannot be purchased with fiat money, converted to real cash, or transferred between accounts. Players must be at least 18 years of age. Please play responsibly.
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
