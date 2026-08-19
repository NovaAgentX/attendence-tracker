/**
 * ==============================================================================
 * ATTENDANCE TRACKER - VANILLA JAVASCRIPT APPLICATION CORE
 * ==============================================================================
 * 
 * Technology: Pure HTML5 + CSS3 + Vanilla JavaScript (ES6+)
 * Database: Google Sheets
 * API: Google Apps Script Web App
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURATION & APPLICATION STATE
// ==============================================================================

const STORAGE_KEYS = {
  API_URL: 'attendance_gas_api_url',
  EMPLOYEES: 'attendance_local_employees',
  ATTENDANCE: 'attendance_local_attendance',
  VACATIONS: 'attendance_local_vacations',
  HOLIDAYS: 'attendance_local_holidays',
  SETTINGS: 'attendance_local_settings',
  USERS: 'attendance_local_users',
  CURRENT_USER: 'attendance_current_user'
};

const DEFAULT_USERS = [
  {
    id: 'UP01',
    name: 'Administrator',
    email: 'admin@company.com',
    role: 'Administrator',
    password: 'password123',
    createdAt: '2026-08-01'
  },
  {
    id: 'UP05',
    name: 'G Diwakar',
    email: 'diwakar@company.com',
    role: 'Employee',
    password: 'password123',
    createdAt: '2026-08-01'
  },
  {
    id: 'UP18',
    name: 'Vignesh',
    email: 'vignesh@company.com',
    role: 'Employee',
    password: 'password123',
    createdAt: '2026-08-01'
  },
  {
    id: 'UP38',
    name: 'Arti',
    email: 'arti@company.com',
    role: 'Employee',
    password: 'password123',
    createdAt: '2026-08-01'
  }
];

const DEFAULT_SETTINGS = {
  STATUS_P: 'Present',
  STATUS_SL: 'Sick Leave',
  STATUS_LOP: 'Loss of Pay',
  STATUS_VIL: 'Vacation in Lieu',
  STATUS_HOLIDAY: 'Company Holiday / Sunday',
  COMPANY_NAME: 'Enterprise Solutions Corp',
  WORKING_DAYS: 'Mon-Sat'
};

const INITIAL_SAMPLE_EMPLOYEES = [
  { id: 'UP05', name: 'G Diwakar', status: 'Active', createdAt: '2026-08-01' },
  { id: 'UP18', name: 'Vignesh', status: 'Active', createdAt: '2026-08-01' },
  { id: 'UP38', name: 'Arti', status: 'Active', createdAt: '2026-08-01' },
  { id: 'UP42', name: 'Priya Sharma', status: 'Active', createdAt: '2026-08-01' },
  { id: 'UP50', name: 'Rajesh Kumar', status: 'Active', createdAt: '2026-08-01' }
];

const INITIAL_SAMPLE_VACATIONS = [
  {
    employeeId: 'UP38',
    employeeName: 'Arti',
    leaveType: 'VIL',
    startDate: '2026-08-09',
    endDate: '2026-08-25',
    createdAt: '2026-08-01 10:30'
  }
];

const INITIAL_SAMPLE_HOLIDAYS = [
  { date: '2026-08-15', holidayName: 'Independence Day', createdAt: '2026-08-01 10:00' },
  { date: '2026-08-23', holidayName: 'Company Holiday', createdAt: '2026-08-01 10:40' }
];

const INITIAL_SAMPLE_ATTENDANCE = [
  { date: '2026-08-19', employeeId: 'UP05', employeeName: 'G Diwakar', status: 'P', updatedAt: '2026-08-19 10:30' },
  { date: '2026-08-19', employeeId: 'UP18', employeeName: 'Vignesh', status: 'SL', updatedAt: '2026-08-19 10:31' }
];

const AppState = {
  currentYear: 2026,
  currentMonth: 8, // 1 - 12 (August 2026 by default)
  activeTab: 'matrix',
  apiUrl: localStorage.getItem(STORAGE_KEYS.API_URL) || '',
  isConnected: false,
  isLoading: false,
  
  // Auth Store
  users: [],
  currentUser: null,
  authTab: 'signin', // 'signin' | 'signup' | 'reset'

  // Data Store
  employees: [],
  attendance: [],
  vacations: [],
  holidays: [],
  settings: { ...DEFAULT_SETTINGS },
  
  // Search & Filter
  searchTerm: '',
  statusFilter: 'all',
  selectedReportEmployeeId: 'ALL', // 'ALL' or specific Employee ID
  
  // Quick Cell Target
  activeCellTarget: null // { employeeId, date, currentStatus }
};

// ==============================================================================
// 2. INITIALIZATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  loadLocalData();
  bindUIEvents();
  switchTab(AppState.currentUser ? 'matrix' : 'home');
}

function loadLocalData() {
  const savedEmployees = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
  const savedAttendance = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  const savedVacations = localStorage.getItem(STORAGE_KEYS.VACATIONS);
  const savedHolidays = localStorage.getItem(STORAGE_KEYS.HOLIDAYS);
  const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  const savedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);

  AppState.employees = savedEmployees ? JSON.parse(savedEmployees) : [...INITIAL_SAMPLE_EMPLOYEES];
  AppState.attendance = savedAttendance ? JSON.parse(savedAttendance) : [...INITIAL_SAMPLE_ATTENDANCE];
  AppState.vacations = savedVacations ? JSON.parse(savedVacations) : [...INITIAL_SAMPLE_VACATIONS];
  AppState.holidays = savedHolidays ? JSON.parse(savedHolidays) : [...INITIAL_SAMPLE_HOLIDAYS];
  AppState.settings = savedSettings ? JSON.parse(savedSettings) : { ...DEFAULT_SETTINGS };
  AppState.users = savedUsers ? JSON.parse(savedUsers) : [...DEFAULT_USERS];
  AppState.currentUser = savedCurrentUser ? JSON.parse(savedCurrentUser) : null;
  AppState.activeTab = AppState.currentUser ? 'matrix' : 'home';

  saveLocalData();
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(AppState.employees));
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(AppState.attendance));
  localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(AppState.vacations));
  localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(AppState.holidays));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(AppState.settings));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(AppState.users));
  if (AppState.currentUser) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(AppState.currentUser));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

// ==============================================================================
// 3. EVENT BINDINGS
// ==============================================================================

function bindUIEvents() {
  // Brand Click -> Go to Matrix if logged in, else Home
  document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
    if (AppState.currentUser) {
      switchTab('matrix');
    } else {
      switchTab('home');
    }
  });

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Auth Tabs
  document.querySelectorAll('.auth-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.authTab;
      switchAuthTab(tab);
    });
  });

  // Auth Forms
  document.getElementById('authSignInForm')?.addEventListener('submit', handleSignIn);
  document.getElementById('authSignUpForm')?.addEventListener('submit', handleSignUp);
  document.getElementById('authResetForm')?.addEventListener('submit', handleResetPassword);

  // Month Navigation
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
  document.getElementById('todayBtn')?.addEventListener('click', () => jumpToCurrentMonth());

  // Search filter
  const searchInput = document.getElementById('employeeSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchTerm = e.target.value.toLowerCase().trim();
      renderMatrix();
      renderEmployeesTable();
    });
  }

  // Reports Filter & Actions
  const reportFilter = document.getElementById('reportEmployeeFilter');
  if (reportFilter) {
    reportFilter.addEventListener('change', (e) => {
      AppState.selectedReportEmployeeId = e.target.value;
      renderReports();
    });
  }

  document.getElementById('reportPrevEmpBtn')?.addEventListener('click', () => navigateReportEmployee(-1));
  document.getElementById('reportNextEmpBtn')?.addEventListener('click', () => navigateReportEmployee(1));
  document.getElementById('printEmployeeReportBtn')?.addEventListener('click', printEmployeeReport);
  document.getElementById('exportEmployeeCsvBtn')?.addEventListener('click', exportEmployeeCsv);

  // Action Buttons
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCsv);
  document.getElementById('bulkMarkBtn')?.addEventListener('click', openBulkMarkModal);

  // Modals Close handlers
  document.querySelectorAll('.modal-close-btn, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // Click Outside Modal to Close
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAllModals();
    });
  });

  // Modal Forms
  document.getElementById('employeeForm')?.addEventListener('submit', handleEmployeeFormSubmit);
  document.getElementById('vacationForm')?.addEventListener('submit', handleVacationFormSubmit);
  document.getElementById('holidayForm')?.addEventListener('submit', handleHolidayFormSubmit);
  document.getElementById('bulkMarkForm')?.addEventListener('submit', handleBulkMarkFormSubmit);
  document.getElementById('gasSettingsForm')?.addEventListener('submit', handleGasSettingsSubmit);

  // Status Selector Buttons in Cell Modal
  document.querySelectorAll('.status-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const status = btn.dataset.status;
      applyCellStatus(status);
    });
  });
}

function switchTab(tabName) {
  // Gating: If not logged in, only allow 'home' (Auth Portal)
  if (!AppState.currentUser) {
    if (tabName !== 'home') {
      showToast('Please sign in or register to access the attendance features.', 'warning');
    }
    tabName = 'home';
  }

  AppState.activeTab = tabName;

  // Update tab buttons active classes
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Toggle view section visibility
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== `view-${tabName}`);
  });

  // Toggle Navigation Tabs Bar (Only visible when user is authenticated)
  const navTabs = document.getElementById('mainNavTabs');
  if (navTabs) {
    navTabs.classList.toggle('hidden', !AppState.currentUser);
  }

  // Toggle dashboard control bar, metrics, and legend (Only visible when logged in AND not on home)
  const showDashboardWidgets = !!AppState.currentUser && tabName !== 'home';
  const controlBar = document.getElementById('dashboardControlBar');
  const metricsGrid = document.getElementById('dashboardMetricsGrid');
  const legendBar = document.getElementById('dashboardLegendBar');

  if (controlBar) controlBar.classList.toggle('hidden', !showDashboardWidgets);
  if (metricsGrid) metricsGrid.classList.toggle('hidden', !showDashboardWidgets);
  if (legendBar) legendBar.classList.toggle('hidden', !showDashboardWidgets);

  renderApp();
}

function changeMonth(delta) {
  let newMonth = AppState.currentMonth + delta;
  let newYear = AppState.currentYear;

  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  } else if (newMonth < 1) {
    newMonth = 12;
    newYear--;
  }

  AppState.currentMonth = newMonth;
  AppState.currentYear = newYear;

  renderApp();
  showToast(`Navigated to ${getMonthName(AppState.currentMonth)} ${AppState.currentYear}`, 'info');
}

function jumpToCurrentMonth() {
  const now = new Date();
  AppState.currentYear = now.getFullYear();
  AppState.currentMonth = now.getMonth() + 1;
  renderApp();
  showToast(`Jumped to Current Month`, 'info');
}

// ==============================================================================
// AUTHENTICATION & HOME PORTAL LOGIC
// ==============================================================================

window.switchAuthTab = function(tab) {
  AppState.authTab = tab;
  
  // Update Buttons
  document.querySelectorAll('.auth-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.authTab === tab);
  });

  // Toggle Form Panels
  const signInForm = document.getElementById('authSignInForm');
  const signUpForm = document.getElementById('authSignUpForm');
  const resetForm = document.getElementById('authResetForm');

  if (signInForm) signInForm.classList.toggle('hidden', tab !== 'signin');
  if (signUpForm) signUpForm.classList.toggle('hidden', tab !== 'signup');
  if (resetForm) resetForm.classList.toggle('hidden', tab !== 'reset');
};

window.quickFillDemo = function(role) {
  switchAuthTab('signin');
  const idInput = document.getElementById('loginIdentifier');
  const passInput = document.getElementById('loginPassword');

  if (role === 'admin') {
    if (idInput) idInput.value = 'admin@company.com';
    if (passInput) passInput.value = 'password123';
    showToast('Filled Admin demo credentials.', 'info');
  } else {
    if (idInput) idInput.value = 'diwakar@company.com';
    if (passInput) passInput.value = 'password123';
    showToast('Filled Employee demo credentials.', 'info');
  }
};

window.togglePasswordVisibility = function(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
};

function handleSignIn(e) {
  e.preventDefault();
  const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  if (!identifier || !password) {
    showToast('Please enter your email/ID and password.', 'warning');
    return;
  }

  const user = AppState.users.find(u => 
    (u.email.toLowerCase() === identifier || u.id.toLowerCase() === identifier) && 
    u.password === password
  );

  if (user) {
    AppState.currentUser = user;
    saveLocalData();
    showToast(`Welcome back, ${user.name}! (${user.role})`, 'success');
    renderApp();
    switchTab('matrix');
  } else {
    showToast('Invalid email/ID or password. Try demo credentials!', 'error');
  }
}

function handleSignUp(e) {
  e.preventDefault();
  const fullName = document.getElementById('signupFullName').value.trim();
  const empId = document.getElementById('signupEmpId').value.trim().toUpperCase();
  const role = document.getElementById('signupRole').value;
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;

  if (!fullName || !empId || !email || !password) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning');
    return;
  }

  // Check if exists
  const existing = AppState.users.find(u => u.email.toLowerCase() === email || u.id.toLowerCase() === empId.toLowerCase());
  if (existing) {
    showToast(`An account with ID ${empId} or email ${email} already exists.`, 'error');
    return;
  }

  const newUser = {
    id: empId,
    name: fullName,
    email: email,
    role: role,
    password: password,
    createdAt: formatDateTimeNow().split(' ')[0]
  };

  AppState.users.push(newUser);

  // Also auto-add to employee directory if not present
  if (!AppState.employees.some(e => e.id.toLowerCase() === empId.toLowerCase())) {
    AppState.employees.push({
      id: empId,
      name: fullName,
      status: 'Active',
      createdAt: newUser.createdAt
    });
  }

  AppState.currentUser = newUser;
  saveLocalData();

  // Reset form
  document.getElementById('authSignUpForm').reset();
  showToast(`Account successfully created! Welcome, ${newUser.name}.`, 'success');
  renderApp();
  switchTab('matrix');
}

function handleResetPassword(e) {
  e.preventDefault();
  const identifier = document.getElementById('resetIdentifier').value.trim().toLowerCase();
  const newPassword = document.getElementById('resetNewPassword').value;
  const confirmPassword = document.getElementById('resetConfirmPassword').value;

  if (!identifier || !newPassword) {
    showToast('Please enter your email or ID and new password.', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning');
    return;
  }

  const userIndex = AppState.users.findIndex(u => 
    u.email.toLowerCase() === identifier || u.id.toLowerCase() === identifier
  );

  if (userIndex >= 0) {
    AppState.users[userIndex].password = newPassword;
    saveLocalData();
    showToast('Password has been reset successfully! Please sign in with your new password.', 'success');
    document.getElementById('authResetForm').reset();
    switchAuthTab('signin');
  } else {
    showToast(`No registered user found matching "${identifier}".`, 'error');
  }
}

window.handleSignOut = function() {
  AppState.currentUser = null;
  saveLocalData();
  showToast('You have signed out successfully.', 'info');
  renderApp();
  switchTab('home');
};

function renderHeaderAuth() {
  const container = document.getElementById('headerAuthSection');
  if (!container) return;

  if (AppState.currentUser) {
    const initials = AppState.currentUser.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    container.innerHTML = `
      <div class="header-user-chip" title="Active Session: ${AppState.currentUser.email}">
        <div class="user-avatar-circle">${initials}</div>
        <div class="user-meta">
          <span class="user-meta-name">${AppState.currentUser.name}</span>
          <span class="user-meta-role">${AppState.currentUser.role}</span>
        </div>
        <button type="button" class="btn-signout" onclick="handleSignOut()" title="Sign out of account">
          Sign Out
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <span class="auth-guest-badge">🔒 Sign In Required</span>
    `;
  }
}

function renderHomeView() {
  const loggedInCard = document.getElementById('authLoggedInView');
  const formsContainer = document.getElementById('authFormsContainer');
  const welcomeAvatar = document.getElementById('welcomeUserAvatar');
  const welcomeName = document.getElementById('welcomeUserName');
  const welcomeEmail = document.getElementById('welcomeUserEmail');

  if (AppState.currentUser) {
    if (loggedInCard) loggedInCard.classList.remove('hidden');
    if (formsContainer) formsContainer.classList.add('hidden');
    
    if (welcomeAvatar) {
      const initials = AppState.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      welcomeAvatar.textContent = initials;
    }
    if (welcomeName) welcomeName.textContent = `Welcome, ${AppState.currentUser.name}!`;
    if (welcomeEmail) welcomeEmail.textContent = `${AppState.currentUser.role} • ${AppState.currentUser.email}`;
  } else {
    if (loggedInCard) loggedInCard.classList.add('hidden');
    if (formsContainer) formsContainer.classList.remove('hidden');
    switchAuthTab(AppState.authTab || 'signin');
  }
}


function jumpToCurrentMonth() {
  const now = new Date();
  AppState.currentYear = now.getFullYear();
  AppState.currentMonth = now.getMonth() + 1;
  renderApp();
  showToast(`Jumped to Current Month`, 'info');
}

// ==============================================================================
// 4. CORE ATTENDANCE CALCULATION ENGINE
// ==============================================================================

function normalizeStatus(st) {
  if (!st) return 'P';
  const s = String(st).trim().toUpperCase();
  if (s === 'H' || s === 'HOLIDAY' || s === 'HOL') return 'H';
  if (s === 'P' || s === 'PRESENT') return 'P';
  if (s === 'SL' || s === 'SICK' || s === 'SICK LEAVE') return 'SL';
  if (s === 'LOP' || s === 'A' || s === 'ABSENT' || s === 'LOSS OF PAY') return 'LOP';
  if (s === 'VIL' || s === 'VACATION') return 'VIL';
  return s;
}

/**
 * Calculates the final attendance status for an employee on a specific date.
 * PRIORITY LOGIC (Strict):
 * 1. Employee Vacation (VIL) -> OVERRIDES Sunday, Weekend, & Company Holiday!
 * 2. Explicit Saved Attendance in Sheet (P, SL, LOP, VIL, H)
 * 3. Company Holiday from Holidays sheet -> H
 * 4. Sunday / Weekend -> H
 * 5. Normal Working Day -> P
 */
