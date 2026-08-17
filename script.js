/**
 * ==============================================================================
 * TEAM LOGIN/LOGOUT ATTENDANCE TRACKING WEB APP - FRONTEND CLIENT SCRIPT
 * ==============================================================================
 * 
 * Communicates with Google Apps Script API via fetch()
 * Persistent Storage: Google Sheets (via Google Apps Script Web App)
 * Timezone: Asia/Dubai
 */

// 1. Google Apps Script Web App URL
// REQUIRED: Replace the string below with your deployed Apps Script Web App URL
// (Extensions > Apps Script > Deploy > New deployment > Web app > copy the URL).
// This makes the app work for every visitor by default. Admins can still override
// it per-browser from the Admin > Settings tab if ever needed.
const API_URL = "https://script.google.com/macros/s/AKfycbw0oHqg1cUfZobMeIP84mkQ2LSzSFubl37ROjyHqA67xRB4aAGbP7UKhsXPvHqIVRqIpA/exec";

// Local storage keys
const STORAGE_KEY_TOKEN = "team_att_token";
const STORAGE_KEY_USER = "team_att_user";
const STORAGE_KEY_CUSTOM_URL = "team_att_apps_script_url";

/**
 * Get active API URL (checks custom override from UI or constant)
 */
function getApiUrl() {
  const customUrl = localStorage.getItem(STORAGE_KEY_CUSTOM_URL);
  if (customUrl && customUrl.trim().startsWith("https://script.google.com")) {
    return customUrl.trim();
  }
  return API_URL;
}

/**
 * Check if a real Google Apps Script endpoint is connected
 */
function isConfiguredUrl() {
  const url = getApiUrl();
  return url && url !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL" && url.startsWith("https://script.google.com");
}

/**
 * ==============================================================================
 * API CLIENT WITH SIMULATOR FALLBACK FOR PREVIEW TESTING
 * ==============================================================================
 */

/**
 * Make an API request to Google Apps Script backend
 */
async function apiCall(action, payload = {}, token = null) {
  const authToken = token || getStoredToken();
  const url = getApiUrl();

  const requestBody = {
    action: action,
    token: authToken,
    ...payload
  };

  // If real Apps Script URL is provided, execute real HTTP fetch
  if (isConfiguredUrl()) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8", // prevents CORS preflight issues with Apps Script
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (!data.success && response.status === 401) {
        clearAuthSession();
        if (!window.location.pathname.endsWith("index.html") && !window.location.pathname.endsWith("/")) {
          window.location.href = "index.html";
        }
      }
      return data;
    } catch (err) {
      console.error("API call failed, testing fallback if applicable:", err);
      // If network fails (e.g. CORS or misconfigured URL), surface informative error
      return {
        success: false,
        error: `Could not reach Google Apps Script Web App: ${err.message}. Please verify Web App deployment permissions (Who has access: Anyone).`
      };
    }
  }

  // Built-in Browser Simulator (Used when YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL is not yet replaced)
  // Ensures all features, forms, roles, timers, and validations can be tested immediately in preview
  return mockAppsScriptEngine(action, requestBody);
}

/**
 * ==============================================================================
 * SESSION & AUTHENTICATION STORAGE HELPERS
 * ==============================================================================
 */

function getStoredToken() {
  return sessionStorage.getItem(STORAGE_KEY_TOKEN) || localStorage.getItem(STORAGE_KEY_TOKEN);
}

function getStoredUser() {
  const userJson = sessionStorage.getItem(STORAGE_KEY_USER) || localStorage.getItem(STORAGE_KEY_USER);
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
  sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}

function clearAuthSession() {
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  sessionStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);
}

/**
 * ==============================================================================
 * PAGE CONTROLLER 1: LOGIN PAGE (index.html)
 * ==============================================================================
 */

function initLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const employeeIdInput = document.getElementById("employeeId");
  const passwordInput = document.getElementById("password");
  const togglePassBtn = document.getElementById("togglePasswordBtn");
  const loginBtn = document.getElementById("loginSubmitBtn");
  const loginSpinner = document.getElementById("loginBtnSpinner");
  const loginBtnText = document.getElementById("loginBtnText");
  const errorAlert = document.getElementById("loginErrorAlert");
  const errorMessageText = document.getElementById("loginErrorMessage");
  const configAlert = document.getElementById("appsScriptBanner");

  // Show status banner if preview simulation is active
  if (configAlert) {
    if (!isConfiguredUrl()) {
      configAlert.style.display = "block";
    } else {
      configAlert.style.display = "none";
    }
  }

  // Quick 1-Click Login buttons for instant testing
  const quickAdminBtn = document.getElementById("quickLoginAdminBtn");
  const quickEmpBtn = document.getElementById("quickLoginEmpBtn");
  if (quickAdminBtn) {
    quickAdminBtn.addEventListener("click", () => {
      if (employeeIdInput) employeeIdInput.value = "ADMIN001";
      if (passwordInput) passwordInput.value = "AdminPassword@123";
      if (loginForm) loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  }
  if (quickEmpBtn) {
    quickEmpBtn.addEventListener("click", () => {
      if (employeeIdInput) employeeIdInput.value = "EMP001";
      if (passwordInput) passwordInput.value = "pass123";
      if (loginForm) loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  }

  // Check if user is already logged in with a valid session
  const token = getStoredToken();
  if (token) {
    apiCall("getCurrentSession", {}, token).then(res => {
      if (res && res.success && res.employee) {
        if (res.employee.role === "Admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "dashboard.html";
        }
      } else {
        clearAuthSession();
      }
    }).catch(() => clearAuthSession());
  }

  // Toggle Password visibility
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePassBtn.innerHTML = isPassword ? `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>` : `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
    });
  }

  // Handle Login submission
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const employeeId = (employeeIdInput.value || "").trim();
      const password = passwordInput.value || "";

      if (!employeeId || !password) {
        showLoginError("Please enter both Employee ID and password.");
        return;
      }

      // Hide previous errors & show loading
      hideLoginError();
      setButtonLoading(loginBtn, loginSpinner, loginBtnText, true, "Verifying...");

      try {
        const response = await apiCall("login", {
          employeeId: employeeId,
          password: password
        });

        if (response && response.success) {
          // Store token and verified employee details
          setAuthSession(response.token, response.employee);

          // Role-based redirection from verified server role
          if (response.employee.role === "Admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "dashboard.html";
          }
        } else {
          showLoginError(response.error || "Invalid Employee ID or password");
        }
      } catch (err) {
        showLoginError("Connection failed. Please check your network or Apps Script configuration.");
      } finally {
        setButtonLoading(loginBtn, loginSpinner, loginBtnText, false, "Sign In");
      }
    });
  }

  function showLoginError(msg) {
    if (errorAlert && errorMessageText) {
      errorMessageText.textContent = msg;
      errorAlert.style.display = "flex";
    }
  }

  function hideLoginError() {
    if (errorAlert) {
      errorAlert.style.display = "none";
    }
  }
}

/**
 * ==============================================================================
 * PAGE CONTROLLER 2: EMPLOYEE DASHBOARD (dashboard.html)
 * ==============================================================================
 */

let workingTimerInterval = null;
let activeSessionStartTime = null;

async function initDashboardPage() {
  let token = getStoredToken();
  if (!token && !isConfiguredUrl()) {
    // In local simulation preview mode, provide default employee session
    token = "tok_EMP001_" + Date.now();
    setAuthSession(token, { id: "EMP001", name: "John Doe", role: "Employee" });
  } else if (!token) {
    window.location.href = "index.html";
    return;
  }

  // UI Elements
  const empNameDisplay = document.getElementById("welcomeEmpName");
  const empIdDisplay = document.getElementById("welcomeEmpId");
  const navUserName = document.getElementById("navUserName");
  const navUserRole = document.getElementById("navUserRole");
  const navUserAvatar = document.getElementById("navUserAvatar");
  const statusBadge = document.getElementById("statusBadge");
  const statusLoginDate = document.getElementById("statusLoginDate");
  const statusLoginTime = document.getElementById("statusLoginTime");
  const timerDigits = document.getElementById("timerDigits");
  const timerSubtext = document.getElementById("timerSubtext");
  const logoutBtn = document.getElementById("logoutBtn");
  const attendanceTbody = document.getElementById("employeeAttendanceTbody");
  const emptyAttendanceBox = document.getElementById("emptyAttendanceBox");
  const historyLoading = document.getElementById("historyLoading");
  const adminNavSwitch = document.getElementById("adminNavSwitch");

  // Logout Modal Elements
  const logoutModal = document.getElementById("logoutConfirmModal");
  const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
  const confirmLogoutSpinner = document.getElementById("confirmLogoutSpinner");

  // 1. Setup Logout Confirmation Modal Handlers
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (logoutModal) logoutModal.classList.add("open");
    });
  }

  if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener("click", () => {
      if (logoutModal) logoutModal.classList.remove("open");
    });
  }

  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener("click", async () => {
      confirmLogoutBtn.disabled = true;
      if (confirmLogoutSpinner) confirmLogoutSpinner.style.display = "inline-block";

      try {
        const res = await apiCall("logout");
        if (res && res.success) {
          if (workingTimerInterval) clearInterval(workingTimerInterval);
          showToast(res.message || "Logged out successfully!", "success");
          clearAuthSession();
          setTimeout(() => {
            window.location.href = "index.html";
          }, 600);
        } else {
          showToast(res.error || "Logout failed. Please try again.", "error");
          confirmLogoutBtn.disabled = false;
          if (confirmLogoutSpinner) confirmLogoutSpinner.style.display = "none";
        }
      } catch (e) {
        showToast("Logout error: " + e.message, "error");
        confirmLogoutBtn.disabled = false;
        if (confirmLogoutSpinner) confirmLogoutSpinner.style.display = "none";
      }
    });
  }

  // Direct Nav Sign Out
  const navSignOutBtn = document.getElementById("navSignOutBtn");
  if (navSignOutBtn) {
    navSignOutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearAuthSession();
      window.location.href = "index.html";
    });
  }

  // 2. Fetch current session and employee identity
  try {
    const res = await apiCall("getCurrentSession");

    if (res && res.success && res.employee) {
      const emp = res.employee;
      if (empNameDisplay) empNameDisplay.textContent = emp.name;
      if (empIdDisplay) empIdDisplay.textContent = emp.id;
      if (navUserName) navUserName.textContent = emp.name;
      if (navUserRole) navUserRole.textContent = emp.role;
      if (navUserAvatar) navUserAvatar.textContent = emp.name.charAt(0).toUpperCase();

      // Show Admin Link if user is Admin
      if (adminNavSwitch && emp.role === "Admin") {
        adminNavSwitch.style.display = "inline-flex";
      }

      // Update Status Card
      if (res.activeSession && res.activeSession.status === "Logged In") {
        if (statusBadge) {
          statusBadge.className = "badge badge-logged-in";
          statusBadge.innerHTML = `<span class="badge-dot"></span> Logged In`;
        }
        if (statusLoginDate) statusLoginDate.textContent = formatDisplayDate(res.activeSession.loginDate);
        if (statusLoginTime) statusLoginTime.textContent = formatDisplayTime(res.activeSession.loginTime);

        // Start Live Timer
        startWorkingTimer(res.activeSession.loginDate, res.activeSession.loginTime, timerDigits, timerSubtext);
        if (logoutBtn) {
          logoutBtn.disabled = false;
          logoutBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg> Logout Now
          `;
        }
      } else {
        // Not logged in currently
        if (statusBadge) {
          statusBadge.className = "badge badge-logged-out";
          statusBadge.innerHTML = `<span class="badge-dot"></span> Logged Out`;
        }
        if (res.lastSession) {
          if (statusLoginDate) statusLoginDate.textContent = formatDisplayDate(res.lastSession.logoutDate || res.lastSession.loginDate);
          if (statusLoginTime) statusLoginTime.textContent = formatDisplayTime(res.lastSession.logoutTime || "-");
        } else {
          if (statusLoginDate) statusLoginDate.textContent = "-";
          if (statusLoginTime) statusLoginTime.textContent = "-";
        }

        if (timerDigits) timerDigits.textContent = res.lastSession ? (res.lastSession.workingHours || "00:00:00") : "00:00:00";
        if (timerSubtext) timerSubtext.textContent = "Session completed";
        if (logoutBtn) {
          logoutBtn.disabled = true;
          logoutBtn.textContent = "Currently Logged Out";
        }
      }
    }
  } catch (err) {
    showToast("Failed to load session details", "error");
  }

  // 3. Load Attendance History for this Employee
  loadMyAttendance();

  async function loadMyAttendance() {
    if (historyLoading) historyLoading.style.display = "block";
    try {
      const res = await apiCall("getMyAttendance");
      if (historyLoading) historyLoading.style.display = "none";

      if (res && res.success && res.records && res.records.length > 0) {
        if (emptyAttendanceBox) emptyAttendanceBox.style.display = "none";
        renderEmployeeAttendanceRows(res.records, attendanceTbody);
      } else {
        if (attendanceTbody) attendanceTbody.innerHTML = "";
        if (emptyAttendanceBox) emptyAttendanceBox.style.display = "block";
      }
    } catch (err) {
      if (historyLoading) historyLoading.style.display = "none";
      showToast("Error loading attendance history", "error");
    }
  }
}

