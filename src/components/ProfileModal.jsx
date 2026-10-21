import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  X, 
  Copy, 
  Check, 
  ShieldCheck, 
  ArrowDownLeft, 
  ArrowUpRight, 
  LogOut,
  Wallet,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Edit3,
  Sparkles,
  Loader2,
  User
} from 'lucide-react';

export default function ProfileModal({ isOpen, onClose, onSwitchToAdmin }) {
  const { 
    user,
    profile,
    wallet, 
    updateTrc20Address,
    logout,
    setIsWalletModalOpen, 
    setWalletModalTab,
    setActiveTab,
    updateUsername,
    usernameChangeCount = 0,
    checkUsernameAvailability,
    platformSettings,
    showToast
  } = useLottery();

  const [trcInput, setTrcInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // User ID / Username editing state
  const currentUsername = profile?.username || user?.user_metadata?.username || (user?.email ? user.email.split('@')[0] : 'VIP_User');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState({ valid: false, message: '' });
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Debounced availability check
  useEffect(() => {
    if (!isEditingUsername) return;
    const clean = newUsernameInput.trim().replace(/^@\s*/, '').trim();
    if (!clean) {
      setUsernameAvailability({ valid: false, message: 'Please enter a User ID' });
      return;
    }
    if (clean.toLowerCase() === currentUsername.toLowerCase()) {
      setUsernameAvailability({ valid: false, message: 'Current User ID' });
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailability(clean);
      setUsernameAvailability(res);
      setIsCheckingUsername(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [newUsernameInput, isEditingUsername, currentUsername]);

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    if (isSavingUsername) return;
    const clean = newUsernameInput.trim().replace(/^@\s*/, '').trim();

    if (clean.toLowerCase() === currentUsername.toLowerCase()) {
      setIsEditingUsername(false);
      return;
    }

    if (!usernameAvailability.valid) {
      showToast(usernameAvailability.message || 'Please enter a valid User ID', 'error');
      return;
    }

    const fee = parseFloat(platformSettings?.usernameChangeFee ?? 5.0);
    if (usernameChangeCount > 0 && wallet.balance < fee) {
      showToast(`Insufficient USDT balance (${wallet.balance.toFixed(2)} USDT). Changing User ID costs ${fee} USDT.`, 'error');
      return;
    }

    setIsSavingUsername(true);
    try {
      const res = await updateUsername(clean);
      if (res.success) {
        setIsEditingUsername(false);
      } else {
        showToast(res.error || 'Failed to update User ID', 'error');
      }
    } finally {
      setIsSavingUsername(false);
    }
  };

  useEffect(() => {
    if (wallet.address) {
      setTrcInput(wallet.address);
    }
  }, [wallet.address]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    showToast('TRC-20 Address copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTrc20 = async (e) => {
    e.preventDefault();
    setSaveStatus('');
    const cleanAddr = trcInput.trim();

    if (!cleanAddr) {
      setSaveStatus('Please enter a TRC-20 address.');
      return;
    }

    if (!cleanAddr.startsWith('T') || cleanAddr.length !== 34) {
      setSaveStatus('Invalid TRC-20 address. It must start with "T" and be 34 characters long.');
      return;
    }

    const res = await updateTrc20Address(cleanAddr);
    if (res.success) {
      setIsEditing(false);
      showToast('TRC-20 Wallet Address saved successfully!', 'success');
    } else {
      setSaveStatus(res.error || 'Failed to update address.');
    }
  };

  const handleConnectTronLink = async () => {
    try {
      if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
        const tronAddr = window.tronWeb.defaultAddress.base58;
        setTrcInput(tronAddr);
        await updateTrc20Address(tronAddr);
        setIsEditing(false);
        showToast(`Connected TronLink: ${tronAddr.slice(0, 6)}...${tronAddr.slice(-4)}`, 'success');
      } else if (window.tronLink) {
        const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
        if (res && window.tronWeb && window.tronWeb.defaultAddress.base58) {
          const tronAddr = window.tronWeb.defaultAddress.base58;
          setTrcInput(tronAddr);
          await updateTrc20Address(tronAddr);
          setIsEditing(false);
          showToast(`Connected TronLink: ${tronAddr.slice(0, 6)}...${tronAddr.slice(-4)}`, 'success');
        }
      } else {
        setIsEditing(true);
        showToast('TronLink extension not detected. Please paste your TRC-20 address below.', 'info');
      }
    } catch (err) {
      console.error(err);
      setIsEditing(true);
      showToast('Please paste your TRC-20 address manually.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 xs:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#0f131c] border border-[rgba(245,196,81,0.3)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 no-scrollbar max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#1e232f] flex items-center justify-between bg-gradient-to-b from-[#141924] to-[#0f131c]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full p-0.5 shadow-md shrink-0">
              <img 
                src="/logo.png" 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover border border-[#ffd700]/40" 
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-sm sm:text-base text-white truncate">
                  @{currentUsername}
                </span>
                {profile?.role === 'super_admin' ? (
                  <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                    SUPER ADMIN
                  </span>
                ) : (
                  <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/30 font-bold shrink-0">
                    VIP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-[#9b8f7c] font-mono-numbers truncate">
                  {user?.email || 'Connected Account'}
                </p>
                <span className="text-[#3b4150]">•</span>
                {usernameChangeCount === 0 ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-mono-numbers font-medium">
                    <Sparkles className="w-2.5 h-2.5" />
                    1 Free Edit Left
                  </span>
                ) : (
                  <span className="text-[10px] text-[#f5c451] flex items-center gap-0.5 font-mono-numbers font-medium">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    Verified Player ID
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#191f2c] hover:bg-[#252d3d] text-[#8b92a2] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content with stable fixed structure */}
        <div className="p-5 space-y-4 no-scrollbar">

          {/* Super Admin Console Access (Only shown for super_admin) */}
          {profile?.role === 'super_admin' && (
            <div className="bg-gradient-to-r from-amber-500/15 via-[#1a2130] to-[#141924] border border-amber-500/40 rounded-xl p-3.5 space-y-2.5 shadow-lg shadow-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Super Admin Console</span>
                      <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40">VIP</span>
                    </div>
                    <p className="text-[10px] text-[#9b8f7c]">Manage pools, draws, users & 24h payout queues</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onSwitchToAdmin) {
                    onSwitchToAdmin();
                  } else {
                    sessionStorage.removeItem('earnflow_view_mode_user');
                    window.location.hash = '#admin';
                  }
                }}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-[#ffd700] to-[#f5c451] hover:from-[#f5c451] hover:to-[#ffd700] text-[#0b0e14] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Open Admin Console</span>
              </button>
            </div>
          )}

          {/* Player User ID / Handle Card */}
          <div className="bg-[#141924] border border-[#232938] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#ffd700]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Player User ID
                </span>
              </div>
              {usernameChangeCount === 0 ? (
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  1st Edit Free Lifetime
                </span>
              ) : (
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                  Fee: {platformSettings?.usernameChangeFee ?? '5.00'} USDT
                </span>
              )}
            </div>

            {!isEditingUsername ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#0b0e14] px-3.5 py-2.5 rounded-xl border border-[#1b2230]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-numbers font-bold text-sm text-[#ffd700] truncate">
                      @{currentUsername}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUsernameInput(currentUsername);
                      setIsEditingUsername(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#1a2130] hover:bg-[#252f45] border border-[#2d3a54] text-xs font-bold text-[#ffd700] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit User ID</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#8b92a2] px-1">
                  <span>
                    {usernameChangeCount === 0 
                      ? '🎁 You have 1 free lifetime User ID change available.' 
                      : `⚡ Edited ${usernameChangeCount} time(s). Next edit: ${platformSettings?.usernameChangeFee ?? '5.00'} USDT.`}
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveUsername} className="space-y-3">
                <div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-numbers font-bold text-sm text-[#ffd700]">
                      @
                    </span>
                    <input
                      type="text"
                      value={newUsernameInput}
                      onChange={(e) => setNewUsernameInput(e.target.value.replace(/^@\s*/, '').replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="Enter new User ID..."
                      maxLength={20}
                      autoFocus
                      className="w-full bg-[#0b0e14] border border-[#232938] focus:border-[#ffd700] rounded-xl pl-8 pr-9 py-2 text-xs text-white font-mono-numbers outline-none transition-colors"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingUsername ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#8b92a2] animate-spin" />
                      ) : usernameAvailability.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#05d5aa]" />
                      ) : newUsernameInput.trim().length >= 3 ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : null}
                    </div>
                  </div>

                  {/* Status / Notice */}
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className={usernameAvailability.valid ? 'text-[#05d5aa] font-medium' : 'text-amber-400 font-medium'}>
                      {usernameAvailability.message || '3-20 chars: letters, numbers, _ only'}
                    </span>
                    <span className="text-[10px] text-[#6b7280] font-mono-numbers">
                      {newUsernameInput.length}/20
                    </span>
                  </div>
                </div>

                {/* Fee notice box */}
                <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
                  usernameChangeCount === 0
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : wallet.balance < parseFloat(platformSettings?.usernameChangeFee ?? 5.0)
                    ? 'bg-red-950/20 border-red-500/30 text-red-300'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}>
                  {usernameChangeCount === 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>1st Edit Free:</strong> No USDT will be deducted from your wallet.</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between font-semibold mb-0.5">
                        <span>Fee: {platformSettings?.usernameChangeFee ?? '5.00'} USDT</span>
                        <span className="font-mono-numbers">Wallet: {wallet.balance.toFixed(2)} USDT</span>
                      </div>
                      <p className="text-[10px] opacity-85">
                        {wallet.balance < parseFloat(platformSettings?.usernameChangeFee ?? 5.0)
                          ? '⚠️ Insufficient balance! Please deposit USDT in your wallet to edit.'
                          : 'Amount will be deducted automatically from your on-chain wallet balance.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Save and Cancel buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={
                      !usernameAvailability.valid || 
                      isCheckingUsername || 
                      isSavingUsername || 
                      (usernameChangeCount > 0 && wallet.balance < parseFloat(platformSettings?.usernameChangeFee ?? 5.0))
                    }
                    className="flex-1 py-1.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSavingUsername ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Database...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Confirm & Save</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingUsername(false);
                      setNewUsernameInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1e232f] border border-[#2d3545] text-xs text-[#8b92a2] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
          
          {/* TRC-20 Wallet Management Card - Fixed Height Container */}
          <div className="bg-[#141924] border border-[#232938] rounded-xl p-4 min-h-[160px] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#ffd700]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  TRC-20 USDT Wallet
                </span>
              </div>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/30 font-bold">
                TRON (TRC-20)
              </span>
            </div>

            {/* If wallet address is present and not currently editing */}
            {wallet.address && !isEditing ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between bg-[#0b0e14] px-3 py-2 rounded-xl border border-[#1b2230]">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-[#05d5aa] shrink-0" />
                    <span className="font-mono-numbers text-xs text-[#e1e2eb] truncate">
                      {wallet.address}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-[#9b8f7c] hover:text-[#ffd700] transition-colors p-1 shrink-0 ml-2 cursor-pointer"
                    title="Copy Address"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#05d5aa]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-[#05d5aa] flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected & Ready for Draws
                  </span>
                  <button
                    onClick={() => { setIsEditing(true); setSaveStatus(''); }}
                    className="text-[11px] text-[#ffd700] hover:underline font-semibold cursor-pointer"
                  >
                    Change Address
                  </button>
                </div>

                <p className="text-[10px] text-[#64748b]">
                  Withdrawals and prize disbursals are automatically sent to this address.
                </p>
              </div>
            ) : (
              /* Input to paste TRC-20 Address or Connect TronLink */
              <form onSubmit={handleSaveTrc20} className="space-y-2">
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={trcInput}
                      onChange={(e) => { setTrcInput(e.target.value); setSaveStatus(''); }}
                      placeholder="Paste TRC-20 address (starts with T)..."
                      className={`w-full bg-[#0b0e14] border rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none transition-colors ${
                        saveStatus ? 'border-red-500 focus:border-red-500' : 'border-[#232938] focus:border-[#ffd700]'
                      }`}
                      required
                    />
                  </div>
                  
                  {/* Fixed-height reserved status slot to prevent modal expansion */}
                  <div className="h-5 mt-1 flex items-center">
                    {saveStatus ? (
                      <div className="text-[11px] text-red-400 flex items-center gap-1 font-medium truncate">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{saveStatus}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[#64748b] truncate">
                        Must start with 'T' and be exactly 34 characters.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Address
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectTronLink}
                    className="px-3 py-1.5 rounded-xl bg-[#1a2130] hover:bg-[#252f45] border border-[#2d3a54] text-xs font-bold text-[#38bdf8] flex items-center gap-1 cursor-pointer"
                    title="Detect TronLink Wallet"
                  >
                    TronLink
                  </button>
                  {wallet.address && (
                    <button
                      type="button"
                      onClick={() => { setIsEditing(false); setSaveStatus(''); setTrcInput(wallet.address); }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1e232f] border border-[#2d3545] text-xs text-[#8b92a2] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Balance & Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#141924] border border-[#232938] p-3.5 rounded-xl">
              <div className="text-[11px] text-[#8b92a2] mb-1">USDT Balance</div>
              <div className="font-mono-numbers font-bold text-lg text-[#ffd700]">
                {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-[#05d5aa] font-mono-numbers font-semibold mt-0.5">Tether TRC-20</div>
            </div>

            <div className="bg-[#141924] border border-[#232938] p-3.5 rounded-xl">
              <div className="text-[11px] text-[#8b92a2] mb-1">Lifetime Winnings</div>
              <div className="font-mono-numbers font-bold text-lg text-[#05d5aa]">
                +{wallet.lifetimeWon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-[#9b8f7c] font-mono-numbers mt-0.5">Automated Disbursals</div>
            </div>
          </div>

          {/* Quick Actions (Full Screen Page Navigation) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
                setWalletModalTab('deposit');
                setActiveTab('wallet');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="py-2.5 rounded-xl bg-[rgba(5,213,170,0.15)] hover:bg-[rgba(5,213,170,0.25)] border border-[#05d5aa]/30 text-[#05d5aa] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Deposit USDT
            </button>
            <button
              onClick={() => {
                onClose();
                setWalletModalTab('withdraw');
                setActiveTab('wallet');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="py-2.5 rounded-xl bg-[rgba(245,196,81,0.15)] hover:bg-[rgba(245,196,81,0.25)] border border-[#ffd700]/30 text-[#ffd700] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Withdraw 24h
            </button>
          </div>

          {/* Sign Out Button */}
          <div className="pt-2 border-t border-[#1e232f]">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out from Account
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
