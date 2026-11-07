/**
 * ============================================================================
 * USE SOUND FX HOOK — REACT BINDING FOR PROCEDURAL SOUND ENGINE
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { soundFX } from '../engine/SoundFXService';

export function useSoundFX() {
  const [enabled, setEnabledState] = useState(soundFX.isEnabled());
  const [volume, setVolumeState] = useState(soundFX.getVolume());

  useEffect(() => {
    const unsub = soundFX.subscribe(({ enabled: nextEnabled, volume: nextVolume }) => {
      setEnabledState(nextEnabled);
      setVolumeState(nextVolume);
    });
    return unsub;
  }, []);

  const toggleSound = useCallback(() => {
    return soundFX.toggle();
  }, []);

  const setVolume = useCallback((val) => {
    soundFX.setVolume(val);
  }, []);

  const setEnabled = useCallback((val) => {
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
    playWinFanfare: useCallback((tier) => soundFX.playWinFanfare(tier), []),
    playCardFlip: useCallback(() => soundFX.playCardFlip(), []),
    playDiceRoll: useCallback(() => soundFX.playDiceRoll(), []),
    playPlinkoBounce: useCallback((row) => soundFX.playPlinkoBounce(row), []),
    playPlinkoSlot: useCallback((mult) => soundFX.playPlinkoSlot(mult), []),
    playCoinflipToss: useCallback(() => soundFX.playCoinflipToss(), []),
    playCoinflipLand: useCallback((isWin) => soundFX.playCoinflipLand(isWin), []),
    playCrashHum: useCallback((mult) => soundFX.playCrashHum(mult), []),
    stopCrashHum: useCallback(() => soundFX.stopCrashHum(), []),
    playCrashExplosion: useCallback(() => soundFX.playCrashExplosion(), []),
    playCrashCashout: useCallback(() => soundFX.playCrashCashout(), []),
    playSlotSpin: useCallback(() => soundFX.playSlotSpin(), []),
    playSlotReelStop: useCallback((idx) => soundFX.playSlotReelStop(idx), []),
    playRouletteSpin: useCallback(() => soundFX.playRouletteSpin(), []),
    playRoulettePocket: useCallback((num) => soundFX.playRoulettePocket(num), []),
    playMinesReveal: useCallback((isGem) => soundFX.playMinesReveal(isGem), []),
    playLimboTick: useCallback(() => soundFX.playLimboTick(), []),
    playKenoPick: useCallback(() => soundFX.playKenoPick(), []),
    playDialTick: useCallback(() => soundFX.playDialTick(), []),
    playDialStop: useCallback((idx) => soundFX.playDialStop(idx), [])
  };
}

export default useSoundFX;

