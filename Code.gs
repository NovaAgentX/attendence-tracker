/**
 * ==============================================================================
 * TEAM LOGIN / LOGOUT ATTENDANCE TRACKING SYSTEM - GOOGLE APPS SCRIPT BACKEND
 * ==============================================================================
 * 
 * Persistent Storage: Google Sheets (Employees, Attendance, Settings)
 * Timezone: Asia/Dubai
 * Security: Salted SHA-256 password hashing, Server-Side Session Tokens,
 *           ScriptLock concurrency prevention, Role Authorization.
 * 
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Paste this entire Code.gs file.
 * 3. Run setup() once to initialize sheets and headers.
 * 4. Run createAdmin() once to create the initial Administrator account.
 * 5. Deploy -> New Deployment -> Web App -> Execute as: Me, Who has access: Anyone.
 * 6. Copy Web App URL into the web application's script.js (or frontend settings).
 * ==============================================================================
 */

// Global Sheet Names
const SHEET_EMPLOYEES = 'Employees';
const SHEET_ATTENDANCE = 'Attendance';
const SHEET_SETTINGS = 'Settings';
const DEFAULT_TIMEZONE = 'Asia/Dubai';
const SESSION_TTL_SECONDS = 43200; // 12 hours

/**
 * Handle HTTP GET Requests
 * Used for health checks, CORS preflight diagnostics, and spreadsheet metadata.
 */
function doGet(e) {
  const ss = getSpreadsheet();
  const timezone = getSetting('TIMEZONE', DEFAULT_TIMEZONE);
  const now = new Date();
  const serverTime = Utilities.formatDate(now, timezone, 'yyyy-MM-dd HH:mm:ss');
  
  const responseData = {
    status: 'ok',
    app: 'Team Attendance Tracking System API',
    spreadsheetName: ss ? ss.getName() : 'Active Spreadsheet',
    spreadsheetUrl: ss ? ss.getUrl() : '',
    timezone: timezone,
    serverTime: serverTime,
    timestamp: now.getTime()
  };

  return createJsonResponse(responseData);
}

/**
 * Handle HTTP POST Requests (Main API Gateway)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  try {
    // Acquire lock to prevent duplicate login/logout race conditions (wait up to 10s)
    lock.waitLock(10000);
    
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        return createJsonResponse({ success: false, error: 'Invalid JSON payload: ' + err.message }, 400);
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;
    if (!action) {
      return createJsonResponse({ success: false, error: 'Action parameter is required' }, 400);
    }

    // Public Actions (No Auth Token required)
    if (action === 'login') {
      return handleLogin(payload);
    } else if (action === 'health' || action === 'ping') {
      return doGet(e);
    }

    // Protected Actions (Require valid auth token)
    const token = payload.token || (e.parameter && e.parameter.token);
    if (!token) {
      return createJsonResponse({ success: false, error: 'Authentication required. Missing session token.' }, 401);
    }

    const auth = validateSession(token);
    if (!auth.valid) {
      return createJsonResponse({ success: false, error: auth.error || 'Invalid or expired session. Please log in again.' }, 401);
    }

    // Route actions based on authenticated user and permissions
    switch (action) {
      // Employee & Admin accessible actions
      case 'getCurrentSession':
        return handleGetCurrentSession(auth);
      
      case 'getMyAttendance':
        return handleGetMyAttendance(auth);
      
      case 'logout':
        return handleLogout(auth, payload);

      // Admin Only Actions
      case 'getDashboardStats':
        ensureAdmin(auth);
        return handleGetDashboardStats();

      case 'getAllAttendance':
        ensureAdmin(auth);
        return handleGetAllAttendance(payload);

      case 'getEmployees':
        ensureAdmin(auth);
        return handleGetEmployees();

      case 'addEmployee':
        ensureAdmin(auth);
        return handleAddEmployee(payload);

      case 'updateEmployee':
        ensureAdmin(auth);
        return handleUpdateEmployee(payload);

      case 'deactivateEmployee':
      case 'toggleEmployeeStatus':
        ensureAdmin(auth);
        return handleToggleEmployeeStatus(payload);

      case 'changePassword':
        ensureAdmin(auth);
        return handleChangePassword(payload);

      case 'getSystemInfo':
        ensureAdmin(auth);
        return handleGetSystemInfo();

      default:
        return createJsonResponse({ success: false, error: 'Unknown action: ' + action }, 400);
    }

  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.message || 'Internal Server Error',
      stack: error.stack
    }, error.statusCode || 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock may already be released
    }
  }
}

/**
 * ==============================================================================
 * AUTHENTICATION & SESSION MANAGEMENT
 * ==============================================================================
 */

