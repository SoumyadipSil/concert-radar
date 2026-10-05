import type { Notifier } from './types';

const notifiers: Map<string, Notifier> = new Map();

/** Register a notifier. Call this once per channel at startup. */
export function registerNotifier(notifier: Notifier): void {
  if (notifiers.has(notifier.channel)) {
    throw new Error(`Notifier for channel "${notifier.channel}" is already registered`);
  }
  notifiers.set(notifier.channel, notifier);
}

/** Get a notifier by channel. */
export function getNotifier(channel: string): Notifier | undefined {
  return notifiers.get(channel);
}

/** Get all registered notifiers. */
export function getAllNotifiers(): Notifier[] {
  return Array.from(notifiers.values());
}
