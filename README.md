# Notification Delivery Service

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![AWS SQS](https://img.shields.io/badge/AWS%20SQS-FF9900?style=flat&logo=amazonsqs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

Multi-channel (email/SMS) notification service with idempotent ingestion,
per-channel SQS queues, automatic SQS-driven retries, DLQ redrive, and
cross-channel fallback on final failure — simulated locally with LocalStack.

## Demo

<!-- Add a terminal-recording GIF here showing: a request fail 3x, hit the
DLQ, and fall back to the other channel. Tools like ScreenToGif (Windows,
free) work well for this. Example:
![demo](docs/demo.gif) -->

## Why this project

Real-world notification systems (order confirmations, OTPs, alerts) need to
survive a flaky email/SMS provider without losing messages or spamming
users with duplicates. This project demonstrates three patterns used in
production message-driven systems:

- **Idempotency** — duplicate requests (same `Idempotency-Key`) never create duplicate work
- **Retry without custom code** — SQS's visibility timeout handles retries; the app never runs a retry loop
- **Graceful degradation** — a channel that keeps failing automatically falls back to another channel instead of just failing silently

## Architecture

```
Client
  │
  ▼
1. Express API — validates request, generates/accepts Idempotency-Key
  │
  ▼
2. MongoDB — Message saved (status: PENDING per channel, attempts: 0)
  │
  ▼
3. SQS — one job pushed per channel (email-queue, sms-queue)  [LocalStack]
  │
  ▼
4. Worker (per channel, polls its queue)
     ├─► success → Mongo status: SENT, delete from SQS
     └─► failure → left on queue → becomes visible again after
                    visibility timeout → SQS retries automatically
                    → after maxReceiveCount, SQS redrive policy moves
                      it to that channel's DLQ (no app code involved)
  │
  ▼
5. DLQ Consumer (separate worker)
     ├─► Mongo status: FAILED_FINAL for that channel
     └─► pushes a fallback job to the other channel's queue
         (email → sms, sms → email) if not already tried
```

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d          # starts Mongo + LocalStack
npm run setup:queues          # creates queues + DLQs + redrive policy
```

> **Windows shortcut:** `start.bat` does the above (Docker up + queue setup)
> and opens the server + all 3 workers in separate terminal windows automatically.

## Run (dev — ts-node-dev, no build step)

Open 4 terminals:

```bash
npm run dev           # API server (port 3000)
npm run worker:email
npm run worker:sms
npm run worker:dlq
```

## Run (compiled)

```bash
npm run build          # tsc -> dist/
npm run start           # node dist/server.js
node dist/workers/worker.js email
node dist/workers/worker.js sms
node dist/workers/dlqConsumer.js
```

## Try it

```bash
curl -X POST http://localhost:3000/api/notify \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-confirmation" \
  -d '{
    "recipient": { "email": "user@example.com", "phone": "+911234567890" },
    "payload": { "subject": "Order confirmed", "body": "Your order is on its way" },
    "channels": ["email", "sms"]
  }'
```

- Send the exact same request again with the same `Idempotency-Key` header →
  you'll get the existing record back, not a new job (idempotency check).
- `SIMULATED_FAILURE_RATE` in `.env` controls how often the worker
  "fails" a delivery, so you can watch a message retry, hit DLQ, and
  fall back to the other channel without waiting for a real outage.
- Check status any time: `GET /api/notify/:id`

## Notes / next steps

- `simulateDelivery()` in `src/workers/worker.ts` is where you'd plug in
  a real provider (SES/SNS, Twilio, etc.) instead of the random coin flip.
- To move this to real AWS: drop the LocalStack container, remove
  `SQS_ENDPOINT` from `.env`, and provide real AWS credentials — no code
  changes needed, since the SDK falls back to real AWS when no custom
  endpoint is set.
- Consider adding a TTL index on old `SENT`/`FAILED_FINAL` messages if
  volume grows.

## Scope

This is a portfolio project demonstrating the architecture end-to-end
locally (Docker + LocalStack for SQS, MongoDB for state). It isn't deployed
live, since the queue-based retry/DLQ behavior — the interesting part —
depends on a real or simulated AWS SQS environment rather than a plain
web server. See the demo GIF above for the retry → DLQ → fallback flow
running locally.