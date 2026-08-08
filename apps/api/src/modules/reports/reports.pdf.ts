import PDFDocument from 'pdfkit';
import type { RiskBand, RiskReportDto } from '@shadowscan/shared';

/**
 *  PDF REPORT RENDERER
 *
 * Server-side, with PDFKit, streamed straight to the response.
 *
 * The alternative - render HTML and print it with headless Chromium - produces a
 * prettier document and costs ~300 MB of RAM per render plus a Chromium download
 * at build time. On a 512 MB Render instance that is the difference between a
 * service that runs and one that gets OOM-killed the first time two people click
 * Export. PDFKit draws primitives, needs no browser, and streams, so peak memory
 * is a few hundred kilobytes regardless of report size.
 *
 * Everything is drawn from the *stored* report document, never recomputed. The
 * PDF and the report detail page therefore cannot disagree.
 */

const PALETTE = {
  ink: '#0B0F17',
  panel: '#111827',
  border: '#E2E8F0',
  mutedText: '#64748B',
  bodyText: '#0F172A',
  invertedText: '#F8FAFC',
  accent: '#06B6D4',
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
} as const;

const BAND_COLOUR: Record<RiskBand, string> = {
  low: PALETTE.low,
  medium: PALETTE.medium,
  high: PALETTE.high,
  critical: PALETTE.critical,
};

const MARGIN = 48;
const PAGE_WIDTH = 595.28; // A4 portrait, points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Doc = PDFKit.PDFDocument;

export interface RenderOptions {
  report: RiskReportDto;
  // Name shown on the cover.
  organisationName?: string;
}

// Renders the report and returns the PDFKit document.
export function renderReportPdf(options: RenderOptions): Doc {
  const { report } = options;
  const organisation = options.organisationName ?? 'Internal Security Review';

  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    // Required to number pages: totals are unknown until the last page is drawn.
    bufferPages: true,
    info: {
      Title: report.title,
      Author: 'ShadowScan',
      Subject: 'AI Governance and Shadow AI Exposure Report',
      Keywords: 'shadow ai, governance, risk, compliance',
    },
  });

  drawCoverBand(doc, report, organisation);
  drawSummary(doc, report);
  drawToolInventory(doc, report);
  drawActorTable(doc, report);
  drawRecommendations(doc, report);
  drawMethodology(doc);
  drawFooters(doc);

  doc.end();
  return doc;
}

function drawCoverBand(doc: Doc, report: RiskReportDto, organisation: string): void {
  const bandHeight = 168;
  doc.rect(0, 0, PAGE_WIDTH, bandHeight).fill(PALETTE.ink);

  doc
    .fillColor(PALETTE.accent)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('SHADOWSCAN  ·  AI GOVERNANCE PLATFORM', MARGIN, 36, { characterSpacing: 1.6 });

  doc
    .fillColor(PALETTE.invertedText)
    .font('Helvetica-Bold')
    .fontSize(21)
    .text(report.title, MARGIN, 58, { width: CONTENT_WIDTH - 130, lineGap: 2 });

  doc
    .fillColor('#94A3B8')
    .font('Helvetica')
    .fontSize(9.5)
    .text(
      `${organisation}   ·   ${formatDate(report.periodStart)} — ${formatDate(report.periodEnd)}   ·   Generated ${formatDateTime(report.createdAt)}`,
      MARGIN,
      bandHeight - 46,
      { width: CONTENT_WIDTH - 130 },
    );

  drawScoreBadge(doc, report, PAGE_WIDTH - MARGIN - 104, 44);

  doc.y = bandHeight + 26;
  doc.x = MARGIN;
}

function drawScoreBadge(doc: Doc, report: RiskReportDto, x: number, y: number): void {
  const size = 104;
  const colour = BAND_COLOUR[report.band];

  doc.roundedRect(x, y, size, size, 10).lineWidth(1.5).fillAndStroke('#0F172A', colour);

  doc
    .fillColor(colour)
    .font('Helvetica-Bold')
    .fontSize(34)
    .text(String(report.score), x, y + 22, { width: size, align: 'center' });

  doc
    .fillColor('#94A3B8')
    .font('Helvetica')
    .fontSize(7.5)
    .text('RISK SCORE / 100', x, y + 60, { width: size, align: 'center', characterSpacing: 0.8 });

  doc
    .fillColor(colour)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(report.band.toUpperCase(), x, y + 76, { width: size, align: 'center', characterSpacing: 1.2 });
}

