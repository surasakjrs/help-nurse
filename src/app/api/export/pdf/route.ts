import { NextRequest, NextResponse } from 'next/server';
import { getCalendarPDF } from '@/lib/exporters';

export async function GET(req: NextRequest) {
  const wid = req.nextUrl.searchParams.get('wid') || '';
  const ym = req.nextUrl.searchParams.get('ym') || '';
  const pdf = await getCalendarPDF(wid, ym);
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="schedule-${wid}-${ym}.pdf"`,
    },
  });
}
