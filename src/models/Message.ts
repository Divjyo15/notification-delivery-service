import mongoose, { Schema, Document } from "mongoose";
import { Channel, ChannelEntry, NotificationPayload, Recipient } from "../types";

export interface MessageDocument extends Document {
  idempotencyKey: string;
  recipient: Recipient;
  payload: NotificationPayload;
  channels: ChannelEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const channelStatusSchema = new Schema<ChannelEntry>(
  {
    channel: { type: String, enum: ["email", "sms"], required: true },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED_FINAL"],
      default: "PENDING",
    },
    attempts: { type: Number, default: 0 },
    fallbackOf: { type: String, default: null },
  },
  { _id: false }
);

const messageSchema = new Schema<MessageDocument>(
  {
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    recipient: { type: Object, required: true },
    payload: { type: Object, required: true },
    channels: { type: [channelStatusSchema], required: true },
  },
  { timestamps: true }
);

export const Message = mongoose.model<MessageDocument>("Message", messageSchema);
export type { Channel };
