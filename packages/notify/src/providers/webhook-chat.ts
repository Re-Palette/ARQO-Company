import type { NotificationMessage, NotificationProvider } from "../types";

/**
 * Incoming-webhook chat providers (Slack / Discord). Disabled by default;
 * enabled later by adding a notification_channels row. Links only — no
 * approval buttons (approvals happen in the app).
 */
function chatProvider(id: "slack" | "discord", format: (m: NotificationMessage, appUrl: string) => unknown): NotificationProvider {
  return {
    id,
    capabilities: () => ({ richText: true, image: false, actionButtons: false, deepLink: true, maxLength: 2000 }),
    validateConfig: (channel, env) => {
      const envName = channel.config.webhookUrlEnv as string | undefined;
      return envName && env[envName] ? [] : [`${envName ?? "webhookUrlEnv"} is not set`];
    },
    send: async (message, channel, env) => {
      const url = env[channel.config.webhookUrlEnv as string];
      if (!url) return { status: "skipped", error: "webhook URL not configured" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(format(message, env.APP_URL ?? "")),
      });
      return res.ok
        ? { status: "sent" }
        : { status: "failed", retryable: res.status === 429 || res.status >= 500, error: `HTTP ${res.status}` };
    },
  };
}

const link = (m: NotificationMessage, appUrl: string) => (m.deepLink ? `${appUrl}${m.deepLink}` : appUrl);

export const slackProvider = chatProvider("slack", (m, appUrl) => ({
  text: `*${m.title}*\n${m.body}\n<${link(m, appUrl)}|F.R.I.D.A.Y. で開く>`,
}));

export const discordProvider = chatProvider("discord", (m, appUrl) => ({
  content: `**${m.title}**\n${m.body}\n${link(m, appUrl)}`,
}));
