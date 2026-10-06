/**
 * One-time setup script: creates the per-channel queues and their DLQs
 * on LocalStack, and wires up the redrive policy (maxReceiveCount ->
 * move to DLQ automatically).
 *
 * Run: npm run setup:queues   (make sure `docker compose up` is running first)
 */
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../src/config/sqs";
import { env } from "../src/config/env";

async function getQueueArn(queueUrl: string): Promise<string> {
  const { Attributes } = await sqsClient.send(
    new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ["QueueArn"] })
  );
  const arn = Attributes?.QueueArn;
  if (!arn) throw new Error(`Could not resolve ARN for ${queueUrl}`);
  return arn;
}

async function createQueue(name: string, attributes: Record<string, string> = {}): Promise<string> {
  const { QueueUrl } = await sqsClient.send(
    new CreateQueueCommand({ QueueName: name, Attributes: attributes })
  );
  if (!QueueUrl) throw new Error(`Failed to create queue ${name}`);
  console.log(`[setup] created queue: ${name} -> ${QueueUrl}`);
  return QueueUrl;
}

async function setupChannel(mainQueueName: string, dlqName: string) {
  const dlqUrl = await createQueue(dlqName);
  const dlqArn = await getQueueArn(dlqUrl);

  const mainUrl = await createQueue(mainQueueName, {
    VisibilityTimeout: String(env.visibilityTimeoutSeconds),
    RedrivePolicy: JSON.stringify({
      deadLetterTargetArn: dlqArn,
      maxReceiveCount: String(env.maxReceiveCount),
    }),
  });

  console.log(
    `[setup] ${mainQueueName} -> after ${env.maxReceiveCount} failed receives, messages move to ${dlqName}\n`
  );
  return { mainUrl, dlqUrl };
}

async function main() {
  console.log("[setup] creating queues on LocalStack...\n");
  await setupChannel(env.queues.email, env.queues.emailDlq);
  await setupChannel(env.queues.sms, env.queues.smsDlq);
  console.log("[setup] done.");
}

main().catch((err) => {
  console.error("[setup] failed:", err);
  process.exit(1);
});
