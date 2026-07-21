// ===== Sheet & column configuration =====
var ACCOUNT_SHEETS = ['الطلاب', 'المشرفين', 'مسؤولون'];
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

// Named account sheets (also listed in ACCOUNT_SHEETS above).
var SUPERVISORS_SHEET = 'المشرفين';
var ADMINS_SHEET = 'مسؤولون';

// الطلاب extra column (added by the spreadsheet owner).
var COL_STUDENT_FAMILY = 10; // اسم الأسرة (الطلاب only)

// Pre-generated guardian IDs are pulled (not randomly generated) from this pool.
var IDS_SHEET = 'IDs';
var GUARDIAN_ID_POOL_RANGE = 'A82:A141'; // 60 pre-written 6-digit values

// ===== Families / Requirements / Completions sheets =====
var FAMILIES_SHEET = 'الأسر';
var REQUIREMENTS_SHEET = 'المتطلبات';
var COMPLETIONS_SHEET = 'الإنجازات';

// الأسر columns
var COL_FAMILY_NAME = 1; // اسم الأسرة (unique key — no numeric id)
var COL_FAMILY_COLOR = 2; // اللون (hex string)
var COL_FAMILY_SUPERVISOR = 3; // معرف المشرف (references المشرفين)
var COL_FAMILY_CREATED = 4; // تاريخ الإنشاء

// المتطلبات columns
var COL_REQ_NUMBER = 1; // رقم المتطلب (sequential, starts at 101)
var COL_REQ_CONTENT_TYPE = 2; // نوع المحتوى ("نص" | "رابط")
var COL_REQ_CONTENT = 3; // المحتوى (text or URL)
var COL_REQ_DATE_SYSTEM = 4; // نظام التاريخ ("هجري" | "ميلادي")
var COL_REQ_DATE = 5; // التاريخ (plain text)
var COL_REQ_TIME = 6; // الوقت (plain text, 12-hour)
var COL_REQ_INCLUDE_SUPERVISORS = 7; // يشمل المشرفين ("نعم" | "لا")
var COL_REQ_CREATED = 8; // تاريخ الإنشاء

// الإنجازات columns
var COL_COMP_REQ_NUMBER = 1; // رقم المتطلب (references المتطلبات col 1)
var COL_COMP_USER_ID = 2; // معرف المستخدم
var COL_COMP_DATE = 3; // تاريخ الإنجاز

var REQ_START_NUMBER = 101;

var CONTENT_TYPES = ['نص', 'رابط'];
var DATE_SYSTEMS = ['هجري', 'ميلادي'];

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

