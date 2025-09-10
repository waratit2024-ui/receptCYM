/**
 * @fileoverview Code.gs
 * ไฟล์หลักสำหรับ Server-side ในระบบคำร้องขอเอกสารวัดไชยามาตย์
 * จัดการการแสดงผลหน้าเว็บ, การส่งข้อมูล, และการจัดการฐานข้อมูล (CRUD)
 */

// ** ตั้งค่าตัวแปรสำคัญ **
const SHEET_ID = '11SsgEH0nritEA9Fz6KhcNGJUGNUFCilAdhLJT0AIi60';
const SHEET_NAME = 'Sheet1';
const DRIVE_ID = '1cb4sS34wqGXeHwKBG-gIH5m1aXdrwVqA';
const ADMIN_PASSWORD = '13263162';

// กำหนด Session สำหรับ Admin (ไม่มีการเก็บใน cookie/localStorage เพราะโดเมนต่างกัน)
const ADMIN_SESSION_KEY = 'admin_session';

/**
 * ฟังก์ชันหลักที่ทำหน้าที่รับคำขอ GET จากเว็บแอปพลิเคชัน
 * @param {Object} e - Object ที่มีพารามิเตอร์ของ URL
 */
function doGet(e) {
  var page = e.parameter.page || "index"; // กำหนดค่าเริ่มต้นเป็นหน้า index
  var template = HtmlService.createTemplateFromFile(page);

  return template.evaluate()
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * ฟังก์ชันสำหรับประมวลผลการส่งฟอร์มจากหน้าผู้ใช้
 * @param {Object} formData - ข้อมูลจากฟอร์มที่ถูกสร้างขึ้นในฝั่ง client
 * @returns {Object} สถานะและข้อความ
 */
function processUserForm(formData) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    let slipUrl = '';

    // อัปโหลดสลิป (ถ้ามี)
    if (formData.donationType === 'โอนผ่านธนาคาร' && formData.slipFile) {
      const dataUrl = String(formData.slipFile);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
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

    // เอกสารที่ต้องการ
    const requiredDocuments = Array.isArray(formData.requiredDocuments) 
      ? formData.requiredDocuments.join(', ')
      : formData.requiredDocuments;

    // ป้องกันกรณีเลือก "รับผ่าน Email" แต่ไม่มีอีเมล (กันพลาดฝั่ง client)
    if (formData.receiveMethod === 'รับผ่าน Email' && !formData.email) {
      throw new Error('กรุณาระบุอีเมลสำหรับการรับเอกสาร');
    }

    // บันทึกลงชีต (เพิ่ม receiveMethod, email เข้าก่อน Tax/Merit URL)
    const timestamp = formatThaiDate(new Date());
    const rowData = [
      timestamp,                    // 1 เวลา
      formData.nationalId,          // 2 บัตรประชาชน
      formData.fullName,            // 3 ชื่อ-นามสกุล
       "'" + formData.phoneNumber,         // 4 เบอร์โทร
      requiredDocuments,            // 5 เอกสารที่ต้องการ
      formData.receiveMethod || '', // 10 ช่องทางรับเอกสาร
      formData.email || '',         // 11 อีเมลรับเอกสาร (ถ้ามี)
      formData.donationType,        // 6 ประเภทการบริจาค
      formData.amount,              // 7 จำนวนเงิน
      slipUrl,                      // 8 ลิงก์สลิป
      formData.note || '',          // 9 หมายเหตุ
      '',                           // 12 TaxPDFURL
      ''                            // 13 MeritPDFURL
    ];
    sheet.appendRow(rowData);

    // ---------- อีเมลแจ้งแอดมิน (HTML) ----------
    const adminSubject = "📩 มีคำร้องใหม่จากระบบคำร้องขอเอกสาร";
    const adminHtml = `
      <div style="font-family: 'Sarabun', Tahoma, sans-serif; padding: 20px; background: #f7fafc; color: #1f2937;">
        <h2 style="margin:0 0 8px; color:#059669;">📑 มีคำร้องใหม่เข้ามา</h2>
        <p style="margin:0 0 12px;">รายละเอียดคำร้องล่าสุดจากผู้ใช้:</p>
        <table style="border-collapse:collapse; width:100%; background:#ffffff; border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#059669; color:#ffffff;">
              <th style="padding:10px; text-align:left;">หัวข้อ</th>
              <th style="padding:10px; text-align:left;">ข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ['เวลาที่บันทึก', timestamp],
              ['ชื่อ-นามสกุล', formData.fullName],
              ['เลขบัตรประชาชน', formData.nationalId],
              ['เบอร์โทรศัพท์', formData.phoneNumber],
              ['เอกสารที่ต้องการ', requiredDocuments || '-'],
              ['ช่องทางรับเอกสาร', formData.receiveMethod || '-'],
              ['อีเมลรับเอกสาร', formData.email || '-'],
              ['ประเภทการบริจาค', formData.donationType],
              ['จำนวนเงิน', (formData.amount || '') + ' บาท'],
              ['สลิป', slipUrl ? `<a href="${slipUrl}" target="_blank">ดูสลิป</a>` : 'ไม่มีแนบ'],
              ['หมายเหตุ', formData.note || '-']
            ].map(([k,v]) => `
              <tr>
                <td style="padding:10px; border-top:1px solid #e5e7eb; width:220px;"><strong>${k}</strong></td>
                <td style="padding:10px; border-top:1px solid #e5e7eb;">${v}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="margin-top:16px; font-size:12px; color:#6b7280;">อีเมลนี้ส่งจากระบบอัตโนมัติ</p>
      </div>
    `;
    MailApp.sendEmail({
      to: "nawaratk65@gmail.com",
      subject: adminSubject,
      htmlBody: adminHtml
    });

    // ---------- อีเมลยืนยันผู้ใช้ (เฉพาะกรณี รับผ่าน Email) ----------
    if (formData.receiveMethod === 'รับผ่าน Email' && formData.email) {
      const userSubject = "วัดไชยามาตย์: รับคำร้องของท่านแล้ว";
      const userHtml = `
        <div style="font-family: 'Sarabun', Tahoma, sans-serif; padding: 20px; background: #ffffff; color:#111827;">
          <div style="border-radius:12px; padding:16px; background: linear-gradient(90deg,#ecfeff,#f0fdf4); border:1px solid #e5e7eb;">
            <h2 style="margin:0 0 8px; color:#047857;">🙏 วัดไชยามาตย์ ได้รับคำร้องของท่านแล้ว</h2>
            <p style="margin:0;">เรียนคุณ <strong>${formData.fullName}</strong></p>
          </div>

          <h3 style="margin:20px 0 8px; color:#047857;">สรุปรายการคำร้อง</h3>
          <table style="border-collapse:collapse; width:100%; background:#ffffff; border:1px solid #e5e7eb;">
            <tbody>
              ${[
                ['เวลาที่บันทึก', timestamp],
                ['ช่องทางรับเอกสาร', formData.receiveMethod],
                ['อีเมลสำหรับรับเอกสาร', formData.email],
                ['เอกสารที่ต้องการ', requiredDocuments || '-'],
                ['ประเภทการบริจาค', formData.donationType],
                ['จำนวนเงิน', (formData.amount || '') + ' บาท'],
                ['หมายเหตุ', formData.note || '-']
              ].map(([k,v]) => `
                <tr>
                  <td style="padding:10px; border-top:1px solid #e5e7eb; background:#f9fafb; width:220px;"><strong>${k}</strong></td>
                  <td style="padding:10px; border-top:1px solid #e5e7eb;">${v}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top:16px; padding:12px 14px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px;">
            <p style="margin:0 0 6px;"><strong>สถานะ:</strong> ได้รับข้อมูลแล้ว</p>
            <p style="margin:0;">โปรดรอดำเนินการ <strong>2 วันทำการ</strong> กรณีเร่งด่วน ติดต่อ <a href="mailto:chaiyamartta@gmail.com">chaiyamartta@gmail.com</a> หรือ <a href="tel:0822801992">082-280-1992</a></p>
          </div>

          <p style="margin-top:12px;">หากต้องการแก้ไขข้อมูล โปรดติดต่อ <a href="tel:0822801992">082-280-1992</a></p>

          <p style="margin-top:16px; font-size:12px; color:#6b7280;">อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้</p>
        </div>
      `;
      MailApp.sendEmail({
        to: formData.email,
        subject: userSubject,
        htmlBody: userHtml,
        replyTo: "chaiyamartta@gmail.com", // ผู้รับตอบกลับจะไปที่อีเมลนี้
        name: "วัดไชยามาตย์"
      });
    }

    return { status: 'success', message: 'ส่งคำร้องเรียบร้อยแล้ว' };

  } catch (error) {
    Logger.log(error);
    return { status: 'error', message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message };
  }
}



/**
 * ฟังก์ชันสำหรับล็อกอินแอดมิน
 * @param {string} password - รหัสผ่านที่ผู้ใช้ป้อน
 * @returns {boolean} true ถ้าล็อกอินสำเร็จ, false ถ้าไม่สำเร็จ
 */
function loginAdmin(password) {
  if (password === ADMIN_PASSWORD) {
    PropertiesService.getUserProperties().setProperty(ADMIN_SESSION_KEY, ADMIN_PASSWORD);
    return true;
  }
  return false;
}

function isAdminSessionActive_() {
  const userProps = PropertiesService.getUserProperties();
  return userProps.getProperty(ADMIN_SESSION_KEY) === ADMIN_PASSWORD;
}

function assertAdmin_() {
  if (!isAdminSessionActive_()) {
    throw new Error('Unauthorized');
  }
}

function logoutAdmin() {
  PropertiesService.getUserProperties().deleteProperty(ADMIN_SESSION_KEY);
  return true;
}


/**
 * ฟังก์ชันสำหรับดึงข้อมูลคำร้องทั้งหมดสำหรับแผงควบคุมแอดมิน
 * @returns {Array<Array<any>>} ข้อมูลคำร้องทั้งหมดใน Google Sheet
 */
function getRequests() {
  assertAdmin_(); // ✅ เพิ่ม
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  return sheet.getDataRange().getValues();
}

/**
 * ฟังก์ชันสำหรับอัปเดตคำร้องขอเอกสาร (สำหรับแอดมิน)
 * @param {number} rowIndex - หมายเลขแถว (ตามที่แสดงใน Sheet, เริ่มจาก 1)
 * @param {string} taxUrl - URL ของใบลดหย่อนภาษี
 * @param {string} meritUrl - URL ของใบอนุโมทนาบัตร
 */
function updateRequest(rowIndex, taxUrl, meritUrl) {
  assertAdmin_(); // ✅ เพิ่ม
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const range = sheet.getRange(rowIndex + 1, 10, 1, 2);
  range.setValues([[taxUrl, meritUrl]]);
}

/**
 * ฟังก์ชันสำหรับลบคำร้องขอเอกสาร (สำหรับแอดมิน)
 * @param {number} rowIndex - หมายเลขแถว (ตามที่แสดงใน Sheet, เริ่มจาก 1)
 */
function deleteRequest(rowIndex) {
  assertAdmin_(); // ✅ เพิ่ม
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  sheet.deleteRow(rowIndex + 1);
}

/**
 * ฟังก์ชันสำหรับค้นหาข้อมูลผู้ใช้ด้วยเลขบัตรประชาชน
 * @param {string} nationalId - เลขบัตรประชาชนที่ต้องการค้นหา
 * @returns {Array<Array<any>>} ข้อมูลรายการทั้งหมดของ ID ที่ตรงกัน
 */
function searchUser(nationalId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  values.shift(); // ลบแถวหัวข้อออก
  const results = values.filter(row => row[1] == nationalId);
  return results;
}

/**
 * ฟังก์ชันสำหรับสร้างข้อความสรุปและร่างข้อความด้วย Gemini API
 * @param {Array<string>} rowData - ข้อมูลของแถวที่ต้องการประมวลผล
 * @returns {Object} ประกอบด้วย summary (ข้อความสรุป) และ message (ข้อความร่างถึงผู้ขอ)
 */
function generateSummaryAndMessage(rowIndex) {
  // ป้องกันการเรียกโดยผู้ไม่ได้รับอนุญาต (ดูหัวข้อ C ด้านล่างด้วย)
  // assertAdmin_(); // เปิดใช้หลังเพิ่มฟังก์ชันความปลอดภัยในข้อ C

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  // values[0] คือหัวตาราง, values[1] คือแถวข้อมูลแรก
  const row = values[rowIndex]; // rowIndex ที่หน้า Admin ส่งมาคือ 1,2,3,... ตรงกับ values[rowIndex]
  if (!row) {
    throw new Error('ไม่พบแถวข้อมูลที่ต้องการ');
  }

  const [timestamp, nationalId, fullName, phoneNumber, requiredDocs, donationType, amount, slipUrl, note] = row;

  const prompt = `
    Based on the following document request data from a temple, please do two things:
    1. Provide a brief, professional summary of the request.
    2. Draft a polite and professional message in Thai to the user to confirm their request and mention that the temple is processing it. The message should include the user's name, the requested documents, and the amount donated.

    Data:
    - User Name: ${fullName}
    - National ID: ${nationalId}
    - Phone Number: ${phoneNumber}
    - Requested Documents: ${requiredDocs}
    - Donation Type: ${donationType}
    - Amount: ${amount} Baht
    - Slip URL: ${slipUrl ? 'มี' : 'ไม่มี'}
    - Note: ${note}

    Format the response as a single JSON object with two keys: "summary" and "message".
    Example JSON: {"summary": "...", "message": "..."}
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { "summary": { "type": "STRING" }, "message": { "type": "STRING" } },
        propertyOrdering: ["summary","message"]
      }
    }
  };

  const apiKey = ""; // ควรย้ายไป Script Properties
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  try {
    const res = UrlFetchApp.fetch(apiUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload) });
    const result = JSON.parse(res.getContentText());
    return JSON.parse(result.candidates[0].content.parts[0].text);
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.message);
    return { summary: 'ไม่สามารถสร้างข้อสรุปได้', message: 'ไม่สามารถสร้างข้อความได้' };
  }
}


/**
 * ฟังก์ชันสำหรับแทรกเนื้อหาของไฟล์อื่น (เช่น CSS) เข้ามาใน HTML
 * @param {string} filename - ชื่อไฟล์ที่ต้องการแทรก
 * @returns {string} เนื้อหาของไฟล์ HTML
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ฟังก์ชันแปลงวันที่เป็นฟอร์แมตไทย: 15/8/2568 : 12.00 น.
 */
function formatThaiDate(date) {
  const tz = "Asia/Bangkok";
  const d = Utilities.formatDate(date, tz, "d");
  const m = Utilities.formatDate(date, tz, "M");
  const y = (date.getFullYear() + 543).toString();
  const hh = Utilities.formatDate(date, tz, "HH");
  const mm = Utilities.formatDate(date, tz, "mm");
  return `${d}/${m}/${y} : ${hh}.${mm} น.`;
}