function drawSummary(doc: Doc, report: RiskReportDto): void {
  sectionHeading(doc, 'Exposure summary');

  const metrics: Array<{ label: string; value: string; tone?: RiskBand }> = [
    { label: 'Log rows ingested', value: report.summary.totalEvents.toLocaleString() },
    { label: 'AI requests detected', value: report.summary.aiRequests.toLocaleString() },
    {
      label: 'Shadow AI requests',
      value: report.summary.shadowAiRequests.toLocaleString(),
      tone: report.summary.shadowAiRequests > 0 ? 'high' : 'low',
    },
    { label: 'Approved AI requests', value: report.summary.approvedRequests.toLocaleString(), tone: 'low' },
    { label: 'People involved', value: report.summary.uniqueActors.toLocaleString() },
    { label: 'Distinct AI services', value: report.summary.uniqueProviders.toLocaleString() },
    {
      label: 'Confidential-content hits',
      value: report.summary.sensitiveHits.toLocaleString(),
      tone: report.summary.sensitiveHits > 0 ? 'critical' : 'low',
    },
    {
      label: 'Unmanaged share',
      value:
        report.summary.aiRequests === 0
          ? '—'
          : `${Math.round((report.summary.shadowAiRequests / report.summary.aiRequests) * 100)}%`,
    },
  ];

  const columns = 4;
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const cardHeight = 52;
  const startY = doc.y;

  metrics.forEach((metric, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);

    doc.roundedRect(x, y, cardWidth, cardHeight, 6).lineWidth(0.8).fillAndStroke('#F8FAFC', PALETTE.border);

    doc
      .fillColor(metric.tone ? BAND_COLOUR[metric.tone] : PALETTE.bodyText)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(metric.value, x + 10, y + 10, { width: cardWidth - 20 });

    doc
      .fillColor(PALETTE.mutedText)
      .font('Helvetica')
      .fontSize(7.5)
      .text(metric.label.toUpperCase(), x + 10, y + 32, {
        width: cardWidth - 20,
        characterSpacing: 0.5,
      });
  });

  doc.y = startY + Math.ceil(metrics.length / columns) * (cardHeight + gap) + 8;
  doc.x = MARGIN;
}

// -------------------------------------------------------- tool inventory ---

function drawToolInventory(doc: Doc, report: RiskReportDto): void {
  sectionHeading(doc, 'AI services detected');

  if (report.topProviders.length === 0) {
    emptyState(doc, 'No AI service was detected in the uploaded logs for this period.');
    return;
  }

  const total = report.topProviders.reduce((sum, provider) => sum + provider.requests, 0);
  const columns = [
    { header: 'Service', width: 210 },
    { header: 'Governance status', width: 130 },
    { header: 'Requests', width: 80, align: 'right' as const },
    { header: 'Share', width: CONTENT_WIDTH - 420, align: 'right' as const },
  ];

  tableHeader(doc, columns);

  for (const provider of report.topProviders) {
    ensureSpace(doc, 22);
    const y = doc.y;
    let x = MARGIN;

    cell(doc, provider.name, x, y, columns[0]!.width, { bold: true });
    x += columns[0]!.width;

    const statusColour =
      provider.policy === 'approved'
        ? PALETTE.low
        : provider.policy === 'blocked'
          ? PALETTE.critical
          : PALETTE.medium;
    cell(doc, policyLabel(provider.policy), x, y, columns[1]!.width, { colour: statusColour });
    x += columns[1]!.width;

    cell(doc, provider.requests.toLocaleString(), x, y, columns[2]!.width, { align: 'right' });
    x += columns[2]!.width;

    const share = total === 0 ? 0 : Math.round((provider.requests / total) * 100);
    cell(doc, `${share}%`, x, y, columns[3]!.width, { align: 'right', colour: PALETTE.mutedText });

    doc.y = y + 18;
    rule(doc);
  }

  doc.y += 8;
}

function drawActorTable(doc: Doc, report: RiskReportDto): void {
  sectionHeading(doc, 'Highest-risk individuals');

  if (report.topActors.length === 0) {
    emptyState(doc, 'No attributable AI activity was recorded for this period.');
    return;
  }

  doc
    .fillColor(PALETTE.mutedText)
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text(
      'Identifiers are taken from the uploaded logs. Treat this list as an investigation starting point, not a disciplinary finding — high usage usually indicates an unmet tooling need.',
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH },
    );
  doc.y += 10;

  const columns = [
    { header: 'Individual', width: 200 },
    { header: 'Requests', width: 90, align: 'right' as const },
    { header: 'Risk score', width: 90, align: 'right' as const },
    { header: 'Band', width: CONTENT_WIDTH - 380 },
  ];

  tableHeader(doc, columns);

  for (const actor of report.topActors) {
    ensureSpace(doc, 22);
    const y = doc.y;
    let x = MARGIN;

    cell(doc, actor.actor, x, y, columns[0]!.width, { bold: true });
    x += columns[0]!.width;

    cell(doc, actor.requests.toLocaleString(), x, y, columns[1]!.width, { align: 'right' });
    x += columns[1]!.width;

    cell(doc, `${actor.score}`, x, y, columns[2]!.width, { align: 'right' });
    x += columns[2]!.width;

    cell(doc, actor.band.toUpperCase(), x, y, columns[3]!.width, { colour: BAND_COLOUR[actor.band], bold: true });

    doc.y = y + 18;
    rule(doc);
  }

  doc.y += 8;
}

