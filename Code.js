// ===== Sheet & column configuration =====
var ACCOUNT_SHEETS = ['الطلاب', 'المشرفين', 'الأدمن'];
var STUDENTS_SHEET = 'الطلاب';

// Column indices (1-based). Account sheets share cols 1-8; الطلاب adds col 9.
var COL_ID = 1;
var COL_ROLE = 2;
var COL_FIRST_NAME = 3;
var COL_LAST_NAME = 4;
var COL_PASSWORD = 5;
var COL_STATUS = 6;
var COL_CREATED = 7;
var COL_LAST_LOGIN = 8;
var COL_GUARDIAN_ID = 9; // الطلاب only

var STATUS_ACTIVE = 'نعم';

function getSheetByName(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function findRowById(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1;
    }
  }
  return -1;
}

// Locate an account by ID across all account sheets.
// Returns { sheet, sheetName, row } or null.
function findAccount(id) {
  for (var s = 0; s < ACCOUNT_SHEETS.length; s++) {
    var name = ACCOUNT_SHEETS[s];
    var sheet = getSheetByName(name);
    if (!sheet) {
      continue;
    }
    var row = findRowById(sheet, id);
    if (row !== -1) {
      return { sheet: sheet, sheetName: name, row: row };
    }
  }
  return null;
}

// Locate the student whose guardian ID (الطلاب col 9) matches. Returns row or -1.
function findStudentRowByGuardianId(guardianId) {
  var sheet = getSheetByName(STUDENTS_SHEET);
  if (!sheet) {
    return -1;
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var gid = data[i][COL_GUARDIAN_ID - 1];
    if (gid !== '' && gid !== null && gid !== undefined && String(gid) === String(guardianId)) {
      return i + 1;
    }
  }
  return -1;
}

// Generate a unique 6-digit guardian ID that does not collide with any
// existing account ID (any sheet) or any existing guardian ID.
function generateGuardianId() {
  var used = {};

  for (var s = 0; s < ACCOUNT_SHEETS.length; s++) {
    var sheet = getSheetByName(ACCOUNT_SHEETS[s]);
    if (!sheet) {
      continue;
    }
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      used[String(data[i][COL_ID - 1])] = true;
      var gid = data[i][COL_GUARDIAN_ID - 1];
      if (gid !== '' && gid !== null && gid !== undefined) {
        used[String(gid)] = true;
      }
    }
  }

  var candidate;
  do {
    candidate = String(Math.floor(100000 + Math.random() * 900000));
  } while (used[candidate]);

  return candidate;
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  var result;

  if (action === 'checkId') {
    result = checkId(body.id);
  } else if (action === 'activate') {
    result = activateAccount(body.id, body.firstName, body.lastName, body.password);
  } else if (action === 'login') {
    result = login(body.id, body.password);
  } else if (action === 'guardianLogin') {
    result = guardianLogin(body.id);
  } else {
    result = { success: false, message: 'إجراء غير معروف' };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function checkId(id) {
  var account = findAccount(id);

  if (account) {
    var status = account.sheet.getRange(account.row, COL_STATUS).getValue();
    return {
      success: true,
      type: 'account',
      role: account.sheetName,
      activated: status === STATUS_ACTIVE
    };
  }

  // Not an account ID — check whether it is a guardian ID (الطلاب col 9).
  if (findStudentRowByGuardianId(id) !== -1) {
    return { success: true, type: 'guardian' };
  }

  return { success: false, message: 'معرف غير صحيح، تواصل مع الإدارة' };
}

function activateAccount(id, firstName, lastName, password) {
  var account = findAccount(id);

  if (!account) {
    return { success: false, message: 'معرف غير صحيح' };
  }

  var sheet = account.sheet;
  var row = account.row;

  var status = sheet.getRange(row, COL_STATUS).getValue();
  if (status === STATUS_ACTIVE) {
    return { success: false, message: 'الحساب مفعّل مسبقاً' };
  }

  if (!/^\d{4}$/.test(password)) {
    return { success: false, message: 'كلمة المرور يجب أن تكون 4 أرقام فقط' };
  }

  if (!firstName || !lastName) {
    return { success: false, message: 'الرجاء إدخال الاسم الأول والأخير' };
  }

  sheet.getRange(row, COL_FIRST_NAME).setValue(firstName);
  sheet.getRange(row, COL_LAST_NAME).setValue(lastName);
  sheet.getRange(row, COL_PASSWORD).setValue(password);
  sheet.getRange(row, COL_STATUS).setValue(STATUS_ACTIVE);

  var response = {
    success: true,
    message: 'تم تفعيل الحساب بنجاح',
    role: account.sheetName
  };

  // Guardian ID is created only when a student (الطلاب) activates.
  if (account.sheetName === STUDENTS_SHEET) {
    var guardianId = generateGuardianId();
    sheet.getRange(row, COL_GUARDIAN_ID).setValue(guardianId);
    response.guardianId = guardianId;
  }

  return response;
}

function login(id, password) {
  var account = findAccount(id);

  if (!account) {
    return { success: false, message: 'معرف غير صحيح' };
  }

  var sheet = account.sheet;
  var row = account.row;

  var status = sheet.getRange(row, COL_STATUS).getValue();
  if (status !== STATUS_ACTIVE) {
    return { success: false, message: 'الحساب غير مفعّل' };
  }

  var storedPassword = String(sheet.getRange(row, COL_PASSWORD).getValue());
  if (storedPassword !== String(password)) {
    return { success: false, message: 'كلمة المرور غير صحيحة' };
  }

  sheet.getRange(row, COL_LAST_LOGIN).setValue(new Date());

  return {
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    role: account.sheetName,
    firstName: sheet.getRange(row, COL_FIRST_NAME).getValue(),
    lastName: sheet.getRange(row, COL_LAST_NAME).getValue()
  };
}

function guardianLogin(id) {
  var row = findStudentRowByGuardianId(id);

  if (row === -1) {
    return { success: false, message: 'معرف غير صحيح' };
  }

  var sheet = getSheetByName(STUDENTS_SHEET);

  return {
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    role: 'ولي أمر',
    studentFirstName: sheet.getRange(row, COL_FIRST_NAME).getValue(),
    studentLastName: sheet.getRange(row, COL_LAST_NAME).getValue()
  };
}