// Pull the first available guardian ID from the pre-generated pool
// (IDs!A82:A141): the first pooled value that is not already assigned as a
// guardian ID in الطلاب and is not used as an account ID in any sheet.
// Returns the ID string, or null when every pooled value is already used.
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

  var idsSheet = getSheetByName(IDS_SHEET);
  if (!idsSheet) {
    return null;
  }

  var pool = idsSheet.getRange(GUARDIAN_ID_POOL_RANGE).getValues();
  for (var p = 0; p < pool.length; p++) {
    var value = pool[p][0];
    if (value === '' || value === null || value === undefined) {
      continue;
    }
    var candidate = String(value);
    if (!used[candidate]) {
      return candidate;
    }
  }

  // Every pooled value is already taken.
  return null;
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

  // ===== PART 1: Families (admin-only) =====
  } else if (action === 'createFamily') {
    result = createFamily(body.adminId, body.name, body.color);
  } else if (action === 'assignSupervisorToFamily') {
    result = assignSupervisorToFamily(body.adminId, body.familyName, body.supervisorId);
  } else if (action === 'assignStudentToFamily') {
    result = assignStudentToFamily(body.adminId, body.studentId, body.familyName);
  } else if (action === 'listSupervisors') {
    result = listSupervisors(body.adminId);
  } else if (action === 'listFamiliesOverview') {
    result = listFamiliesOverview(body.adminId);

  // ===== PART 2: Requirements & Completions =====
  } else if (action === 'createRequirement') {
    result = createRequirement(
      body.adminId,
      body.contentType,
      body.content,
      body.dateSystem,
      body.dateValue,
      body.time,
      body.includeSupervisors
    );
  } else if (action === 'listRequirementsForUser') {
    result = listRequirementsForUser(body.id);
  } else if (action === 'completeRequirement') {
    result = completeRequirement(body.userId, body.requirementNumber);
  } else if (action === 'getFamilyProgress') {
    result = getFamilyProgress(body.supervisorId);
  } else if (action === 'getFamilyMembersSimpleStatus') {
    result = getFamilyMembersSimpleStatus(body.studentId);
  } else if (action === 'getStudentRecord') {
    result = getStudentRecord(body.studentId);
  } else if (action === 'getChildProgress') {
    result = getChildProgress(body.guardianId, body.studentId);

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
  sheet.getRange(row, COL_CREATED).setValue(new Date());

  var response = {
    success: true,
    message: 'تم تفعيل الحساب بنجاح',
    role: account.sheetName
  };

  // Guardian ID is assigned only when a student (الطلاب) activates. If the
  // pool is exhausted, the student is still activated — just without a
  // guardian ID — so they are never blocked from logging in.
  if (account.sheetName === STUDENTS_SHEET) {
    var guardianId = generateGuardianId();
    if (guardianId !== null) {
      sheet.getRange(row, COL_GUARDIAN_ID).setValue(guardianId);
      response.guardianId = guardianId;
    }
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

// =====================================================================
// Shared helpers for families / requirements / completions
// =====================================================================

function unauthorized() {
  return { success: false, message: 'غير مصرح لك بهذا الإجراء' };
}

// A caller is an admin only if their ID is actually found in مسؤولون.
function isAdmin(id) {
  var account = findAccount(id);
  return !!account && account.sheetName === ADMINS_SHEET;
}

// Locate a family by its name (the key). Returns the row number or -1.
function findFamilyRow(name) {
  var sheet = getSheetByName(FAMILIES_SHEET);
  if (!sheet) {
    return -1;
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_FAMILY_NAME - 1]) === String(name)) {
      return i + 1;
    }
  }
  return -1;
}

// First/last name for any account id, or null if not found.
function getAccountName(id) {
  if (id === '' || id === null || id === undefined) {
    return null;
  }
  var account = findAccount(id);
  if (!account) {
    return null;
  }
  return {
    firstName: account.sheet.getRange(account.row, COL_FIRST_NAME).getValue(),
    lastName: account.sheet.getRange(account.row, COL_LAST_NAME).getValue()
  };
}

// All students as { id, firstName, lastName, family, guardianId }.
function getAllStudents() {
  var sheet = getSheetByName(STUDENTS_SHEET);
  var list = [];
  if (!sheet) {
    return list;
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var id = data[i][COL_ID - 1];
    if (id === '' || id === null || id === undefined) {
      continue;
    }
    list.push({
      id: String(id),
      firstName: data[i][COL_FIRST_NAME - 1],
      lastName: data[i][COL_LAST_NAME - 1],
      family: data[i][COL_STUDENT_FAMILY - 1],
      guardianId: data[i][COL_GUARDIAN_ID - 1]
    });
  }
  return list;
}

// All requirements, in sheet order.
function getAllRequirements() {
  var sheet = getSheetByName(REQUIREMENTS_SHEET);
  var list = [];
  if (!sheet) {
    return list;
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var num = data[i][COL_REQ_NUMBER - 1];
    if (num === '' || num === null || num === undefined) {
      continue;
    }
    list.push({
      number: String(num),
      contentType: data[i][COL_REQ_CONTENT_TYPE - 1],
      content: data[i][COL_REQ_CONTENT - 1],
      dateSystem: data[i][COL_REQ_DATE_SYSTEM - 1],
      date: data[i][COL_REQ_DATE - 1],
      time: data[i][COL_REQ_TIME - 1],
      includeSupervisors: data[i][COL_REQ_INCLUDE_SUPERVISORS - 1] === 'نعم',
      created: data[i][COL_REQ_CREATED - 1]
    });
  }
  return list;
}

