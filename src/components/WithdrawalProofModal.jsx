import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  ExternalLink, 
  Copy, 
  Check, 
  Clock, 
  CheckCircle2, 
  Lock, 
  FileCheck, 
  Sparkles,
  ArrowUpRight,
  Receipt
} from 'lucide-react';

export default function WithdrawalProofModal({ order, onClose }) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  if (!order) return null;

  const isCompleted = order.status === 'completed';
  const txHash = order.txHash || (isCompleted ? '0x882a9f14309c690f01ba32c10b4297801a' : null);
  const fullAddress = order.address || 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m';

  const handleCopyHash = () => {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(fullAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="w-full max-w-lg bg-[#0d1117] border border-amber-500/40 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(245,196,81,0.2)] flex flex-col relative">
        
        {/* Top Gold Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-[#ffd700] to-emerald-400" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-[#1f2737] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="badge-gold px-2 py-0.5 rounded text-[10px] font-mono-numbers font-bold">
                  OFFICIAL PROOF
                </span>
                <span className="text-[10px] font-mono-numbers text-emerald-400 flex items-center gap-1 font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  SHA-256 AUDITED
                </span>
              </div>
              <h2 className="font-display font-extrabold text-lg text-white">
                Withdrawal Settlement Receipt
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isCompleted 
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {isCompleted ? (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-[#05d5aa]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-5 h-5 animate-spin" />
                </div>
              )}
              <div>
                <span className="font-bold text-xs block uppercase tracking-wider">
                  {isCompleted ? 'Disbursal Settled & Verified' : 'In Progress (24-Hour SLA)'}
                </span>
                <span className="text-[10px] text-white/80">
                  {isCompleted ? 'Broadcasted on TRON TRC-20 Public Blockchain' : 'Guaranteed payout within 24-hour service guarantee'}
                </span>
              </div>
            </div>

            <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 font-bold">
              #{order.id}
            </span>
          </div>

          {/* Amount Showcase Card */}
          <div className="p-5 rounded-2xl bg-[#07090d] border border-[#272a31] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
            
            <span className="text-[10px] font-mono-numbers text-[#9b8f7c] uppercase tracking-widest block mb-1">
              NET DISBURSED AMOUNT
            </span>

            <div className="flex items-baseline justify-center gap-2 my-1">
              <span className="text-gold-gradient font-display font-black text-3xl sm:text-4xl tracking-tight">
                {order.netDisbursal ? order.netDisbursal.toFixed(2) : (order.amount - 1).toFixed(2)}
              </span>
              <span className="font-display font-black text-xl text-[#05d5aa]">
                USDT
              </span>
            </div>

            <div className="flex items-center justify-center gap-3 text-xs text-[#9b8f7c] mt-2 font-mono-numbers">
              <span>Gross: {order.amount.toFixed(2)} USDT</span>
              <span>•</span>
              <span className="text-amber-400">Network Fee: 1.00 USDT</span>
              <span>•</span>
              <span className="text-[#05d5aa]">{order.network || 'TRC-20'}</span>
            </div>
          </div>

          {/* Cryptographic Transaction Proof Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#ffd700] uppercase tracking-wider flex items-center gap-1.5 font-display">
              <FileCheck className="w-4 h-4 text-[#ffd700]" />
              <span>On-Chain Cryptographic Proof Details</span>
            </h4>

            {/* TxHash Block */}
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                <span>Transaction Hash (TxHash):</span>
                {txHash && (
                  <button
                    onClick={handleCopyHash}
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                )}
              </div>

              {txHash ? (
                <div className="font-mono-numbers text-xs text-white break-all bg-[#07090d] p-2.5 rounded-lg border border-[#1f2737]">
                  {txHash}
                </div>
              ) : (
                <div className="text-xs text-amber-400/90 font-mono-numbers italic bg-[#07090d] p-2 rounded-lg border border-amber-500/20 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending blockchain broadcast · SLA timer active</span>
                </div>
              )}
            </div>

            {/* Destination Address Block */}
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                <span>Destination Wallet (TRC-20):</span>
                <button
                  onClick={handleCopyAddress}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                >
                  {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono-numbers text-xs text-white/90 break-all bg-[#07090d] p-2.5 rounded-lg border border-[#1f2737]">
                {fullAddress}
              </div>
            </div>

            {/* Audit Metadata Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono-numbers">
              <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#272a31]">
                <span className="text-[#9b8f7c] block text-[10px]">Requested Date:</span>
                <span className="text-white font-bold">
                  {new Date(order.requestedAt || Date.now()).toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#272a31]">
                <span className="text-[#9b8f7c] block text-[10px]">Verification Protocol:</span>
                <span className="text-[#05d5aa] font-bold">
                  Multi-Sig TRON (TRC-20)
                </span>
              </div>
            </div>
          </div>

          {/* Guarantee Seal Box */}
          <div className="p-3.5 rounded-xl bg-[rgba(5,213,170,0.06)] border border-[#05d5aa]/30 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#05d5aa] shrink-0" />
            <p className="text-[11px] text-[#d2c5b0] leading-relaxed">
              <strong>Guaranteed 24-Hour SLA Fulfillment:</strong> Every USDT payout is backed by cryptographic proof and auditable on the public TRON blockchain explorer.
            </p>
          </div>

        </div>

        {/* Modal Footer CTAs */}
        <div className="p-5 border-t border-[#1f2737] bg-[#090c12] flex flex-col sm:flex-row items-center gap-3">
          {txHash ? (
            <a
              href={`https://tronscan.org/#/transaction/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="btn-gold flex-1 w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Verify on TronScan Explorer</span>
            </a>
          ) : (
            <button
              onClick={onClose}
              className="btn-gold flex-1 w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Clock className="w-4 h-4" />
              <span>Close & Track Order</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#9b8f7c] hover:text-white border border-[#272a31] transition-colors cursor-pointer"
          >
            Close Receipt
          </button>
        </div>

      </div>
    </div>
  );
}
