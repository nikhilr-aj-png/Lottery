/**
 * Event Status Utility — EarnFlow.in
 *
 * Implements strict status rules:
 * - LIVE: Active/open events with ample time remaining (Light Green)
 * - EXPIRING SOON: Active events approaching expiration (<= 1 hour remaining) (Light Reddish)
 * - END: Expired or completed events (Light Red)
 *
 * Replaces all legacy "OPEN", "CONCLUDE", and "CONCLUDED" visible labels.
 */

export type EventStatusType = 'LIVE' | 'EXPIRING SOON' | 'END';

export interface EventStatusInfo {
  type: EventStatusType;
  label: string;
  badgeClass: string;
  textClass: string;
  dotClass: string;
  isEnd: boolean;
  isExpiringSoon: boolean;
  isLive: boolean;
  remainingMs: number;
}

/**
 * Calculates current event status based on backend status and draw timestamp.
 * @param event Lottery event object or game room object
 * @param expiringSoonThresholdMs Defaults to 1 hour (3,600,000 ms)
 */
export function getEventStatusInfo(
  event?: any,
  expiringSoonThresholdMs: number = 60 * 60 * 1000
): EventStatusInfo {
  if (!event) {
    return {
      type: 'END',
      label: 'END',
      badgeClass: 'bg-red-500/15 border border-red-500/30 text-red-400',
      textClass: 'text-red-400',
      dotClass: 'bg-red-500',
      isEnd: true,
      isExpiringSoon: false,
      isLive: false,
      remainingMs: 0
    };
  }

  const now = Date.now();
  const isExplicitlyCompleted = event.status === 'completed' || event.status === 'ended' || event.status === 'settled';
  const drawTime = typeof event.drawTime === 'number' 
    ? event.drawTime 
    : (event.draw_time ? Number(event.draw_time) : 0);

  const remainingMs = drawTime > 0 ? drawTime - now : 0;
  const isTimeExpired = drawTime > 0 && remainingMs <= 0;

  // 1. END Status
  if (isExplicitlyCompleted || isTimeExpired) {
    return {
      type: 'END',
      label: 'END',
      badgeClass: 'bg-red-500/15 border border-red-500/30 text-red-400',
      textClass: 'text-red-400',
      dotClass: 'bg-red-500',
      isEnd: true,
      isExpiringSoon: false,
      isLive: false,
      remainingMs: 0
    };
  }

  // 2. EXPIRING SOON Status (drawTime within threshold, e.g. <= 1 hour)
  if (drawTime > 0 && remainingMs > 0 && remainingMs <= expiringSoonThresholdMs) {
    return {
      type: 'EXPIRING SOON',
      label: 'EXPIRING SOON',
      badgeClass: 'bg-rose-500/15 border border-rose-500/35 text-rose-300',
      textClass: 'text-rose-300',
      dotClass: 'bg-rose-400 animate-ping',
      isEnd: false,
      isExpiringSoon: true,
      isLive: false,
      remainingMs
    };
  }

  // 3. LIVE Status
  return {
    type: 'LIVE',
    label: 'LIVE',
    badgeClass: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400 animate-pulse',
    isEnd: false,
    isExpiringSoon: false,
    isLive: true,
    remainingMs: Math.max(0, remainingMs)
  };
}
