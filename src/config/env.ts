import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.warn(`[env] WARNING: could not load .env from ${envPath} — using defaults only`);
} else {
  console.log(`[env] Loaded .env from: ${envPath}`);
}
console.log(`[env] raw SIMULATED_FAILURE_RATE from process.env = ${process.env.SIMULATED_FAILURE_RATE}`);

export const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/notification-service",

  aws: {
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
    endpoint: process.env.SQS_ENDPOINT || "http://localhost:4566",
  },

  queues: {
    email: process.env.EMAIL_QUEUE_NAME || "email-queue",
    sms: process.env.SMS_QUEUE_NAME || "sms-queue",
    emailDlq: process.env.EMAIL_DLQ_NAME || "email-dlq",
    smsDlq: process.env.SMS_DLQ_NAME || "sms-dlq",
  },

  maxReceiveCount: parseInt(process.env.MAX_RECEIVE_COUNT || "3", 10),
  visibilityTimeoutSeconds: parseInt(process.env.VISIBILITY_TIMEOUT_SECONDS || "30", 10),
  simulatedFailureRate: parseFloat(process.env.SIMULATED_FAILURE_RATE || "0.4"),
};