function drawRecommendations(doc: Doc, report: RiskReportDto): void {
  sectionHeading(doc, 'Recommended actions');

  for (const recommendation of report.recommendations) {
    const colour = BAND_COLOUR[recommendation.severity];

    doc.font('Helvetica').fontSize(9);
    const detailHeight = doc.heightOfString(recommendation.detail, { width: CONTENT_WIDTH - 22 });
    const blockHeight = detailHeight + 34;

    ensureSpace(doc, blockHeight + 8);
    const y = doc.y;

    // Severity stripe down the left edge, which is far easier to scan than a
    // repeated coloured word at the start of every paragraph.
    doc.rect(MARGIN, y, 3, blockHeight).fill(colour);

    doc
      .fillColor(colour)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(recommendation.severity.toUpperCase(), MARGIN + 12, y + 1, { characterSpacing: 1 });

    doc
      .fillColor(PALETTE.bodyText)
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text(recommendation.title, MARGIN + 12, y + 12, { width: CONTENT_WIDTH - 22 });

    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(9)
      .text(recommendation.detail, MARGIN + 12, doc.y + 3, { width: CONTENT_WIDTH - 22, lineGap: 1.5 });

    doc.y += 14;
    doc.x = MARGIN;
  }
}

// ------------------------------------------------------------ methodology ---

function drawMethodology(doc: Doc): void {
  ensureSpace(doc, 150);
  sectionHeading(doc, 'Methodology and limitations');

  const paragraphs = [
    'Detection resolves each logged hostname against a curated registry of AI providers, then applies pattern heuristics to catch services the registry has not yet catalogued. Anything matched by heuristic alone is reported as unclassified rather than assumed safe.',
    'Risk scores are additive and itemised: each request accumulates points for the provider, its governance status, its processing jurisdiction, any confidential content detected, and the time of day. Individual and organisational scores are normalised to 0-100 so they remain comparable as log volume grows.',
    'Confidential-content detection operates on URL query strings and on prompt fields where the log source provides them. Browser history exports do not contain prompt text, so an absence of content findings from a history-only import is not evidence that no confidential data was submitted.',
    'Matched secrets are never stored. The platform records the class of identifier detected and its count; the underlying value is discarded at ingestion.',
  ];

  doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
  for (const paragraph of paragraphs) {
    ensureSpace(doc, 40);
    doc.text(`•  ${paragraph}`, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 1.5 });
    doc.y += 6;
  }
}

// --------------------------------------------------------------- chrome ---

function drawFooters(doc: Doc): void {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);

    // Writing inside the bottom margin makes PDFKit's text flow believe the page has overflowed, and it silently appends a bla
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = doc.page.height - 34;
    doc
      .moveTo(MARGIN, y - 8)
      .lineTo(PAGE_WIDTH - MARGIN, y - 8)
      .lineWidth(0.5)
      .stroke(PALETTE.border);

    doc
      .fillColor(PALETTE.mutedText)
      .font('Helvetica')
      .fontSize(7.5)
      .text('CONFIDENTIAL — contains identifiable AI usage data. Handle under your internal data policy.', MARGIN, y, {
        width: CONTENT_WIDTH - 80,
        lineBreak: false,
      });

    doc
      .fillColor(PALETTE.mutedText)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`${index - range.start + 1} / ${range.count}`, PAGE_WIDTH - MARGIN - 60, y, {
        width: 60,
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = originalBottomMargin;
  }
}

function sectionHeading(doc: Doc, title: string): void {
  ensureSpace(doc, 46);
  doc
    .fillColor(PALETTE.bodyText)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(title, MARGIN, doc.y);
  doc.y += 2;
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + 34, doc.y)
    .lineWidth(2)
    .stroke(PALETTE.accent);
  doc.y += 12;
  doc.x = MARGIN;
}

interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

function tableHeader(doc: Doc, columns: Column[]): void {
  ensureSpace(doc, 26);
  const y = doc.y;
  let x = MARGIN;

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.mutedText);
  for (const column of columns) {
    doc.text(column.header.toUpperCase(), x, y, {
      width: column.width - 6,
      align: column.align ?? 'left',
      characterSpacing: 0.5,
    });
    x += column.width;
  }

  doc.y = y + 12;
  rule(doc);
}

function cell(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { align?: 'left' | 'right'; colour?: string; bold?: boolean } = {},
): void {
  doc
    .fillColor(options.colour ?? PALETTE.bodyText)
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9)
    .text(text, x, y, {
      width: width - 6,
      align: options.align ?? 'left',
      ellipsis: true,
      lineBreak: false,
    });
}

function rule(doc: Doc): void {
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .lineWidth(0.5)
    .stroke(PALETTE.border);
  doc.y += 6;
  doc.x = MARGIN;
}

// Adds a page when the requested block would overflow the bottom margin.
function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
    doc.y = MARGIN;
    doc.x = MARGIN;
  }
}

function emptyState(doc: Doc, message: string): void {
  doc.fillColor(PALETTE.mutedText).font('Helvetica-Oblique').fontSize(9).text(message, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
  });
  doc.y += 16;
  doc.x = MARGIN;
}

function policyLabel(policy: string): string {
  if (policy === 'approved') return 'Approved';
  if (policy === 'blocked') return 'Blocked — in use';
  return 'Not assessed';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
