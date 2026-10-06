import express from "express";
import { connectDB } from "./config/db";
import notifyRoutes from "./routes/notify.routes";
import { env } from "./config/env";

async function start() {
  await connectDB();

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", notifyRoutes);

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

start();
