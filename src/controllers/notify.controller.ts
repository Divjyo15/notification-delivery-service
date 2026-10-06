import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Message } from "../models/Message";
import { sendToQueue } from "../services/queueClient";
import { env } from "../config/env";
import { Channel } from "../types";

const CHANNEL_QUEUE_MAP: Record<Channel, string> = {
  email: env.queues.email,
  sms: env.queues.sms,
};

function isChannel(value: string): value is Channel {
  return value === "email" || value === "sms";
}

export async function createNotification(req: Request, res: Response) {
  try {
    const { recipient, payload, channels } = req.body as {
      recipient?: Record<string, unknown>;
      payload?: Record<string, unknown>;
      channels?: string[];
    };

    if (!recipient || !payload || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        error: "recipient, payload and a non-empty channels[] array are required",
      });
    }

    const invalidChannel = channels.find((c) => !isChannel(c));
    if (invalidChannel) {
      return res.status(400).json({ error: `Unsupported channel: ${invalidChannel}` });
    }
    const validChannels = channels as Channel[];

    // Idempotency: client can pass their own key (e.g. Idempotency-Key header),
    // otherwise we generate one server-side.
    const idempotencyKey = (req.headers["idempotency-key"] as string) || uuidv4();

    const existing = await Message.findOne({ idempotencyKey });
    if (existing) {
      return res.status(200).json({
        message: "Duplicate request — returning existing record",
        idempotencyKey,
        data: existing,
      });
    }

    const message = await Message.create({
      idempotencyKey,
      recipient,
      payload,
      channels: validChannels.map((c) => ({
        channel: c,
        status: "PENDING",
        attempts: 0,
        fallbackOf: null,
      })),
    });

    await Promise.all(
      validChannels.map((c) =>
        sendToQueue(CHANNEL_QUEUE_MAP[c], {
          messageId: message._id.toString(),
          idempotencyKey,
          channel: c,
          recipient,
          payload,
        })
      )
    );

    return res.status(202).json({
      message: "Notification accepted",
      idempotencyKey,
      data: message,
    });
  } catch (err) {
    console.error("[notify] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getNotification(req: Request, res: Response) {
  const message = await Message.findById(req.params.id);
  if (!message) return res.status(404).json({ error: "Not found" });
  return res.json(message);
}
