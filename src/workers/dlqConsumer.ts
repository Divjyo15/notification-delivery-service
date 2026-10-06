/**
 * Polls both DLQs. For every message that landed here (i.e. it exhausted
 * maxReceiveCount on its main queue), it:
 *   1. marks that channel FAILED_FINAL in Mongo
 *   2. tries a fallback channel (email -> sms, sms -> email) if one
 *      hasn't already been tried for this message
 *   3. deletes the message from the DLQ (we've handled it)
 *
 * Run: npm run worker:dlq
 */
import { connectDB } from "../config/db";
import { Message, MessageDocument } from "../models/Message";
import { receiveFromQueue, deleteFromQueue, sendToQueue } from "../services/queueClient";
import { env } from "../config/env";
import { Channel, QueueJob } from "../types";

const FALLBACK_MAP: Record<Channel, Channel> = { email: "sms", sms: "email" };
const CHANNEL_QUEUE_MAP: Record<Channel, string> = { email: env.queues.email, sms: env.queues.sms };
const DLQS: { name: string; channel: Channel }[] = [
  { name: env.queues.emailDlq, channel: "email" },
  { name: env.queues.smsDlq, channel: "sms" },
];

async function markFailedFinal(messageId: string, channel: Channel) {
  await Message.updateOne(
    { _id: messageId, "channels.channel": channel },
    { $set: { "channels.$.status": "FAILED_FINAL" } }
  );
}

async function tryFallback(message: MessageDocument, failedChannel: Channel) {
  const fallbackChannel = FALLBACK_MAP[failedChannel];
  const alreadyTried = message.channels.some((c) => c.channel === fallbackChannel);

  if (alreadyTried) {
    console.log(
      `[dlq] messageId=${message._id} fallback (${fallbackChannel}) already exists — skipping, alerting only`
    );
    return;
  }

  await Message.updateOne(
    { _id: message._id },
    {
      $push: {
        channels: {
          channel: fallbackChannel,
          status: "PENDING",
          attempts: 0,
          fallbackOf: failedChannel,
        },
      },
    }
  );

  await sendToQueue(CHANNEL_QUEUE_MAP[fallbackChannel], {
    messageId: message._id.toString(),
    idempotencyKey: message.idempotencyKey,
    channel: fallbackChannel,
    recipient: message.recipient,
    payload: message.payload,
  });

  console.log(
    `[dlq] messageId=${message._id} ${failedChannel} exhausted -> falling back to ${fallbackChannel}`
  );
}

async function pollLoop(): Promise<void> {
  for (const { name: dlqName, channel } of DLQS) {
    const messages = await receiveFromQueue(dlqName, { maxMessages: 5, waitTimeSeconds: 5 });

    for (const raw of messages) {
      const body: QueueJob = JSON.parse(raw.Body ?? "{}");
      const message = await Message.findById(body.messageId);

      if (!message) {
        console.warn(`[dlq] messageId=${body.messageId} not found in DB — deleting from DLQ`);
        if (raw.ReceiptHandle) await deleteFromQueue(dlqName, raw.ReceiptHandle);
        continue;
      }

      await markFailedFinal(message._id.toString(), channel);
      await tryFallback(message, channel);
      if (raw.ReceiptHandle) await deleteFromQueue(dlqName, raw.ReceiptHandle);
    }
  }

  setImmediate(pollLoop);
}

async function start() {
  await connectDB();
  console.log(`[dlq] polling ${env.queues.emailDlq} and ${env.queues.smsDlq}...`);
  pollLoop();
}

start();
