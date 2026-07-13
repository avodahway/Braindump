import type { AnalyticsEvent } from '../lib/types';
import { loadSettings } from './client';
import { trackPublicEvent } from './publicClient';

export function trackEvent(event: AnalyticsEvent): void {
  const settings = loadSettings();
  if (settings.backendMode !== 'public' || !settings.publicApiBaseUrl) return;

  void trackPublicEvent(settings.publicApiBaseUrl, event).catch(() => {
    // Analytics must never interrupt the capture or creation flow.
  });
}
