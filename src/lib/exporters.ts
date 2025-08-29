import { getAssignmentsByMonth } from '@/services/assignment.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function getCalendarCSV(wid: string, ym: string) {
  const items = await getAssignmentsByMonth(wid, ym);
  const header = 'day,shift,staffIds\n';
  const body = items.map((i: any) => `${i.day},${i.shift},"${(i.staffIds || []).join(' ')}"`).join('\n');
  return header + body + '\n';
}

export async function getCalendarPDF(wid: string, ym: string) {
  const items = await getAssignmentsByMonth(wid, ym);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const title = `Schedule ${wid} ${ym}`;
  page.drawText(title, { x: 50, y: 760, size: 16, font, color: rgb(0, 0, 0) });
  let y = 730;
  for (const i of items.slice(0, 40)) {
    // simple single-page list
    page.drawText(`${i.day} ${i.shift}: ${(i.staffIds || []).join(' ')}`, { x: 50, y, size: 10, font });
    y -= 14;
    if (y < 40) break;
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
