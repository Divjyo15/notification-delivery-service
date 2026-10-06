@echo off
echo Starting Docker containers (Mongo + LocalStack)...
docker compose up -d

echo Waiting for LocalStack to be ready...
timeout /t 8 /nobreak >nul

echo Creating SQS queues (safe to re-run, skips if already exist)...
call npm run setup:queues

echo.
echo Opening server + workers in separate terminals...

start "API Server" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul

start "Worker - Email" cmd /k "npm run worker:email"
timeout /t 2 /nobreak >nul

start "Worker - SMS" cmd /k "npm run worker:sms"
timeout /t 2 /nobreak >nul

start "Worker - DLQ" cmd /k "npm run worker:dlq"

echo.
echo All set! 4 windows opened: API Server, Worker-Email, Worker-SMS, Worker-DLQ