/**
 * Handle Employee / Admin Login
 */
function handleLogin(payload) {
  const employeeId = (payload.employeeId || '').trim();
  const password = payload.password || '';

  if (!employeeId || !password) {
    return createJsonResponse({ success: false, error: 'Invalid Employee ID or password' }, 401);
  }

  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    return createJsonResponse({ success: false, error: 'Employees sheet not initialized. Please run setup().' }, 500);
  }

  const empData = empSheet.getDataRange().getValues();
  if (empData.length <= 1) {
    return createJsonResponse({ success: false, error: 'Invalid Employee ID or password' }, 401);
  }

  // Header indices: 0: Employee ID | 1: Employee Name | 2: Password | 3: Role | 4: Active
  let matchedEmployee = null;
  for (let i = 1; i < empData.length; i++) {
    const row = empData[i];
    const rowEmpId = String(row[0]).trim();
    if (rowEmpId.toLowerCase() === employeeId.toLowerCase()) {
      matchedEmployee = {
        rowIndex: i + 1,
        id: rowEmpId,
        name: String(row[1]).trim(),
        storedHash: String(row[2]).trim(),
        role: String(row[3]).trim() || 'Employee',
        active: row[4] === true || String(row[4]).toUpperCase() === 'TRUE'
      };
      break;
    }
  }

  // Generic failure message to prevent credential enumeration
  if (!matchedEmployee) {
    return createJsonResponse({ success: false, error: 'Invalid Employee ID or password' }, 401);
  }

  if (!matchedEmployee.active) {
    return createJsonResponse({ success: false, error: 'Account is deactivated. Please contact your Administrator.' }, 403);
  }

  if (!verifyPassword(password, matchedEmployee.storedHash)) {
    return createJsonResponse({ success: false, error: 'Invalid Employee ID or password' }, 401);
  }

  const timezone = getSetting('TIMEZONE', DEFAULT_TIMEZONE);
  const now = new Date();
  const currentDateStr = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
  const currentTimeStr = Utilities.formatDate(now, timezone, 'HH:mm:ss');

  // Check active attendance session
  const attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  let activeSession = null;

  if (attSheet) {
    const attData = attSheet.getDataRange().getValues();
    // Headers: 0: Record ID | 1: Employee ID | 2: Employee Name | 3: Login Date | 4: Login Time | 5: Logout Date | 6: Logout Time | 7: Working Hours | 8: Status
    for (let i = attData.length - 1; i >= 1; i--) {
      const row = attData[i];
      if (String(row[1]).trim().toLowerCase() === matchedEmployee.id.toLowerCase() && String(row[8]).trim() === 'Logged In') {
        activeSession = {
          recordId: String(row[0]),
          employeeId: matchedEmployee.id,
          employeeName: matchedEmployee.name,
          loginDate: formatDateDisplay(row[3]),
          loginTime: formatTimeDisplay(row[4]),
          status: 'Logged In'
        };
        break;
      }
    }
  }

  let alreadyLoggedIn = false;
  let currentRecord = null;

  if (activeSession) {
    // Duplicate Login Prevention: Do NOT create another record. Return existing active session.
    alreadyLoggedIn = true;
    currentRecord = activeSession;
  } else {
    // Create new attendance record
    const recordId = Utilities.getUuid();
    if (attSheet) {
      attSheet.appendRow([
        recordId,
        matchedEmployee.id,
        matchedEmployee.name,
        currentDateStr,
        currentTimeStr,
        '', // Logout Date
        '', // Logout Time
        '', // Working Hours
        'Logged In'
      ]);
    }

    currentRecord = {
      recordId: recordId,
      employeeId: matchedEmployee.id,
      employeeName: matchedEmployee.name,
      loginDate: currentDateStr,
      loginTime: currentTimeStr,
      status: 'Logged In'
    };
  }

  // Create Server-Side Session Token
  const token = Utilities.getUuid() + '-' + now.getTime().toString(36);
  const sessionData = {
    employeeId: matchedEmployee.id,
    role: matchedEmployee.role,
    name: matchedEmployee.name,
    createdAt: now.getTime(),
    expiresAt: now.getTime() + (SESSION_TTL_SECONDS * 1000)
  };

  const cache = CacheService.getScriptCache();
  cache.put('sess_' + token, JSON.stringify(sessionData), SESSION_TTL_SECONDS);

  return createJsonResponse({
    success: true,
    message: alreadyLoggedIn ? 'You are already logged in.' : 'Login successful.',
    token: token,
    employee: {
      id: matchedEmployee.id,
      name: matchedEmployee.name,
      role: matchedEmployee.role
    },
    currentSession: currentRecord,
    alreadyLoggedIn: alreadyLoggedIn,
    serverTime: currentTimeStr,
    serverDate: currentDateStr,
    timezone: timezone
  });
}