// Map: userId (string) -> { requirementNumber (string): true }.
function getCompletionsByUser() {
  var sheet = getSheetByName(COMPLETIONS_SHEET);
  var map = {};
  if (!sheet) {
    return map;
  }
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var reqNum = data[i][COL_COMP_REQ_NUMBER - 1];
    var userId = data[i][COL_COMP_USER_ID - 1];
    if (userId === '' || userId === null || userId === undefined) {
      continue;
    }
    var key = String(userId);
    if (!map[key]) {
      map[key] = {};
    }
    map[key][String(reqNum)] = true;
  }
  return map;
}

// Next رقم المتطلب: max existing value + 1, or REQ_START_NUMBER when empty.
function nextRequirementNumber() {
  var sheet = getSheetByName(REQUIREMENTS_SHEET);
  var max = REQ_START_NUMBER - 1;
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var num = Number(data[i][COL_REQ_NUMBER - 1]);
      if (!isNaN(num) && num > max) {
        max = num;
      }
    }
  }
  return max + 1;
}

// True when a Date falls on the current calendar day (script timezone).
function isToday(dateValue) {
  if (!(dateValue instanceof Date)) {
    return false;
  }
  var tz = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  return Utilities.formatDate(dateValue, tz, 'yyyy-MM-dd') === today;
}

// =====================================================================
// PART 1: Families (admin-only)
// =====================================================================

function createFamily(adminId, name, color) {
  if (!isAdmin(adminId)) {
    return unauthorized();
  }
  if (!name) {
    return { success: false, message: 'اسم الأسرة مطلوب' };
  }
  if (findFamilyRow(name) !== -1) {
    return { success: false, message: 'اسم الأسرة موجود مسبقاً' };
  }
  getSheetByName(FAMILIES_SHEET).appendRow([name, color || '', '', new Date()]);
  return { success: true, message: 'تم إنشاء الأسرة' };
}

function assignSupervisorToFamily(adminId, familyName, supervisorId) {
  if (!isAdmin(adminId)) {
    return unauthorized();
  }
  var supAccount = findAccount(supervisorId);
  if (!supAccount || supAccount.sheetName !== SUPERVISORS_SHEET) {
    return { success: false, message: 'المشرف غير موجود' };
  }
  var row = findFamilyRow(familyName);
  if (row === -1) {
    return { success: false, message: 'الأسرة غير موجودة' };
  }
  getSheetByName(FAMILIES_SHEET).getRange(row, COL_FAMILY_SUPERVISOR).setValue(supervisorId);
  return { success: true, message: 'تم تعيين المشرف للأسرة' };
}

function assignStudentToFamily(adminId, studentId, familyName) {
  if (!isAdmin(adminId)) {
    return unauthorized();
  }
  var stuAccount = findAccount(studentId);
  if (!stuAccount || stuAccount.sheetName !== STUDENTS_SHEET) {
    return { success: false, message: 'الطالب غير موجود' };
  }
  if (findFamilyRow(familyName) === -1) {
    return { success: false, message: 'الأسرة غير موجودة' };
  }
  stuAccount.sheet.getRange(stuAccount.row, COL_STUDENT_FAMILY).setValue(familyName);
  return { success: true, message: 'تم إسناد الطالب للأسرة' };
}

function listSupervisors(adminId) {
  if (!isAdmin(adminId)) {
    return unauthorized();
  }
  var sheet = getSheetByName(SUPERVISORS_SHEET);
  var supervisors = [];
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var id = data[i][COL_ID - 1];
      if (id === '' || id === null || id === undefined) {
        continue;
      }
      supervisors.push({
        id: String(id),
        firstName: data[i][COL_FIRST_NAME - 1],
        lastName: data[i][COL_LAST_NAME - 1]
      });
    }
  }
  return { success: true, supervisors: supervisors };
}

