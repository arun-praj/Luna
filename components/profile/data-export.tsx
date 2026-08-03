"use client";

import * as React from "react";
import { FileDown, FileSpreadsheet, LoaderCircle } from "lucide-react";
import type { PDFFont, PDFPage } from "pdf-lib";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { authenticatedFetch } from "@/lib/auth-client";

type ExportFormat = "csv" | "pdf";

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthPeriod(): AppliedPeriod {
  const now = new Date();
  return {
    mode: "month",
    label: `${new Intl.DateTimeFormat("en-US", { month: "short" }).format(now)} ${now.getFullYear()}`,
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function periodQuery(period: AppliedPeriod) {
  const params = new URLSearchParams();
  if (period.from) params.set("from", localDateKey(period.from));
  if (period.to) params.set("to", localDateKey(period.to));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function displayAmount(transaction: ApiTransaction, currency: string) {
  const prefix =
    transaction.type === "income" || transaction.type === "savings"
      ? "+"
      : transaction.type === "expense"
        ? "-"
        : transaction.type === "adjust_balance"
          ? transaction.amount >= 0 ? "+" : "-"
          : "";
  return `${prefix}${currency} ${Math.abs(transaction.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function transactionTitle(transaction: ApiTransaction) {
  return transaction.title || transaction.categoryName || transaction.type;
}

function transactionAccount(transaction: ApiTransaction) {
  return transaction.destinationAccountName
    ? `${transaction.accountName} -> ${transaction.destinationAccountName}`
    : transaction.accountName;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvForTransactions(transactions: ApiTransaction[], currency: string) {
  const headers = ["Date", "Type", "Title", "Category", "Account", "Amount", "Notes", "Tags"];
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.type,
    transactionTitle(transaction),
    transaction.categoryName ?? "",
    transactionAccount(transaction),
    displayAmount(transaction, currency),
    transaction.notes ?? "",
    transaction.tags.join(", "),
  ]);
  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
}

function safePdfText(value: string) {
  return value.replaceAll("→", "->").replace(/[^\x20-\x7E]/g, "");
}

function fitPdfText(text: string, font: PDFFont, size: number, width: number) {
  const safeText = safePdfText(text);
  if (font.widthOfTextAtSize(safeText, size) <= width) return safeText;
  let shortened = safeText;
  while (shortened.length > 3 && font.widthOfTextAtSize(`${shortened}...`, size) > width) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.slice(0, -3)}...`;
}

function sectionItems(transactions: ApiTransaction[], type: ApiTransaction["type"]) {
  return transactions.filter((transaction) => transaction.type === type);
}

async function buildPdf(
  transactions: ApiTransaction[],
  period: AppliedPeriod,
  currency: string,
) {
  const { PDFDocument, PageSizes, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = PageSizes.A4[0];
  const pageHeight = PageSizes.A4[1];
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const colors = {
    ink: rgb(0.12, 0.18, 0.16),
    muted: rgb(0.38, 0.44, 0.42),
    border: rgb(0.84, 0.88, 0.86),
    teal: rgb(0.21, 0.42, 0.41),
    green: rgb(0.18, 0.49, 0.35),
    red: rgb(0.62, 0.29, 0.27),
    blue: rgb(0.26, 0.44, 0.60),
    pale: rgb(0.95, 0.97, 0.96),
  };
  let page: PDFPage = pdf.addPage(PageSizes.A4);
  let y = pageHeight - margin;

  const addPage = () => {
    page = pdf.addPage(PageSizes.A4);
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin + 26) addPage();
  };

  page.drawRectangle({ x: 0, y: pageHeight - 105, width: pageWidth, height: 105, color: colors.teal });
  page.drawText("LUNA", { x: margin, y: pageHeight - 49, size: 10, font: bold, color: rgb(0.82, 0.94, 0.90) });
  page.drawText("Transaction report", { x: margin, y: pageHeight - 76, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safePdfText(`${period.label}  |  Generated ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date())}`), { x: margin, y: pageHeight - 93, size: 8, font: regular, color: rgb(0.90, 0.96, 0.94) });
  y = pageHeight - 132;

  const totals = {
    income: sectionItems(transactions, "income").reduce((sum, item) => sum + item.amount, 0),
    expense: sectionItems(transactions, "expense").reduce((sum, item) => sum + item.amount, 0),
    savings: sectionItems(transactions, "savings").reduce((sum, item) => sum + item.amount, 0),
  };
  const summary = [
    ["Income", totals.income, colors.green],
    ["Expenses", totals.expense, colors.red],
    ["Savings", totals.savings, colors.teal],
  ] as const;
  const summaryGap = 8;
  const summaryWidth = (contentWidth - summaryGap * 2) / 3;
  summary.forEach(([label, amount, color], index) => {
    const x = margin + index * (summaryWidth + summaryGap);
    page.drawRectangle({ x, y: y - 42, width: summaryWidth, height: 42, borderColor: colors.border, borderWidth: 0.7, color: colors.pale });
    page.drawText(label, { x: x + 8, y: y - 16, size: 7.5, font: bold, color: colors.muted });
    page.drawText(safePdfText(`${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`), { x: x + 8, y: y - 32, size: 10, font: bold, color });
  });
  y -= 62;

  const sections: Array<{ type: ApiTransaction["type"]; label: string; color: typeof colors.teal }> = [
    { type: "expense", label: "Expenses", color: colors.red },
    { type: "savings", label: "Savings", color: colors.teal },
    { type: "income", label: "Income", color: colors.green },
    { type: "transfer", label: "Transfers", color: colors.blue },
    { type: "adjust_balance", label: "Balance adjustments", color: colors.muted },
  ];
  const columns = [
    { label: "Date", width: 52 },
    { label: "Description", width: 160 },
    { label: "Category", width: 100 },
    { label: "Account", width: 142 },
    { label: "Amount", width: contentWidth - 52 - 160 - 100 - 142 },
  ];

  for (const section of sections) {
    const items = sectionItems(transactions, section.type);
    if (!items.length) continue;
    ensureSpace(48);
    page.drawText(section.label, { x: margin, y, size: 12, font: bold, color: section.color });
    y -= 17;
    page.drawRectangle({ x: margin, y: y - 16, width: contentWidth, height: 17, color: colors.teal });
    let x = margin;
    for (const column of columns) {
      page.drawText(column.label, { x: x + 5, y: y - 11, size: 6.5, font: bold, color: rgb(1, 1, 1) });
      x += column.width;
    }
    y -= 19;

    for (const transaction of items) {
      const pageBeforeRow = page;
      ensureSpace(14);
      if (page !== pageBeforeRow) {
        page.drawText(safePdfText(`${section.label} (continued)`), { x: margin, y, size: 8, font: bold, color: section.color });
        y -= 13;
        page.drawRectangle({ x: margin, y: y - 16, width: contentWidth, height: 17, color: colors.teal });
        let continuedX = margin;
        for (const column of columns) {
          page.drawText(column.label, { x: continuedX + 5, y: y - 11, size: 6.5, font: bold, color: rgb(1, 1, 1) });
          continuedX += column.width;
        }
        y -= 19;
      }
      if (Math.round((pageHeight - y) / 14) % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 3, width: contentWidth, height: 14, color: colors.pale });
      }
      const values = [
        displayDate(transaction.date),
        transactionTitle(transaction),
        transaction.categoryName ?? "Uncategorized",
        transactionAccount(transaction),
        displayAmount(transaction, currency),
      ];
      x = margin;
      columns.forEach((column, index) => {
        const text = fitPdfText(values[index], index === 4 ? bold : regular, 6.5, column.width - 10);
        page.drawText(text, { x: x + 5, y, size: 6.5, font: index === 4 ? bold : regular, color: index === 4 ? section.color : colors.ink });
        x += column.width;
      });
      y -= 14;
      page.drawLine({ start: { x: margin, y: y + 3 }, end: { x: margin + contentWidth, y: y + 3 }, thickness: 0.35, color: colors.border });
    }
    y -= 13;
  }

  if (!transactions.length) {
    ensureSpace(35);
    page.drawText("No transactions found for this period.", { x: margin, y, size: 10, font: regular, color: colors.muted });
  }

  pdf.getPages().forEach((pdfPage, index, pages) => {
    pdfPage.drawText(safePdfText(`Luna  |  ${period.label}`), { x: margin, y: 17, size: 6.5, font: regular, color: colors.muted });
    const pageNumber = `Page ${index + 1} of ${pages.length}`;
    pdfPage.drawText(pageNumber, { x: pageWidth - margin - bold.widthOfTextAtSize(pageNumber, 6.5), y: 17, size: 6.5, font: bold, color: colors.muted });
  });

  return pdf.save();
}

export function DataExportButton({ currency }: { currency: string }) {
  const initialPeriod = React.useMemo(() => currentMonthPeriod(), []);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState("");
  const pendingFormat = React.useRef<ExportFormat | null>(null);

  const exportTransactions = React.useCallback(async (period: AppliedPeriod, format: ExportFormat) => {
    setIsExporting(true);
    setExportError("");
    try {
      const response = await authenticatedFetch(`/api/transactions${periodQuery(period)}`);
      if (!response.ok) throw new Error("Unable to load transactions");
      const result = (await response.json()) as { transactions?: ApiTransaction[] };
      const transactions = result.transactions ?? [];
      const fileDate = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        downloadBlob(new Blob([csvForTransactions(transactions, currency)], { type: "text/csv;charset=utf-8" }), `luna-transactions-${fileDate}.csv`);
      } else {
        const bytes = await buildPdf(transactions, period, currency);
        const pdfBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(pdfBuffer).set(bytes);
        downloadBlob(new Blob([pdfBuffer], { type: "application/pdf" }), `luna-transactions-${fileDate}.pdf`);
      }
    } catch {
      setExportError("Could not prepare this export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [currency]);

  const handleApply = React.useCallback((period: AppliedPeriod) => {
    const format = pendingFormat.current;
    pendingFormat.current = null;
    if (format) void exportTransactions(period, format);
  }, [exportTransactions]);

  return (
    <div className="relative shrink-0">
      <DatePicker
        initialMode="month"
        initialLabel={initialPeriod.label}
        triggerLabel="Export"
        triggerAriaLabel="Choose export date range"
        triggerIcon={FileDown}
        onApply={handleApply}
        footer={(apply, canApply) => (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canApply || isExporting}
              onClick={() => {
                pendingFormat.current = "csv";
                apply();
              }}
              className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-primary-soft px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-50"
            >
              {isExporting && pendingFormat.current === "csv" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FileSpreadsheet aria-hidden="true" className="size-4" />}
              <span className="truncate">Export Excel (CSV)</span>
            </button>
            <button
              type="button"
              disabled={!canApply || isExporting}
              onClick={() => {
                pendingFormat.current = "pdf";
                apply();
              }}
              className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-50"
            >
              {isExporting && pendingFormat.current === "pdf" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FileDown aria-hidden="true" className="size-4" />}
              <span className="truncate">Download A4 PDF</span>
            </button>
          </div>
        )}
      />
      {exportError ? <p role="alert" className="sr-only">{exportError}</p> : null}
    </div>
  );
}