/**
 * Handle Employee / Admin Logout
 */
function handleLogout(auth, payload) {
  const ss = getSpreadsheet();
  const timezone = getSetting('TIMEZONE', DEFAULT_TIMEZONE);
  const now = new Date();
  const logoutDateStr = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
  const logoutTimeStr = Utilities.formatDate(now, timezone, 'HH:mm:ss');

  const attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  let updatedRecord = null;

  if (attSheet) {
    const attData = attSheet.getDataRange().getValues();
    // Search for active "Logged In" session for this authenticated employee
    for (let i = attData.length - 1; i >= 1; i--) {
      const row = attData[i];
      const rowEmpId = String(row[1]).trim();
      const status = String(row[8]).trim();

      if (rowEmpId.toLowerCase() === auth.employeeId.toLowerCase() && status === 'Logged In') {
        const rowIndex = i + 1;
        const loginDate = formatDateDisplay(row[3]);
        const loginTime = formatTimeDisplay(row[4]);
        
        // Calculate Working Hours Server-Side
        const workingHours = calculateWorkingHours(loginDate, loginTime, logoutDateStr, logoutTimeStr, timezone);

        // Update the SAME attendance record row: Logout Date (col 6), Logout Time (col 7), Working Hours (col 8), Status (col 9)
        attSheet.getRange(rowIndex, 6).setValue(logoutDateStr);
        attSheet.getRange(rowIndex, 7).setValue(logoutTimeStr);
        attSheet.getRange(rowIndex, 8).setValue(workingHours);
        attSheet.getRange(rowIndex, 9).setValue('Logged Out');

        updatedRecord = {
          recordId: String(row[0]),
          employeeId: auth.employeeId,
          employeeName: String(row[2]),
          loginDate: loginDate,
          loginTime: loginTime,
          logoutDate: logoutDateStr,
          logoutTime: logoutTimeStr,
          workingHours: workingHours,
          status: 'Logged Out'
        };
        break;
      }
    }
  }

  // Invalidate Session Token
  if (payload.token) {
    const cache = CacheService.getScriptCache();
    cache.remove('sess_' + payload.token);
  }

  return createJsonResponse({
    success: true,
    message: 'Logged out successfully.',
    record: updatedRecord,
    logoutDate: logoutDateStr,
    logoutTime: logoutTimeStr,
    workingHours: updatedRecord ? updatedRecord.workingHours : '0:00'
  });
}

/**
 * Handle getCurrentSession (loads current active attendance session for employee)
 */
