import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { logger } from './lib/logger.js';
import { getRiskSettings } from './models/RiskSettings.js';

// Process entry point.
async function main(): Promise<void> {
  await connectDatabase();

  // Materialise the settings singleton at boot so the first upload does not race
  // two concurrent creates against the unique index.
  await getRiskSettings();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ShadowScan API listening');
  });

  // A port clash is the most common startup failure in development - an editor restart orphans the previous process and it keeps the socket.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal(
        `Port ${env.PORT} is already in use — most likely an earlier API process that was never stopped.\n\n` +
          `  Free it with:\n` +
          `    Get-NetTCPConnection -LocalPort ${env.PORT} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n\n` +
          `  Or run on a different port by setting PORT in apps/api/.env.\n`,
      );
    } else {
      logger.fatal({ err: error }, 'The HTTP server failed to start');
    }
    process.exit(1);
  });

  // Render sends SIGTERM and waits ~30s before SIGKILL. Draining in-flight
  // requests first prevents a deploy from returning 502s to whoever was mid-upload.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // An unhandled rejection leaves the process in an unknown state. Logging and
  // exiting lets the platform restart cleanly instead of serving from a corrupted
  // one - crash-only design is the right default for a stateless API.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start ShadowScan API');
  process.exit(1);
});
