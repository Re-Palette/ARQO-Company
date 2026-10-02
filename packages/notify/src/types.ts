import type { NotificationCategory, Severity } from "@friday/core";

/** Channel-agnostic message (docs/design/13-notifications.md 13.3). */
export interface NotificationMessage {
  id: string;
  category: NotificationCategory;
  severity: Severity;
  title: string;
  body: string;
  deepLink?: string;
  imageUrl?: string;
  /** Links only. Approvals are never performed from external channels. */
  actions?: { label: string; url: string }[];
  dedupeKey?: string;
}

export interface ProviderCapabilities {
  richText: boolean;
  image: boolean;
  actionButtons: boolean;
  deepLink: boolean;
  maxLength: number;
}

export interface ChannelConfig {
  id: string;
  provider: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  retryable?: boolean;
  error?: string;
}

export interface NotificationProvider {
  readonly id: string;
  capabilities(): ProviderCapabilities;
  /** Returns a list of problems; empty means the config is usable. */
  validateConfig(channel: ChannelConfig, env: Record<string, string | undefined>): string[];
  send(message: NotificationMessage, channel: ChannelConfig, env: Record<string, string | undefined>): Promise<SendResult>;
}