function handleGetCurrentSession(auth) {
  const ss = getSpreadsheet();
  const attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  const timezone = getSetting('TIMEZONE', DEFAULT_TIMEZONE);
  const now = new Date();
  const currentDateStr = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
  const currentTimeStr = Utilities.formatDate(now, timezone, 'HH:mm:ss');

  let activeSession = null;
  let lastCompletedSession = null;

  if (attSheet) {
    const attData = attSheet.getDataRange().getValues();
    for (let i = attData.length - 1; i >= 1; i--) {
      const row = attData[i];
      if (String(row[1]).trim().toLowerCase() === auth.employeeId.toLowerCase()) {
        const status = String(row[8]).trim();
        const record = {
          recordId: String(row[0]),
          employeeId: String(row[1]),
          employeeName: String(row[2]),
          loginDate: formatDateDisplay(row[3]),
          loginTime: formatTimeDisplay(row[4]),
          logoutDate: formatDateDisplay(row[5]),
          logoutTime: formatTimeDisplay(row[6]),
          workingHours: String(row[7] || ''),
          status: status
        };

        if (status === 'Logged In' && !activeSession) {
          activeSession = record;
        } else if (status === 'Logged Out' && !lastCompletedSession) {
          lastCompletedSession = record;
        }

        if (activeSession && lastCompletedSession) break;
      }
    }
  }

  return createJsonResponse({
    success: true,
    employee: {
      id: auth.employeeId,
      name: auth.name,
      role: auth.role
    },
    activeSession: activeSession,
    lastSession: lastCompletedSession,
    serverTime: currentTimeStr,
    serverDate: currentDateStr,
    timezone: timezone
  });
}

/**
 * Handle getMyAttendance (Filtered strictly to authenticated employee)
 */
function handleGetMyAttendance(auth) {
  const ss = getSpreadsheet();
  const attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  const records = [];

  if (attSheet) {
    const attData = attSheet.getDataRange().getValues();
    for (let i = attData.length - 1; i >= 1; i--) {
      const row = attData[i];
      if (String(row[1]).trim().toLowerCase() === auth.employeeId.toLowerCase()) {
        records.push({
          recordId: String(row[0]),
          employeeId: String(row[1]),
          employeeName: String(row[2]),
          loginDate: formatDateDisplay(row[3]),
          loginTime: formatTimeDisplay(row[4]),
          logoutDate: formatDateDisplay(row[5]),
          logoutTime: formatTimeDisplay(row[6]),
          workingHours: String(row[7] || '-'),
          status: String(row[8] || '')
        });
      }
    }
  }

  return createJsonResponse({
    success: true,
    employeeId: auth.employeeId,
    records: records
  });
}

/**
 * ==============================================================================
 * ADMIN-ONLY HANDLERS
 * ==============================================================================
 */

/**
 * Admin: Get Dashboard Summary Statistics
 */
function handleGetDashboardStats() {
  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  const attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  const timezone = getSetting('TIMEZONE', DEFAULT_TIMEZONE);
  const now = new Date();
  const todayStr = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');

  let totalActiveEmployees = 0;
  let totalEmployees = 0;

  if (empSheet) {
    const empData = empSheet.getDataRange().getValues();
    for (let i = 1; i < empData.length; i++) {
      totalEmployees++;
      const active = empData[i][4] === true || String(empData[i][4]).toUpperCase() === 'TRUE';
      if (active) {
        totalActiveEmployees++;
      }
    }
  }

  let currentlyLoggedIn = 0;
  let totalLoggedOutToday = 0;
  let totalWorkingMinutesToday = 0;

  if (attSheet) {
    const attData = attSheet.getDataRange().getValues();
    for (let i = 1; i < attData.length; i++) {
      const row = attData[i];
      const loginDate = formatDateDisplay(row[3]);
      const status = String(row[8]).trim();
      const workingHoursStr = String(row[7] || '').trim();

      if (status === 'Logged In') {
        currentlyLoggedIn++;
      }

      if (loginDate === todayStr && status === 'Logged Out') {
        totalLoggedOutToday++;
        if (workingHoursStr) {
          totalWorkingMinutesToday += parseWorkingHoursToMinutes(workingHoursStr);
        }
      }
    }
  }

  const hours = Math.floor(totalWorkingMinutesToday / 60);
  const mins = totalWorkingMinutesToday % 60;
  const formattedTotalWorkingHours = hours + 'h ' + (mins < 10 ? '0' : '') + mins + 'm';

  return createJsonResponse({
    success: true,
    stats: {
      totalActiveEmployees: totalActiveEmployees,
      totalEmployees: totalEmployees,
      currentlyLoggedIn: currentlyLoggedIn,
      totalLoggedOutToday: totalLoggedOutToday,
      totalWorkingHoursToday: formattedTotalWorkingHours,
      todayDate: todayStr,
      timezone: timezone
    }
  });
}

