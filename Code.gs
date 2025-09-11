/**
 * ระบบคำร้องขอเอกสารวัดไชยามาตย์
 * เวอร์ชันรวม Code.gs + index.html
 */

// ตั้งค่าให้ตรงกับระบบของคุณ
const SHEET_ID = '11SsgEH0nritEA9Fz6KhcNGJUGNUFCilAdhLJT0AIi60';   // <-- ใส่ Google Sheet ID
const SHEET_NAME = 'Sheet1';             // <-- ใส่ชื่อชีต
const DRIVE_ID = '1cb4sS34wqGXeHwKBG-gIH5m1aXdrwVqA';   // <-- ใส่โฟลเดอร์ไอดี Google Drive
const ADMIN_PASSWORD = '13263162';       // <-- ตั้งรหัสผ่านแอดมิน

/** ======================= doGet ======================= */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle("ระบบคำร้องวัดไชยามาตย์")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** ======================= User Form ======================= */
function processUserForm(formData) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    let slipUrl = '';

    // Upload slip ถ้ามีแนบมา
    if (formData.donationType === 'โอนผ่านธนาคาร' && formData.slipFile) {
      const match = String(formData.slipFile).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error('ไฟล์สลิปไม่ถูกต้อง');

      const mime = match[1];
      const b64 = match[2];
      const bytes = Utilities.base64Decode(b64);
      const name = formData.slipFileName || ('slip_' + Date.now());
      const blob = Utilities.newBlob(bytes, mime, name);

      const folder = DriveApp.getFolderById(DRIVE_ID);
      const file = folder.createFile(blob);
      slipUrl = file.getUrl();
    }

    const requiredDocuments = Array.isArray(formData.requiredDocuments)
      ? formData.requiredDocuments.join(', ')
      : formData.requiredDocuments;

    const timestamp = formatThaiDate(new Date());

    const rowData = [
      timestamp,
      formData.nationalId,
      formData.fullName,
      "'" + formData.phoneNumber,
      requiredDocuments,
      formData.receiveMethod || '',
      formData.email || '',
      formData.donationType,
      formData.amount,
      slipUrl,
      formData.note || '',
      '',
      ''
    ];

    sheet.appendRow(rowData);

    return { status: 'success', message: 'ส่งคำร้องเรียบร้อยแล้ว ✅' };

  } catch (error) {
    Logger.log(error);
    return { status: 'error', message: 'เกิดข้อผิดพลาด: ' + error.message };
  }
}

/** ======================= Utils ======================= */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function formatThaiDate(date) {
  const tz = "Asia/Bangkok";
  const d = Utilities.formatDate(date, tz, "d");
  const m = Utilities.formatDate(date, tz, "M");
  const y = (date.getFullYear() + 543).toString();
  const hh = Utilities.formatDate(date, tz, "HH");
  const mm = Utilities.formatDate(date, tz, "mm");
  return `${d}/${m}/${y} : ${hh}.${mm} น.`;
}
