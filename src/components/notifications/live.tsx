'use client';

import type { AppNotification } from '@/types/notification';

// Placeholder until the notifications area lands. The real version opens the
// live stream (GET /api/proxy/me/events) for signed-in visitors, shows toasts
// and calls useLiveEvent listeners. The API below is the contract other areas
// code against; keep it.
export function LiveUpdates({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Run `onEvent` when a live notification whose type matches arrives (e.g. a
// booking change, to refetch the day), or with null when events may have been
// missed (a resync: refetch whatever is on screen). Folded into one call per
// burst by the real implementation.
export function useLiveEvent(
  _matches: (type: string) => boolean,
  _onEvent: (notification: AppNotification | null) => void,
): void {}