/**
 * Admin: Get All Attendance Records with optional filters
 */
function handleGetAllAttendance(payload) {
  const ss = getSpreadsheet();
  const attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  const records = [];

  const filterDate = payload.date ? String(payload.date).trim() : '';
  const filterStatus = payload.status ? String(payload.status).trim() : '';
  const filterSearch = payload.search ? String(payload.search).toLowerCase().trim() : '';
  const filterEmployee = payload.employeeId ? String(payload.employeeId).toLowerCase().trim() : '';

  if (attSheet) {
    const attData = attSheet.getDataRange().getValues();
    for (let i = attData.length - 1; i >= 1; i--) {
      const row = attData[i];
      const recordId = String(row[0]);
      const empId = String(row[1]);
      const empName = String(row[2]);
      const loginDate = formatDateDisplay(row[3]);
      const loginTime = formatTimeDisplay(row[4]);
      const logoutDate = formatDateDisplay(row[5]);
      const logoutTime = formatTimeDisplay(row[6]);
      const workingHours = String(row[7] || '-');
      const status = String(row[8] || '');

      // Apply Filters
      if (filterDate && loginDate !== filterDate) continue;
      if (filterStatus && filterStatus !== 'All' && status !== filterStatus) continue;
      if (filterEmployee && empId.toLowerCase() !== filterEmployee) continue;
      if (filterSearch) {
        const matchesId = empId.toLowerCase().indexOf(filterSearch) !== -1;
        const matchesName = empName.toLowerCase().indexOf(filterSearch) !== -1;
        if (!matchesId && !matchesName) continue;
      }

      records.push({
        recordId: recordId,
        employeeId: empId,
        employeeName: empName,
        loginDate: loginDate,
        loginTime: loginTime,
        logoutDate: logoutDate,
        logoutTime: logoutTime,
        workingHours: workingHours,
        status: status
      });
    }
  }

  return createJsonResponse({
    success: true,
    totalRecords: records.length,
    records: records
  });
}

/**
 * Admin: Get All Employees (Never return password hashes)
 */
function handleGetEmployees() {
  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  const employees = [];

  if (empSheet) {
    const empData = empSheet.getDataRange().getValues();
    for (let i = 1; i < empData.length; i++) {
      const row = empData[i];
      const active = row[4] === true || String(row[4]).toUpperCase() === 'TRUE';
      employees.push({
        employeeId: String(row[0]),
        employeeName: String(row[1]),
        role: String(row[3]) || 'Employee',
        active: active
      });
    }
  }

  return createJsonResponse({
    success: true,
    employees: employees
  });
}

/**
 * Admin: Add New Employee
 */
function handleAddEmployee(payload) {
  const employeeId = (payload.employeeId || '').trim();
  const employeeName = (payload.employeeName || '').trim();
  const password = payload.password || '';
  const role = (payload.role || 'Employee').trim();
  const active = payload.active !== false && String(payload.active).toUpperCase() !== 'FALSE';

  if (!employeeId || !employeeName || !password) {
    return createJsonResponse({ success: false, error: 'Employee ID, Name, and Password are required.' }, 400);
  }

  if (role !== 'Admin' && role !== 'Employee') {
    return createJsonResponse({ success: false, error: 'Role must be either Admin or Employee.' }, 400);
  }

  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    return createJsonResponse({ success: false, error: 'Employees sheet not found.' }, 500);
  }

  const empData = empSheet.getDataRange().getValues();
  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][0]).trim().toLowerCase() === employeeId.toLowerCase()) {
      return createJsonResponse({ success: false, error: 'Employee ID "' + employeeId + '" already exists.' }, 400);
    }
  }

  const passwordHash = hashPassword(password);
  empSheet.appendRow([
    employeeId,
    employeeName,
    passwordHash,
    role,
    active
  ]);

  return createJsonResponse({
    success: true,
    message: 'Employee created successfully.',
    employee: {
      employeeId: employeeId,
      employeeName: employeeName,
      role: role,
      active: active
    }
  });
}