/**
 * Render Employee Attendance History Rows
 */
function renderEmployeeAttendanceRows(records, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";

  records.forEach(rec => {
    const tr = document.createElement("tr");
    const isLogged = rec.status === "Logged In";
    const statusBadgeHtml = isLogged
      ? `<span class="badge badge-logged-in"><span class="badge-dot"></span> Logged In</span>`
      : `<span class="badge badge-logged-out"><span class="badge-dot"></span> Logged Out</span>`;

    tr.innerHTML = `
      <td><strong>${formatDisplayDate(rec.loginDate)}</strong></td>
      <td>${formatDisplayTime(rec.loginTime)}</td>
      <td>${rec.logoutTime ? formatDisplayTime(rec.logoutTime) : '<span style="color:var(--text-muted)">-</span>'}</td>
      <td><strong>${rec.workingHours || (isLogged ? '<span style="color:var(--primary)">In Progress</span>' : '-')}</strong></td>
      <td>${statusBadgeHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Live Working Timer
 */
function startWorkingTimer(loginDateStr, loginTimeStr, timerEl, subtextEl) {
  if (workingTimerInterval) clearInterval(workingTimerInterval);
  if (!timerEl) return;

  // Compute start timestamp
  const loginIso = `${loginDateStr}T${loginTimeStr}`;
  let startMs = new Date(loginIso).getTime();
  if (isNaN(startMs)) {
    startMs = Date.now();
  }

  function update() {
    const nowMs = Date.now();
    let diffMs = nowMs - startMs;
    if (diffMs < 0) diffMs = 0;

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    timerEl.textContent = formatted;
    if (subtextEl) subtextEl.textContent = "Live duration (Server Asia/Dubai)";
  }

  update();
  workingTimerInterval = setInterval(update, 1000);
}

/**
 * ==============================================================================
 * PAGE CONTROLLER 3: ADMIN DASHBOARD (admin.html)
 * ==============================================================================
 */

async function initAdminPage() {
  let token = getStoredToken();
  if (!token && !isConfiguredUrl()) {
    // In local simulation preview mode, provide default admin session
    token = "tok_ADMIN001_" + Date.now();
    setAuthSession(token, { id: "ADMIN001", name: "Company Admin", role: "Admin" });
  } else if (!token) {
    window.location.href = "index.html";
    return;
  }

  // UI Elements
  const navAdminName = document.getElementById("adminNavName");
  const navAdminAvatar = document.getElementById("adminNavAvatar");
  const pageTitleEl = document.getElementById("adminPageTitle");
  const statTotalEmployees = document.getElementById("statTotalEmployees");
  const statCurrentlyLoggedIn = document.getElementById("statCurrentlyLoggedIn");
  const statTotalLoggedOut = document.getElementById("statTotalLoggedOut");
  const statTotalWorkingHours = document.getElementById("statTotalWorkingHours");
  const adminAttendanceTbody = document.getElementById("adminAttendanceTbody");
  const adminEmployeesTbody = document.getElementById("adminEmployeesTbody");

  // Filters
  const searchInput = document.getElementById("attendanceSearchInput");
  const dateFilterInput = document.getElementById("attendanceDateFilter");
  const statusFilterSelect = document.getElementById("attendanceStatusFilter");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const refreshAttendanceBtn = document.getElementById("refreshAttendanceBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const openSheetBtn = document.getElementById("openGoogleSheetBtn");

  // Navigation Tabs in Admin
  const tabButtons = document.querySelectorAll(".admin-nav-tab");
  const tabSections = document.querySelectorAll(".admin-tab-section");

  // Title map for tabs
  const tabTitles = {
    dashboard: "Live Dashboard Overview",
    attendance: "Attendance Logs",
    employees: "Employee Directory",
    reports: "Setup & Configuration"
  };

  // 1. Tab Switching Logic (Attached immediately)
  tabButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute("data-tab");
      if (!targetTab) return;

      tabButtons.forEach(b => b.classList.remove("active"));
      tabSections.forEach(s => {
        s.style.display = "none";
      });

      btn.classList.add("active");
      const activeSec = document.getElementById(`tabSection_${targetTab}`);
      if (activeSec) {
        activeSec.style.display = "block";
      }

      if (pageTitleEl && tabTitles[targetTab]) {
        pageTitleEl.textContent = tabTitles[targetTab];
      }

      if (targetTab === "dashboard") loadDashboardStats();
      if (targetTab === "attendance") loadAllAttendance();
      if (targetTab === "employees") loadEmployees();
      if (targetTab === "reports") loadSystemInfo();
    });
  });

  // Logout Handler
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      clearAuthSession();
      showToast("Signed out successfully", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 400);
    });
  }

  // Modals
  const addEmpModal = document.getElementById("addEmployeeModal");
  const addEmpBtn = document.getElementById("openAddEmployeeModalBtn");
  const addEmpForm = document.getElementById("addEmployeeForm");
  const closeAddEmpModal = document.getElementById("closeAddEmployeeModalBtn");

  const changePassModal = document.getElementById("changePasswordModal");
  const changePassForm = document.getElementById("changePasswordForm");
  const closePassModal = document.getElementById("closePasswordModalBtn");
  const passEmpLabel = document.getElementById("modalPasswordEmpLabel");
  const passEmpIdInput = document.getElementById("modalPasswordEmpId");

  const editEmpModal = document.getElementById("editEmployeeModal");
  const editEmpForm = document.getElementById("editEmployeeForm");
  const closeEditEmpModal = document.getElementById("closeEditEmployeeModalBtn");
  const editEmpIdInput = document.getElementById("editEmpId");
  const editEmpNameInput = document.getElementById("editEmpName");
  const editEmpRoleSelect = document.getElementById("editEmpRole");
  const editEmpActiveSelect = document.getElementById("editEmpActive");

  // 2. Server-Side Role Verification
  try {
    const authCheck = await apiCall("getCurrentSession");
    if (authCheck && authCheck.success && authCheck.employee) {
      if (authCheck.employee.role !== "Admin") {
        showToast("Access Denied: Admin authorization required.", "error");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 800);
        return;
      }
      if (navAdminName) navAdminName.textContent = authCheck.employee.name;
      if (navAdminAvatar) navAdminAvatar.textContent = authCheck.employee.name.charAt(0).toUpperCase();
    }
  } catch (e) {
    // In fallback mode, continue
  }

  // Initial Data Load
  loadDashboardStats();
  loadAllAttendance();
  loadEmployees();
  loadSystemInfo();

  // Load Dashboard Summary Cards
  async function loadDashboardStats() {
    try {
      const res = await apiCall("getDashboardStats");
      if (res && res.success && res.stats) {
        if (statTotalEmployees) statTotalEmployees.textContent = res.stats.totalActiveEmployees;
        if (statCurrentlyLoggedIn) statCurrentlyLoggedIn.textContent = res.stats.currentlyLoggedIn;
        if (statTotalLoggedOut) statTotalLoggedOut.textContent = res.stats.totalLoggedOutToday;
        if (statTotalWorkingHours) statTotalWorkingHours.textContent = res.stats.totalWorkingHoursToday;
      }
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  }

  // Load All Attendance with Filters
  let currentAttendanceRecords = [];
  async function loadAllAttendance() {
    if (adminAttendanceTbody) {
      adminAttendanceTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;"><span class="spinner spinner-primary"></span> Loading attendance data...</td></tr>`;
    }

    try {
      const payload = {
        search: searchInput ? searchInput.value : "",
        date: dateFilterInput ? dateFilterInput.value : "",
        status: statusFilterSelect ? statusFilterSelect.value : "All"
      };

      const res = await apiCall("getAllAttendance", payload);
      if (res && res.success) {
        currentAttendanceRecords = res.records || [];
        renderAdminAttendanceRows(currentAttendanceRecords, adminAttendanceTbody);
      } else {
        showToast(res.error || "Failed to load attendance", "error");
      }
    } catch (e) {
      showToast("Error loading attendance data", "error");
    }
  }

  function renderAdminAttendanceRows(records, tbody) {
    if (!tbody) return;
    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">No attendance records found matching the criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    records.forEach(rec => {
      const tr = document.createElement("tr");
      const isLogged = rec.status === "Logged In";
      const statusBadgeHtml = isLogged
        ? `<span class="badge badge-logged-in"><span class="badge-dot"></span> Logged In</span>`
        : `<span class="badge badge-logged-out"><span class="badge-dot"></span> Logged Out</span>`;

      tr.innerHTML = `
        <td><strong style="color:var(--primary);">${escapeHtml(rec.employeeId)}</strong></td>
        <td><strong>${escapeHtml(rec.employeeName)}</strong></td>
        <td>${formatDisplayDate(rec.loginDate)}</td>
        <td>${formatDisplayTime(rec.loginTime)}</td>
        <td>${rec.logoutDate ? formatDisplayDate(rec.logoutDate) : "-"}</td>
        <td>${rec.logoutTime ? formatDisplayTime(rec.logoutTime) : "-"}</td>
        <td><strong>${rec.workingHours || (isLogged ? '<span style="color:var(--primary)">In Progress</span>' : '-')}</strong></td>
        <td>${statusBadgeHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Load Employees
  async function loadEmployees() {
    if (adminEmployeesTbody) {
      adminEmployeesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;"><span class="spinner spinner-primary"></span> Loading employees...</td></tr>`;
    }

    try {
      const res = await apiCall("getEmployees");
      if (res && res.success) {
        renderAdminEmployeeRows(res.employees || [], adminEmployeesTbody);
      } else {
        showToast(res.error || "Failed to load employees", "error");
      }
    } catch (e) {
      showToast("Error loading employees", "error");
    }
  }

  function renderAdminEmployeeRows(employees, tbody) {
    if (!tbody) return;
    if (!employees || employees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No employees found.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    employees.forEach(emp => {
      const tr = document.createElement("tr");
      const roleBadge = emp.role === "Admin"
        ? `<span class="badge badge-role-admin">Admin</span>`
        : `<span class="badge badge-role-employee">Employee</span>`;

      const activeBadge = emp.active
        ? `<span class="badge badge-active"><span class="badge-dot"></span> Active</span>`
        : `<span class="badge badge-inactive"><span class="badge-dot"></span> Inactive</span>`;

      const toggleActionText = emp.active ? "Deactivate" : "Activate";
      const toggleActionClass = emp.active ? "btn-outline" : "btn-secondary";

      tr.innerHTML = `
        <td><strong>${escapeHtml(emp.employeeId)}</strong></td>
        <td>${escapeHtml(emp.employeeName)}</td>
        <td>${roleBadge}</td>
        <td>${activeBadge}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm edit-emp-btn" data-id="${escapeHtml(emp.employeeId)}" data-name="${escapeHtml(emp.employeeName)}" data-role="${escapeHtml(emp.role)}" data-active="${emp.active}">Edit</button>
            <button class="btn btn-secondary btn-sm change-pass-btn" data-id="${escapeHtml(emp.employeeId)}" data-name="${escapeHtml(emp.employeeName)}">Change Password</button>
            <button class="btn ${toggleActionClass} btn-sm toggle-status-btn" data-id="${escapeHtml(emp.employeeId)}" data-active="${emp.active}">${toggleActionText}</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach Event Handlers to dynamically generated employee row buttons
    tbody.querySelectorAll(".edit-emp-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        const role = btn.getAttribute("data-role");
        const active = btn.getAttribute("data-active") === "true";

        if (editEmpIdInput) editEmpIdInput.value = id;
        if (editEmpNameInput) editEmpNameInput.value = name;
        if (editEmpRoleSelect) editEmpRoleSelect.value = role;
        if (editEmpActiveSelect) editEmpActiveSelect.value = active ? "true" : "false";

        if (editEmpModal) editEmpModal.classList.add("open");
      });
    });

    tbody.querySelectorAll(".change-pass-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");

        if (passEmpIdInput) passEmpIdInput.value = id;
        if (passEmpLabel) passEmpLabel.textContent = `Employee: ${id} - ${name}`;

        const newPassInput = document.getElementById("newEmployeePassword");
        if (newPassInput) newPassInput.value = "";

        if (changePassModal) changePassModal.classList.add("open");
      });
    });

    tbody.querySelectorAll(".toggle-status-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const currentActive = btn.getAttribute("data-active") === "true";
        const actionLabel = currentActive ? "deactivate" : "activate";

        if (confirm(`Are you sure you want to ${actionLabel} employee ${id}?`)) {
          try {
            const res = await apiCall("toggleEmployeeStatus", { employeeId: id, active: !currentActive });
            if (res && res.success) {
              showToast(res.message || `Employee status updated`, "success");
              loadEmployees();
              loadDashboardStats();
            } else {
              showToast(res.error || "Failed to update status", "error");
            }
          } catch (e) {
            showToast("Error updating status", "error");
          }
        }
      });
    });
  }

  // Filter Listeners
  if (searchInput) searchInput.addEventListener("input", debounce(loadAllAttendance, 300));
  if (dateFilterInput) dateFilterInput.addEventListener("change", loadAllAttendance);
  if (statusFilterSelect) statusFilterSelect.addEventListener("change", loadAllAttendance);
  if (refreshAttendanceBtn) refreshAttendanceBtn.addEventListener("click", loadAllAttendance);
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (dateFilterInput) dateFilterInput.value = "";
      if (statusFilterSelect) statusFilterSelect.value = "All";
      loadAllAttendance();
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      if (!currentAttendanceRecords || currentAttendanceRecords.length === 0) {
        showToast("No attendance records to export", "info");
        return;
      }

      const headers = ["Record ID", "Employee ID", "Employee Name", "Login Date", "Login Time", "Logout Date", "Logout Time", "Working Hours", "Status"];
      const rows = currentAttendanceRecords.map(r => [
        r.recordId,
        r.employeeId,
        `"${(r.employeeName || "").replace(/"/g, '""')}"`,
        r.loginDate,
        r.loginTime,
        r.logoutDate || "",
        r.logoutTime || "",
        r.workingHours || "",
        r.status
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Attendance_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Attendance records exported to CSV", "success");
    });
  }

  // Open Google Sheet
  async function loadSystemInfo() {
    try {
      const res = await apiCall("getSystemInfo");
      if (res && res.success && res.spreadsheetUrl && openSheetBtn) {
        openSheetBtn.href = res.spreadsheetUrl;
        openSheetBtn.target = "_blank";
        openSheetBtn.style.display = "inline-flex";
      }
    } catch (e) {
      // ignore
    }
  }

  // Add Employee Modal Handlers
  if (addEmpBtn && addEmpModal) {
    addEmpBtn.addEventListener("click", () => {
      if (addEmpForm) addEmpForm.reset();
      addEmpModal.classList.add("open");
    });
  }
  if (closeAddEmpModal && addEmpModal) {
    closeAddEmpModal.addEventListener("click", () => addEmpModal.classList.remove("open"));
  }

  if (addEmpForm) {
    addEmpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = document.getElementById("newEmpId").value.trim();
      const empName = document.getElementById("newEmpName").value.trim();
      const empPass = document.getElementById("newEmpPassword").value;
      const empRole = document.getElementById("newEmpRole").value;
      const empActive = document.getElementById("newEmpActive").value === "true";

      const submitBtn = document.getElementById("submitAddEmpBtn");
      submitBtn.disabled = true;

      try {
        const res = await apiCall("addEmployee", {
          employeeId: empId,
          employeeName: empName,
          password: empPass,
          role: empRole,
          active: empActive
        });

        if (res && res.success) {
          showToast(res.message || "Employee created successfully!", "success");
          addEmpModal.classList.remove("open");
          loadEmployees();
          loadDashboardStats();
        } else {
          showToast(res.error || "Failed to create employee", "error");
        }
      } catch (err) {
        showToast("Error adding employee: " + err.message, "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Edit Employee Form
  if (closeEditEmpModal && editEmpModal) {
    closeEditEmpModal.addEventListener("click", () => editEmpModal.classList.remove("open"));
  }
  if (editEmpForm) {
    editEmpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = editEmpIdInput.value;
      const empName = editEmpNameInput.value.trim();
      const empRole = editEmpRoleSelect.value;
      const empActive = editEmpActiveSelect.value === "true";

      try {
        const res = await apiCall("updateEmployee", {
          employeeId: empId,
          employeeName: empName,
          role: empRole,
          active: empActive
        });

        if (res && res.success) {
          showToast(res.message || "Employee updated successfully!", "success");
          editEmpModal.classList.remove("open");
          loadEmployees();
          loadDashboardStats();
        } else {
          showToast(res.error || "Failed to update employee", "error");
        }
      } catch (err) {
        showToast("Error updating employee: " + err.message, "error");
      }
    });
  }

  // Change Password Form
  if (closePassModal && changePassModal) {
    closePassModal.addEventListener("click", () => changePassModal.classList.remove("open"));
  }
  if (changePassForm) {
    changePassForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = passEmpIdInput.value;
      const newPass = document.getElementById("newEmployeePassword").value;

      if (!newPass || newPass.length < 4) {
        showToast("Password must be at least 4 characters", "error");
        return;
      }

      try {
        const res = await apiCall("changePassword", {
          employeeId: empId,
          newPassword: newPass
        });

        if (res && res.success) {
          showToast(res.message || "Password updated successfully!", "success");
          changePassModal.classList.remove("open");
        } else {
          showToast(res.error || "Failed to change password", "error");
        }
      } catch (err) {
        showToast("Error updating password: " + err.message, "error");
      }
    });
  }

  // Apps Script Setup URL Configurator in Admin
  initSettingsTab();
}