function calculateAttendanceStatus(employeeId, dateKey, dayInfo) {
  const empIdLower = employeeId.toLowerCase();

  // 1. Check Employee Vacation (Highest Priority)
  const activeVacation = AppState.vacations.find(v => {
    return v.employeeId.toLowerCase() === empIdLower &&
           dateKey >= v.startDate &&
           dateKey <= v.endDate;
  });

  if (activeVacation) {
    return {
      status: activeVacation.leaveType || 'VIL',
      source: 'vacation',
      isVacation: true,
      description: `Vacation Period (${activeVacation.leaveType})`
    };
  }

  // 2. Check Explicit Attendance Record in Database
  const explicitRecord = AppState.attendance.find(a => {
    return a.employeeId.toLowerCase() === empIdLower && a.date === dateKey;
  });

  if (explicitRecord && explicitRecord.status) {
    const norm = normalizeStatus(explicitRecord.status);
    return {
      status: norm,
      source: 'explicit',
      isCustom: true,
      description: `Explicit Status (${norm})`
    };
  }

  // 3. Check Company Holiday from Holidays Sheet
  if (dayInfo.holidayName) {
    return {
      status: 'H',
      source: 'holiday',
      isHoliday: true,
      description: `Company Holiday: ${dayInfo.holidayName}`
    };
  }

  // 4. Check Sunday
  if (dayInfo.isSunday) {
    return {
      status: 'H',
      source: 'sunday',
      isSunday: true,
      description: 'Sunday Weekly Off'
    };
  }

  // 5. Normal Working Day (Default P)
  return {
    status: 'P',
    source: 'default',
    description: 'Normal Working Day (Present)'
  };
}