/**
 * Admin: Update Employee Details (Name, Role, Active)
 */
function handleUpdateEmployee(payload) {
  const employeeId = (payload.employeeId || '').trim();
  const employeeName = (payload.employeeName || '').trim();
  const role = (payload.role || '').trim();
  const active = payload.active === true || String(payload.active).toUpperCase() === 'TRUE';

  if (!employeeId) {
    return createJsonResponse({ success: false, error: 'Employee ID is required.' }, 400);
  }

  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    return createJsonResponse({ success: false, error: 'Employees sheet not found.' }, 500);
  }

  const empData = empSheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][0]).trim().toLowerCase() === employeeId.toLowerCase()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    return createJsonResponse({ success: false, error: 'Employee not found.' }, 404);
  }

  if (employeeName) {
    empSheet.getRange(foundRow, 2).setValue(employeeName);
  }
  if (role && (role === 'Admin' || role === 'Employee')) {
    empSheet.getRange(foundRow, 4).setValue(role);
  }
  if (payload.active !== undefined) {
    empSheet.getRange(foundRow, 5).setValue(active);
  }

  return createJsonResponse({
    success: true,
    message: 'Employee updated successfully.'
  });
}

/**
 * Admin: Toggle Employee Active Status
 */
function handleToggleEmployeeStatus(payload) {
  const employeeId = (payload.employeeId || '').trim();
  if (!employeeId) {
    return createJsonResponse({ success: false, error: 'Employee ID is required.' }, 400);
  }

  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    return createJsonResponse({ success: false, error: 'Employees sheet not found.' }, 500);
  }

  const empData = empSheet.getDataRange().getValues();
  let foundRow = -1;
  let currentActive = true;

  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][0]).trim().toLowerCase() === employeeId.toLowerCase()) {
      foundRow = i + 1;
      currentActive = empData[i][4] === true || String(empData[i][4]).toUpperCase() === 'TRUE';
      break;
    }
  }

  if (foundRow === -1) {
    return createJsonResponse({ success: false, error: 'Employee not found.' }, 404);
  }

  const newStatus = payload.active !== undefined ? (payload.active === true || String(payload.active).toUpperCase() === 'TRUE') : !currentActive;
  empSheet.getRange(foundRow, 5).setValue(newStatus);

  return createJsonResponse({
    success: true,
    message: 'Employee status changed to ' + (newStatus ? 'Active' : 'Inactive'),
    active: newStatus
  });
}

/**
 * Admin: Change Employee Password
 */
function handleChangePassword(payload) {
  const employeeId = (payload.employeeId || '').trim();
  const newPassword = payload.newPassword || '';

  if (!employeeId || !newPassword) {
    return createJsonResponse({ success: false, error: 'Employee ID and new password are required.' }, 400);
  }

  if (newPassword.length < 4) {
    return createJsonResponse({ success: false, error: 'Password must be at least 4 characters long.' }, 400);
  }

  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    return createJsonResponse({ success: false, error: 'Employees sheet not found.' }, 500);
  }

  const empData = empSheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][0]).trim().toLowerCase() === employeeId.toLowerCase()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    return createJsonResponse({ success: false, error: 'Employee not found.' }, 404);
  }

  const newHash = hashPassword(newPassword);
  empSheet.getRange(foundRow, 3).setValue(newHash);

  return createJsonResponse({
    success: true,
    message: 'Password updated successfully for employee ' + employeeId
  });
}

/**
 * Admin: Get System Info and Spreadsheet URL
 */
function handleGetSystemInfo() {
  const ss = getSpreadsheet();
  return createJsonResponse({
    success: true,
    spreadsheetUrl: ss ? ss.getUrl() : '',
    spreadsheetName: ss ? ss.getName() : '',
    timezone: getSetting('TIMEZONE', DEFAULT_TIMEZONE)
  });
}

/**
 * ==============================================================================
 * UTILITY & SECURITY HELPERS
 * ==============================================================================
 */

/**
 * Validates session token and returns authenticated employee details
 */