/**
 * Admin Settings / Apps Script Connection Configurator
 */
function initSettingsTab() {
  const urlInput = document.getElementById("appsScriptUrlInput");
  const saveUrlBtn = document.getElementById("saveAppsScriptUrlBtn");
  const testUrlBtn = document.getElementById("testAppsScriptUrlBtn");
  const copyScriptBtn = document.getElementById("copyCodeGsBtn");

  if (urlInput) {
    urlInput.value = localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || (API_URL !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL" ? API_URL : "");
  }

  if (saveUrlBtn && urlInput) {
    saveUrlBtn.addEventListener("click", () => {
      const val = urlInput.value.trim();
      if (val) {
        localStorage.setItem(STORAGE_KEY_CUSTOM_URL, val);
        showToast("Google Apps Script Web App URL saved!", "success");
      } else {
        localStorage.removeItem(STORAGE_KEY_CUSTOM_URL);
        showToast("Reset to default configuration", "info");
      }
    });
  }

  if (testUrlBtn && urlInput) {
    testUrlBtn.addEventListener("click", async () => {
      const val = urlInput.value.trim();
      if (!val) {
        showToast("Please enter a Google Apps Script Web App URL first", "error");
        return;
      }

      testUrlBtn.disabled = true;
      testUrlBtn.textContent = "Testing...";

      try {
        const res = await fetch(val + "?action=health");
        const data = await res.json();
        if (data && data.status === "ok") {
          showToast(`Connected successfully to "${data.spreadsheetName || 'Spreadsheet'}" (Timezone: ${data.timezone})`, "success");
        } else {
          showToast("Received response, but status was not OK. Verify Code.gs setup.", "warning");
        }
      } catch (e) {
        showToast("Connection failed: " + e.message, "error");
      } finally {
        testUrlBtn.disabled = false;
        testUrlBtn.textContent = "Test Connection";
      }
    });
  }

  if (copyScriptBtn) {
    copyScriptBtn.addEventListener("click", () => {
      const scriptCodeEl = document.getElementById("codeGsViewer");
      if (scriptCodeEl) {
        navigator.clipboard.writeText(scriptCodeEl.textContent).then(() => {
          showToast("Code.gs copied to clipboard!", "success");
        });
      }
    });
  }
}

/**
 * ==============================================================================
 * BROWSER SIMULATOR ENGINE (Zero-setup instant preview testing)
 * ==============================================================================
 */
function mockAppsScriptEngine(action, payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const EMP_KEY = "mock_gs_employees";
      const ATT_KEY = "mock_gs_attendance";

      // Initialize default mock data if empty
      if (!localStorage.getItem(EMP_KEY)) {
        const initialEmployees = [
          { id: "ADMIN001", name: "Company Admin", hash: "v1$salt1$adminpass", role: "Admin", active: true },
          { id: "EMP001", name: "John Doe", hash: "v1$salt2$pass123", role: "Employee", active: true },
          { id: "EMP002", name: "Sarah Smith", hash: "v1$salt3$pass123", role: "Employee", active: true }
        ];
        localStorage.setItem(EMP_KEY, JSON.stringify(initialEmployees));
      }

      if (!localStorage.getItem(ATT_KEY)) {
        const initialAttendance = [
          {
            recordId: "rec-001",
            employeeId: "EMP001",
            employeeName: "John Doe",
            loginDate: "2026-08-16",
            loginTime: "09:00:15",
            logoutDate: "2026-08-16",
            logoutTime: "17:30:45",
            workingHours: "8:30",
            status: "Logged Out"
          },
          {
            recordId: "rec-002",
            employeeId: "EMP002",
            employeeName: "Sarah Smith",
            loginDate: "2026-08-16",
            loginTime: "08:45:00",
            logoutDate: "2026-08-16",
            logoutTime: "17:15:20",
            workingHours: "8:30",
            status: "Logged Out"
          }
        ];
        localStorage.setItem(ATT_KEY, JSON.stringify(initialAttendance));
      }

      const employees = JSON.parse(localStorage.getItem(EMP_KEY) || "[]");
      const attendance = JSON.parse(localStorage.getItem(ATT_KEY) || "[]");

      // Current Asia/Dubai Server Time formatting
      const now = new Date();
      // Format to Dubai UTC+4
      const dubaiOffset = 4 * 60; // minutes
      const localOffset = now.getTimezoneOffset();
      const dubaiTime = new Date(now.getTime() + (dubaiOffset + localOffset) * 60000);

      const serverDateStr = dubaiTime.toISOString().slice(0, 10);
      const serverTimeStr = dubaiTime.toTimeString().slice(0, 8);

      switch (action) {
        case "login": {
          const empId = (payload.employeeId || "").trim();
          const pass = payload.password || "";
          
          const match = employees.find(e => e.id.toLowerCase() === empId.toLowerCase());
          if (!match) {
            return resolve({ success: false, error: "Invalid Employee ID or password" });
          }
          if (!match.active) {
            return resolve({ success: false, error: "Account is deactivated. Please contact your Administrator." });
          }

          // Check if password matches (support standard preview passwords or any password if simple)
          const validPass = (match.id === "ADMIN001" && (pass === "AdminPassword@123" || pass === "admin" || pass === "admin123")) ||
                            (pass === "pass123" || pass === "password" || pass === "123456" || match.hash.includes(pass) || pass.length >= 4);

          if (!validPass) {
            return resolve({ success: false, error: "Invalid Employee ID or password" });
          }

          // Check active session
          const activeSess = attendance.find(a => a.employeeId.toLowerCase() === match.id.toLowerCase() && a.status === "Logged In");
          let currentSession = null;
          let alreadyLoggedIn = false;

          if (activeSess) {
            alreadyLoggedIn = true;
            currentSession = activeSess;
          } else {
            currentSession = {
              recordId: "REC-" + Date.now().toString(36).toUpperCase(),
              employeeId: match.id,
              employeeName: match.name,
              loginDate: serverDateStr,
              loginTime: serverTimeStr,
              logoutDate: "",
              logoutTime: "",
              workingHours: "",
              status: "Logged In"
            };
            attendance.push(currentSession);
            localStorage.setItem(ATT_KEY, JSON.stringify(attendance));
          }

          const token = "tok_" + match.id + "_" + Date.now();
          return resolve({
            success: true,
            message: alreadyLoggedIn ? "You are already logged in." : "Login successful.",
            token: token,
            employee: { id: match.id, name: match.name, role: match.role },
            currentSession: currentSession,
            alreadyLoggedIn: alreadyLoggedIn,
            serverDate: serverDateStr,
            serverTime: serverTimeStr,
            timezone: "Asia/Dubai"
          });
        }

        case "getCurrentSession": {
          const token = payload.token || "";
          const parts = token.split("_");
          const empId = parts[1] || "EMP001";
          const match = employees.find(e => e.id.toLowerCase() === empId.toLowerCase()) || employees[0];

          const activeSess = attendance.find(a => a.employeeId.toLowerCase() === match.id.toLowerCase() && a.status === "Logged In");
          const lastSess = attendance.slice().reverse().find(a => a.employeeId.toLowerCase() === match.id.toLowerCase() && a.status === "Logged Out");

          return resolve({
            success: true,
            employee: { id: match.id, name: match.name, role: match.role },
            activeSession: activeSess || null,
            lastSession: lastSess || null,
            serverDate: serverDateStr,
            serverTime: serverTimeStr,
            timezone: "Asia/Dubai"
          });
        }

        case "logout": {
          const token = payload.token || "";
          const parts = token.split("_");
          const empId = parts[1] || "";
          
          const record = attendance.slice().reverse().find(a => a.employeeId.toLowerCase() === empId.toLowerCase() && a.status === "Logged In");
          if (record) {
            record.logoutDate = serverDateStr;
            record.logoutTime = serverTimeStr;
            
            // Calc hours
            const start = new Date(`${record.loginDate}T${record.loginTime}`).getTime();
            const end = new Date(`${serverDateStr}T${serverTimeStr}`).getTime();
            let diffMins = Math.floor((end - start) / 60000);
            if (isNaN(diffMins) || diffMins < 0) diffMins = 5;
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            record.workingHours = `${h}:${m < 10 ? '0' : ''}${m}`;
            record.status = "Logged Out";

            localStorage.setItem(ATT_KEY, JSON.stringify(attendance));
            return resolve({
              success: true,
              message: "Logged out successfully.",
              record: record,
              workingHours: record.workingHours
            });
          }
          return resolve({ success: true, message: "Logged out." });
        }

        case "getMyAttendance": {
          const token = payload.token || "";
          const parts = token.split("_");
          const empId = parts[1] || "";
          const records = attendance.filter(a => a.employeeId.toLowerCase() === empId.toLowerCase()).reverse();
          return resolve({ success: true, employeeId: empId, records: records });
        }

        case "getDashboardStats": {
          const activeEmployees = employees.filter(e => e.active).length;
          const currentlyLoggedIn = attendance.filter(a => a.status === "Logged In").length;
          const todayLoggedOut = attendance.filter(a => a.loginDate === serverDateStr && a.status === "Logged Out").length;

          let totalMins = 0;
          attendance.filter(a => a.loginDate === serverDateStr && a.status === "Logged Out").forEach(a => {
            if (a.workingHours) {
              const [h, m] = a.workingHours.split(":").map(Number);
              totalMins += (h * 60) + (m || 0);
            }
          });
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;

          return resolve({
            success: true,
            stats: {
              totalActiveEmployees: activeEmployees,
              totalEmployees: employees.length,
              currentlyLoggedIn: currentlyLoggedIn,
              totalLoggedOutToday: todayLoggedOut,
              totalWorkingHoursToday: `${h}h ${m < 10 ? '0' : ''}${m}m`,
              todayDate: serverDateStr,
              timezone: "Asia/Dubai"
            }
          });
        }

        case "getAllAttendance": {
          let recs = attendance.slice().reverse();
          if (payload.date) recs = recs.filter(r => r.loginDate === payload.date);
          if (payload.status && payload.status !== "All") recs = recs.filter(r => r.status === payload.status);
          if (payload.search) {
            const s = payload.search.toLowerCase();
            recs = recs.filter(r => r.employeeId.toLowerCase().includes(s) || r.employeeName.toLowerCase().includes(s));
          }
          return resolve({ success: true, records: recs });
        }

        case "getEmployees": {
          const safeList = employees.map(e => ({
            employeeId: e.id,
            employeeName: e.name,
            role: e.role,
            active: e.active
          }));
          return resolve({ success: true, employees: safeList });
        }

        case "addEmployee": {
          const id = (payload.employeeId || "").trim();
          const name = (payload.employeeName || "").trim();
          const pass = payload.password || "";
          const role = payload.role || "Employee";
          const active = payload.active !== false;

          if (employees.find(e => e.id.toLowerCase() === id.toLowerCase())) {
            return resolve({ success: false, error: `Employee ID "${id}" already exists.` });
          }

          employees.push({
            id: id,
            name: name,
            hash: "v1$salt$" + pass,
            role: role,
            active: active
          });
          localStorage.setItem(EMP_KEY, JSON.stringify(employees));
          return resolve({ success: true, message: "Employee created successfully." });
        }

        case "updateEmployee": {
          const id = (payload.employeeId || "").trim();
          const emp = employees.find(e => e.id.toLowerCase() === id.toLowerCase());
          if (!emp) return resolve({ success: false, error: "Employee not found." });

          if (payload.employeeName) emp.name = payload.employeeName.trim();
          if (payload.role) emp.role = payload.role;
          if (payload.active !== undefined) emp.active = payload.active;

          localStorage.setItem(EMP_KEY, JSON.stringify(employees));
          return resolve({ success: true, message: "Employee updated successfully." });
        }

        case "toggleEmployeeStatus": {
          const id = (payload.employeeId || "").trim();
          const emp = employees.find(e => e.id.toLowerCase() === id.toLowerCase());
          if (!emp) return resolve({ success: false, error: "Employee not found." });

          emp.active = payload.active !== undefined ? payload.active : !emp.active;
          localStorage.setItem(EMP_KEY, JSON.stringify(employees));
          return resolve({ success: true, message: `Status updated to ${emp.active ? 'Active' : 'Inactive'}.`, active: emp.active });
        }

        case "changePassword": {
          const id = (payload.employeeId || "").trim();
          const newPass = payload.newPassword || "";
          const emp = employees.find(e => e.id.toLowerCase() === id.toLowerCase());
          if (!emp) return resolve({ success: false, error: "Employee not found." });

          emp.hash = "v1$salt$" + newPass;
          localStorage.setItem(EMP_KEY, JSON.stringify(employees));
          return resolve({ success: true, message: `Password updated for employee ${id}.` });
        }

        case "getSystemInfo": {
          return resolve({
            success: true,
            spreadsheetUrl: "https://docs.google.com/spreadsheets",
            spreadsheetName: "Team Attendance Database",
            timezone: "Asia/Dubai"
          });
        }

        default:
          return resolve({ success: false, error: "Unknown action" });
      }
    }, 150);
  });
}

/**
 * ==============================================================================
 * UTILITY HELPERS
 * ==============================================================================
 */

function formatDisplayDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const parts = String(dateStr).split("-");
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return "-";
  try {
    const parts = String(timeStr).split(":");
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      h = h ? h : 12;
      return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
    }
    return timeStr;
  } catch (e) {
    return timeStr;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setButtonLoading(btn, spinner, textEl, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
  if (textEl) textEl.textContent = text;
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Floating Toast Notification
 */
function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}
