/**
 * Generic channel worker. Run one process per channel:
 *   npm run worker:email
 *   npm run worker:sms
 *
 * Flow per message:
 *  - poll queue (long polling)
 *  - "send" it (simulated — random failure rate for local testing)
 *  - success -> update Mongo channel status to SENT, delete from queue
 *  - failure -> DO NOTHING. The message becomes visible again after the
 *    visibility timeout and SQS retries it automatically. Once
 *    ApproximateReceiveCount crosses maxReceiveCount, SQS's redrive
 *    policy moves it to the DLQ on its own — no code needed for that part.
 */
import { connectDB } from "../config/db";
import { Message } from "../models/Message";
import { receiveFromQueue, deleteFromQueue } from "../services/queueClient";
import { env } from "../config/env";
import { Channel, QueueJob } from "../types";

const channelArg = process.argv[2];
if (channelArg !== "email" && channelArg !== "sms") {
  console.error("Usage: ts-node worker.ts <email|sms>");
  process.exit(1);
}
const channel: Channel = channelArg;
const queueName = env.queues[channel];

function simulateDelivery(): boolean {
  // Replace with a real provider call (SES/SNS/Twilio/etc).
  return Math.random() >= env.simulatedFailureRate;
}

async function markSent(messageId: string, ch: Channel) {
  await Message.updateOne(
    { _id: messageId, "channels.channel": ch },
    { $set: { "channels.$.status": "SENT" } }
  );
}

async function incrementAttempts(messageId: string, ch: Channel) {
  await Message.updateOne(
    { _id: messageId, "channels.channel": ch },
    { $inc: { "channels.$.attempts": 1 } }
  );
}

async function pollLoop(): Promise<void> {
  const messages = await receiveFromQueue(queueName, { maxMessages: 5, waitTimeSeconds: 10 });

  for (const raw of messages) {
    const body: QueueJob = JSON.parse(raw.Body ?? "{}");
    const receiveCount = raw.Attributes?.ApproximateReceiveCount || "1";
    console.log(
      `[worker:${channel}] processing messageId=${body.messageId} (receive attempt #${receiveCount})`
    );

    await incrementAttempts(body.messageId, channel);

    const delivered = simulateDelivery();

    if (delivered) {
      await markSent(body.messageId, channel);
      if (raw.ReceiptHandle) await deleteFromQueue(queueName, raw.ReceiptHandle);
      console.log(`[worker:${channel}] SENT messageId=${body.messageId}`);
    } else {
      console.log(
        `[worker:${channel}] FAILED messageId=${body.messageId} — leaving for SQS retry/redrive`
      );
    }
  }

  setImmediate(pollLoop);
}

async function start() {
  await connectDB();
  console.log(`[worker:${channel}] SIMULATED_FAILURE_RATE = ${env.simulatedFailureRate}`);
  pollLoop();
}

start();
