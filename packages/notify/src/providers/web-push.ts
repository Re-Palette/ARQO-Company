import type { NotificationProvider } from "../types";

/**
 * Web Push (PWA). Phase 0 registers the provider and validates configuration;
 * VAPID signing and subscription delivery are implemented in Phase 3.
 */
export const webPushProvider: NotificationProvider = {
  id: "web_push",
  capabilities: () => ({ richText: false, image: true, actionButtons: false, deepLink: true, maxLength: 240 }),
  validateConfig: (_channel, env) =>
    ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"].filter((k) => !env[k]).map((k) => `${k} is not set`),
  send: async (_message, channel, env) => {
    const problems = webPushProvider.validateConfig(channel, env);
    if (problems.length) return { status: "skipped", error: problems.join(", ") };
    return { status: "skipped", error: "Web Push delivery is implemented in Phase 3" };
  },
};
