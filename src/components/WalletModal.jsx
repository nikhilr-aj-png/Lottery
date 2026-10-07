import React, { useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';

export default function WalletModal() {
  const { isWalletModalOpen, setIsWalletModalOpen, setActiveTab } = useLottery();

  useEffect(() => {
    if (isWalletModalOpen) {
      setActiveTab('wallet');
      setIsWalletModalOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isWalletModalOpen, setActiveTab, setIsWalletModalOpen]);

  return null;
}
