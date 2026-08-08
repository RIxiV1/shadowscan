import { Router } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { asyncHandler, pathParam, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { uploadMiddleware } from './uploads.middleware.js';
import * as uploadsService from './uploads.service.js';

export const uploadsRouter: Router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const objectIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid upload id.'),
});

uploadsRouter.use(authenticate);

// POST /api/uploads - multipart/form-data, field name `file` Runs the full pipeline and returns the finished result, so th
uploadsRouter.post(
  '/',
  uploadLimiter,
  uploadMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.badRequest('Attach a log file in a form field named "file".');
    }

    const result = await uploadsService.createUpload({
      filename: req.file.originalname,
      buffer: req.file.buffer,
      userId: req.auth!.userId,
    });

    recordAudit(req, AUDIT_ACTIONS.UPLOAD_CREATE, result.upload.filename, {
      rows: result.upload.rowsTotal,
      aiRequests: result.upload.aiRequests,
      shadowAiRequests: result.upload.shadowAiRequests,
    });

    sendOk(res, result, 201);
  }),
);
uploadsRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    sendOk(res, await uploadsService.listUploads(req.query));
  }),
);

// GET /api/uploads/:id
uploadsRouter.get(
  '/:id',
  validate(objectIdParam, 'params'),
  asyncHandler(async (req, res) => {
    sendOk(res, await uploadsService.getUpload(pathParam(req, 'id')));
  }),
);

// DELETE /api/uploads/:id - admin Cascades to every event derived from the upload.
uploadsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate(objectIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const result = await uploadsService.deleteUpload(pathParam(req, 'id'));
    recordAudit(req, AUDIT_ACTIONS.UPLOAD_DELETE, pathParam(req, 'id'), result);
    sendOk(res, result);
  }),
);
