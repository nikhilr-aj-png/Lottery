import React, { useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import AdminAuthGate from './AdminAuthGate';
import AdminConsole from './AdminConsole';

export default function AdminPortal({ onSwitchToUserLobby }) {
  const { user, profile, logout } = useLottery();
  const [passcodeAuth, setPasscodeAuth] = useState(() => {
    return sessionStorage.getItem('earnflow_admin_auth') === 'true';
  });

  // Allowed if user has database role super_admin OR authenticated with master key
  const isSuperAdmin = (user && profile?.role === 'super_admin') || passcodeAuth;

  const handleAuthenticated = () => {
    setPasscodeAuth(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('earnflow_admin_auth');
    setPasscodeAuth(false);
    logout();
    if (onSwitchToUserLobby) {
      onSwitchToUserLobby();
    } else {
      window.location.hash = '';
      window.location.href = '/';
    }
  };

  if (!isSuperAdmin) {
    return <AdminAuthGate onAuthenticated={handleAuthenticated} onCancel={onSwitchToUserLobby} />;
  }

  return <AdminConsole onLogout={handleLogout} onSwitchToUserLobby={onSwitchToUserLobby} />;
}
