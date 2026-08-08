import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (error: unknown) =>
    logger.error({ err: error }, 'MongoDB connection error'),
  );

  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: !env.isProduction,
    serverSelectionTimeoutMS: 10_000,
    // Free-tier Atlas caps connections; a small pool keeps headroom for the
    // seeder and any second instance during a rolling deploy.
    maxPoolSize: 10,
    minPoolSize: 1,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close(false);
}
