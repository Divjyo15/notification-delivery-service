import {
  GetQueueUrlCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message as SQSMessage,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/sqs";

const urlCache = new Map<string, string>();

export async function getQueueUrl(queueName: string): Promise<string> {
  const cached = urlCache.get(queueName);
  if (cached) return cached;

  const { QueueUrl } = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
  if (!QueueUrl) throw new Error(`Queue not found: ${queueName}`);

  urlCache.set(queueName, QueueUrl);
  return QueueUrl;
}

export async function sendToQueue(queueName: string, body: unknown) {
  const QueueUrl = await getQueueUrl(queueName);
  return sqsClient.send(
    new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify(body),
    })
  );
}

export async function receiveFromQueue(
  queueName: string,
  opts: { maxMessages?: number; waitTimeSeconds?: number } = {}
): Promise<SQSMessage[]> {
  const { maxMessages = 5, waitTimeSeconds = 10 } = opts;
  const QueueUrl = await getQueueUrl(queueName);

  const res = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds, // long polling
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    })
  );

  return res.Messages || [];
}

export async function deleteFromQueue(queueName: string, receiptHandle: string) {
  const QueueUrl = await getQueueUrl(queueName);
  return sqsClient.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: receiptHandle }));
}