/**
 * Computes the month days structure
 */
function getMonthDays(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Index holidays for quick lookup
  const holidayMap = {};
  AppState.holidays.forEach(h => {
    holidayMap[h.date] = h.holidayName;
  });

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();

    days.push({
      day: d,
      date: dateKey,
      dayName: dayNames[dayOfWeek],
      isSunday: dayOfWeek === 0,
      isSaturday: dayOfWeek === 6,
      holidayName: holidayMap[dateKey] || null
    });
  }

  return days;
}

// ==============================================================================
// 5. RENDERING MODULES
// ==============================================================================

function renderApp() {
  renderHeaderAuth();
  updateMonthHeader();
  renderLegend();

  if (AppState.activeTab === 'home') {
    renderHomeView();
  } else if (AppState.activeTab === 'matrix') {
    renderMatrix();
  } else if (AppState.activeTab === 'employees') {
    renderEmployeesTable();
  } else if (AppState.activeTab === 'vacations') {
    renderVacationsTable();
  } else if (AppState.activeTab === 'holidays') {
    renderHolidaysTable();
  } else if (AppState.activeTab === 'reports') {
    renderReports();
  } else if (AppState.activeTab === 'settings') {
    renderSettingsView();
  }

  updateBadges();
}

function updateMonthHeader() {
  const monthName = getMonthName(AppState.currentMonth);
  const text = `${monthName} ${AppState.currentYear}`;
  document.getElementById('currentMonthDisplay').textContent = text;
  document.getElementById('printMonthTitle').textContent = text;
}

function renderLegend() {
  // Update metric counters on top
  const monthDays = getMonthDays(AppState.currentYear, AppState.currentMonth);
  const activeEmployees = AppState.employees.filter(e => e.status === 'Active');
  
  let totalP = 0;
  let totalSL = 0;
  let totalLOP = 0;
  let totalVIL = 0;
  let totalHol = 0;

  activeEmployees.forEach(emp => {
    monthDays.forEach(day => {
      const res = calculateAttendanceStatus(emp.id, day.date, day);
      const st = normalizeStatus(res.status);
      if (st === 'P') totalP++;
      else if (st === 'SL') totalSL++;
      else if (st === 'LOP' || st === 'A') totalLOP++;
      else if (st === 'VIL') totalVIL++;
      else if (st === 'H') totalHol++;
    });
  });

  const countElemP = document.getElementById('metricPresentCount');
  const countElemSL = document.getElementById('metricSlCount');
  const countElemLOP = document.getElementById('metricLopCount');
  const countElemVIL = document.getElementById('metricVilCount');
  const countElemHol = document.getElementById('metricHolidayCount');

  if (countElemP) countElemP.textContent = totalP;
  if (countElemSL) countElemSL.textContent = totalSL;
  if (countElemLOP) countElemLOP.textContent = totalLOP;
  if (countElemVIL) countElemVIL.textContent = totalVIL;
  if (countElemHol) countElemHol.textContent = totalHol;
}

window.viewEmployeeReport = function(empId) {
  AppState.selectedReportEmployeeId = empId;
  switchTab('reports');
};

window.navigateReportEmployee = function(delta) {
  const options = ['ALL', ...AppState.employees.map(e => e.id)];
  let currentIndex = options.indexOf(AppState.selectedReportEmployeeId);
  if (currentIndex === -1) currentIndex = 0;

  let nextIndex = currentIndex + delta;
  if (nextIndex < 0) nextIndex = options.length - 1;
  if (nextIndex >= options.length) nextIndex = 0;

  AppState.selectedReportEmployeeId = options[nextIndex];
  renderReports();
};

