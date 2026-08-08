import type { RiskReportDto } from '@shadowscan/shared';

import { AppError } from '../../lib/errors.js';
import { toRiskReportDto } from '../../lib/mappers.js';
import { paginate, resolvePage } from '../../lib/pagination.js';

import { RiskReport } from '../../models/RiskReport.js';
import { Upload } from '../../models/Upload.js';
import { buildFindings, buildSnapshot, type Window } from '../analytics/analytics.service.js';

export interface GenerateReportInput {
  title?: string;
  from?: Date;
  to?: Date;
  userId: string;
}

const MAX_WINDOW_DAYS = 365;

export async function generateReport(input: GenerateReportInput): Promise<RiskReportDto> {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (from.getTime() >= to.getTime()) {
    throw AppError.badRequest('The start of the period must be before the end.');
  }

  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (days > MAX_WINDOW_DAYS) {
    throw AppError.badRequest(`Reports cover at most ${MAX_WINDOW_DAYS} days.`);
  }

  const window: Window = { from, to, days };
  const snapshot = await buildSnapshot(window);

  // Same helper the dashboard uses, so a finding on screen is the same finding
  // that lands in the PDF.
  const recommendations = await buildFindings(snapshot);

  const totalEventsAgg = await Upload.aggregate<{ totalEvents: number }>([
    { $match: { createdAt: { $gte: from, $lte: to }, status: 'completed' } },
    { $group: { _id: null, totalEvents: { $sum: '$rowsParsed' } } },
    { $project: { _id: 0, totalEvents: 1 } },
  ]);

  const report = await RiskReport.create({
    title: input.title?.trim() || defaultTitle(from, to),
    periodStart: from,
    periodEnd: to,
    score: snapshot.riskScore,
    band: snapshot.riskBand,
    summary: {
      totalEvents: totalEventsAgg[0]?.totalEvents ?? 0,
      aiRequests: snapshot.aiRequests,
      shadowAiRequests: snapshot.shadowAiRequests,
      approvedRequests: snapshot.approvedRequests,
      uniqueActors: snapshot.uniqueActors,
      uniqueProviders: snapshot.uniqueProviders,
      sensitiveHits: snapshot.sensitiveHits,
    },
    topProviders: snapshot.usageByTool.slice(0, 10).map((tool) => ({
      key: tool.key,
      name: tool.name,
      requests: tool.requests,
      policy: tool.policy,
    })),
    topActors: snapshot.highRiskActors.slice(0, 10).map((actor) => ({
      actor: actor.actor,
      requests: actor.requests,
      score: actor.score,
      band: actor.band,
    })),
    recommendations,
    generatedBy: input.userId,
  });

  await report.populate('generatedBy', 'name');
  return toRiskReportDto(report);
}

export async function listReports(query: { page?: number; pageSize?: number }) {
  const page = resolvePage(query);
  const [items, total] = await Promise.all([
    RiskReport.find()
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('generatedBy', 'name'),
    RiskReport.countDocuments(),
  ]);
  return paginate(items.map(toRiskReportDto), total, page);
}

export async function getReport(id: string): Promise<RiskReportDto> {
  const report = await RiskReport.findById(id).populate('generatedBy', 'name');
  if (!report) throw AppError.notFound('Report');
  return toRiskReportDto(report);
}

export async function deleteReport(id: string): Promise<void> {
  const result = await RiskReport.findByIdAndDelete(id);
  if (!result) throw AppError.notFound('Report');
}

function defaultTitle(from: Date, to: Date): string {
  const format = (date: Date) =>
    date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `AI Governance Report — ${format(from)} to ${format(to)}`;
}
