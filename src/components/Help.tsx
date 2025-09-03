'use client';

export default function HelpPage() {
  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-semibold'>วิธีการใช้งานระบบ Nurse Roster</h1>
      <p className='text-soft'>
        คำแนะนำแบบย่อสำหรับแอดมินและสตาฟ: ตั้งหน่วยงาน → เพิ่มพนักงาน → ตั้งแผน → Auto Assign → ตรวจด้วย Analyse →
        แก้ไขจุดจำเป็น → Export
      </p>

      <div className='grid md:grid-cols-2 gap-4'>
        {/* <section className='card p-4 space-y-2'>
          <h2 className='text-lg font-medium'>เริ่มต้น</h2>
          <ol className='list-decimal list-inside space-y-1 text-sm'>
            <li>
              กด <span className='badge'>Login</span> ด้วย Google
            </li>
            <li>
              ถ้าเป็นแอดมินแล้วไม่เห็นเมนู: เพิ่มอีเมลใน <code className='badge'>NEXT_PUBLIC_ADMIN_EMAILS</code>{' '}
              แล้วรีสตาร์ต dev server
            </li>
          </ol>
          <div className='divider' />
          <h3 className='font-medium'>เมนูหลัก</h3>
          <ul className='list-disc list-inside space-y-1 text-sm'>
            <li>
              <b>สถานที่ทำงาน</b>: เพิ่ม/แก้ ICU, ER, CCU ฯลฯ
            </li>
            <li>
              <b>แผนรายเดือน</b>: ตั้ง <i>Demand/คนต่อเวร</i>, <i>Base Shifts</i>, <i>Min OT</i>, <i>Day Off</i>,{' '}
              <i>Preferences</i>, และ <i>INCHARGE min/max</i>
            </li>
            <li>
              <b>ปฏิทิน</b>: ดู/แก้ตาราง, Auto Assign, Analyse, Export
            </li>
          </ul>
        </section> */}

        <section className='card p-4 space-y-2'>
          <h2 className='text-lg font-medium'>ลำดับการใช้งานที่แนะนำ</h2>
          <ol className='list-decimal list-inside space-y-1 text-sm'>
            <li>
              <b>สถานที่ทำงาน</b> → เพิ่มหน่วยงาน
            </li>
            <li>
              เพิ่ม <b>พนักงาน</b> ของหน่วยนั้น ระบุบทบาท <span className='badge'>INCHARGE</span> หรือ{' '}
              <span className='badge'>MED</span>
            </li>
            <li>
              เข้า <b>แผนรายเดือน</b> (เลือกเดือน) แล้วตั้งค่า Base/Min OT/Day Off/Preferences
            </li>
            <li>
              ไปที่ <b>ปฏิทิน</b> → เลือกหน่วยงาน+เดือน → กด <span className='btn xs'>Auto Assign</span>
            </li>
            <li>
              กด <span className='btn xs'>Analyse</span> ที่หัวข้อของวัน เพื่อตรวจ “ใครลงได้/ไม่ได้ + เหตุผล”
            </li>
            <li>
              แก้ไขรายช่อง (ปุ่ม <span className='btn xs'>แก้ไข</span>) แล้ว <b>บันทึก</b>
            </li>
            <li>
              ส่งออกเป็น <span className='badge'>Excel</span>
            </li>
          </ol>
        </section>
      </div>

      <section className='card p-4 space-y-3'>
        <h2 className='text-lg font-medium'>กติกา Auto Assign (สรุป)</h2>
        <ul className='grid md:grid-cols-2 gap-2 text-sm'>
          <li>
            จัดลำดับเวร: <b>ดึก → เช้า → บ่าย</b> เพื่อล็อก INCHARGE ของดึกก่อน
          </li>
          <li>
            แต่ละเวรต้องมี INCHARGE ≥ <i>inMin</i> และ ≤ <i>inMax</i>
          </li>
          <li>
            <b>สูงสุด 2 เวร/วัน/คน</b>
          </li>
          <li>
            <b>ห้าม NIGHT → MORNING</b> วันถัดไป
          </li>
          <li>
            เคารพ <b>Day Off</b>
          </li>
          <li>
            <b>ห้ามคู่ 2 เวร/วันเดิม</b> (เช่น เช้า+บ่าย) ซ้ำกันเกิน <b>3 วันติด</b>
          </li>
          <li>
            <b>ห้ามทำงานติดกันเกิน 5 วัน</b> (นับเป็น “วัน”)
          </li>
          <li>
            น้ำหนักเลือกคน: พิจารณา <b>Preferences 30%</b> + <b>Base ที่ยังไม่ครบ 35%</b> + <b>Min OT ที่ยังขาด 35%</b>
          </li>
          <li>
            รอบเติมโควตา: บังคับให้แต่ละคนได้ครบ <b>Base + Min OT</b>
          </li>
          <li>
            ถ้า Planner ติ๊ก <b>Skip last NIGHT</b> → ปิดเวรดึกวันสุดท้ายอัตโนมัติ
          </li>
        </ul>
      </section>

      {/* <section className='card p-4 space-y-3'>
        <h2 className='text-lg font-medium'>Tips & Troubleshooting</h2>
        <ul className='list-disc list-inside space-y-1 text-sm'>
          <li>
            “ปุ่มแอดมินหาย” → ตรวจ role หรือเพิ่มอีเมลใน <code className='badge'>NEXT_PUBLIC_ADMIN_EMAILS</code>
          </li>
          <li>
            “คนไม่ครบ” → ลด Demand หรือเพิ่มบุคลากร/เปลี่ยนบทบาท/คลาย inMin/inMax, ดูเหตุผลใน <b>Analyse</b>
          </li>
          <li>CSV ภาษาไทยเพี้ยน → ใช้ Data &gt; From Text/CSV (UTF-8)</li>
          <li>
            Excel มีแท็บ <b>Schedule</b> และ <b>Summary</b> (Base/Min OT/ทำจริง/OT/ขาด-เกิน)
          </li>
        </ul>
      </section> */}
    </div>
  );
}
