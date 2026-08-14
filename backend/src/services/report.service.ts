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

const PRIMARY = "#4f46e5";
const TEXT = "#14162b";
const MUTED = "#6b7089";
const BORDER = "#e5e7f0";

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
  const rowHeight = 20;
  const bottomMargin = doc.page.margins.bottom;

  function drawHeader() {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT);
    // Snapshot y once — text() advances doc.y after each call, so reading
    // doc.y fresh inside the loop would stack columns vertically instead
    // of placing them side by side on one row.
    const y = doc.y;
    let x = startX;
    for (const col of columns) {
      doc.text(col.label, x, y, { width: col.width, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y = y;
    doc.moveDown(0.6);
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), doc.y)
      .strokeColor(BORDER)
      .stroke();
    doc.moveDown(0.4);
    doc.x = startX;
  }

  drawHeader();
  doc.font("Helvetica").fontSize(9).fillColor(TEXT);

  for (const row of rows) {
    if (doc.y + rowHeight > doc.page.height - bottomMargin) {
      doc.addPage();
      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor(TEXT);
    }

    const y = doc.y;
    let x = startX;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      doc.text(row[i] ?? "", x, y, { width: col.width, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y = y;
    doc.moveDown(0.9);
  }

  // Leave the cursor at the left margin, not wherever the last column's
  // explicit x put it — otherwise unpositioned text() calls right after
  // this table (e.g. the next section title) inherit that x and wrap
  // into whatever narrow width remains to the page edge.
  doc.x = startX;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.x = 50;
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(PRIMARY).text(title, 50, doc.y);
  doc.moveDown(0.3);
  doc.x = 50;
}

export async function generateInventoryReportPdf(): Promise<Buffer> {
  const [summary, lowStock, inventory] = await Promise.all([
    getDashboardSummary(),
    getLowStockProducts(),
    getFullInventoryTable(),
  ]);

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ── Header ──────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(20).fillColor(TEXT).text("StockPilot");
  doc.font("Helvetica").fontSize(14).fillColor(MUTED).text("Inventory Report");
  doc
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      `Generated ${new Date().toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      })}`
    );
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BORDER).stroke();

  // ── Summary KPIs ────────────────────────────────────────
  sectionTitle(doc, "Summary");
  const kpiPairs: Array<[string, string]> = [
    ["Total products", String(summary.kpis.totalProducts)],
    ["Total warehouses", String(summary.kpis.totalWarehouses)],
    ["Total stock units", String(summary.kpis.totalStockUnits)],
    ["Total inventory value", formatCurrency(summary.kpis.totalInventoryValue)],
    ["Low stock items", String(summary.kpis.lowStockCount)],
    ["Movements today", String(summary.kpis.movementsToday)],
  ];
  doc.font("Helvetica").fontSize(10).fillColor(TEXT);
  for (const [label, value] of kpiPairs) {
    doc.text(`${label}:`, 50, doc.y, { continued: true, width: 200 });
    doc.font("Helvetica-Bold").text(`  ${value}`);
    doc.font("Helvetica");
  }

  // ── Low stock products ──────────────────────────────────
  sectionTitle(doc, `Low Stock Products (${lowStock.length})`);
  if (lowStock.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("Nothing is currently below its threshold.");
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
      50
    );
  }

  // ── Top products by movement volume ─────────────────────
  sectionTitle(doc, "Top Products by Movement Volume");
  if (summary.topProducts.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No stock movements recorded yet.");
  } else {
    drawTable(
      doc,
      [
        { label: "SKU", width: 110 },
        { label: "Name", width: 300 },
        { label: "Volume", width: 85, align: "right" },
      ],
      summary.topProducts.map((p) => [p.sku, p.name, String(p.volume)]),
      50
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
    50
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
    50
  );

  // ── Footer: page numbers on every page ───────────────────
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
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `StockPilot — append-only inventory ledger  ·  Page ${i + 1} of ${range.count}`,
        50,
        doc.page.height - 35,
        { width: 495, align: "center" }
      );
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  return done;
}
