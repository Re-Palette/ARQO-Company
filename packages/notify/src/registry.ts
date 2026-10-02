import { discordProvider, slackProvider } from "./providers/webhook-chat";
import { inAppProvider } from "./providers/in-app";
import { webPushProvider } from "./providers/web-push";
import type { NotificationProvider } from "./types";

const providers = new Map<string, NotificationProvider>(
  [inAppProvider, webPushProvider, slackProvider, discordProvider].map((p) => [p.id, p]),
);

/** Add a channel (e.g. LINE) by registering a provider; callers do not change. */
export function registerNotificationProvider(provider: NotificationProvider): void {
  providers.set(provider.id, provider);
}

export function getNotificationProvider(id: string): NotificationProvider | undefined {
  return providers.get(id);
}

export function notificationProviderIds(): string[] {
  return [...providers.keys()];
}
