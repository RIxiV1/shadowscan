import { createHash } from 'node:crypto';
import type { UploadResult } from '@shadowscan/shared';
import { env } from '../../config/env.js';
import { ingestRecords } from '../../engine/ingest.js';
import { parseLogFile } from '../../engine/parsers/index.js';
import { AppError } from '../../lib/errors.js';
import { toAiEventDto, toUploadDto } from '../../lib/mappers.js';
import { logger } from '../../lib/logger.js';
import { paginate, resolvePage } from '../../lib/pagination.js';
import { AiEvent } from '../../models/AiEvent.js';
import { getRiskSettings } from '../../models/RiskSettings.js';
import { Upload } from '../../models/Upload.js';
import { loadProviderIndex } from '../providers/providers.service.js';

// Ingestion is synchronous â€” the HTTP request returns the finished result.

const PREVIEW_SIZE = 10;

export interface CreateUploadInput {
  filename: string;
  buffer: Buffer;
  userId: string;
}

export async function createUpload(input: CreateUploadInput): Promise<UploadResult> {
  const checksum = createHash('sha256').update(input.buffer).digest('hex');

  // Re-uploading the same file is a common accident and it silently doubles every
  // number on the dashboard. Rejecting on content hash â€” not filename â€” catches it.
  const duplicate = await Upload.findOne({ checksum, status: 'completed' }).select('filename createdAt');
  if (duplicate) {
    throw AppError.conflict(
      `This exact file was already ingested as "${duplicate.filename}". Delete that upload first if you want to re-import it.`,
    );
  }

  const filename = sanitiseFilename(input.filename);
  const content = decodeBuffer(input.buffer);

  const upload = await Upload.create({
    filename,
    sizeBytes: input.buffer.byteLength,
    checksum,
    format: 'csv',
    status: 'processing',
    uploadedBy: input.userId,
  });

  try {
    const parsed = parseLogFile(filename, content, { maxRows: env.MAX_ROWS_PER_UPLOAD });
    const [{ index }, settings] = await Promise.all([loadProviderIndex(), getRiskSettings()]);

    const outcome = ingestRecords(parsed.records, {
      index,
      weights: settings,
      confidentialKeywords: settings.confidentialKeywords,
      // Rows with no timestamp are dated to the moment of upload. They are still
      // worth keeping â€” the destination is the finding â€” but they must not land
      // at epoch zero and drag every time-series chart back to 1970.
      fallbackTimestamp: new Date(),
    });

    if (outcome.events.length > 0) {
      await AiEvent.insertMany(
        outcome.events.map((event) => ({ ...event, uploadId: upload._id })),
        // Ordered inserts abort the whole batch on the first bad document. One
        // unparseable row must not discard the other 49 999.
        { ordered: false },
      );
    }

    upload.set({
      format: parsed.format,
      status: 'completed',
      rowsTotal: parsed.rowsTotal,
      rowsParsed: outcome.rowsParsed,
      rowsRejected: parsed.rowsRejected + outcome.rowsRejected,
      aiRequests: outcome.aiRequests,
      shadowAiRequests: outcome.shadowAiRequests,
      parseErrors: parsed.errors,
      completedAt: new Date(),
    });
    await upload.save();

    logger.info(
      {
        uploadId: upload.id,
        rows: parsed.rowsTotal,
        aiRequests: outcome.aiRequests,
        shadowAi: outcome.shadowAiRequests,
      },
      'Upload ingested',
    );

    const preview = await AiEvent.find({ uploadId: upload._id })
      .sort({ riskScore: -1, occurredAt: -1 })
      .limit(PREVIEW_SIZE);

    return { upload: toUploadDto(upload), preview: preview.map(toAiEventDto) };
  } catch (error) {
    // The upload document is kept in `failed` state rather than deleted: the
    // operator needs to see *that* an import failed and why, not have it vanish.
    upload.set({
      status: 'failed',
      completedAt: new Date(),
      parseErrors: [error instanceof Error ? error.message : 'Ingestion failed.'],
    });
    await upload.save();
    throw error;
  }
}

export async function listUploads(query: { page?: number; pageSize?: number }) {
  const page = resolvePage(query);
  const [items, total] = await Promise.all([
    Upload.find()
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('uploadedBy', 'name'),
    Upload.countDocuments(),
  ]);
  return paginate(items.map(toUploadDto), total, page);
}

export async function getUpload(id: string) {
  const upload = await Upload.findById(id).populate('uploadedBy', 'name');
  if (!upload) throw AppError.notFound('Upload');
  return toUploadDto(upload);
}

/**
 * Deletes an upload and every event derived from it.
 *
 * The events go first. If the process dies between the two operations, orphaned
 * events are a visible inconsistency an operator can retry away; an upload record
 * pointing at deleted events would silently under-report forever.
 */
export async function deleteUpload(id: string): Promise<{ deletedEvents: number }> {
  const upload = await Upload.findById(id);
  if (!upload) throw AppError.notFound('Upload');

  const result = await AiEvent.deleteMany({ uploadId: upload._id });
  await upload.deleteOne();

  return { deletedEvents: result.deletedCount ?? 0 };
}

function sanitiseFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'upload';
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'upload';
}

// Decodes the upload as UTF-8, stripping a BOM.
function decodeBuffer(buffer: Buffer): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
