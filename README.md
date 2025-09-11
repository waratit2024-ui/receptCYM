# ระบบคำร้องขอเอกสารวัดไชยามาตย์

ระบบ Web App ด้วย Google Apps Script + HTML/JS  
รองรับการ:
- ส่งฟอร์มคำร้อง + แนบสลิป
- บันทึกข้อมูลลง Google Sheet
- แจ้งเตือนอัตโนมัติผ่านอีเมล
- ระบบหลังบ้านสำหรับแอดมิน (CRUD + อัปโหลดไฟล์)

## โครงสร้างโค้ด
- `src/Code.gs` → โค้ดฝั่ง Server (Google Apps Script)
- `src/index.html` → หน้า Web App สำหรับผู้ใช้งาน
- `src/Style.html` → CSS + Tailwind

## การติดตั้ง
1. สร้าง Google Apps Script โปรเจกต์ใหม่
2. อัปโหลดไฟล์จาก `src/` ไปวางแทนที่
3. ตั้งค่า **Script Properties**:
   - `11SsgEH0nritEA9Fz6KhcNGJUGNUFCilAdhLJT0AIi60`
   - `Sheet1`
   - `1cb4sS34wqGXeHwKBG-gIH5m1aXdrwVqA`
   - `ADMIN_PASSWORD`
   - `GEMINI_API_KEY`
4. Deploy เป็น Web App