function listFamiliesOverview(adminId) {
  if (!isAdmin(adminId)) {
    return unauthorized();
  }

  var famSheet = getSheetByName(FAMILIES_SHEET);
  var famData = famSheet ? famSheet.getDataRange().getValues() : [];
  var students = getAllStudents();
  var requirements = getAllRequirements();
  var completions = getCompletionsByUser();
  var reqCount = requirements.length;

  var families = [];
  for (var i = 1; i < famData.length; i++) {
    var name = famData[i][COL_FAMILY_NAME - 1];
    if (name === '' || name === null || name === undefined) {
      continue;
    }
    var supName = getAccountName(famData[i][COL_FAMILY_SUPERVISOR - 1]);

    var famStudents = [];
    var totalCompleted = 0;
    for (var s = 0; s < students.length; s++) {
      if (String(students[s].family) !== String(name)) {
        continue;
      }
      var userComp = completions[students[s].id] || {};
      for (var r = 0; r < requirements.length; r++) {
        if (userComp[requirements[r].number]) {
          totalCompleted++;
        }
      }
      famStudents.push({
        id: students[s].id,
        firstName: students[s].firstName,
        lastName: students[s].lastName
      });
    }

    var denom = famStudents.length * reqCount;
    var percentage = denom > 0 ? Math.round((totalCompleted / denom) * 100) : 0;

    families.push({
      name: name,
      color: famData[i][COL_FAMILY_COLOR - 1],
      supervisorFirstName: supName ? supName.firstName : '',
      supervisorLastName: supName ? supName.lastName : '',
      students: famStudents,
      completionPercentage: percentage
    });
  }

  return { success: true, families: families };
}

// =====================================================================
// PART 2: Requirements & Completions
// =====================================================================

function createRequirement(adminId, contentType, content, dateSystem, dateValue, time, includeSupervisors) {
  if (!isAdmin(adminId)) {
    return unauthorized();
  }
  if (CONTENT_TYPES.indexOf(contentType) === -1) {
    return { success: false, message: 'نوع المحتوى غير صالح' };
  }
  if (DATE_SYSTEMS.indexOf(dateSystem) === -1) {
    return { success: false, message: 'نظام التاريخ غير صالح' };
  }
  if (!content) {
    return { success: false, message: 'المحتوى مطلوب' };
  }

  var includeSup =
    includeSupervisors === true ||
    includeSupervisors === 'نعم' ||
    includeSupervisors === 'true'
      ? 'نعم'
      : 'لا';

  var number = nextRequirementNumber();
  getSheetByName(REQUIREMENTS_SHEET).appendRow([
    number,
    contentType,
    content,
    dateSystem,
    dateValue || '',
    time || '',
    includeSup,
    new Date()
  ]);

  return { success: true, message: 'تم إنشاء المتطلب', requirementNumber: number };
}

// Requirements targeted at a given account, each flagged completed for them.
function listRequirementsForUser(id) {
  var account = findAccount(id);
  if (!account) {
    return { success: false, message: 'معرف غير صحيح' };
  }
  var role = account.sheetName;
  var all = getAllRequirements();
  var userComp = getCompletionsByUser()[String(id)] || {};

  var out = [];
  for (var i = 0; i < all.length; i++) {
    var req = all[i];
    // Supervisors only see requirements addressed to them; students & admins see all.
    if (role === SUPERVISORS_SHEET && !req.includeSupervisors) {
      continue;
    }
    out.push({
      number: req.number,
      contentType: req.contentType,
      content: req.content,
      dateSystem: req.dateSystem,
      date: req.date,
      time: req.time,
      includeSupervisors: req.includeSupervisors,
      completed: !!userComp[req.number]
    });
  }
  return { success: true, role: role, requirements: out };
}