function renderMatrix() {
  const container = document.getElementById('matrixTableContainer');
  if (!container) return;

  const monthDays = getMonthDays(AppState.currentYear, AppState.currentMonth);
  
  // Filter employees
  let employeesToRender = AppState.employees;
  if (AppState.searchTerm) {
    employeesToRender = employeesToRender.filter(e => 
      e.name.toLowerCase().includes(AppState.searchTerm) || 
      e.id.toLowerCase().includes(AppState.searchTerm)
    );
  }

  // Build Table HTML
  let html = `
    <table class="attendance-table" id="matrixTable">
      <thead>
        <tr>
          <th rowspan="2" class="col-emp-id">Emp ID</th>
          <th rowspan="2" class="col-emp-name">Employee Name</th>
  `;

  // Row 1: Day Names
  monthDays.forEach(d => {
    const isSun = d.isSunday;
    const isHol = !!d.holidayName;
    let cls = isSun ? 'sunday-header' : (isHol ? 'holiday-header' : '');
    html += `<th class="${cls}" title="${d.holidayName || (isSun ? 'Sunday' : d.dayName)}">${d.dayName}</th>`;
  });

  // Summary headers
  html += `
          <th rowspan="2" class="col-summary" title="Present Days">P</th>
          <th rowspan="2" class="col-summary" title="Sick Leave">SL</th>
          <th rowspan="2" class="col-summary" title="Loss of Pay">LOP</th>
          <th rowspan="2" class="col-summary" title="Vacation in Lieu">VIL</th>
          <th rowspan="2" class="col-summary" title="Holiday / Sunday">H</th>
          <th rowspan="2" class="col-total-payable" title="Payable Days (P + SL + VIL + H)">Payable</th>
        </tr>
        <tr>
  `;

  // Row 2: Day Numbers (1 .. 31)
  monthDays.forEach(d => {
    const isSun = d.isSunday;
    const isHol = !!d.holidayName;
    let cls = isSun ? 'sunday-header' : (isHol ? 'holiday-header' : '');
    html += `<th class="${cls}">${d.day}</th>`;
  });

  html += `
        </tr>
      </thead>
      <tbody>
  `;

  if (employeesToRender.length === 0) {
    html += `
      <tr>
        <td colspan="${monthDays.length + 8}" style="text-align:center; padding:30px; color:var(--text-muted);">
          No employees found matching your search.
        </td>
      </tr>
    `;
  }

  // Daily totals accumulator
  const dailyTotals = monthDays.map(() => ({ P: 0, SL: 0, LOP: 0, VIL: 0, H: 0 }));

  employeesToRender.forEach(emp => {
    let empP = 0;
    let empSL = 0;
    let empLOP = 0;
    let empVIL = 0;
    let empHOL = 0;

    html += `
      <tr data-emp-id="${emp.id}">
        <td class="col-emp-id">
          <a href="javascript:void(0)" onclick="viewEmployeeReport('${emp.id}')" title="View individual report for ${emp.name}" style="color:var(--primary); font-weight:700; text-decoration:none;">
            ${emp.id}
          </a>
        </td>
        <td class="col-emp-name" title="Click to view monthly report for ${emp.name}">
          <a href="javascript:void(0)" onclick="viewEmployeeReport('${emp.id}')" style="color:inherit; text-decoration:none; display:flex; align-items:center; justify-content:space-between;">
            <span>${emp.name}</span>
            <span style="font-size:11px; opacity:0.6;" title="View Monthly Report">📊</span>
          </a>
        </td>
    `;

    monthDays.forEach((day, index) => {
      const result = calculateAttendanceStatus(emp.id, day.date, day);
      const st = normalizeStatus(result.status);

      if (st === 'P') { empP++; dailyTotals[index].P++; }
      else if (st === 'SL') { empSL++; dailyTotals[index].SL++; }
      else if (st === 'LOP' || st === 'A') { empLOP++; dailyTotals[index].LOP++; }
      else if (st === 'VIL') { empVIL++; dailyTotals[index].VIL++; }
      else if (st === 'H') { empHOL++; dailyTotals[index].H++; }

      let cellExtraClass = '';
      if (day.isSunday) cellExtraClass += ' sunday-col';
      if (day.holidayName) cellExtraClass += ' holiday-col';

      html += `
        <td class="${cellExtraClass}">
          <div class="attendance-cell status-badge ${st}" 
               data-emp-id="${emp.id}" 
               data-emp-name="${emp.name}" 
               data-date="${day.date}" 
               data-status="${st}"
               title="${emp.name} (${emp.id}) | ${day.date}: ${st} - ${result.description}">
            ${st}
            ${result.isCustom ? '<span class="cell-dot-explicit" title="Manually saved"></span>' : ''}
          </div>
        </td>
      `;
    });

    const payableDays = empP + empSL + empVIL + empHOL;

    html += `
        <td class="col-summary font-bold" style="color:var(--status-p-text);">${empP}</td>
        <td class="col-summary font-bold" style="color:var(--status-sl-text);">${empSL}</td>
        <td class="col-summary font-bold" style="color:var(--status-lop-text);">${empLOP}</td>
        <td class="col-summary font-bold" style="color:var(--status-vil-text);">${empVIL}</td>
        <td class="col-summary font-bold" style="color:var(--status-hol-text);">${empHOL}</td>
        <td class="col-total-payable">${payableDays}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
      <tfoot>
        <tr>
          <td class="col-emp-id">Total</td>
          <td class="col-emp-name">Present (P) Count</td>
  `;

  dailyTotals.forEach(dt => {
    html += `<td>${dt.P}</td>`;
  });

  html += `
          <td colspan="6" style="text-align:right; padding-right:12px; color:var(--text-muted);">
            Active: ${AppState.employees.filter(e=>e.status==='Active').length}
          </td>
        </tr>
      </tfoot>
    </table>
  `;

  container.innerHTML = html;

  // Bind cell clicks for fast editing
  container.querySelectorAll('.attendance-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const empId = cell.dataset.empId;
      const empName = cell.dataset.empName;
      const date = cell.dataset.date;
      const currentStatus = cell.dataset.status;

      openCellStatusModal(empId, empName, date, currentStatus);
    });
  });
}

