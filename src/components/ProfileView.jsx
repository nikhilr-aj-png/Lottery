import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  User, 
  Wallet, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Edit3, 
  Save, 
  Sparkles, 
  Loader2, 
  Lock, 
  ArrowDownLeft, 
  ArrowUpRight, 
  LogOut, 
  ArrowLeft,
  DollarSign,
  Ticket,
  Trophy,
  Headphones,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

export default function ProfileView({ onSwitchToAdmin, onBackToHome }) {
  const { 
    user,
    profile,
    wallet, 
    updateTrc20Address,
    logout,
    setActiveTab,
    setWalletModalTab,
    updateUsername,
    usernameChangeCount = 0,
    checkUsernameAvailability,
    platformSettings,
    showToast
  } = useLottery();

  const [trcInput, setTrcInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressSaveStatus, setAddressSaveStatus] = useState('');

  // User ID / Username editing state
  const currentUsername = profile?.username || user?.user_metadata?.username || (user?.email ? user.email.split('@')[0] : 'VIP_User');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState({ valid: false, message: '' });
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Sync TRC-20 input with current wallet address
  useEffect(() => {
    if (wallet.address) {
      setTrcInput(wallet.address);
    }
  }, [wallet.address]);

  // Debounced availability check for User ID
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
  }, [newUsernameInput, isEditingUsername, currentUsername, checkUsernameAvailability]);

  const handleCopy = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    showToast('TRC-20 Address copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

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
        showToast('User ID updated successfully!', 'success');
      } else {
        showToast(res.error || 'Failed to update User ID', 'error');
      }
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveTrc20 = async (e) => {
    e.preventDefault();
    setAddressSaveStatus('');
    const cleanAddr = trcInput.trim();

    if (!cleanAddr) {
      setAddressSaveStatus('Please enter a TRC-20 address.');
      return;
    }

    if (!cleanAddr.startsWith('T') || cleanAddr.length !== 34) {
      setAddressSaveStatus('Invalid TRC-20 address. It must start with "T" and be 34 characters long.');
      return;
    }

    const res = await updateTrc20Address(cleanAddr);
    if (res.success) {
      setIsEditingAddress(false);
      showToast('TRC-20 Wallet Address saved successfully!', 'success');
    } else {
      setAddressSaveStatus(res.error || 'Failed to update address.');
    }
  };

  const handleConnectTronLink = async () => {
    try {
      if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
        const tronAddr = window.tronWeb.defaultAddress.base58;
        setTrcInput(tronAddr);
        await updateTrc20Address(tronAddr);
        setIsEditingAddress(false);
        showToast(`Connected TronLink: ${tronAddr.slice(0, 6)}...${tronAddr.slice(-4)}`, 'success');
      } else if (window.tronLink) {
        const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
        if (res && window.tronWeb && window.tronWeb.defaultAddress.base58) {
          const tronAddr = window.tronWeb.defaultAddress.base58;
          setTrcInput(tronAddr);
          await updateTrc20Address(tronAddr);
          setIsEditingAddress(false);
          showToast(`Connected TronLink: ${tronAddr.slice(0, 6)}...${tronAddr.slice(-4)}`, 'success');
        }
      } else {
        setIsEditingAddress(true);
        showToast('TronLink extension not detected. Please paste your TRC-20 address manually.', 'info');
      }
    } catch (err) {
      console.error(err);
      setIsEditingAddress(true);
      showToast('Please paste your TRC-20 address manually.', 'info');
    }
  };

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] 4k:max-w-[2400px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      

      {/* Super Admin Console Access Banner (if super_admin) */}
      {profile?.role === 'super_admin' && (
        <div className="bg-gradient-to-r from-amber-500/15 via-[#1a2130] to-[#141924] border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-amber-500/5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm sm:text-base text-white uppercase tracking-wider">
                  Super Admin Console Access
                </h3>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40">
                  Full Control
                </span>
              </div>
              <p className="text-xs text-[#9b8f7c] mt-0.5">
                Launch new on-chain pools, draw provably fair winners, manage users & disburse 24h payout queues.
              </p>
            </div>
          </div>
          <button
            onClick={onSwitchToAdmin}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>Launch Admin Console</span>
          </button>
        </div>
      )}

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Stat 1: Available USDT Balance */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-l-4 border-l-[#ffd700] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#9b8f7c] font-bold uppercase tracking-wider">
              Available Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-black text-2xl sm:text-3xl text-gold-gradient">
              {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-[#05d5aa] font-bold font-mono-numbers">USDT</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-[#1b2230]">
            <button
              onClick={() => {
                setWalletModalTab('deposit');
                setActiveTab('wallet');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-[11px] text-[#05d5aa] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowDownLeft className="w-3 h-3" />
              Deposit
            </button>
            <span className="text-[#3b4150]">•</span>
            <button
              onClick={() => {
                setWalletModalTab('withdraw');
                setActiveTab('wallet');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-[11px] text-[#ffd700] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpRight className="w-3 h-3" />
              Withdraw 24h
            </button>
          </div>
        </div>

        {/* Stat 2: Lifetime Won Prizes */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-l-4 border-l-[#05d5aa] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#9b8f7c] font-bold uppercase tracking-wider">
              Lifetime Winnings
            </span>
            <div className="w-8 h-8 rounded-lg bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-black text-2xl sm:text-3xl text-white">
              +{wallet.lifetimeWon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-[#05d5aa] font-bold font-mono-numbers">USDT</span>
          </div>
          <p className="text-[10px] text-[#05d5aa] mt-2.5 pt-2 border-t border-[#1b2230] font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Auto-credited to balance
          </p>
        </div>

        {/* Stat 3: Player VIP Role */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-l-4 border-l-[#9b8f7c] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#9b8f7c] font-bold uppercase tracking-wider">
              Account Status
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#141924] flex items-center justify-center text-[#ffd700]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display font-extrabold text-xl sm:text-2xl text-white">
            {profile?.role === 'super_admin' ? 'Super Admin' : 'VIP Member'}
          </div>
          <p className="text-[10px] text-[#9b8f7c] mt-2.5 pt-2 border-t border-[#1b2230] font-mono-numbers">
            {user?.email || 'Authenticated Player'}
          </p>
        </div>

        {/* Stat 4: TRC-20 Status */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-l-4 border-l-[#00f2fe] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#9b8f7c] font-bold uppercase tracking-wider">
              TRC-20 Settlement
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00f2fe]/15 flex items-center justify-center text-[#00f2fe]">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono-numbers font-bold text-sm sm:text-base text-white truncate">
            {wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : 'Not Configured'}
          </div>
          <p className="text-[10px] text-[#05d5aa] mt-2.5 pt-2 border-t border-[#1b2230] font-mono-numbers flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#05d5aa] animate-ping" />
            Direct Automated Payouts
          </p>
        </div>

      </div>

      {/* Main Two-Column Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* LEFT COLUMN: User ID & TRC-20 Wallet Configuration (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* CARD 1: VIP Player User ID */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#272a31] relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700]">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    VIP Player User ID
                  </h3>
                  <p className="text-xs text-[#9b8f7c]">
                    Unique public username visible on lucky leaderboards and winning ticket draws
                  </p>
                </div>
              </div>

              {usernameChangeCount === 0 ? (
                <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  1st Edit Free Lifetime
                </span>
              ) : (
                <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold shrink-0">
                  Fee: {platformSettings?.usernameChangeFee ?? '5.00'} USDT
                </span>
              )}
            </div>

            {!isEditingUsername ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#0b0e14] px-4 py-3 rounded-xl border border-[#1b2230]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[#9b8f7c]">Handle:</span>
                    <span className="font-mono-numbers font-bold text-base text-[#ffd700] truncate">
                      @{currentUsername}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUsernameInput(currentUsername);
                      setIsEditingUsername(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1a2130] hover:bg-[#252f45] border border-[#2d3a54] text-xs font-bold text-[#ffd700] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Change User ID</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#8b92a2] px-1">
                  <span>
                    {usernameChangeCount === 0 
                      ? '🎁 You have 1 free lifetime User ID change available.' 
                      : `⚡ Edited ${usernameChangeCount} time(s). Next edit: ${platformSettings?.usernameChangeFee ?? '5.00'} USDT.`}
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveUsername} className="space-y-3.5 pt-1">
                <div>
                  <label className="text-xs text-[#9b8f7c] font-medium mb-1.5 block">
                    Choose New User ID
                  </label>
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
                      className="w-full bg-[#0b0e14] border border-[#232938] focus:border-[#ffd700] rounded-xl pl-8 pr-10 py-2.5 text-xs text-white font-mono-numbers outline-none transition-colors"
                      required
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {isCheckingUsername ? (
                        <Loader2 className="w-4 h-4 text-[#8b92a2] animate-spin" />
                      ) : usernameAvailability.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-[#05d5aa]" />
                      ) : newUsernameInput.trim().length >= 3 ? (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className={usernameAvailability.valid ? 'text-[#05d5aa] font-medium' : 'text-amber-400 font-medium'}>
                      {usernameAvailability.message || '3-20 characters: letters, numbers, and _ only'}
                    </span>
                    <span className="text-[11px] text-[#6b7280] font-mono-numbers">
                      {newUsernameInput.length}/20
                    </span>
                  </div>
                </div>

                {/* Fee notice box */}
                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  usernameChangeCount === 0
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : wallet.balance < parseFloat(platformSettings?.usernameChangeFee ?? 5.0)
                    ? 'bg-red-950/20 border-red-500/30 text-red-300'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}>
                  {usernameChangeCount === 0 ? (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span><strong>1st Edit Free:</strong> No USDT will be deducted from your wallet balance.</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between font-semibold mb-0.5">
                        <span>Edit Fee: {platformSettings?.usernameChangeFee ?? '5.00'} USDT</span>
                        <span className="font-mono-numbers">Your Balance: {wallet.balance.toFixed(2)} USDT</span>
                      </div>
                      <p className="text-[11px] opacity-85">
                        {wallet.balance < parseFloat(platformSettings?.usernameChangeFee ?? 5.0)
                          ? '⚠️ Insufficient balance! Please deposit USDT into your wallet before changing User ID.'
                          : 'Amount will be deducted automatically from your on-chain wallet balance upon confirmation.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="submit"
                    disabled={
                      !usernameAvailability.valid || 
                      isCheckingUsername || 
                      isSavingUsername || 
                      (usernameChangeCount > 0 && wallet.balance < parseFloat(platformSettings?.usernameChangeFee ?? 5.0))
                    }
                    className="flex-1 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSavingUsername ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Profile Database...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Confirm & Update User ID</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingUsername(false);
                      setNewUsernameInput('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1e232f] border border-[#2d3545] text-xs text-[#8b92a2] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* CARD 2: TRC-20 USDT Settlement Address */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#272a31] relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa]">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    TRC-20 USDT Wallet Address
                  </h3>
                  <p className="text-xs text-[#9b8f7c]">
                    Non-custodial settlement address for automated 24h SLA prize disbursals
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded-full bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/30 font-bold shrink-0">
                TRON (TRC-20)
              </span>
            </div>

            {wallet.address && !isEditingAddress ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#0b0e14] px-4 py-3 rounded-xl border border-[#1b2230]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-[#05d5aa] shrink-0" />
                    <span className="font-mono-numbers text-xs sm:text-sm text-[#e1e2eb] truncate">
                      {wallet.address}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-[#9b8f7c] hover:text-[#ffd700] transition-colors p-1.5 shrink-0 ml-2 cursor-pointer rounded-lg hover:bg-white/5"
                    title="Copy Address"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#05d5aa]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#05d5aa] flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected & Verified for Instant Payouts
                  </span>
                  <button
                    onClick={() => { setIsEditingAddress(true); setAddressSaveStatus(''); }}
                    className="text-xs text-[#ffd700] hover:underline font-bold cursor-pointer"
                  >
                    Change Wallet
                  </button>
                </div>

                <p className="text-xs text-[#64748b] leading-relaxed">
                  All lottery winning prizes and 24h withdrawal disbursements are automatically settled to this on-chain address.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveTrc20} className="space-y-3">
                <div>
                  <label className="text-xs text-[#9b8f7c] font-medium mb-1.5 block">
                    Enter TRC-20 Address (TRON Network)
                  </label>
                  <input
                    type="text"
                    value={trcInput}
                    onChange={(e) => { setTrcInput(e.target.value); setAddressSaveStatus(''); }}
                    placeholder="Paste TRC-20 address starting with 'T'..."
                    className={`w-full bg-[#0b0e14] border rounded-xl px-3.5 py-2.5 text-xs text-white font-mono-numbers outline-none transition-colors ${
                      addressSaveStatus ? 'border-red-500 focus:border-red-500' : 'border-[#232938] focus:border-[#ffd700]'
                    }`}
                    required
                  />

                  {addressSaveStatus ? (
                    <div className="text-xs text-red-400 flex items-center gap-1.5 mt-1.5 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{addressSaveStatus}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#64748b] mt-1.5">
                      Must start with 'T' and be exactly 34 characters (Base58 TRON format).
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    Save Settlement Address
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectTronLink}
                    className="px-4 py-2.5 rounded-xl bg-[#1a2130] hover:bg-[#252f45] border border-[#2d3a54] text-xs font-bold text-[#38bdf8] flex items-center gap-1.5 cursor-pointer"
                    title="Detect TronLink Wallet"
                  >
                    Auto-Detect TronLink
                  </button>
                  {wallet.address && (
                    <button
                      type="button"
                      onClick={() => { setIsEditingAddress(false); setAddressSaveStatus(''); setTrcInput(wallet.address); }}
                      className="px-4 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1e232f] border border-[#2d3545] text-xs text-[#8b92a2] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Account Credentials, Security & Shortcuts (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">


          {/* CARD 4: Platform Quick Navigation */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#272a31] space-y-4">
            <h3 className="font-display font-bold text-base text-white">
              Platform Quick Access
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setActiveTab('wallet');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] hover:border-[#ffd700]/30 transition-all text-left flex flex-col justify-between cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700] mb-2 group-hover:scale-105 transition-transform">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#ffd700] transition-colors">
                    USDT Wallet
                  </div>
                  <div className="text-[10px] text-[#9b8f7c]">
                    Deposits & 24h Payouts
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('tickets');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] hover:border-[#ffd700]/30 transition-all text-left flex flex-col justify-between cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa] mb-2 group-hover:scale-105 transition-transform">
                  <Ticket className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#05d5aa] transition-colors">
                    My Tickets
                  </div>
                  <div className="text-[10px] text-[#9b8f7c]">
                    Track 4-digit combos
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('results');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] hover:border-[#ffd700]/30 transition-all text-left flex flex-col justify-between cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#00f2fe]/15 flex items-center justify-center text-[#00f2fe] mb-2 group-hover:scale-105 transition-transform">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#00f2fe] transition-colors">
                    Past Results
                  </div>
                  <div className="text-[10px] text-[#9b8f7c]">
                    Winning numbers & pools
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('contact');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] hover:border-[#ffd700]/30 transition-all text-left flex flex-col justify-between cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 mb-2 group-hover:scale-105 transition-transform">
                  <Headphones className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                    VIP Support
                  </div>
                  <div className="text-[10px] text-[#9b8f7c]">
                    24/7 Support desk
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* CARD 5: Account Sign Out */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-red-500/20 bg-red-950/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">
                  Session Management
                </h4>
                <p className="text-[11px] text-[#9b8f7c]">
                  Safely disconnect from this device
                </p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
