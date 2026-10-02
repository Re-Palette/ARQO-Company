import type { NotificationProvider } from "../types";

/**
 * App Notification. The notification row itself is the in-app message and the
 * dashboard reads it (Realtime / polling), so delivery is recording only.
 */
export const inAppProvider: NotificationProvider = {
  id: "in_app",
  capabilities: () => ({ richText: true, image: true, actionButtons: true, deepLink: true, maxLength: 4000 }),
  validateConfig: () => [],
  send: async (message) => ({ status: "sent", providerMessageId: message.id }),
};
