/**
 * ============================================================================
 * USE SOUND FX HOOK — REACT BINDING FOR PROCEDURAL SOUND ENGINE
 * ============================================================================
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
  playCardFlip: () => void;
  playDiceRoll: () => void;
  playPlinkoBounce: (row?: number) => void;
  playPlinkoSlot: (mult?: number) => void;
  playCoinflipToss: () => void;
  playCoinflipLand: (isWin?: boolean) => void;
  playCrashHum: (mult?: number) => void;
  stopCrashHum: () => void;
  playCrashExplosion: () => void;
  playCrashCashout: () => void;
  playSlotSpin: () => void;
  playSlotReelStop: (idx?: number) => void;
  playRouletteSpin: () => void;
  playRoulettePocket: (num?: number | string) => void;
  playMinesReveal: (isGem?: boolean) => void;
  playLimboTick: () => void;
  playKenoPick: () => void;
  playDialTick: () => void;
  playDialStop: (idx?: number) => void;
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
    // Direct audio triggers
    playClick: useCallback(() => soundFX.playClick(), []),
    playChipBet: useCallback(() => soundFX.playChipBet(), []),
    playWinFanfare: useCallback((tier?: 'standard' | 'big' | 'jackpot') => soundFX.playWinFanfare(tier), []),
    playCardFlip: useCallback(() => soundFX.playCardFlip(), []),
    playDiceRoll: useCallback(() => soundFX.playDiceRoll(), []),
    playPlinkoBounce: useCallback((row?: number) => soundFX.playPlinkoBounce(row), []),
    playPlinkoSlot: useCallback((mult?: number) => soundFX.playPlinkoSlot(mult), []),
    playCoinflipToss: useCallback(() => soundFX.playCoinflipToss(), []),
    playCoinflipLand: useCallback((isWin?: boolean) => soundFX.playCoinflipLand(isWin), []),
    playCrashHum: useCallback((mult?: number) => soundFX.playCrashHum(mult), []),
    stopCrashHum: useCallback(() => soundFX.stopCrashHum(), []),
    playCrashExplosion: useCallback(() => soundFX.playCrashExplosion(), []),
    playCrashCashout: useCallback(() => soundFX.playCrashCashout(), []),
    playSlotSpin: useCallback(() => soundFX.playSlotSpin(), []),
    playSlotReelStop: useCallback((idx?: number) => soundFX.playSlotReelStop(idx), []),
    playRouletteSpin: useCallback(() => soundFX.playRouletteSpin(), []),
    playRoulettePocket: useCallback((num?: number | string) => soundFX.playRoulettePocket(num), []),
    playMinesReveal: useCallback((isGem?: boolean) => soundFX.playMinesReveal(isGem), []),
    playLimboTick: useCallback(() => soundFX.playLimboTick(), []),
    playKenoPick: useCallback(() => soundFX.playKenoPick(), []),
    playDialTick: useCallback(() => soundFX.playDialTick(), []),
    playDialStop: useCallback((idx?: number) => soundFX.playDialStop(idx), [])
  };
}

export default useSoundFX;