function completeRequirement(userId, requirementNumber) {
  var account = findAccount(userId);
  if (!account) {
    return { success: false, message: 'معرف غير صحيح' };
  }

  var reqNum = String(requirementNumber);
  var requirements = getAllRequirements();
  var req = null;
  for (var i = 0; i < requirements.length; i++) {
    if (requirements[i].number === reqNum) {
      req = requirements[i];
      break;
    }
  }
  if (!req) {
    return { success: false, message: 'المتطلب غير موجود' };
  }

  // A supervisor may only complete requirements addressed to supervisors.
  if (account.sheetName === SUPERVISORS_SHEET && !req.includeSupervisors) {
    return unauthorized();
  }

  var sheet = getSheetByName(COMPLETIONS_SHEET);
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (
      String(data[r][COL_COMP_REQ_NUMBER - 1]) === reqNum &&
      String(data[r][COL_COMP_USER_ID - 1]) === String(userId)
    ) {
      return { success: true, message: 'تم الإنجاز مسبقاً', alreadyCompleted: true };
    }
  }

  sheet.appendRow([Number(reqNum), userId, new Date()]);
  return { success: true, message: 'تم تسجيل الإنجاز', alreadyCompleted: false };
}

// Supervisor view: every student in their family with per-requirement status.
function getFamilyProgress(supervisorId) {
  var account = findAccount(supervisorId);
  if (!account || account.sheetName !== SUPERVISORS_SHEET) {
    return unauthorized();
  }

  var famSheet = getSheetByName(FAMILIES_SHEET);
  var famData = famSheet ? famSheet.getDataRange().getValues() : [];
  var family = null;
  for (var i = 1; i < famData.length; i++) {
    if (String(famData[i][COL_FAMILY_SUPERVISOR - 1]) === String(supervisorId)) {
      family = {
        name: famData[i][COL_FAMILY_NAME - 1],
        color: famData[i][COL_FAMILY_COLOR - 1]
      };
      break;
    }
  }
  if (!family) {
    return { success: true, family: null, requirements: [], students: [] };
  }

  var requirements = getAllRequirements();
  var completions = getCompletionsByUser();
  var allStudents = getAllStudents();

  var reqList = [];
  for (var r = 0; r < requirements.length; r++) {
    reqList.push({
      number: requirements[r].number,
      contentType: requirements[r].contentType,
      content: requirements[r].content,
      dateSystem: requirements[r].dateSystem,
      date: requirements[r].date,
      time: requirements[r].time
    });
  }

  var studentsOut = [];
  for (var s = 0; s < allStudents.length; s++) {
    if (String(allStudents[s].family) !== String(family.name)) {
      continue;
    }
    var userComp = completions[allStudents[s].id] || {};
    var compArr = [];
    var doneCount = 0;
    for (var q = 0; q < requirements.length; q++) {
      var done = !!userComp[requirements[q].number];
      if (done) {
        doneCount++;
      }
      compArr.push({ number: requirements[q].number, completed: done });
    }
    studentsOut.push({
      id: allStudents[s].id,
      firstName: allStudents[s].firstName,
      lastName: allStudents[s].lastName,
      completions: compArr,
      completedCount: doneCount
    });
  }

  return {
    success: true,
    family: family,
    requirements: reqList,
    students: studentsOut
  };
}

