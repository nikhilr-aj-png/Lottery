import React, { useState } from 'react';
import { useLottery } from '../context/LotteryContext';
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
  MessageSquare
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
    a: 'All registered players can claim 100 free Flow Coins every 24 hours through our daily faucet. Additionally, players receive a 500 FC welcome grant upon registration and bonus Flow Coins through achievement milestones.'
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
  const { showToast } = useLottery();
  
  // Accordion state
  const [openFaq, setOpenFaq] = useState(0);

  // Support form state
  const [ticketCategory, setTicketCategory] = useState('Provably Fair');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      showToast('Please fill in both subject and message.', 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedTicket({
        id: ticketId,
        category: ticketCategory,
        subject: ticketSubject
      });
      setIsSubmitting(false);
      setTicketSubject('');
      setTicketMessage('');
      showToast(`Support Ticket #${ticketId} created successfully!`, 'success');
    }, 600);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left">
      
      {/* 1. HERO HEADER */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono-numbers font-bold">
            <Headphones className="w-3.5 h-3.5 text-purple-400" />
            <span>PLAYER SUPPORT & COMPLIANCE</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
            Customer Support & FAQ
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Need help with game rules, Provably Fair cryptographic verification, or account settings? Our support team and knowledge base are available 24/7.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: FAQ ACCORDION (7 cols) */}
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
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
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

        {/* RIGHT COLUMN: SUBMIT TICKET FORM (5 cols) */}
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
                  Ticket #{submittedTicket.id} Created
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Our support team will review your inquiry regarding "{submittedTicket.subject}".
                </p>
                <button
                  onClick={() => setSubmittedTicket(null)}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold transition-colors cursor-pointer"
                >
                  Create Another Ticket
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-3 pt-3">
                {/* Category */}
                <div>
                  <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                    Inquiry Category:
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="Provably Fair">Provably Fair Verification</option>
                    <option value="Account">Account & Username</option>
                    <option value="Rules">Game Rules Inquiry</option>
                    <option value="Bug">Bug Report</option>
                    <option value="Suggestion">Feature Suggestion</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                    Subject:
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of inquiry..."
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="text-[11px] font-mono-numbers font-bold text-[#94A3B8] block mb-1">
                    Message Details:
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Provide details about the issue or question..."
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl p-3 text-xs text-white outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl btn-gold text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Inquiry'}</span>
                </button>
              </form>
            )}
          </div>

          <div className="pt-3 border-t border-[#1F2737] text-[10px] text-[#64748B]">
            Support responses are logged to your player profile.
          </div>
        </div>

      </div>

      {/* 3. RESPONSIBLE SOCIAL GAMING BANNER */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-white">
              Responsible Social Gaming
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Gaming should always remain entertaining. Since all activities use free Flow Coins without real money stakes, enjoy pure fun, set personal time boundaries, and pause whenever you need.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] text-xs font-mono-numbers text-amber-300 font-bold">
            100% Social Entertainment
          </span>
        </div>
      </div>

    </div>
  );
}

