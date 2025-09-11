/**
 * @fileoverview Code.gs
 * ไฟล์หลักสำหรับ Server-side ในระบบคำร้องขอเอกสารวัดไชยามาตย์
 */

const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
const SHEET_NAME = PropertiesService.getScriptProperties().getProperty('SHEET_NAME') || 'Sheet1';
const DRIVE_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_ID');
const ADMIN_PASSWORD = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
const ADMIN_SESSION_KEY = 'admin_session';

/** ======================= doGet ======================= */
function doGet(e) {
  var page = e.parameter.page || "index"; 
  var template = HtmlService.createTemplateFromFile(page);

  return template.evaluate()
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** ======================= User Form ======================= */
function processUserForm(formData) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    let slipUrl = '';

    // Upload slip if provided
    if (formData.donationType === 'โอนผ่านธนาคาร' && formData.slipFile) {
      const match = String(formData.slipFile).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error('รูปแบบสลิปไม่ถูกต้อง');

      const mime = match[1];
      const b64  = match[2];
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

    if (formData.receiveMethod === 'รับผ่าน Email' && !formData.email) {
      throw new Error('กรุณาระบุอีเมลสำหรับการรับเอกสาร');
    }

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

    // Send email to admin
    MailApp.sendEmail({
      to: "nawaratk65@gmail.com",
      subject: "📩 มีคำร้องใหม่จากระบบคำร้องขอเอกสาร",
      htmlBody: `<p>มีคำร้องใหม่จาก ${formData.fullName}</p>`
    });

    // Send confirmation to user
    if (formData.receiveMethod === 'รับผ่าน Email' && formData.email) {
      MailApp.sendEmail({
        to: formData.email,
        subject: "วัดไชยามาตย์: รับคำร้องของท่านแล้ว",
        htmlBody: `<p>เรียนคุณ ${formData.fullName} ระบบได้รับคำร้องแล้ว</p>`,
        replyTo: "chaiyamartta@gmail.com",
        name: "วัดไชยามาตย์"
      });
    }

    return { status: 'success', message: 'ส่งคำร้องเรียบร้อยแล้ว' };

  } catch (error) {
    Logger.log(error);
    return { status: 'error', message: 'เกิดข้อผิดพลาด: ' + error.message };
  }
}

/** ======================= Admin ======================= */
function loginAdmin(password) {
  if (password === ADMIN_PASSWORD) {
    PropertiesService.getUserProperties().setProperty(ADMIN_SESSION_KEY, ADMIN_PASSWORD);
    return true;
  }
  return false;
}
function isAdminSessionActive_() {
  return PropertiesService.getUserProperties().getProperty(ADMIN_SESSION_KEY) === ADMIN_PASSWORD;
}
function assertAdmin_() {
  if (!isAdminSessionActive_()) throw new Error('Unauthorized');
}
function logoutAdmin() {
  PropertiesService.getUserProperties().deleteProperty(ADMIN_SESSION_KEY);
  return true;
}
function getRequests() {
  assertAdmin_();
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME).getDataRange().getValues();
}
function updateRequest(rowIndex, taxUrl, meritUrl) {
  assertAdmin_();
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  sheet.getRange(rowIndex + 1, 10, 1, 2).setValues([[taxUrl, meritUrl]]);
}
function deleteRequest(rowIndex) {
  assertAdmin_();
  SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME).deleteRow(rowIndex + 1);
}
function searchUser(nationalId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  values.shift();
  return values.filter(row => row[1] == nationalId);
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
