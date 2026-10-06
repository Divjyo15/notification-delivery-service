export type Channel = "email" | "sms";

export type ChannelStatus = "PENDING" | "SENT" | "FAILED_FINAL";

export interface Recipient {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface NotificationPayload {
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

export interface ChannelEntry {
  channel: Channel;
  status: ChannelStatus;
  attempts: number;
  fallbackOf: Channel | null;
}

export interface QueueJob {
  messageId: string;
  idempotencyKey: string;
  channel: Channel;
  recipient: Recipient;
  payload: NotificationPayload;
}
