import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { AI_PROVIDERS } from '../config/ai-providers.js';
import { env } from '../config/env.js';
import { buildProviderIndex, type IndexedProvider } from '../engine/detector.js';
import { ingestRecords } from '../engine/ingest.js';
import type { RawRecord } from '../engine/parsers/types.js';
import { hashPassword } from '../lib/passwords.js';
import { logger } from '../lib/logger.js';
import { AiEvent } from '../models/AiEvent.js';
import { Provider } from '../models/Provider.js';
import { getRiskSettings } from '../models/RiskSettings.js';
import { Upload } from '../models/Upload.js';
import { User } from '../models/User.js';
import { connectDatabase, disconnectDatabase } from './connection.js';

// SEEDER npm run seed registry + settings + admin account npm run seed -- --demo the above, plus a synthetic month of activity Idempotent.

async function seedProviders(): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const provider of AI_PROVIDERS) {
    const result = await Provider.updateOne(
      { key: provider.key },
      {
        $set: {
          name: provider.name,
          vendor: provider.vendor,
          category: provider.category,
          domains: provider.domains,
          dataRegion: provider.dataRegion,
          trainsOnUserData: provider.trainsOnUserData,
          isBuiltIn: true,
        },
        $setOnInsert: {
          key: provider.key,
          policy: provider.defaultPolicy,
          riskWeight: provider.riskWeight,
          notes: provider.notes,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) inserted += 1;
    else if (result.modifiedCount > 0) updated += 1;
  }

  return { inserted, updated };
}

async function seedAdmin(): Promise<boolean> {
  const existing = await User.findOne({ email: env.SEED_ADMIN_EMAIL }).select('_id');
  if (existing) return false;

  await User.create({
    email: env.SEED_ADMIN_EMAIL,
    name: env.SEED_ADMIN_NAME,
    passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
    role: 'admin',
  });

  return true;
}

const DEMO_ACTORS = [
  'priya.sharma',
  'arjun.mehta',
  'rahul.verma',
  'ananya.iyer',
  'vikram.nair',
  'sneha.kulkarni',
  'aditya.rao',
  'meera.pillai',
  'karthik.reddy',
  'fatima.khan',
  'rohan.das',
  'ishita.bose',
];

// Weighted destination mix, tuned to look like a real mid-size engineering org: a long head of mainstream assistants, a vi
const DEMO_DESTINATIONS: Array<{ url: string; weight: number; content?: string }> = [
  { url: 'https://chatgpt.com/c/session', weight: 220 },
  { url: 'https://chatgpt.com/', weight: 120 },
  { url: 'https://claude.ai/chat', weight: 140 },
  { url: 'https://gemini.google.com/app', weight: 90 },
  { url: 'https://copilot.microsoft.com/chats', weight: 130 },
  { url: 'https://api.githubcopilot.com/completions', weight: 160 },
  { url: 'https://www.perplexity.ai/search?q=kubernetes+ingress+timeout', weight: 60 },
  { url: 'https://www.perplexity.ai/search?q=how+to+redact+customer+list+before+sharing', weight: 8 },
  { url: 'https://chat.deepseek.com/', weight: 34 },
  { url: 'https://cursor.com/dashboard', weight: 48 },
  { url: 'https://grok.com/chat', weight: 22 },
  { url: 'https://www.meta.ai/', weight: 14 },
  { url: 'https://huggingface.co/models', weight: 26 },
  { url: 'https://openrouter.ai/chat', weight: 12 },
  { url: 'https://www.grammarly.com/editor', weight: 40 },
  { url: 'https://otter.ai/notes', weight: 18 },
  { url: 'https://www.chatpdf.com/upload', weight: 9 },
  { url: 'https://sider.ai/chat', weight: 11 },
  { url: 'https://kimi.com/chat', weight: 7 },
  { url: 'https://v0.app/chat', weight: 15 },
  { url: 'https://bolt.new/~/project', weight: 10 },
  { url: 'https://elevenlabs.io/speech-synthesis', weight: 6 },
  // Heuristic-only hits: hosts that are not in the registry at all.
  { url: 'https://ai.internal-vendor-tools.com/chat', weight: 9 },
  { url: 'https://promptforge.ai/generate', weight: 7 },
  // Content-bearing rows, the kind a CASB export produces.
  {
    url: 'https://chatgpt.com/c/session',
    weight: 6,
    content: 'Rewrite this confidential board deck summary for the Q3 earnings call',
  },
  {
    url: 'https://chat.deepseek.com/',
    weight: 4,
    content: 'Here is our customer list, generate outreach emails: rahul@acme.co.in, priya@acme.co.in',
  },
  {
    url: 'https://www.chatpdf.com/upload',
    weight: 3,
    content: 'Summarise the attached NDA and the merger due diligence memo',
  },
  {
    url: 'https://claude.ai/chat',
    weight: 3,
    content: 'Debug this deploy script, my api key is sk-proj-9f2Ba7QeLm4X8vTzR1cW0dYh',
  },
  {
    url: 'https://sider.ai/chat',
    weight: 2,
    content: 'Draft a termination letter for employee, salary details 1450000, PAN and aadhaar 4321 8765 2109',
  },
];
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function buildDemoRecords(count: number): RawRecord[] {
  const random = makeRandom(20_260_401);
  const pool: typeof DEMO_DESTINATIONS = [];
  for (const destination of DEMO_DESTINATIONS) {
    for (let i = 0; i < destination.weight; i += 1) pool.push(destination);
  }

  const records: RawRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i += 1) {
    const destination = pool[Math.floor(random() * pool.length)]!;

    // Actor selection is skewed with a squared random so a handful of people
    // dominate the tail - that concentration is what the risk model is designed
    // to surface, and a flat distribution would hide it.
    const actorIndex = Math.floor(random() ** 2 * DEMO_ACTORS.length);
    const actor = DEMO_ACTORS[actorIndex] ?? DEMO_ACTORS[0]!;

    const daysAgo = random() * 29;
    // Working hours with a tail into the evening, plus occasional 2am activity.
    const hour = random() < 0.12 ? Math.floor(random() * 6) : 9 + Math.floor(random() * 12);
    const occurredAt = new Date(now - daysAgo * 86_400_000);
    occurredAt.setHours(hour, Math.floor(random() * 60), Math.floor(random() * 60), 0);

    records.push({
      url: destination.url,
      actor,
      occurredAt,
      content: destination.content ?? '',
    });
  }

  return records;
}

