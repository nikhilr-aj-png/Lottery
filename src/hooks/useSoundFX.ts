/**
 * ============================================================================
 * USE SOUND FX HOOK — REACT BINDING FOR PROCEDURAL SOUND ENGINE
 * ============================================================================
 * Dedicated audio controls for Four-Digit Lottery platform.
 */

import { useState, useEffect, useCallback } from 'react';
import { soundFX, SoundFXService } from '../engine/SoundFXService';

export interface UseSoundFXReturn {
  enabled: boolean;
  volume: number;
  toggleSound: () => boolean;
  setVolume: (val: number | string) => void;
  setEnabled: (val: boolean) => void;
  soundFX: SoundFXService;
  playClick: () => void;
  playChipBet: () => void;
  playWinFanfare: (tier?: 'standard' | 'big' | 'jackpot') => void;
  playDialTick: () => void;
  playDialStop: (idx?: number) => void;
  playRouletteSpin: () => void;
}

export function useSoundFX(): UseSoundFXReturn {
  const [enabled, setEnabledState] = useState<boolean>(soundFX.isEnabled());
  const [volume, setVolumeState] = useState<number>(soundFX.getVolume());

  useEffect(() => {
    const unsub = soundFX.subscribe(({ enabled: nextEnabled, volume: nextVolume }) => {
      setEnabledState(nextEnabled);
      setVolumeState(nextVolume);
    });
    return () => {
      unsub();
    };
  }, []);

  const toggleSound = useCallback(() => {
    return soundFX.toggle();
  }, []);

  const setVolume = useCallback((val: number | string) => {
    soundFX.setVolume(val);
  }, []);

  const setEnabled = useCallback((val: boolean) => {
    soundFX.setEnabled(val);
  }, []);

  return {
    enabled,
    volume,
    toggleSound,
    setVolume,
    setEnabled,
    soundFX,
    playClick: useCallback(() => soundFX.playClick(), []),
    playChipBet: useCallback(() => soundFX.playChipBet(), []),
    playWinFanfare: useCallback((tier?: 'standard' | 'big' | 'jackpot') => soundFX.playWinFanfare(tier), []),
    playDialTick: useCallback(() => soundFX.playDialTick(), []),
    playDialStop: useCallback((idx?: number) => soundFX.playDialStop(idx), []),
    playRouletteSpin: useCallback(() => soundFX.playDialTick(), [])
  };
}

export default useSoundFX;