// Student view: family info + a binary "did each member finish today's
// requirement(s)". "Today" = requirements created on the current day.
function getFamilyMembersSimpleStatus(studentId) {
  var account = findAccount(studentId);
  if (!account || account.sheetName !== STUDENTS_SHEET) {
    return { success: false, message: 'معرف غير صحيح' };
  }

  var familyName = account.sheet.getRange(account.row, COL_STUDENT_FAMILY).getValue();
  if (!familyName) {
    return { success: false, message: 'الطالب غير مسند إلى أسرة' };
  }

  var color = '';
  var supId = '';
  var famSheet = getSheetByName(FAMILIES_SHEET);
  var famData = famSheet ? famSheet.getDataRange().getValues() : [];
  for (var i = 1; i < famData.length; i++) {
    if (String(famData[i][COL_FAMILY_NAME - 1]) === String(familyName)) {
      color = famData[i][COL_FAMILY_COLOR - 1];
      supId = famData[i][COL_FAMILY_SUPERVISOR - 1];
      break;
    }
  }
  var supName = getAccountName(supId);

  var requirements = getAllRequirements();
  var todays = [];
  for (var r = 0; r < requirements.length; r++) {
    if (isToday(requirements[r].created)) {
      todays.push(requirements[r].number);
    }
  }

  var completions = getCompletionsByUser();
  var allStudents = getAllStudents();
  var members = [];
  for (var s = 0; s < allStudents.length; s++) {
    if (String(allStudents[s].family) !== String(familyName)) {
      continue;
    }
    var userComp = completions[allStudents[s].id] || {};
    var completed = todays.length > 0;
    for (var t = 0; t < todays.length; t++) {
      if (!userComp[todays[t]]) {
        completed = false;
        break;
      }
    }
    members.push({
      id: allStudents[s].id,
      firstName: allStudents[s].firstName,
      lastName: allStudents[s].lastName,
      completed: completed
    });
  }

  return {
    success: true,
    family: {
      name: familyName,
      color: color,
      supervisorFirstName: supName ? supName.firstName : '',
      supervisorLastName: supName ? supName.lastName : ''
    },
    members: members
  };
}

// Student view: their own history, grouped by the requirement's date.
function getStudentRecord(studentId) {
  var account = findAccount(studentId);
  if (!account || account.sheetName !== STUDENTS_SHEET) {
    return { success: false, message: 'معرف غير صحيح' };
  }

  var requirements = getAllRequirements();
  var userComp = getCompletionsByUser()[String(studentId)] || {};

  var groupsMap = {};
  var order = [];
  for (var i = 0; i < requirements.length; i++) {
    var req = requirements[i];
    var key =
      req.date !== '' && req.date !== null && req.date !== undefined
        ? String(req.date)
        : 'غير محدد';
    if (!groupsMap[key]) {
      groupsMap[key] = { date: key, dateSystem: req.dateSystem, items: [] };
      order.push(key);
    }
    groupsMap[key].items.push({
      number: req.number,
      contentType: req.contentType,
      content: req.content,
      time: req.time,
      completed: !!userComp[req.number]
    });
  }

  var groups = [];
  for (var g = 0; g < order.length; g++) {
    groups.push(groupsMap[order[g]]);
  }

  return { success: true, groups: groups };
}

// Guardian view: only their own child's overall completion summary. The child
// is derived from the guardian ID server-side; studentId is an optional check.
function getChildProgress(guardianId, studentId) {
  var row = findStudentRowByGuardianId(guardianId);
  if (row === -1) {
    return unauthorized();
  }

  var sheet = getSheetByName(STUDENTS_SHEET);
  var actualId = sheet.getRange(row, COL_ID).getValue();
  if (studentId !== undefined && studentId !== null && studentId !== '' &&
      String(studentId) !== String(actualId)) {
    return unauthorized();
  }

  var firstName = sheet.getRange(row, COL_FIRST_NAME).getValue();
  var lastName = sheet.getRange(row, COL_LAST_NAME).getValue();

  var requirements = getAllRequirements();
  var userComp = getCompletionsByUser()[String(actualId)] || {};
  var done = 0;
  for (var i = 0; i < requirements.length; i++) {
    if (userComp[requirements[i].number]) {
      done++;
    }
  }
  var total = requirements.length;
  var percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    success: true,
    student: { firstName: firstName, lastName: lastName },
    completedCount: done,
    totalCount: total,
    completionPercentage: percentage
  };
}