function renderEmployeesTable() {
  const tbody = document.getElementById('employeesTableBody');
  if (!tbody) return;

  let employees = AppState.employees;
  if (AppState.searchTerm) {
    employees = employees.filter(e => 
      e.name.toLowerCase().includes(AppState.searchTerm) || 
      e.id.toLowerCase().includes(AppState.searchTerm)
    );
  }

  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:24px;">No employees registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = employees.map(emp => `
    <tr>
      <td class="font-bold text-primary">${emp.id}</td>
      <td><strong>${emp.name}</strong></td>
      <td>
        <span class="${emp.status === 'Active' ? 'pill-active' : 'pill-inactive'}">
          ${emp.status}
        </span>
      </td>
      <td>${emp.createdAt || '-'}</td>
      <td class="text-right">
        <button class="btn btn-secondary btn-sm" onclick="openEditEmployeeModal('${emp.id}')">Edit</button>
        <button class="btn ${emp.status === 'Active' ? 'btn-secondary' : 'btn-success'} btn-sm" 
                onclick="toggleEmployeeStatus('${emp.id}')">
          ${emp.status === 'Active' ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  `).join('');
}

function renderVacationsTable() {
  const tbody = document.getElementById('vacationsTableBody');
  if (!tbody) return;

  if (AppState.vacations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">No vacation periods configured.</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.vacations.map((vac, idx) => {
    const daysDiff = calculateDaysBetween(vac.startDate, vac.endDate);
    return `
      <tr>
        <td class="font-bold text-primary">${vac.employeeId}</td>
        <td><strong>${vac.employeeName || getEmployeeNameById(vac.employeeId)}</strong></td>
        <td><span class="status-badge VIL">${vac.leaveType || 'VIL'}</span></td>
        <td>${formatDateForDisplay(vac.startDate)}</td>
        <td>${formatDateForDisplay(vac.endDate)}</td>
        <td><span class="pill-active">${daysDiff} days</span></td>
        <td class="text-right">
          <button class="btn btn-danger btn-sm" onclick="deleteVacationRecord('${vac.employeeId}', '${vac.startDate}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHolidaysTable() {
  const tbody = document.getElementById('holidaysTableBody');
  if (!tbody) return;

  if (AppState.holidays.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:24px;">No company holidays configured.</td></tr>`;
    return;
  }

  // Sort holidays by date
  const sortedHolidays = [...AppState.holidays].sort((a,b) => a.date.localeCompare(b.date));

  tbody.innerHTML = sortedHolidays.map(hol => `
    <tr>
      <td class="font-bold">${formatDateForDisplay(hol.date)}</td>
      <td><strong>${hol.holidayName}</strong></td>
      <td>${hol.createdAt || '-'}</td>
      <td class="text-right">
        <button class="btn btn-danger btn-sm" onclick="deleteHolidayRecord('${hol.date}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderReports() {
  const container = document.getElementById('reportsContainer');
  if (!container) return;

  const selectFilter = document.getElementById('reportEmployeeFilter');
  if (selectFilter) {
    // Preserve current selection or default to ALL
    let optionsHtml = `<option value="ALL">🏢 All Employees (Consolidated Summary)</option>`;
    
    if (AppState.employees.length > 0) {
      optionsHtml += `<optgroup label="Active Employees">`;
      AppState.employees.filter(e => e.status === 'Active').forEach(e => {
        optionsHtml += `<option value="${e.id}">${e.id} - ${e.name} (Active)</option>`;
      });
      optionsHtml += `</optgroup>`;

      const inactives = AppState.employees.filter(e => e.status !== 'Active');
      if (inactives.length > 0) {
        optionsHtml += `<optgroup label="Inactive Employees">`;
        inactives.forEach(e => {
          optionsHtml += `<option value="${e.id}">${e.id} - ${e.name} (Inactive)</option>`;
        });
        optionsHtml += `</optgroup>`;
      }
    }
    
    selectFilter.innerHTML = optionsHtml;
    selectFilter.value = AppState.selectedReportEmployeeId || 'ALL';
  }

  const monthDays = getMonthDays(AppState.currentYear, AppState.currentMonth);
  const totalDays = monthDays.length;
  const monthName = getMonthName(AppState.currentMonth);

  // CASE 1: INDIVIDUAL EMPLOYEE MONTHLY REPORT
  if (AppState.selectedReportEmployeeId && AppState.selectedReportEmployeeId !== 'ALL') {
    const emp = AppState.employees.find(e => e.id.toLowerCase() === AppState.selectedReportEmployeeId.toLowerCase());
    if (!emp) {
      AppState.selectedReportEmployeeId = 'ALL';
      renderReports();
      return;
    }

    let p = 0, sl = 0, lop = 0, vil = 0, hol = 0;
    const dailyRecords = monthDays.map(day => {
      const res = calculateAttendanceStatus(emp.id, day.date, day);
      const st = normalizeStatus(res.status);
      if (st === 'P') p++;
      else if (st === 'SL') sl++;
      else if (st === 'LOP' || st === 'A') lop++;
      else if (st === 'VIL') vil++;
      else if (st === 'H') hol++;
      return { day, res, st };
    });

    const payableDays = p + sl + vil + hol;
    const rate = totalDays > 0 ? ((payableDays / totalDays) * 100).toFixed(1) : '0.0';
    const presentRate = totalDays > 0 ? ((p / totalDays) * 100).toFixed(1) : '0.0';
    const initials = emp.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || emp.id;

    // Check if employee has active vacation this month
    const empVacations = AppState.vacations.filter(v => v.employeeId.toLowerCase() === emp.id.toLowerCase());

    let html = `
      <!-- Employee Profile Banner -->
      <div class="employee-profile-card">
        <div class="emp-profile-left">
          <div class="emp-avatar">${initials}</div>
          <div class="emp-profile-details">
            <h2>${emp.name}</h2>
            <p>
              <span><strong>Employee ID:</strong> ${emp.id}</span>
              <span>•</span>
              <span class="${emp.status === 'Active' ? 'pill-active' : 'pill-inactive'}">${emp.status}</span>
              <span>•</span>
              <span><strong>Report Period:</strong> ${monthName} ${AppState.currentYear}</span>
            </p>
            ${empVacations.length > 0 ? `
              <div style="font-size:12px; margin-top:6px; opacity:0.95; background:rgba(255,255,255,0.18); padding:4px 10px; border-radius:4px; display:inline-block;">
                🏖️ <strong>Vacation Configured:</strong> ${empVacations.map(v => `${formatDateForDisplay(v.startDate)} to ${formatDateForDisplay(v.endDate)} (${v.leaveType})`).join(', ')}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px;">
          <div class="emp-rate-gauge">
            <div class="rate-num">${payableDays} / ${totalDays}</div>
            <div class="rate-label">Payable Days</div>
          </div>
          <div class="emp-rate-gauge">
            <div class="rate-num">${rate}%</div>
            <div class="rate-label">Monthly Attendance Rate</div>
          </div>
        </div>
      </div>

      <!-- KPI Metrics Row -->
      <div class="individual-kpis">
        <div class="kpi-chip">
          <div class="kpi-val" style="color:var(--status-p-text);">${p}</div>
          <div class="kpi-lbl">Present (P)</div>
        </div>
        <div class="kpi-chip">
          <div class="kpi-val" style="color:var(--status-sl-text);">${sl}</div>
          <div class="kpi-lbl">Sick Leave (SL)</div>
        </div>
        <div class="kpi-chip">
          <div class="kpi-val" style="color:var(--status-lop-text);">${lop}</div>
          <div class="kpi-lbl">Loss of Pay (LOP)</div>
        </div>
        <div class="kpi-chip">
          <div class="kpi-val" style="color:var(--status-vil-text);">${vil}</div>
          <div class="kpi-lbl">Vacation (VIL)</div>
        </div>
        <div class="kpi-chip">
          <div class="kpi-val" style="color:var(--status-hol-text);">${hol}</div>
          <div class="kpi-lbl">Holiday / Sun (H)</div>
        </div>
        <div class="kpi-chip" style="background:#EFF6FF; border-color:#BFDBFE;">
          <div class="kpi-val" style="color:var(--primary);">${payableDays}</div>
          <div class="kpi-lbl">Total Payable Days</div>
        </div>
      </div>

      <!-- Day-by-Day Detailed Timesheet Table -->
      <div class="view-card">
        <div class="card-header-flex">
          <div class="card-title">
            <h3>Daily Timesheet & Attendance Register</h3>
            <p>Full day-by-day activity breakdown for ${emp.name} (${emp.id}) in ${monthName} ${AppState.currentYear}</p>
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            Total Calendar Days: <strong>${totalDays}</strong>
          </div>
        </div>

        <div class="table-responsive">
          <table class="timesheet-table">
            <thead>
              <tr>
                <th style="width:120px;">Date</th>
                <th style="width:130px;">Day</th>
                <th style="width:110px;">Status</th>
                <th>Source & Priority Reason</th>
                <th class="text-right no-print" style="width:100px;">Action</th>
              </tr>
            </thead>
            <tbody>
    `;

    dailyRecords.forEach(({ day, res, st }) => {
      let rowClass = '';
      if (st === 'VIL') rowClass = 'vacation-row';
      else if (day.isSunday) rowClass = 'sunday-row';
      else if (day.holidayName) rowClass = 'holiday-row';

      html += `
        <tr class="${rowClass}">
          <td class="font-bold">${formatDateForDisplay(day.date)}</td>
          <td>
            <strong>${day.dayName}</strong>
            ${day.isSunday ? '<span style="font-size:10px; color:#DC2626; margin-left:4px;">(Weekly Off)</span>' : ''}
          </td>
          <td>
            <span class="status-badge ${st}">${st}</span>
          </td>
          <td>
            <span style="font-size:12px; color:var(--text-main);">
              ${res.description}
            </span>
            ${res.isCustom ? '<span class="cell-dot-explicit" style="position:static; display:inline-block; margin-left:4px; vertical-align:middle;" title="Manually edited"></span>' : ''}
          </td>
          <td class="text-right no-print">
            <button class="btn btn-secondary btn-sm" onclick="openCellStatusModal('${emp.id}', '${emp.name}', '${day.date}', '${st}')">
              Edit
            </button>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>

        <!-- Official Sign-off Box for Print / HR -->
        <div class="signature-box">
          <div>
            <div style="font-size:12px; color:var(--text-main); font-weight:600;">Employee Acknowledgment:</div>
            <div class="signature-line">
              Signature of ${emp.name} & Date
            </div>
          </div>
          <div>
            <div style="font-size:12px; color:var(--text-main); font-weight:600;">Authorized HR / Supervisor:</div>
            <div class="signature-line">
              Manager / HR Signature & Stamp
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    return;
  }

  // CASE 2: CONSOLIDATED ALL-EMPLOYEES REPORT
  let html = `
    <div class="view-card">
      <div class="card-header-flex">
        <div class="card-title">
          <h3>Monthly Attendance & Payroll Summary (All Employees)</h3>
          <p>Consolidated statistics for ${monthName} ${AppState.currentYear}. Select any employee above to view their individual day-by-day timesheet report.</p>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Employee Name</th>
              <th>Status</th>
              <th>Total Days</th>
              <th>Present (P)</th>
              <th>Sick Leave (SL)</th>
              <th>Loss of Pay (LOP)</th>
              <th>Vacation (VIL)</th>
              <th>Holiday (H)</th>
              <th>Payable Days</th>
              <th>Attendance Rate</th>
              <th class="text-right no-print">Action</th>
            </tr>
          </thead>
          <tbody>
  `;

  AppState.employees.forEach(emp => {
    let p = 0, sl = 0, lop = 0, vil = 0, hol = 0;

    monthDays.forEach(day => {
      const res = calculateAttendanceStatus(emp.id, day.date, day);
      const st = normalizeStatus(res.status);
      if (st === 'P') p++;
      else if (st === 'SL') sl++;
      else if (st === 'LOP' || st === 'A') lop++;
      else if (st === 'VIL') vil++;
      else if (st === 'H') hol++;
    });

    const payable = p + sl + vil + hol;
    const rate = totalDays > 0 ? ((payable / totalDays) * 100).toFixed(1) : '0.0';

    html += `
      <tr>
        <td class="font-bold text-primary">${emp.id}</td>
        <td><strong>${emp.name}</strong></td>
        <td><span class="${emp.status === 'Active' ? 'pill-active' : 'pill-inactive'}">${emp.status}</span></td>
        <td>${totalDays}</td>
        <td><span class="status-badge P">${p}</span></td>
        <td><span class="status-badge SL">${sl}</span></td>
        <td><span class="status-badge LOP">${lop}</span></td>
        <td><span class="status-badge VIL">${vil}</span></td>
        <td><span class="status-badge H">${hol}</span></td>
        <td class="font-bold text-primary" style="font-size:14px;">${payable}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="flex:1; background:#E2E8F0; height:6px; border-radius:3px; overflow:hidden; min-width:60px;">
              <div style="background:var(--primary); width:${rate}%; height:100%;"></div>
            </div>
            <span style="font-weight:600; font-size:12px;">${rate}%</span>
          </div>
        </td>
        <td class="text-right no-print">
          <button class="btn btn-secondary btn-sm" onclick="viewEmployeeReport('${emp.id}')">
            📊 View Timesheet
          </button>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function printEmployeeReport() {
  window.print();
}

function exportEmployeeCsv() {
  if (!AppState.selectedReportEmployeeId || AppState.selectedReportEmployeeId === 'ALL') {
    exportToCsv();
    return;
  }

  const emp = AppState.employees.find(e => e.id.toLowerCase() === AppState.selectedReportEmployeeId.toLowerCase());
  if (!emp) {
    exportToCsv();
    return;
  }

  const monthDays = getMonthDays(AppState.currentYear, AppState.currentMonth);
  const monthName = getMonthName(AppState.currentMonth);

  const headerRow = [
    'Date',
    'Day',
    'Employee ID',
    'Employee Name',
    'Status',
    'Attendance Classification',
    'Source / Priority Reason'
  ];

  const rows = [headerRow];
  let p = 0, sl = 0, lop = 0, vil = 0, hol = 0;

  monthDays.forEach(day => {
    const res = calculateAttendanceStatus(emp.id, day.date, day);
    const st = normalizeStatus(res.status);
    if (st === 'P') p++;
    else if (st === 'SL') sl++;
    else if (st === 'LOP' || st === 'A') lop++;
    else if (st === 'VIL') vil++;
    else if (st === 'H') hol++;

    rows.push([
      `"${formatDateForDisplay(day.date)}"`,
      `"${day.dayName}"`,
      `"${emp.id}"`,
      `"${emp.name}"`,
      `"${st}"`,
      `"${st === 'P' ? 'Present' : (st === 'SL' ? 'Sick Leave' : (st === 'LOP' ? 'Loss of Pay' : (st === 'VIL' ? 'Vacation in Lieu' : 'Holiday / Sunday')))}"`,
      `"${res.description.replace(/"/g, '""')}"`
    ]);
  });

  const totalDays = monthDays.length;
  const payable = p + sl + vil + hol;
  const rate = totalDays > 0 ? ((payable / totalDays) * 100).toFixed(1) : '0.0';

  rows.push([]);
  rows.push(['--- SUMMARY METRICS ---']);
  rows.push(['Total Calendar Days', totalDays]);
  rows.push(['Present Days (P)', p]);
  rows.push(['Sick Leave (SL)', sl]);
  rows.push(['Loss of Pay (LOP)', lop]);
  rows.push(['Vacation (VIL)', vil]);
  rows.push(['Holidays & Sundays (H)', hol]);
  rows.push(['Total Payable Days', payable]);
  rows.push(['Attendance Rate', `${rate}%`]);

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Timesheet_${emp.id}_${emp.name.replace(/\s+/g, '_')}_${monthName}_${AppState.currentYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Exported monthly timesheet for ${emp.name} (${emp.id}) to CSV.`, 'success');
}

function renderSettingsView() {
  const urlInput = document.getElementById('gasApiUrlInput');
  if (urlInput) {
    urlInput.value = AppState.apiUrl || '';
  }
}

function updateBadges() {
  const empBadge = document.getElementById('empCountBadge');
  const vacBadge = document.getElementById('vacCountBadge');
  const holBadge = document.getElementById('holCountBadge');

  if (empBadge) empBadge.textContent = AppState.employees.length;
  if (vacBadge) vacBadge.textContent = AppState.vacations.length;
  if (holBadge) holBadge.textContent = AppState.holidays.length;
}

function updateConnectionBadge(connected, text) {
  const badge = document.getElementById('connectionBadge');
  if (!badge) return;

  badge.className = `connection-badge ${connected ? 'connected' : (AppState.apiUrl ? 'error' : 'demo')}`;
  badge.innerHTML = `<span class="pulse-dot"></span> ${text || (connected ? 'Google Apps Script Live' : (AppState.apiUrl ? 'Connection Error' : 'Local Demo Mode'))}`;
}

// ==============================================================================
// 6. MODAL & ATTENDANCE ACTIONS
// ==============================================================================

function openCellStatusModal(empId, empName, date, currentStatus) {
  AppState.activeCellTarget = { employeeId: empId, employeeName: empName, date: date, currentStatus: currentStatus };

  document.getElementById('cellModalEmpName').textContent = `${empName} (${empId})`;
  document.getElementById('cellModalDate').textContent = formatDateForDisplay(date);

  // Highlight active status button
  document.querySelectorAll('.status-choice-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.status === currentStatus);
  });

  openModal('cellStatusModal');
}

async function applyCellStatus(status) {
  if (!AppState.activeCellTarget) return;

  const { employeeId, employeeName, date } = AppState.activeCellTarget;
  closeAllModals();

  if (status === 'CLEAR') {
    // Remove explicit attendance record
    AppState.attendance = AppState.attendance.filter(a => !(a.employeeId.toLowerCase() === employeeId.toLowerCase() && a.date === date));
    saveLocalData();
    showToast(`Cleared manual status for ${employeeId} on ${date}`, 'success');
  } else {
    // Update or insert record
    const existingIndex = AppState.attendance.findIndex(a => a.employeeId.toLowerCase() === employeeId.toLowerCase() && a.date === date);
    const nowStr = formatDateTimeNow();

    if (existingIndex >= 0) {
      AppState.attendance[existingIndex].status = status;
      AppState.attendance[existingIndex].updatedAt = nowStr;
    } else {
      AppState.attendance.push({
        date: date,
        employeeId: employeeId,
        employeeName: employeeName,
        status: status,
        updatedAt: nowStr
      });
    }

    saveLocalData();
    showToast(`Marked ${employeeName} as ${status} on ${formatDateForDisplay(date)}`, 'success');

    // Sync to Google Apps Script if connected
    if (AppState.apiUrl) {
      sendGasRequest('updateAttendance', {
        date: date,
        employeeId: employeeId,
        employeeName: employeeName,
        status: status
      }).catch(err => console.error('Background GAS sync error:', err));
    }
  }

  renderApp();
}

function openBulkMarkModal() {
  const selectEmp = document.getElementById('bulkEmployeeSelect');
  if (selectEmp) {
    selectEmp.innerHTML = `
      <option value="ALL_ACTIVE">All Active Employees (${AppState.employees.filter(e=>e.status==='Active').length})</option>
      ${AppState.employees.map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('')}
    `;
  }

  // Default date to today or 1st of active month
  const bulkDateInput = document.getElementById('bulkDateInput');
  if (bulkDateInput) {
    const dayStr = String(new Date().getDate()).padStart(2, '0');
    const mStr = String(AppState.currentMonth).padStart(2, '0');
    bulkDateInput.value = `${AppState.currentYear}-${mStr}-${dayStr}`;
  }

  openModal('bulkMarkModal');
}

async function handleBulkMarkFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById('bulkDateInput').value;
  const status = document.getElementById('bulkStatusSelect').value;
  const target = document.getElementById('bulkEmployeeSelect').value;

  if (!date || !status) {
    showToast('Please select a valid date and status.', 'error');
    return;
  }

  let targets = [];
  if (target === 'ALL_ACTIVE') {
    targets = AppState.employees.filter(e => e.status === 'Active');
  } else {
    const emp = AppState.employees.find(e => e.id === target);
    if (emp) targets = [emp];
  }

  const updates = [];
  const nowStr = formatDateTimeNow();

  targets.forEach(emp => {
    // Avoid overriding active vacations if status is not vacation
    const activeVacation = AppState.vacations.find(v => v.employeeId.toLowerCase() === emp.id.toLowerCase() && date >= v.startDate && date <= v.endDate);
    if (activeVacation && status !== activeVacation.leaveType) {
      // Vacation takes priority, skipped from normal overwrite
      return;
    }

    const existingIndex = AppState.attendance.findIndex(a => a.employeeId.toLowerCase() === emp.id.toLowerCase() && a.date === date);
    if (existingIndex >= 0) {
      AppState.attendance[existingIndex].status = status;
      AppState.attendance[existingIndex].updatedAt = nowStr;
    } else {
      AppState.attendance.push({
        date: date,
        employeeId: emp.id,
        employeeName: emp.name,
        status: status,
        updatedAt: nowStr
      });
    }

    updates.push({
      date: date,
      employeeId: emp.id,
      employeeName: emp.name,
      status: status
    });
  });

  saveLocalData();
  closeAllModals();
  renderApp();
  showToast(`Bulk marked ${updates.length} employees as ${status} on ${formatDateForDisplay(date)}`, 'success');

  if (AppState.apiUrl && updates.length > 0) {
    sendGasRequest('bulkUpdateAttendance', { updates: updates })
      .catch(err => console.error('Bulk update GAS sync error:', err));
  }
}

// ==============================================================================
// 7. EMPLOYEE MANAGEMENT
// ==============================================================================

window.openAddEmployeeModal = function() {
  document.getElementById('employeeModalTitle').textContent = 'Add New Employee';
  document.getElementById('empFormId').value = '';
  document.getElementById('empFormId').readOnly = false;
  document.getElementById('empFormName').value = '';
  document.getElementById('empFormStatus').value = 'Active';
  openModal('employeeModal');
};

window.openEditEmployeeModal = function(id) {
  const emp = AppState.employees.find(e => e.id === id);
  if (!emp) return;

  document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
  document.getElementById('empFormId').value = emp.id;
  document.getElementById('empFormId').readOnly = true;
  document.getElementById('empFormName').value = emp.name;
  document.getElementById('empFormStatus').value = emp.status;
  openModal('employeeModal');
};

async function handleEmployeeFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('empFormId').value.trim().toUpperCase();
  const name = document.getElementById('empFormName').value.trim();
  const status = document.getElementById('empFormStatus').value;
  const isEdit = document.getElementById('empFormId').readOnly;

  if (!id || !name) {
    showToast('Employee ID and Name are required.', 'error');
    return;
  }

  if (isEdit) {
    const idx = AppState.employees.findIndex(e => e.id === id);
    if (idx >= 0) {
      AppState.employees[idx].name = name;
      AppState.employees[idx].status = status;
      saveLocalData();
      showToast(`Employee ${name} (${id}) updated successfully.`, 'success');
      
      if (AppState.apiUrl) {
        sendGasRequest('editEmployee', { id, name, status }).catch(console.error);
      }
    }
  } else {
    // Check duplicate
    if (AppState.employees.some(e => e.id === id)) {
      showToast(`Employee ID ${id} already exists.`, 'error');
      return;
    }

    const newEmp = { id, name, status, createdAt: formatDateKey(new Date()) };
    AppState.employees.push(newEmp);
    saveLocalData();
    showToast(`Employee ${name} (${id}) added successfully.`, 'success');

    if (AppState.apiUrl) {
      sendGasRequest('addEmployee', newEmp).catch(console.error);
    }
  }

  closeAllModals();
  renderApp();
}

window.toggleEmployeeStatus = async function(id) {
  const emp = AppState.employees.find(e => e.id === id);
  if (!emp) return;

  const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
  emp.status = newStatus;
  saveLocalData();
  renderApp();
  showToast(`Employee ${emp.name} marked as ${newStatus}.`, 'success');

  if (AppState.apiUrl) {
    sendGasRequest('deactivateEmployee', { id: id, status: newStatus }).catch(console.error);
  }
};

// ==============================================================================
// 8. VACATION MANAGEMENT (RULE 1 PRIORITY)
// ==============================================================================

window.openAddVacationModal = function() {
  const select = document.getElementById('vacationEmpSelect');
  if (select) {
    select.innerHTML = AppState.employees.map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('');
  }

  // Pre-fill dates for convenient entry
  const mStr = String(AppState.currentMonth).padStart(2, '0');
  document.getElementById('vacationStartInput').value = `${AppState.currentYear}-${mStr}-09`;
  document.getElementById('vacationEndInput').value = `${AppState.currentYear}-${mStr}-25`;
  document.getElementById('vacationTypeSelect').value = 'VIL';

  openModal('vacationModal');
};

async function handleVacationFormSubmit(e) {
  e.preventDefault();
  const empId = document.getElementById('vacationEmpSelect').value;
  const leaveType = document.getElementById('vacationTypeSelect').value || 'VIL';
  const startDate = document.getElementById('vacationStartInput').value;
  const endDate = document.getElementById('vacationEndInput').value;

  if (!empId || !startDate || !endDate) {
    showToast('Please fill all vacation fields.', 'error');
    return;
  }

  if (startDate > endDate) {
    showToast('Start Date cannot be after End Date.', 'error');
    return;
  }

  const empName = getEmployeeNameById(empId);
  const nowStr = formatDateTimeNow();

  const newVacation = {
    employeeId: empId,
    employeeName: empName,
    leaveType: leaveType,
    startDate: startDate,
    endDate: endDate,
    createdAt: nowStr
  };

  AppState.vacations.push(newVacation);
  saveLocalData();
  closeAllModals();
  renderApp();
  showToast(`Vacation period added for ${empName} (${startDate} to ${endDate}).`, 'success');

  if (AppState.apiUrl) {
    sendGasRequest('addVacation', newVacation).catch(console.error);
  }
}

window.deleteVacationRecord = async function(empId, startDate) {
  if (!confirm(`Are you sure you want to remove this vacation period?`)) return;

  AppState.vacations = AppState.vacations.filter(v => !(v.employeeId.toLowerCase() === empId.toLowerCase() && v.startDate === startDate));
  saveLocalData();
  renderApp();
  showToast(`Vacation period removed.`, 'success');

  if (AppState.apiUrl) {
    sendGasRequest('deleteVacation', { employeeId: empId, startDate: startDate }).catch(console.error);
  }
};

// ==============================================================================
// 9. HOLIDAY MANAGEMENT
// ==============================================================================

window.openAddHolidayModal = function() {
  const mStr = String(AppState.currentMonth).padStart(2, '0');
  document.getElementById('holidayDateInput').value = `${AppState.currentYear}-${mStr}-23`;
  document.getElementById('holidayNameInput').value = 'Company Holiday';
  openModal('holidayModal');
};

async function handleHolidayFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById('holidayDateInput').value;
  const name = document.getElementById('holidayNameInput').value.trim();

  if (!date || !name) {
    showToast('Date and Holiday Name are required.', 'error');
    return;
  }

  const existingIdx = AppState.holidays.findIndex(h => h.date === date);
  if (existingIdx >= 0) {
    AppState.holidays[existingIdx].holidayName = name;
  } else {
    AppState.holidays.push({
      date: date,
      holidayName: name,
      createdAt: formatDateTimeNow()
    });
  }

  saveLocalData();
  closeAllModals();
  renderApp();
  showToast(`Holiday "${name}" saved for ${formatDateForDisplay(date)}.`, 'success');

  if (AppState.apiUrl) {
    sendGasRequest('addHoliday', { date, holidayName: name }).catch(console.error);
  }
}

window.deleteHolidayRecord = async function(date) {
  if (!confirm(`Remove holiday on ${formatDateForDisplay(date)}?`)) return;

  AppState.holidays = AppState.holidays.filter(h => h.date !== date);
  saveLocalData();
  renderApp();
  showToast(`Holiday removed.`, 'success');

  if (AppState.apiUrl) {
    sendGasRequest('deleteHoliday', { date: date }).catch(console.error);
  }
};

// ==============================================================================
// 10. GOOGLE APPS SCRIPT API INTEGRATION
// ==============================================================================

async function sendGasRequest(action, payload = {}) {
  if (!AppState.apiUrl) return null;

  try {
    const url = AppState.apiUrl;
    const body = JSON.stringify({ action: action, ...payload });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // Text plain avoids unnecessary preflight blocking in Apps Script
      },
      body: body
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`GAS API Error (${action}):`, error);
    throw error;
  }
}

async function syncWithGoogleAppsScript(showToastFeedback = false) {
  if (!AppState.apiUrl) {
    if (showToastFeedback) showToast('Please enter your Google Apps Script URL in Settings first.', 'warning');
    return;
  }

  AppState.isLoading = true;
  updateConnectionBadge(false, 'Syncing...');

  try {
    const fetchUrl = `${AppState.apiUrl}${AppState.apiUrl.includes('?') ? '&' : '?'}action=getAllData&year=${AppState.currentYear}&month=${AppState.currentMonth}`;
    const response = await fetch(fetchUrl);
    const result = await response.json();

    if (result && result.success && result.data) {
      AppState.isConnected = true;
      const data = result.data;

      if (Array.isArray(data.employees) && data.employees.length > 0) {
        AppState.employees = data.employees;
      }
      if (Array.isArray(data.attendance)) {
        AppState.attendance = data.attendance;
      }
      if (Array.isArray(data.vacations)) {
        AppState.vacations = data.vacations;
      }
      if (Array.isArray(data.holidays)) {
        AppState.holidays = data.holidays;
      }
      if (data.settings && typeof data.settings === 'object') {
        AppState.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      }

      saveLocalData();
      updateConnectionBadge(true, 'Google Apps Script Live');
      if (showToastFeedback) showToast('Data synchronized successfully with Google Sheets!', 'success');
      renderApp();
    } else {
      throw new Error(result.message || 'Invalid API response format');
    }
  } catch (err) {
    console.warn('Sync failed, continuing with local store:', err);
    AppState.isConnected = false;
    updateConnectionBadge(false, 'Live Sync Error (Using Local)');
    if (showToastFeedback) showToast(`Sync issue: ${err.message}. Using local storage.`, 'error');
  } finally {
    AppState.isLoading = false;
  }
}

async function testGasConnection() {
  const urlInput = document.getElementById('gasApiUrlInput');
  const testUrl = urlInput ? urlInput.value.trim() : '';

  if (!testUrl) {
    showToast('Please enter a Web App URL to test.', 'error');
    return;
  }

  showToast('Testing Google Apps Script connection...', 'info');

  try {
    const pingUrl = `${testUrl}${testUrl.includes('?') ? '&' : '?'}action=ping`;
    const res = await fetch(pingUrl);
    const json = await res.json();

    if (json && json.success) {
      showToast('Connection verified! Google Apps Script is responding correctly.', 'success');
      AppState.apiUrl = testUrl;
      localStorage.setItem(STORAGE_KEYS.API_URL, testUrl);
      AppState.isConnected = true;
      updateConnectionBadge(true, 'Google Apps Script Live');
      syncWithGoogleAppsScript(false);
    } else {
      showToast(`Connected but received error: ${json.message || 'Unknown'}`, 'warning');
    }
  } catch (err) {
    showToast(`Connection failed. Check Web App URL & deployment permissions. (${err.message})`, 'error');
  }
}

function handleGasSettingsSubmit(e) {
  e.preventDefault();
  const url = document.getElementById('gasApiUrlInput').value.trim();
  AppState.apiUrl = url;
  localStorage.setItem(STORAGE_KEYS.API_URL, url);

  if (url) {
    showToast('Web App URL saved. Syncing data...', 'success');
    syncWithGoogleAppsScript(true);
  } else {
    showToast('Web App URL cleared. Switched to Local Demo Mode.', 'info');
    updateConnectionBadge(false, 'Local Demo Mode');
  }
}

function copyGasScript() {
  const code = document.getElementById('gasCodeText')?.innerText;
  if (!code) return;

  navigator.clipboard.writeText(code).then(() => {
    showToast('Google Apps Script (Code.gs) copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Unable to auto-copy. Please select and copy manually.', 'warning');
  });
}

// ==============================================================================
// 11. CSV EXPORT & PRINT
// ==============================================================================

function exportToCsv() {
  const monthDays = getMonthDays(AppState.currentYear, AppState.currentMonth);
  const monthName = getMonthName(AppState.currentMonth);
  
  // Headers
  const headerRow = [
    'Employee ID',
    'Employee Name',
    'Status',
    ...monthDays.map(d => `${d.day} (${d.dayName})`),
    'Present (P)',
    'Sick Leave (SL)',
    'Loss of Pay (LOP)',
    'Vacation (VIL)',
    'Holiday (H)',
    'Payable Days'
  ];

  const rows = [headerRow];

  AppState.employees.forEach(emp => {
    let p = 0, sl = 0, lop = 0, vil = 0, hol = 0;
    const dayValues = [];

    monthDays.forEach(day => {
      const res = calculateAttendanceStatus(emp.id, day.date, day);
      const st = normalizeStatus(res.status);
      dayValues.push(st);

      if (st === 'P') p++;
      else if (st === 'SL') sl++;
      else if (st === 'LOP' || st === 'A') lop++;
      else if (st === 'VIL') vil++;
      else if (st === 'H') hol++;
    });

    const payable = p + sl + vil + hol;

    rows.push([
      `"${emp.id}"`,
      `"${emp.name}"`,
      `"${emp.status}"`,
      ...dayValues.map(v => `"${v}"`),
      p,
      sl,
      lop,
      vil,
      hol,
      payable
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Attendance_${monthName}_${AppState.currentYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Exported ${monthName} ${AppState.currentYear} attendance to CSV.`, 'success');
}

function printRegister() {
  window.print();
}

// ==============================================================================
// 12. UTILITIES & TOAST (Strict 3-Second Timeout)
// ==============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none;border:none;color:#FFF;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // Exact 3.0 second lifetime
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 3000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  AppState.activeCellTarget = null;
}

function getMonthName(monthNumber) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthNumber - 1] || '';
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  return dateStr;
}

function formatDateKey(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') {
    const parts = dateObj.trim().split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
      return `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
    }
    return dateObj;
  }
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateTimeNow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hr = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hr}:${min}`;
}

function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

function getEmployeeNameById(id) {
  const emp = AppState.employees.find(e => e.id.toLowerCase() === String(id).toLowerCase());
  return emp ? emp.name : id;
}
