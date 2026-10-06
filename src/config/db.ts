import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri);
    console.log(`[db] connected -> ${env.mongoUri}`);
  } catch (err) {
    console.error("[db] connection failed:", (err as Error).message);
    process.exit(1);
  }
}
