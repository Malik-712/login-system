# نظام متابعة الأسر — Family Requirements Tracker

A lightweight, Arabic-first (RTL) web app for running a student program organized
into **families** (الأسر). Admins publish time-boxed **requirements** (المتطلبات);
students complete them; supervisors track their family's progress; guardians follow
their child — all backed by Google Sheets, with no server to maintain.

- **Frontend:** a single static page (HTML/CSS/JS), hosted on **Netlify**.
- **Backend:** a **Google Apps Script** web app (`doPost` JSON API).
- **Data store:** a **Google Sheet** (one tab per entity).

---

## Table of contents

- [Roles](#roles)
- [Architecture](#architecture)
- [Data model (sheets)](#data-model-sheets)
- [Backend API](#backend-api)
- [Setup &amp; deployment](#setup--deployment)
- [Known limitations](#known-limitations)

---

## Roles

The role is derived **server-side** from which sheet an ID is found in — the
frontend can never claim a role it doesn't have.

| Role | Arabic | Can do |
| --- | --- | --- |
| Student | **طالب** | See their active requirements (todo list with countdowns), mark them done, view their family members' status, and browse their own full history (`السجل`). |
| Supervisor | **مشرف** | Monitor their assigned family: overall completion chart, each student's per‑requirement detail (`الطلاب`), and the family's historical log (`سجل الأسرة`). |
| Admin | **مسؤول** | Create families, assign a supervisor and students to each, create requirements, view an all‑families overview, and check every account's activation status (`إدارة الحسابات`). |
| Guardian | **ولي أمر** | See **only** their own child's overall completion summary. |

**Authentication flow:** a user enters their 6‑digit ID → the backend reports
whether it's an account or a guardian ID and whether it's activated → first‑time
accounts set their name + a 4‑digit password (activation); returning accounts log
in; guardians are recognized by their guardian ID. Sessions persist in
`localStorage`.

---

## Architecture

```text
┌──────────────────────────┐        POST (JSON, text/plain)        ┌───────────────────────────┐
│  Static frontend          │  ───────────────────────────────▶   │  Google Apps Script       │
│  (index.html / style.css  │                                       │  Code.js  →  doPost(e)    │
│   / script.js) on Netlify │  ◀───────────────────────────────    │  (web app /exec endpoint) │
└──────────────────────────┘        JSON response                  └────────────┬──────────────┘
                                                                                 │
                                                                                 ▼
                                                                     ┌───────────────────────────┐
                                                                     │  Google Sheet (data store)│
                                                                     │  one tab per entity       │
                                                                     └───────────────────────────┘
```

- The frontend calls a single `SCRIPT_URL` with `{ "action": "...", ... }` and
  renders the JSON response. There is **one round trip per screen**; successful
  read responses are cached client‑side for the session (any write clears the
  cache) so switching between tabs that reuse the same data is instant.
- The backend reads each sheet **once per request** (cached in memory) and batches
  writes, to keep Apps Script latency down.
- Hijri dates use the **Umm al‑Qura** calendar via `Intl` on both sides, so what
  the admin picks, what's stored, and the computed status all agree.

---

## Data model (sheets)

All sheets have a header row. "Account sheets" (`الطلاب`, `المشرفين`, `مسؤولون`)
share the same first 8 columns.

### `الطلاب` — Students

| # | Column | Notes |
| --- | --- | --- |
| 1 | معرف (ID) | 6‑digit, unique |
| 2 | الدور (Role) | `الطلاب` |
| 3 | الاسم الأول (First name) | set on activation |
| 4 | الاسم الأخير (Last name) | set on activation |
| 5 | كلمة المرور (Password) | 4 digits, plaintext (by design) |
| 6 | حالة الحساب (Status) | `نعم` = activated |
| 7 | تاريخ الإنشاء (Created) | set on activation |
| 8 | آخر دخول (Last login) | |
| 9 | معرف ولي الأمر (Guardian ID) | pulled from the `IDs` pool on activation |
| 10 | اسم الأسرة (Family name) | the one family this student belongs to |

### `المشرفين` — Supervisors &nbsp;·&nbsp; `مسؤولون` — Admins

| # | Column |
| --- | --- |
| 1 | معرف (ID) |
| 2 | الدور (Role) — `المشرفين` / `مسؤولون` |
| 3 | الاسم الأول (First name) |
| 4 | الاسم الأخير (Last name) |
| 5 | كلمة المرور (Password) |
| 6 | حالة الحساب (Status) |
| 7 | تاريخ الإنشاء (Created) |
| 8 | آخر دخول (Last login) |

### `الأسر` — Families

| # | Column | Notes |
| --- | --- | --- |
| 1 | اسم الأسرة (Name) | unique key — there is no numeric family ID |
| 2 | معرف المشرف (Supervisor ID) | references `المشرفين` |
| 3 | تاريخ الإنشاء (Created) | |

### `المتطلبات` — Requirements

| # | Column | Notes |
| --- | --- | --- |
| 1 | رقم المتطلب (Number) | sequential, starts at 101 |
| 2 | نوع المحتوى (Content type) | kept blank — link vs. text is auto‑detected on display |
| 3 | المحتوى (Content) | plain text or a URL |
| 4 | نظام التاريخ (Date system) | `هجري` / `ميلادي` |
| 5 | تاريخ البداية (Start date) | text `YYYY/MM/DD` in the chosen system |
| 6 | وقت البداية (Start time) | text `hh:mm صباحاً/مساءً` |
| 7 | تاريخ النهاية (End date) | text |
| 8 | وقت النهاية (End time) | text |
| 9 | يشمل المشرفين (Include supervisors) | `نعم` / `لا` |
| 10 | تاريخ الإنشاء (Created) | |
| 11 | أنشأه (Created by) | the admin's full name |

### `الإنجازات` — Completions

| # | Column |
| --- | --- |
| 1 | رقم المتطلب (Requirement number) |
| 2 | معرف المستخدم (User ID) |
| 3 | تاريخ الإنجاز (Completed at) |

### `IDs` — Guardian‑ID pool

A fixed pool of pre‑generated 6‑digit guardian IDs in **`A82:A141`** (60 values).
On student activation, the first unused value is assigned as that student's
guardian ID.

---

## Backend API

Every call is `POST` with a JSON body `{ "action": "<name>", ... }`. Admin/supervisor
actions **verify the caller's role server‑side** against the sheets — a role or ID
claim from the client is never trusted.

### Auth

| Action | Params | Who | Returns |
| --- | --- | --- | --- |
| `checkId` | `id` | anyone | `{ type: "account", role, activated }` · `{ type: "guardian" }` · error |
| `activate` | `id, firstName, lastName, password` | unactivated account | `{ role, guardianId? }` (guardianId for students only) |
| `login` | `id, password` | activated account | `{ role, firstName, lastName }` |
| `guardianLogin` | `id` | guardian ID | `{ role: "ولي أمر", studentFirstName, studentLastName }` |

### Families (admin only)

| Action | Params | Returns |
| --- | --- | --- |
| `createFamily` | `adminId, name` | success / duplicate error |
| `assignSupervisorToFamily` | `adminId, familyName, supervisorId` | success |
| `assignStudentToFamily` | `adminId, studentId, familyName` | success (rejects if the student is already in a family) |
| `removeStudentFromFamily` | `adminId, studentId` | clears the student's family |
| `listSupervisors` | `adminId` | supervisors who are **activated and not yet assigned** to any family (name + id) |
| `listStudents` | `adminId` | **activated** students with their current family |
| `listAllAccounts` | `adminId` | every account across all three sheets with activation status |
| `listFamiliesOverview` | `adminId` | each family: name, supervisor name, students, overall completion % |

### Requirements &amp; progress

| Action | Params | Who | Returns |
| --- | --- | --- | --- |
| `createRequirement` | `adminId, content, dateSystem, startDate, startTime, endDate, endTime, includeSupervisors` | admin | `{ requirementNumber }` |
| `listRequirementsForUser` | `id` | any account | that user's **active** requirements (`قادم`/`نشط` only — expired ones drop off) with status, start/end timestamps, and whether completed |
| `completeRequirement` | `userId, requirementNumber` | student / supervisor | records a completion — rejected if the requirement's window isn't open |
| `getFamilyProgress` | `supervisorId` | supervisor | the supervisor's family, its requirements (with status), and each student's per‑requirement completion |
| `getFamilyMembersSimpleStatus` | `studentId` | student | family name + supervisor + each member's done/not‑done for today's requirements |
| `getStudentRecord` | `studentId` | student | the student's full history grouped by date |
| `getChildProgress` | `guardianId[, studentId]` | guardian | only the linked child's overall completion summary |

**Requirement status** (`قادم` upcoming · `نشط` active · `منتهي` expired) is computed
from the server clock vs. the stored start/end window. Expired requirements are
hidden from home lists but remain in the history (`السجل`). Remaining time is shown
as a single floored unit (e.g. `باقي لها 3 أيام`, `باقي لها 6 ساعات`, or
`أقل من ساعة`).

---

## Setup &amp; deployment

### Prerequisites

- Node.js + [`@google/clasp`](https://github.com/google/clasp) (`npm i -g @google/clasp`)
- A Google account with the target Sheet and Apps Script project
- A Netlify account (or any static host)

### Backend (Google Apps Script)

The backend lives in `Code.js` (+ `appsscript.json`) and is pushed with `clasp`.

```bash
clasp login                 # once
clasp push --force          # upload Code.js + appsscript.json
# Deploy to the existing web-app deployment (keeps the same /exec URL):
clasp deploy --deploymentId <DEPLOYMENT_ID> --description "…"
```

> **Note:** `clasp push` updates the code, but the production `/exec` URL serves a
> *versioned* deployment — you must `clasp deploy` (updating the same deployment
> ID) for changes to go live. A `.claspignore` keeps the frontend files out of the
> Apps Script project.

### Frontend (Netlify)

The frontend is static — just `index.html`, `style.css`, `script.js`, and
`favicon.svg`. Point the frontend at the web app by setting `SCRIPT_URL` at the top
of `script.js` to your deployment's `/exec` URL.

```bash
git add .
git commit -m "…"
git push        # Netlify builds & publishes on push
```

No build step is required.

---

## Known limitations

- **Plaintext passwords, by design.** Passwords are 4‑digit and stored as text in
  the sheet. This is intentional for a low‑stakes internal tool — do not reuse
  these credentials anywhere sensitive.
- **Link/text content only — no file uploads.** Requirement content is a plain
  string; if it looks like a URL it's rendered as a link, otherwise as text.
- **Apps Script latency.** Each request carries the platform's inherent web‑app
  overhead (a `/exec` redirect + execution spin‑up) of a few seconds. The app
  minimizes this by reading each sheet once per request and caching read responses
  client‑side, but it can't be eliminated.
- **Hijri = Umm al‑Qura via `Intl`.** Dates depend on the platform's calendar data;
  both frontend and backend use the same source to stay consistent.
- **One family per student.** Enforced server‑side; a student must be removed from
  their current family before joining another.
- **Small scale.** The single‑sheet, read‑everything model suits classroom‑sized
  data; it is not built for tens of thousands of rows.