function validateSession(token) {
  if (!token) return { valid: false, error: 'Missing session token' };

  const cache = CacheService.getScriptCache();
  const cachedData = cache.get('sess_' + token);
  
  if (!cachedData) {
    return { valid: false, error: 'Session expired or invalid. Please log in again.' };
  }

  let session;
  try {
    session = JSON.parse(cachedData);
  } catch (e) {
    return { valid: false, error: 'Invalid session structure' };
  }

  // Cross-check with Employees sheet to guarantee employee is still Active and has valid Role
  const ss = getSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) return { valid: false, error: 'Database error' };

  const empData = empSheet.getDataRange().getValues();
  let employeeFound = false;
  let active = false;
  let currentRole = 'Employee';
  let currentName = session.name;

  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][0]).trim().toLowerCase() === session.employeeId.toLowerCase()) {
      employeeFound = true;
      currentName = String(empData[i][1]).trim();
      currentRole = String(empData[i][3]).trim() || 'Employee';
      active = empData[i][4] === true || String(empData[i][4]).toUpperCase() === 'TRUE';
      break;
    }
  }

  if (!employeeFound) {
    return { valid: false, error: 'Employee account no longer exists.' };
  }

  if (!active) {
    return { valid: false, error: 'Employee account has been deactivated.' };
  }

  return {
    valid: true,
    employeeId: session.employeeId,
    name: currentName,
    role: currentRole
  };
}

/**
 * Enforce Admin role restriction
 */
function ensureAdmin(auth) {
  if (!auth || auth.role !== 'Admin') {
    const error = new Error('Forbidden: 403 / Admin access required.');
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Salted SHA-256 password hash generator: returns format "v1$salt$hash"
 */
function hashPassword(password, salt) {
  if (!salt) {
    salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  }
  const rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password,
    Utilities.Charset.UTF_8
  );
  
  let hashHex = '';
  for (let i = 0; i < rawBytes.length; i++) {
    let byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    let hex = byteVal.toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hashHex += hex;
  }

  return 'v1$' + salt + '$' + hashHex;
}

/**
 * Verify password against stored hash "v1$salt$hash"
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  
  const parts = storedHash.split('$');
  if (parts.length === 3 && parts[0] === 'v1') {
    const salt = parts[1];
    const expectedHash = parts[2];
    const computed = hashPassword(password, salt);
    const computedHash = computed.split('$')[2];
    return computedHash === expectedHash;
  }

  // Fallback for direct plain comparison during initial setup migration (if any)
  return storedHash === password;
}

/**
 * Calculate working hours string (H:MM) from login and logout strings
 */
function calculateWorkingHours(loginDate, loginTime, logoutDate, logoutTime, timezone) {
  try {
    const startStr = loginDate + 'T' + loginTime;
    const endStr = logoutDate + 'T' + logoutTime;

    const start = new Date(startStr);
    const end = new Date(endStr);

    let diffMs = end.getTime() - start.getTime();
    if (isNaN(diffMs) || diffMs < 0) {
      // Fallback: parse manually
      const loginParts = loginTime.split(':').map(Number);
      const logoutParts = logoutTime.split(':').map(Number);
      const loginMins = (loginParts[0] * 60) + loginParts[1];
      const logoutMins = (logoutParts[0] * 60) + logoutParts[1];
      let diffMins = logoutMins - loginMins;
      if (diffMins < 0) diffMins += (24 * 60);
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return h + ':' + (m < 10 ? '0' : '') + m;
    }

    const totalMins = Math.floor(diffMs / (1000 * 60));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  } catch (e) {
    return '0:00';
  }
}

function parseWorkingHoursToMinutes(whStr) {
  if (!whStr || whStr === '-') return 0;
  const parts = whStr.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60) + m;
  }
  return 0;
}

/**
 * Format date display safely from Sheets cell value
 */
function formatDateDisplay(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, getSetting('TIMEZONE', DEFAULT_TIMEZONE), 'yyyy-MM-dd');
  }
  return String(val).trim();
}

/**
 * Format time display safely from Sheets cell value
 */
function formatTimeDisplay(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, getSetting('TIMEZONE', DEFAULT_TIMEZONE), 'HH:mm:ss');
  }
  return String(val).trim();
}

