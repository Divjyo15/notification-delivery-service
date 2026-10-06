import { SQSClient } from "@aws-sdk/client-sqs";
import { env } from "./env";

export const sqsClient = new SQSClient({
  region: env.aws.region,
  endpoint: env.aws.endpoint, // LocalStack endpoint locally; remove/override for real AWS
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
  },
});
