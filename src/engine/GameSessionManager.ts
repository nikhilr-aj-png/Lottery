/**
 * ============================================================================
 * GAME SESSION MANAGER — FOUR-DIGIT LOTTERY PLATFORM
 * ============================================================================
 * Coordinates session and ticket state for Four-Digit Lottery.
 */

export type SessionStatus = 'idle' | 'purchasing' | 'confirmed' | 'error';

export interface GameSessionState {
  gameId: 'lottery';
  status: SessionStatus;
  error?: string | null;
}

export class GameSessionManager {
  private status: SessionStatus = 'idle';

  getStatus(): SessionStatus {
    return this.status;
  }

  setStatus(s: SessionStatus): void {
    this.status = s;
  }
}

export const gameSessionManager = new GameSessionManager();
