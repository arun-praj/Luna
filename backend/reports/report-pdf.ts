import "server-only";

import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { ReportData } from "./report-service";

function safeText(value: string) {
  return value.replaceAll("->", "-").replace(/[^ -~]/g, "");
}

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fitText(value: string, font: PDFFont, size: number, width: number) {
  const text = safeText(value);
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let result = text;
  while (result.length > 4 && font.widthOfTextAtSize(`${result}...`, size) > width) result = result.slice(0, -1);
  return `${result.slice(0, -3)}...`;
}

function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildReportPdf(report: ReportData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = PageSizes.A4;
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const colors = {
    background: rgb(0.965, 0.976, 0.968),
    card: rgb(1, 1, 1),
    ink: rgb(0.10, 0.15, 0.14),
    muted: rgb(0.39, 0.45, 0.43),
    border: rgb(0.85, 0.89, 0.87),
    primary: rgb(0.20, 0.48, 0.45),
    primarySoft: rgb(0.91, 0.96, 0.94),
    expense: rgb(0.67, 0.29, 0.27),
    expenseSoft: rgb(0.99, 0.93, 0.92),
    income: rgb(0.16, 0.49, 0.32),
    incomeSoft: rgb(0.91, 0.97, 0.93),
    forecast: rgb(0.25, 0.42, 0.62),
    forecastSoft: rgb(0.92, 0.95, 0.99),
    white: rgb(1, 1, 1),
  };

  let page: PDFPage = pdf.addPage(PageSizes.A4);
  let y = pageHeight - margin;

  const drawBackground = () => {
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.background });
  };

  const drawPageHeader = (firstPage = false) => {
    drawBackground();
    if (firstPage) {
      page.drawRectangle({ x: 0, y: pageHeight - 112, width: pageWidth, height: 112, color: colors.primary });
      page.drawText("LUNA", { x: margin, y: pageHeight - 36, size: 9, font: bold, color: rgb(0.82, 0.95, 0.91) });
      page.drawText("Money report", { x: margin, y: pageHeight - 67, size: 22, font: bold, color: colors.white });
      page.drawText(safeText(`${report.period.label}  |  Generated ${report.generatedAt.slice(0, 10)}`), { x: margin, y: pageHeight - 88, size: 8, font: regular, color: rgb(0.90, 0.97, 0.94) });
      y = pageHeight - 137;
    } else {
      page.drawText("LUNA", { x: margin, y: pageHeight - 34, size: 8, font: bold, color: colors.primary });
      page.drawText("Money report", { x: margin + 35, y: pageHeight - 34, size: 8, font: regular, color: colors.muted });
      y = pageHeight - 58;
    }
  };

  const newPage = () => {
    page = pdf.addPage(PageSizes.A4);
    drawPageHeader(false);
  };

  const ensureSpace = (height: number) => {
    if (y - height < 48) newPage();
  };

  const drawCard = (x: number, top: number, width: number, height: number, fill = colors.card) => {
    page.drawRectangle({ x, y: top - height, width, height, color: fill, borderColor: colors.border, borderWidth: 0.7 });
  };

  const drawWrapped = (value: string, x: number, top: number, width: number, size = 8.5, color = colors.muted, lineHeight = 12) => {
    const lines = wrapText(value, regular, size, width);
    lines.forEach((line, index) => page.drawText(line, { x, y: top - index * lineHeight, size, font: regular, color }));
    return lines.length * lineHeight;
  };

  const drawIconHeading = (icon: string, title: string, color: typeof colors.primary) => {
    ensureSpace(32);
    page.drawRectangle({ x: margin, y: y - 19, width: 20, height: 20, color });
    page.drawText(icon, { x: margin + 6, y: y - 13, size: 8, font: bold, color: colors.white });
    page.drawText(safeText(title), { x: margin + 29, y: y - 14, size: 13, font: bold, color: colors.ink });
    y -= 27;
  };

  const drawMetric = (label: string, value: string, x: number, color: typeof colors.expense, fill: typeof colors.expenseSoft) => {
    const metricWidth = (contentWidth - 16) / 3;
    drawCard(x, y, metricWidth, 52, fill);
    page.drawText(label, { x: x + 10, y: y - 16, size: 7, font: bold, color: colors.muted });
    page.drawText(fitText(value, bold, 10, metricWidth - 20), { x: x + 10, y: y - 36, size: 10, font: bold, color });
  };

  drawPageHeader(true);
  const metricWidth = (contentWidth - 16) / 3;
  drawMetric("Total spending", money(report.totals.spending, report.currency), margin, colors.expense, colors.expenseSoft);
  drawMetric("Total earning", money(report.totals.earning, report.currency), margin + metricWidth + 8, colors.income, colors.incomeSoft);
  drawMetric("Total savings", money(report.totals.savings, report.currency), margin + (metricWidth + 8) * 2, colors.primary, colors.primarySoft);
  y -= 65;

  drawIconHeading("AI", "AI insights", colors.primary);
  const insightGap = 7;
  const insightWidth = (contentWidth - insightGap) / 2;
  for (let index = 0; index < report.insights.slice(0, 3).length; index += 2) {
    const row = report.insights.slice(index, index + 2);
    ensureSpace(58);
    row.forEach((insight, column) => {
      const x = margin + column * (insightWidth + insightGap);
      drawCard(x, y, insightWidth, 54, colors.card);
      page.drawCircle({ x: x + 14, y: y - 15, size: 4, color: colors.primary });
      page.drawText(safeText(insight.title), { x: x + 25, y: y - 18, size: 8, font: bold, color: colors.ink });
      drawWrapped(insight.body, x + 11, y - 34, insightWidth - 22, 7, colors.muted, 8.5);
    });
    y -= 61;
  }
  if (report.ai.source === "local") {
    y -= 2;
    y -= drawWrapped("Generated locally because NVIDIA AI was unavailable.", margin, y, contentWidth, 6.8, colors.muted, 8);
  }
  y -= 7;

  drawIconHeading("$", "Category spending", colors.expense);
  const categories = report.categorySpending.slice(0, 6);
  const categoryRowHeight = 20;
  ensureSpace(Math.max(40, categories.length * categoryRowHeight + 12));
  const categoryCardTop = y;
  drawCard(margin, categoryCardTop, contentWidth, Math.max(34, categories.length * categoryRowHeight + 8), colors.card);
  if (!categories.length) {
    page.drawText("No expense categories were recorded in this period.", { x: margin + 12, y: y - 21, size: 7.5, font: regular, color: colors.muted });
    y -= 42;
  } else {
    categories.forEach((category, index) => {
      const rowY = categoryCardTop - 12 - index * categoryRowHeight;
      if (index === 0) page.drawRectangle({ x: margin + 5, y: rowY - 13, width: contentWidth - 10, height: 18, color: colors.expenseSoft });
      page.drawCircle({ x: margin + 16, y: rowY - 5, size: 3, color: colors.expense });
      page.drawText(fitText(category.name, regular, 7.5, contentWidth - 165), { x: margin + 27, y: rowY - 7, size: 7.5, font: regular, color: colors.ink });
      page.drawText(`${category.share}%`, { x: margin + contentWidth - 98, y: rowY - 7, size: 7.5, font: bold, color: colors.muted });
      const amount = money(category.amount, report.currency);
      page.drawText(amount, { x: margin + contentWidth - 10 - bold.widthOfTextAtSize(amount, 7.5), y: rowY - 7, size: 7.5, font: bold, color: colors.expense });
    });
    y = categoryCardTop - categories.length * categoryRowHeight - 10;
  }
  y -= 7;

  drawIconHeading("!", "Most costly expense", colors.expense);
  const twoColGap = 10;
  const twoColWidth = (contentWidth - twoColGap) / 2;
  ensureSpace(94);
  const twoColTop = y;
  drawCard(margin, twoColTop, twoColWidth, 86, colors.expenseSoft);
  page.drawText("Largest single expense", { x: margin + 12, y: twoColTop - 17, size: 7, font: bold, color: colors.expense });
  if (report.topExpense) {
    page.drawText(fitText(report.topExpense.title, bold, 9, twoColWidth - 24), { x: margin + 12, y: twoColTop - 38, size: 9, font: bold, color: colors.ink });
    drawWrapped(`${report.topExpense.category}  |  ${report.topExpense.date}`, margin + 12, twoColTop - 52, twoColWidth - 24, 7, colors.muted, 8);
    page.drawText(money(report.topExpense.amount, report.currency), { x: margin + 12, y: twoColTop - 75, size: 10, font: bold, color: colors.expense });
  } else {
    page.drawText("No expenses recorded yet.", { x: margin + 12, y: twoColTop - 42, size: 7.5, font: regular, color: colors.muted });
  }

  const forecastX = margin + twoColWidth + twoColGap;
  drawCard(forecastX, twoColTop, twoColWidth, 86, colors.forecastSoft);
  page.drawText("Future forecast", { x: forecastX + 12, y: twoColTop - 17, size: 7, font: bold, color: colors.forecast });
  page.drawText(safeText(report.forecast.label), { x: forecastX + 12, y: twoColTop - 36, size: 9, font: bold, color: colors.ink });
  page.drawText(`Spending  ${money(report.forecast.spending, report.currency)}`, { x: forecastX + 12, y: twoColTop - 52, size: 7, font: regular, color: colors.forecast });
  page.drawText(`Earning   ${money(report.forecast.earning, report.currency)}`, { x: forecastX + 12, y: twoColTop - 64, size: 7, font: regular, color: colors.income });
  page.drawText(`Savings   ${money(report.forecast.savings, report.currency)}`, { x: forecastX + 12, y: twoColTop - 76, size: 7, font: regular, color: colors.primary });
  y -= 98;

  const suggestionHeight = Math.max(46, report.suggestions.reduce((total, suggestion) => total + wrapText(suggestion, regular, 7.5, contentWidth - 38).length * 10 + 10, 0));
  ensureSpace(suggestionHeight + 44);
  drawIconHeading("+", "Suggestions", colors.income);
  const suggestionTop = y;
  drawCard(margin, suggestionTop, contentWidth, suggestionHeight, colors.card);
  let suggestionY = suggestionTop - 18;
  report.suggestions.forEach((suggestion) => {
    page.drawCircle({ x: margin + 16, y: suggestionY + 2, size: 3, color: colors.income });
    const used = drawWrapped(suggestion, margin + 27, suggestionY, contentWidth - 41, 7.5, colors.ink, 10);
    suggestionY -= used + 6;
  });
  y = suggestionTop - suggestionHeight - 14;

  pdf.getPages().forEach((pdfPage, index, pages) => {
    pdfPage.drawLine({ start: { x: margin, y: 31 }, end: { x: pageWidth - margin, y: 31 }, thickness: 0.5, color: colors.border });
    pdfPage.drawText("Luna - calm, clear money management", { x: margin, y: 18, size: 6.5, font: regular, color: colors.muted });
    const pageNumber = `Page ${index + 1} of ${pages.length}`;
    pdfPage.drawText(pageNumber, { x: pageWidth - margin - bold.widthOfTextAtSize(pageNumber, 6.5), y: 18, size: 6.5, font: bold, color: colors.muted });
  });

  return pdf.save();
}