async function seedDemoData(): Promise<number> {
  const existing = await Upload.findOne({ filename: 'demo-proxy-export.csv' }).select('_id');
  if (existing) {
    logger.info('Demo data already present, skipping');
    return 0;
  }

  const documents = await Provider.find()
    .select('key name vendor category domains riskWeight policy dataRegion trainsOnUserData')
    .lean();

  const providers: IndexedProvider[] = documents.map((document) => ({
    id: String(document._id),
    key: document.key,
    name: document.name,
    vendor: document.vendor,
    category: document.category,
    domains: document.domains,
    riskWeight: document.riskWeight,
    policy: document.policy,
    dataRegion: document.dataRegion,
    trainsOnUserData: document.trainsOnUserData,
  }));

  const settings = await getRiskSettings();
  const records = buildDemoRecords(1400);

  const outcome = ingestRecords(records, {
    index: buildProviderIndex(providers),
    weights: settings,
    confidentialKeywords: settings.confidentialKeywords,
    fallbackTimestamp: new Date(),
  });

  const admin = await User.findOne({ email: env.SEED_ADMIN_EMAIL }).select('_id');

  const upload = await Upload.create({
    filename: 'demo-proxy-export.csv',
    sizeBytes: records.length * 180,
    checksum: createHash('sha256').update('shadowscan-demo-dataset-v1').digest('hex'),
    format: 'proxy-log',
    status: 'completed',
    rowsTotal: records.length,
    rowsParsed: outcome.rowsParsed,
    rowsRejected: outcome.rowsRejected,
    aiRequests: outcome.aiRequests,
    shadowAiRequests: outcome.shadowAiRequests,
    parseErrors: [],
    uploadedBy: admin?._id ?? null,
    completedAt: new Date(),
  });

  await AiEvent.insertMany(
    outcome.events.map((event) => ({ ...event, uploadId: upload._id })),
    { ordered: false },
  );

  return outcome.events.length;
}

// -------------------------------------------------------------------- main ---

async function main(): Promise<void> {
  const withDemo = process.argv.includes('--demo');

  await connectDatabase();

  // Explicit index creation. `autoIndex` is off in production, so this is the one
  // place indexes are guaranteed to exist after a deploy.
  await Promise.all([
    User.syncIndexes(),
    Provider.syncIndexes(),
    Upload.syncIndexes(),
    AiEvent.syncIndexes(),
  ]);

  const providers = await seedProviders();
  const adminCreated = await seedAdmin();
  await getRiskSettings();

  const demoEvents = withDemo ? await seedDemoData() : 0;

  logger.info(
    {
      providersInserted: providers.inserted,
      providersUpdated: providers.updated,
      adminCreated,
      demoEvents,
    },
    'Seed complete',
  );

  if (adminCreated) {
    logger.info(
      `Admin account created: ${env.SEED_ADMIN_EMAIL}. Change this password immediately after your first sign-in.`,
    );
  }

  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Seed failed');
  await mongoose.connection.close(true).catch(() => undefined);
  process.exit(1);
});
