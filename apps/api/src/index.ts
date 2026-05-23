import 'dotenv/config';
import http from 'http';

import { env } from './config/env';
import { connectDB } from './config/db';
import { initRedis } from './config/redis';
import { startAllJobs } from './jobs';
import { initSocket } from './socket';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  await connectDB();
  await initRedis();

  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);
  startAllJobs();

  server.listen(env.PORT, () => {
    console.info(
      `[server] 🚀 LOGX Express API running on port ${env.PORT} (${env.NODE_ENV})`
    );
  });

  const shutdown = (signal: string) => {
    console.info(`[server] ${signal} — shutting down gracefully`);
    server.close(() => {
      console.info('[server] HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection:', reason);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
