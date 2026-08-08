import { Router } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit.js';
import { asyncHandler, pathParam, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { reportLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { renderReportPdf } from './reports.pdf.js';
import * as reportsService from './reports.service.js';

export const reportsRouter: Router = Router();

const generateSchema = z.object({
  title: z.string().trim().max(160).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const objectIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid report id.'),
});

reportsRouter.use(authenticate);
reportsRouter.post(
  '/',
  reportLimiter,
  validate(generateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof generateSchema>;
    const report = await reportsService.generateReport({ ...body, userId: req.auth!.userId });
    recordAudit(req, AUDIT_ACTIONS.REPORT_GENERATE, report.id, {
      score: report.score,
      band: report.band,
    });
    sendOk(res, report, 201);
  }),
);

// GET /api/reports?page=&pageSize= 200 Paginated<RiskReportDto>
reportsRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    sendOk(res, await reportsService.listReports(req.query));
  }),
);

// GET /api/reports/:id
reportsRouter.get(
  '/:id',
  validate(objectIdParam, 'params'),
  asyncHandler(async (req, res) => {
    sendOk(res, await reportsService.getReport(pathParam(req, 'id')));
  }),
);

// GET /api/reports/:id/pdf - streamed download Returns `application/pdf` rather than the JSON envelope, so the client fetches it as a blob.
reportsRouter.get(
  '/:id/pdf',
  validate(objectIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const report = await reportsService.getReport(pathParam(req, 'id'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowscan-report-${report.id}.pdf"`,
    );
    // The PDF contains identifiable usage data; keep it out of shared caches.
    res.setHeader('Cache-Control', 'private, no-store');

    recordAudit(req, AUDIT_ACTIONS.REPORT_EXPORT, report.id);

    renderReportPdf({ report }).pipe(res);
  }),
);

// DELETE /api/reports/:id
reportsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate(objectIdParam, 'params'),
  asyncHandler(async (req, res) => {
    await reportsService.deleteReport(pathParam(req, 'id'));
    recordAudit(req, AUDIT_ACTIONS.REPORT_DELETE, pathParam(req, 'id'));
    res.status(204).end();
  }),
);
