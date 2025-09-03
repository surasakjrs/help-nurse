import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportCsv(rows: string[][], filename = 'schedule.csv') {
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPdf(headers: string[], body: string[][], title = 'Monthly Schedule', filename = 'schedule.pdf') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  autoTable(doc, { head: [headers], body, startY: 60, styles: { fontSize: 9 } });
  doc.save(filename);
}
