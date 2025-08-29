import AuthGate from '@/components/AuthGate';

export default function Home() {
  return (
    <AuthGate>
      <main className='space-y-6'>
        <h1 className='text-2xl font-semibold'>สรุปภาพรวม</h1>
        <div className='grid md:grid-cols-3 gap-4'>
          <div className='card p-4'>
            <div className='text-sm text-zinc-600'>ผู้ใช้งาน</div>
            <div className='text-2xl font-semibold'>แบบเรียลไทม์</div>
          </div>
          <div className='card p-4'>
            <div className='text-sm text-zinc-600'>สถานที่ทำงาน</div>
            <div className='text-2xl font-semibold'>จัดการได้ในเมนู</div>
          </div>
          <div className='card p-4'>
            <div className='text-sm text-zinc-600'>ปฏิทิน</div>
            <div className='text-2xl font-semibold'>ดู/Export CSV & PDF</div>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
