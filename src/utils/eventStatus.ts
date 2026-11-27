/**
 * Event Status Utility — EarnFlow.in
 *
 * Implements strict lifecycle status separation evaluated against authoritative
 * server timestamps:
 *   Draft -> Scheduled -> Active -> Expired -> Processing -> Completed
 */

export type EventStatusType = 'UPCOMING' | 'LIVE' | 'EXPIRING SOON' | 'END';

export interface EventStatusInfo {
  type: EventStatusType;
  label: string;
  badgeClass: string;
  textClass: string;
  dotClass: string;
  isEnd: boolean;
  isExpired: boolean;
  isProcessing: boolean;
  isFinalized: boolean;
  isUpcoming: boolean;
  isScheduledUnpublished: boolean;
  isExpiringSoon: boolean;
  isLive: boolean;
  remainingMs: number;
  startTimeMs: number;
  expiresAtMs: number;
  finalizedAtMs: number;
  ticketVisibilityUntilMs: number;
  visibilityRemainingMs: number;
  isWithinPostFinalizationVisibility: boolean;
}

export function computeDurationMs(durationValue?: any, durationUnit?: any): number {
  const n = Number(durationValue || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const u = String(durationUnit || 'hours').toLowerCase().trim();
  if (u.startsWith('min')) return Math.round(n * 60 * 1000);
  if (u.startsWith('day')) return Math.round(n * 86400 * 1000);
  return Math.round(n * 3600 * 1000);
}

export function resolveEventWindow(event?: any): { startTimeMs: number; expiresAtMs: number } {
  if (!event) return { startTimeMs: 0, expiresAtMs: 0 };
  const startTimeMs = Number(event.startTime ?? event.start_time ?? 0) || 0;
  const drawTimeMs = Number(event.drawTime ?? event.draw_time ?? 0) || 0;
  const durMs = computeDurationMs(
    event.durationValue ?? event.duration_value,
    event.durationUnit ?? event.duration_unit
  );

  const computedEnd = startTimeMs > 0 && durMs > 0 ? startTimeMs + durMs : 0;
  let expiresAtMs = 0;
  if (drawTimeMs > 0 && computedEnd > 0) {
    expiresAtMs = Math.min(drawTimeMs, computedEnd);
  } else if (drawTimeMs > 0) {
    expiresAtMs = drawTimeMs;
  } else if (computedEnd > 0) {
    expiresAtMs = computedEnd;
  }

  return { startTimeMs, expiresAtMs };
}

function toEpochMs(val?: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) && val > 0 ? val : 0;
  const parsed = new Date(val).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Calculates current event status based on backend status, availability window,
 * finalization timestamp, 1-hour visibility deadline, and server timestamp.
 */
export function getEventStatusInfo(
  event?: any,
  expiringSoonThresholdMs: number = 60 * 60 * 1000,
  nowMs: number = Date.now()
): EventStatusInfo {
  if (!event || event.isSyntheticFallback) {
    return {
      type: 'END',
      label: 'END',
      badgeClass: 'bg-red-500/15 border border-red-500/30 text-red-400',
      textClass: 'text-red-400',
      dotClass: 'bg-red-500',
      isEnd: true,
      isExpired: true,
      isProcessing: false,
      isFinalized: false,
      isUpcoming: false,
      isScheduledUnpublished: false,
      isExpiringSoon: false,
      isLive: false,
      remainingMs: 0,
      startTimeMs: 0,
      expiresAtMs: 0,
      finalizedAtMs: 0,
      ticketVisibilityUntilMs: 0,
      visibilityRemainingMs: 0,
      isWithinPostFinalizationVisibility: false
    };
  }

  const rawStatus = String(event.status ?? event.eventStatus ?? event.event_status ?? '').toLowerCase().trim();
  const isDeleted = Boolean(event.isDeleted ?? event.is_deleted) || rawStatus === 'deleted';
  const isPaused = Boolean(event.isPaused ?? event.is_paused) || rawStatus === 'paused';
  const publishedAtMs = toEpochMs(event.publishedAtMs ?? event.published_at_ms ?? event.publishedAt ?? event.published_at);
  const scheduledPublishAtMs = toEpochMs(event.scheduledPublishAtMs ?? event.scheduled_publish_at_ms ?? event.scheduledPublishAt ?? event.scheduled_publish_at);
  const isScheduledUnpublished =
    (rawStatus === 'scheduled' || rawStatus === 'draft') &&
    publishedAtMs <= 0;

  const isActiveFlag = event.isActive !== false && event.is_active !== false && event.eventIsActive !== false;

  const finalizedAtMs = toEpochMs(event.finalizedAtMs ?? event.finalized_at_ms ?? event.finalizedAt ?? event.finalized_at ?? event.drawExecutedAt ?? event.draw_executed_at);
  const explicitVisUntilMs = toEpochMs(event.ticketVisibilityUntilMs ?? event.ticket_visibility_until_ms ?? event.ticketVisibilityUntil ?? event.ticket_visibility_until);
  const ticketVisibilityUntilMs = explicitVisUntilMs > 0
    ? explicitVisUntilMs
    : (finalizedAtMs > 0 ? finalizedAtMs + 3600 * 1000 : 0);

  const isFinalized =
    ['completed', 'settled'].includes(rawStatus) &&
    (finalizedAtMs > 0 || Boolean(event.winningDigits || event.winning_digits));

  const isProcessing = !isFinalized && (rawStatus === 'processing' || rawStatus === 'result_pending');

  const visibilityRemainingMs = isFinalized && ticketVisibilityUntilMs > 0
    ? Math.max(0, ticketVisibilityUntilMs - nowMs)
    : 0;
  const isWithinPostFinalizationVisibility = isFinalized && visibilityRemainingMs > 0;

  const { startTimeMs, expiresAtMs } = resolveEventWindow(event);

  // 1. SCHEDULED / DRAFT before official publication time
  if (!isDeleted && !isPaused && !isFinalized && (isScheduledUnpublished || rawStatus === 'upcoming' || (startTimeMs > 0 && nowMs < startTimeMs))) {
    const waitTarget = scheduledPublishAtMs > 0 ? scheduledPublishAtMs : startTimeMs;
    return {
      type: 'UPCOMING',
      label: isScheduledUnpublished ? 'SCHEDULED' : 'UPCOMING',
      badgeClass: 'bg-blue-500/15 border border-blue-500/30 text-blue-300',
      textClass: 'text-blue-300',
      dotClass: 'bg-blue-400',
      isEnd: false,
      isExpired: false,
      isProcessing: false,
      isFinalized: false,
      isUpcoming: true,
      isScheduledUnpublished,
      isExpiringSoon: false,
      isLive: false,
      remainingMs: waitTarget > 0 ? Math.max(0, waitTarget - nowMs) : 0,
      startTimeMs,
      expiresAtMs,
      finalizedAtMs: 0,
      ticketVisibilityUntilMs: 0,
      visibilityRemainingMs: 0,
      isWithinPostFinalizationVisibility: false
    };
  }

  const isExplicitlyStopped =
    isFinalized ||
    isProcessing ||
    ['ended', 'expired'].includes(rawStatus) ||
    isDeleted ||
    isPaused ||
    !isActiveFlag;

  // 2. Explicit END / Completed / Processing / Expired / Deleted / Paused
  if (isExplicitlyStopped) {
    return {
      type: 'END',
      label: isPaused ? 'PAUSED' : isFinalized ? 'COMPLETED' : isProcessing ? 'PROCESSING' : 'EXPIRED',
      badgeClass: isFinalized
        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
        : isProcessing
          ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
          : 'bg-red-500/15 border border-red-500/30 text-red-400',
      textClass: isFinalized ? 'text-emerald-300' : isProcessing ? 'text-indigo-300' : 'text-red-400',
      dotClass: isFinalized ? 'bg-emerald-400' : isProcessing ? 'bg-indigo-400' : 'bg-red-500',
      isEnd: true,
      isExpired: true,
      isProcessing,
      isFinalized,
      isUpcoming: false,
      isScheduledUnpublished: false,
      isExpiringSoon: false,
      isLive: false,
      remainingMs: 0,
      startTimeMs,
      expiresAtMs,
      finalizedAtMs,
      ticketVisibilityUntilMs,
      visibilityRemainingMs,
      isWithinPostFinalizationVisibility
    };
  }

  // 3. Current server time >= expiration -> EXPIRED (Winning digits locked, awaiting automatic processing)
  const remainingMs = expiresAtMs > 0 ? expiresAtMs - nowMs : 0;
  if (expiresAtMs <= 0 || remainingMs <= 0) {
    return {
      type: 'END',
      label: 'EXPIRED',
      badgeClass: 'bg-amber-500/15 border border-amber-500/30 text-amber-300',
      textClass: 'text-amber-300',
      dotClass: 'bg-amber-400',
      isEnd: true,
      isExpired: true,
      isProcessing: false,
      isFinalized: false,
      isUpcoming: false,
      isScheduledUnpublished: false,
      isExpiringSoon: false,
      isLive: false,
      remainingMs: 0,
      startTimeMs,
      expiresAtMs,
      finalizedAtMs: 0,
      ticketVisibilityUntilMs: 0,
      visibilityRemainingMs: 0,
      isWithinPostFinalizationVisibility: false
    };
  }

  // 4. EXPIRING SOON
  if (remainingMs <= expiringSoonThresholdMs) {
    return {
      type: 'EXPIRING SOON',
      label: 'EXPIRING SOON',
      badgeClass: 'bg-amber-500/15 border border-amber-500/35 text-amber-300',
      textClass: 'text-amber-300',
      dotClass: 'bg-amber-400 animate-pulse',
      isEnd: false,
      isExpired: false,
      isProcessing: false,
      isFinalized: false,
      isUpcoming: false,
      isScheduledUnpublished: false,
      isExpiringSoon: true,
      isLive: true,
      remainingMs,
      startTimeMs,
      expiresAtMs,
      finalizedAtMs: 0,
      ticketVisibilityUntilMs: 0,
      visibilityRemainingMs: 0,
      isWithinPostFinalizationVisibility: false
    };
  }

  // 5. LIVE
  return {
    type: 'LIVE',
    label: 'LIVE',
    badgeClass: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400 animate-pulse',
    isEnd: false,
    isExpired: false,
    isProcessing: false,
    isFinalized: false,
    isUpcoming: false,
    isScheduledUnpublished: false,
    isExpiringSoon: false,
    isLive: true,
    remainingMs,
    startTimeMs,
    expiresAtMs,
    finalizedAtMs: 0,
    ticketVisibilityUntilMs: 0,
    visibilityRemainingMs: 0,
    isWithinPostFinalizationVisibility: false
  };
}