/**
 * Get active spreadsheet instance
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
  } catch (e) {
    return null;
  }
}

/**
 * Get setting value from Settings sheet
 */
function getSetting(key, defaultValue) {
  try {
    const ss = getSpreadsheet();
    if (!ss) return defaultValue;
    const sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) return defaultValue;
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === key.toUpperCase()) {
        return String(data[i][1]).trim() || defaultValue;
      }
    }
  } catch (e) {
    // ignore
  }
  return defaultValue;
}

/**
 * Standard JSON Response Creator with CORS headers
 */
function createJsonResponse(data, statusCode) {
  const jsonString = JSON.stringify(data);
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ==============================================================================
 * ONE-TIME SETUP & ADMIN CREATION FUNCTIONS (RUN DIRECTLY IN APPS SCRIPT)
 * ==============================================================================
 */

/**
 * Setup Function: Creates or formats the three required sheets with headers.
 */
function setup() {
  const ss = getSpreadsheet();
  if (!ss) {
    Logger.log('Error: Could not access active spreadsheet.');
    return;
  }

  // 1. Employees Sheet
  let empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    empSheet = ss.insertSheet(SHEET_EMPLOYEES);
  }
  const empHeaders = ['Employee ID', 'Employee Name', 'Password', 'Role', 'Active'];
  if (empSheet.getLastRow() === 0) {
    empSheet.appendRow(empHeaders);
    empSheet.getRange(1, 1, 1, empHeaders.length).setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
    empSheet.setFrozenRows(1);
  }

  // 2. Attendance Sheet
  let attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  if (!attSheet) {
    attSheet = ss.insertSheet(SHEET_ATTENDANCE);
  }
  const attHeaders = ['Record ID', 'Employee ID', 'Employee Name', 'Login Date', 'Login Time', 'Logout Date', 'Logout Time', 'Working Hours', 'Status'];
  if (attSheet.getLastRow() === 0) {
    attSheet.appendRow(attHeaders);
    attSheet.getRange(1, 1, 1, attHeaders.length).setFontWeight('bold').setBackground('#1E293B').setFontColor('#FFFFFF');
    attSheet.setFrozenRows(1);
  }

  // 3. Settings Sheet
  let setSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!setSheet) {
    setSheet = ss.insertSheet(SHEET_SETTINGS);
  }
  const setHeaders = ['Setting', 'Value'];
  if (setSheet.getLastRow() === 0) {
    setSheet.appendRow(setHeaders);
    setSheet.appendRow(['TIMEZONE', DEFAULT_TIMEZONE]);
    setSheet.getRange(1, 1, 1, setHeaders.length).setFontWeight('bold').setBackground('#475569').setFontColor('#FFFFFF');
    setSheet.setFrozenRows(1);
  }

  Logger.log('Setup completed successfully! Sheets initialized: Employees, Attendance, Settings.');
}

/**
 * Initial Admin Account Creator
 * Run this function once manually from the Apps Script editor to create the first Administrator.
 * 
 * Default credentials if not supplied:
 * ID: ADMIN001
 * Name: Company Admin
 * Password: AdminPassword@123
 */
function createAdmin(employeeId, employeeName, password) {
  const ss = getSpreadsheet();
  if (!ss) {
    Logger.log('Error: Could not access spreadsheet. Run setup() first.');
    return;
  }

  let empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    setup();
    empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  }

  const adminId = employeeId || 'ADMIN001';
  const adminName = employeeName || 'Company Admin';
  const adminPass = password || 'AdminPassword@123';

  // Check if ID already exists
  const empData = empSheet.getDataRange().getValues();
  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][0]).trim().toLowerCase() === adminId.toLowerCase()) {
      Logger.log('Admin account with ID "' + adminId + '" already exists.');
      return;
    }
  }

  const passwordHash = hashPassword(adminPass);
  empSheet.appendRow([adminId, adminName, passwordHash, 'Admin', true]);

  Logger.log('Admin created successfully!');
  Logger.log('Employee ID: ' + adminId);
  Logger.log('Employee Name: ' + adminName);
  Logger.log('Role: Admin');
  Logger.log('Active: TRUE');
  Logger.log('Password hash saved securely in Google Sheets.');
}
