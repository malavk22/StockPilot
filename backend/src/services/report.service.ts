// server/src/services/report.service.ts
//
// Renders a self-contained PDF snapshot of the inventory — the same
// numbers the dashboard shows, but as a document someone can save, print,
// or attach to an email. Built with pdfkit directly against a Buffer
// (rather than streaming straight to the response) so the generation
// logic stays testable independent of Express.

import PDFDocument from "pdfkit";
import prisma from "../db.js";
import { getDashboardSummary } from "./dashboard.service.js";
import { getLowStockProducts } from "./stock.service.js";

// Palette mirrors the frontend's own design tokens (index.css) so the PDF
// reads as the same product, not a generic export.
const PRIMARY = "#4f46e5";
const PRIMARY_DARK = "#3730a3";
const TEXT = "#14162b";
const MUTED = "#6b7089";
const BORDER = "#e5e7f0";
const CARD_BG = "#eef2ff";
const ROW_ALT_BG = "#f7f8fc";
const WHITE = "#ffffff";

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function roundToCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatCurrency(n: number): string {
  return `$${roundToCents(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getFullInventoryTable() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; sku: string; name: string; unit: string; price: string; currentStock: bigint }>
  >`
    SELECT p.id, p.sku, p.name, p.unit, p.price,
           COALESCE(SUM(sm.quantity), 0) AS "currentStock"
    FROM "Product" p
    LEFT JOIN "StockMovement" sm ON sm."productId" = p.id
    WHERE p."deletedAt" IS NULL
    GROUP BY p.id
    ORDER BY p.name;
  `;

  return rows.map((r) => {
    const currentStock = Number(r.currentStock);
    const price = Number(r.price);
    return { ...r, currentStock, price, value: roundToCents(price * currentStock) };
  });
}

/** A minimal table renderer — pdfkit has no built-in table support, so we
 * lay out rows manually at fixed column offsets and paginate by hand. */
function drawTable(
  doc: PDFKit.PDFDocument,
  columns: Array<{ label: string; width: number; align?: "left" | "right" }>,
  rows: string[][],
  startX: number
) {
  const rowHeight = 22;
  const headerHeight = 24;
  const headerPadTop = 6;
  const rowPadTop = 6;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  const bottomMargin = doc.page.margins.bottom;

  function drawHeader() {
    const bandTop = doc.y;
    doc.rect(startX, bandTop, tableWidth, headerHeight).fill(CARD_BG);

    const textY = bandTop + headerPadTop;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PRIMARY_DARK);
    let x = startX;
    for (const col of columns) {
      doc.text(col.label, x + 6, textY, { width: col.width - 10, align: col.align ?? "left" });
      x += col.width;
    }
    // Advance by the band's actual measured height, not an estimated
    // font-metric moveDown() — that's what let the first data row creep
    // up into the shaded header band.
    doc.y = bandTop + headerHeight;
    doc.x = startX;
  }

  drawHeader();
  doc.font("Helvetica").fontSize(9).fillColor(TEXT);

  rows.forEach((row, i) => {
    if (doc.y + rowHeight > doc.page.height - bottomMargin) {
      doc.addPage();
      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor(TEXT);
    }

    const rowTop = doc.y;
    if (i % 2 === 1) {
      doc.rect(startX, rowTop, tableWidth, rowHeight).fill(ROW_ALT_BG);
    }
    doc.fillColor(TEXT);

    const textY = rowTop + rowPadTop;
    let x = startX;
    for (let col = 0; col < columns.length; col++) {
      const c = columns[col]!;
      doc.text(row[col] ?? "", x + 6, textY, { width: c.width - 10, align: c.align ?? "left" });
      x += c.width;
    }
    // Same principle as the header: advance by the fixed row height we
    // actually drew the zebra rect at, not a font-metric guess.
    doc.y = rowTop + rowHeight;
  });

  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + tableWidth, doc.y)
    .strokeColor(BORDER)
    .stroke();
  doc.moveDown(0.6);

  // Leave the cursor at the left margin, not wherever the last column's
  // explicit x put it — otherwise unpositioned text() calls right after
  // this table (e.g. the next section title) inherit that x and wrap
  // into whatever narrow width remains to the page edge.
  doc.x = startX;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.x = MARGIN;
  doc.moveDown(1);
  const y = doc.y;
  doc.rect(MARGIN, y + 1, 4, 12).fill(PRIMARY);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(TEXT).text(title, MARGIN + 10, y);
  doc.moveDown(0.5);
  doc.x = MARGIN;
}

function drawKpiCards(doc: PDFKit.PDFDocument, cards: Array<{ label: string; value: string }>) {
  const cols = 3;
  const gap = 12;
  const cardWidth = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
  const cardHeight = 56;

  const startY = doc.y;
  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);

    doc.roundedRect(x, y, cardWidth, cardHeight, 6).fillAndStroke(CARD_BG, BORDER);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(card.label, x + 12, y + 10, { width: cardWidth - 24 });
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(PRIMARY_DARK)
      .text(card.value, x + 12, y + 26, { width: cardWidth - 24 });
  });

  const rows = Math.ceil(cards.length / cols);
  doc.y = startY + rows * cardHeight + (rows - 1) * gap;
  doc.x = MARGIN;
  doc.moveDown(1.2);
}

function drawBanner(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, PAGE_WIDTH, 96).fill(PRIMARY);
  doc.font("Helvetica-Bold").fontSize(24).fillColor(WHITE).text("StockPilot", MARGIN, 28);
  doc
    .font("Helvetica")
    .fontSize(13)
    .fillColor("#e0e1fa")
    .text("Inventory Report", MARGIN, 58);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#c7c9f5")
    .text(
      `Generated ${new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}`,
      MARGIN,
      78
    );
  doc.y = 120;
  doc.x = MARGIN;
}

export async function generateInventoryReportPdf(): Promise<Buffer> {
  const [summary, lowStock, inventory] = await Promise.all([
    getDashboardSummary(),
    getLowStockProducts(),
    getFullInventoryTable(),
  ]);

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ── Banner ──────────────────────────────────────────────
  drawBanner(doc);

  // ── Summary KPIs ────────────────────────────────────────
  sectionTitle(doc, "Summary");
  drawKpiCards(doc, [
    { label: "Total products", value: String(summary.kpis.totalProducts) },
    { label: "Total warehouses", value: String(summary.kpis.totalWarehouses) },
    { label: "Total stock units", value: String(summary.kpis.totalStockUnits) },
    { label: "Total inventory value", value: formatCurrency(summary.kpis.totalInventoryValue) },
    { label: "Low stock items", value: String(summary.kpis.lowStockCount) },
    { label: "Movements today", value: String(summary.kpis.movementsToday) },
  ]);

  // ── Low stock products ──────────────────────────────────
  sectionTitle(doc, `Low Stock Products (${lowStock.length})`);
  if (lowStock.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("Nothing is currently below its threshold.");
    doc.moveDown(0.6);
  } else {
    drawTable(
      doc,
      [
        { label: "SKU", width: 110 },
        { label: "Name", width: 220 },
        { label: "Stock", width: 90, align: "right" },
        { label: "Threshold", width: 75, align: "right" },
      ],
      lowStock.map((p) => [p.sku, p.name, String(p.currentStock), String(p.lowStockThreshold)]),
      MARGIN
    );
  }

  // ── Top products by movement volume ─────────────────────
  sectionTitle(doc, "Top Products by Movement Volume");
  if (summary.topProducts.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No stock movements recorded yet.");
    doc.moveDown(0.6);
  } else {
    drawTable(
      doc,
      [
        { label: "SKU", width: 110 },
        { label: "Name", width: 300 },
        { label: "Volume", width: 85, align: "right" },
      ],
      summary.topProducts.map((p) => [p.sku, p.name, String(p.volume)]),
      MARGIN
    );
  }

  // ── Movements by type ────────────────────────────────────
  sectionTitle(doc, "Movements by Type");
  drawTable(
    doc,
    [
      { label: "Type", width: 200 },
      { label: "Count", width: 100, align: "right" },
    ],
    summary.movementsByType.map((m) => [m.type.replace("_", " "), String(m.count)]),
    MARGIN
  );

  // ── Full inventory ───────────────────────────────────────
  sectionTitle(doc, `Full Inventory Catalog (${inventory.length})`);
  drawTable(
    doc,
    [
      { label: "SKU", width: 90 },
      { label: "Name", width: 165 },
      { label: "Unit", width: 55 },
      { label: "Price", width: 65, align: "right" },
      { label: "Stock", width: 65, align: "right" },
      { label: "Value", width: 55, align: "right" },
    ],
    inventory.map((p) => [
      p.sku,
      p.name,
      p.unit,
      formatCurrency(p.price),
      String(p.currentStock),
      formatCurrency(p.value),
    ]),
    MARGIN
  );

  // ── Footer: brand + page numbers on every page ───────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // The footer sits inside the bottom margin by design, but pdfkit's
    // text() auto-paginates when a write would land past `height -
    // margins.bottom` — it can't tell this one-liner is meant to go
    // there, so it silently pushes it onto a new blank page instead.
    // Zeroing the bottom margin for this single absolute-positioned
    // write turns that check off without affecting page layout.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(MARGIN, doc.page.height - 46).lineTo(PAGE_WIDTH - MARGIN, doc.page.height - 46).strokeColor(BORDER).stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text("StockPilot — append-only inventory ledger", MARGIN, doc.page.height - 35, {
        width: 300,
        align: "left",
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Page ${i + 1} of ${range.count}`, PAGE_WIDTH - MARGIN - 195, doc.page.height - 35, {
        width: 195,
        align: "right",
      });

    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  return done;
}
