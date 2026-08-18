# Deploying Team Attendance Tracker to GitHub Pages + your Google Sheet

Your Google Sheet already has the right structure (Employees / Attendance / Settings
tabs with the correct headers), and `Code.gs` is already written to read/write that exact
structure. You just need to connect the two pieces and publish the static files.

## 1. Connect Code.gs to YOUR Google Sheet

1. Open your existing Google Sheet (the one with Employees / Attendance / Settings tabs).
2. Go to **Extensions > Apps Script**.
3. Delete any placeholder code and paste in the contents of `Code.gs` from this folder.
4. In the function dropdown at the top, select `setup` and click **Run**.
   - This is safe to run even though your sheets already exist — it only creates
     headers if a sheet is empty, it will not touch or duplicate your existing data.
5. If you don't have an admin account in the Employees sheet yet, select `createAdmin`
   and click **Run** (edit the parameters in the code, or just run it as-is to get the
   defaults `ADMIN001` / `AdminPassword@123` — change this password after first login).
6. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy**, authorize the permissions it asks for, then copy the **Web app URL**
   (looks like `https://script.google.com/macros/s/XXXXXXXX/exec`).

## 2. Point the website at your Web App URL

Open `script.js` in this folder and replace this line near the top:

```js
const API_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
```

with your real URL, e.g.:

```js
const API_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```

This makes every visitor's browser talk directly to your Apps Script, which reads and
writes rows in your Google Sheet. (There is also an "Apps Script URL" field inside the
Admin > Settings tab in the app itself — that's just a per-browser override for testing;
hardcoding it in `script.js` is what makes it work for everyone by default.)

## 3. Push to GitHub and enable Pages

1. Create a new GitHub repo and push the contents of this `web` folder to it
   (`index.html`, `admin.html`, `dashboard.html`, `script.js`, `style.css`).
2. In the repo, go to **Settings > Pages**.
3. Under "Build and deployment", set Source to **Deploy from a branch**, branch **main**,
   folder **/ (root)**. Save.
4. GitHub will give you a URL like `https://yourusername.github.io/your-repo-name/`.
   That's your live site — `index.html` is the employee/admin login page.

No build step, no Node/Vite needed — these are plain static files, and Apps Script
handles CORS for you already.

## Notes on access control

- Regular employees can only log in/out and see their own attendance history
  (`getMyAttendance`) — enforced server-side in `Code.gs`.
- Every admin-only action (`getEmployees`, `addEmployee`, `updateEmployee`,
  `deactivateEmployee`, `getAllAttendance`, `getDashboardStats`, `changePassword`) is
  gated by `ensureAdmin(auth)`, which checks the `Role` column for the logged-in
  session and rejects with 403 if it isn't `Admin`. You don't need to change anything
  here — it's already admin-restricted.
- To promote/demote someone, just change their `Role` cell in the Employees sheet to
  `Admin` or `Employee` (or use the Admin UI's Edit Employee action, which does the
  same thing through `updateEmployee`).
