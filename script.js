const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw0gDByt3iDBcFaBJDVUWZEY-BkMx2ApTLWpt6zKYRaZCxqzyDyEQKGdqfoaFLUGb19dg/exec";

const STUDENTS = "الطلاب";
const SUPERVISORS = "المشرفين";
const ADMINS = "مسؤولون";
const ROLE_LABELS = {
  [STUDENTS]: "طالب",
  [SUPERVISORS]: "مشرف",
  [ADMINS]: "مسؤول",
};

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const SESSION_KEY = "loginSession";

let currentId = "";
let currentSession = null;

// ===== Cached DOM references =====
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const appGreeting = document.getElementById("appGreeting");
const appRole = document.getElementById("appRole");
const appViewTitle = document.getElementById("appViewTitle");
const appContent = document.getElementById("appContent");

const roleLabelEl = document.getElementById("roleLabel");
const msg = document.getElementById("msg");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const steps = [step1, step2, step3];

const idForm = document.getElementById("idForm");
const activateForm = document.getElementById("activateForm");
const loginForm = document.getElementById("loginForm");

const idInput = document.getElementById("idInput");
const firstNameInput = document.getElementById("firstNameInput");
const lastNameInput = document.getElementById("lastNameInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const passwordInput = document.getElementById("passwordInput");

const idSubmitBtn = idForm.querySelector('button[type="submit"]');
const activateSubmitBtn = activateForm.querySelector('button[type="submit"]');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

const menuButton = document.getElementById("menuButton");
const menuOverlay = document.getElementById("menuOverlay");
const menuPanel = document.getElementById("menuPanel");
const menuList = document.getElementById("menuList");
const logoutButton = document.getElementById("logoutButton");

// ===== Small helpers =====
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function range(a, b) {
  const r = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function fullName(first, last) {
  return ((first || "") + " " + (last || "")).trim();
}

function isAssignedFamily(family) {
  return family !== "" && family !== null && family !== undefined;
}

// Auto-detect whether content is a URL. Returns a safe href, or null (plain text).
function contentUrl(content) {
  const s = String(content == null ? "" : content).trim();
  if (!s || /\s/.test(s)) return null;
  if (/^https?:\/\/\S+$/i.test(s)) return s;
  if (/^www\.\S+$/i.test(s)) return "https://" + s;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(s)) return "https://" + s;
  return null;
}

// ===== Hijri (Umm al-Qura) via Intl — matches the backend =====
function gregorianToHijri(date) {
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
    year: "numeric", month: "numeric", day: "numeric",
  });
  const o = {};
  fmt.formatToParts(date).forEach((p) => {
    if (p.type === "year") o.hy = Number(p.value);
    else if (p.type === "month") o.hm = Number(p.value);
    else if (p.type === "day") o.hd = Number(p.value);
  });
  return o;
}

// Current moment as { dateStr:"YYYY/MM/DD", timeStr:"hh:mm صباحاً/مساءً" }.
function nowValue(system) {
  const now = new Date();
  let h = now.getHours();
  const period = h < 12 ? "صباحاً" : "مساءً";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const timeStr = pad2(h12) + ":" + pad2(now.getMinutes()) + " " + period;
  let dateStr;
  if (system === "هجري") {
    const hj = gregorianToHijri(now);
    dateStr = hj.hy + "/" + pad2(hj.hm) + "/" + pad2(hj.hd);
  } else {
    dateStr = now.getFullYear() + "/" + pad2(now.getMonth() + 1) + "/" + pad2(now.getDate());
  }
  return { dateStr, timeStr };
}

function parseDateStr(dateStr) {
  const p = String(dateStr || "").split("/");
  return { y: p[0] || "", mo: p[1] || "", d: p[2] || "" };
}

function parseTimeStr(timeStr) {
  const t = String(timeStr || "");
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return {
    hour: m ? pad2(Number(m[1])) : "06",
    minute: m ? pad2(Number(m[2])) : "00",
    period: t.indexOf("مساء") !== -1 ? "مساءً" : "صباحاً",
  };
}

// ===== Countdown: single largest whole unit, floored, never rounded up =====
function pluralAr(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return n + " " + few;
  return n + " " + many;
}

function countdownText(endTs) {
  if (endTs == null) return "";
  const ms = endTs - Date.now();
  if (ms <= 0) return "";
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return "باقي لها " + pluralAr(days, "يوم", "يومان", "أيام", "يوماً");
  if (hours >= 1) return "باقي لها " + pluralAr(hours, "ساعة", "ساعتان", "ساعات", "ساعة");
  return "أقل من ساعة";
}

function statusBadge(status) {
  if (!status) return null;
  const cls = status === "نشط" ? "active" : status === "قادم" ? "upcoming" : "expired";
  return el("span", "status-badge " + cls, status);
}

// ===== Session persistence =====
function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    /* storage unavailable */
  }
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    /* ignore */
  }
}

function validSession(s) {
  if (!s || !s.id) return false;
  if (s.kind === "guardian") return true;
  if (s.kind === "account") return !!(s.role && s.firstName && s.lastName);
  return false;
}

// ===== Role helpers =====
function roleKey(session) {
  if (session.kind === "guardian") return "guardian";
  if (session.role === STUDENTS) return "student";
  if (session.role === SUPERVISORS) return "supervisor";
  if (session.role === ADMINS) return "admin";
  return null;
}

function roleDisplay(session) {
  if (session.kind === "guardian") return "ولي أمر";
  return ROLE_LABELS[session.role] || session.role;
}

function greetingText(session) {
  if (session.kind === "guardian") return "أهلاً بك";
  return "أهلاً " + fullName(session.firstName, session.lastName);
}

// ===== API =====
function callApi(payload) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  }).then((res) => res.json());
}

// Backend requests are slow (~seconds), so cache successful read responses for
// the session. Switching between tabs that reuse the same data (e.g. a
// supervisor's home/الطلاب/سجل, all getFamilyProgress) then costs nothing.
// Any write (completing a requirement, admin actions, logout) clears it.
const __apiCache = {};
function cachedCall(payload) {
  const key = JSON.stringify(payload);
  if (Object.prototype.hasOwnProperty.call(__apiCache, key)) {
    return Promise.resolve(__apiCache[key]);
  }
  return callApi(payload).then((r) => {
    if (r && r.success) __apiCache[key] = r;
    return r;
  });
}
function clearApiCache() {
  for (const k in __apiCache) delete __apiCache[k];
}

function submitRequest(button, payload, onSuccess) {
  button.disabled = true;
  return callApi(payload)
    .then((result) => {
      if (!result.success) {
        showMsg(result.message, "error");
        return;
      }
      return onSuccess(result);
    })
    .catch(() => showMsg("حدث خطأ، حاول مرة أخرى", "error"))
    .finally(() => {
      button.disabled = false;
    });
}

// ===== Auth UI =====
function showStep(step) {
  for (let i = 0; i < steps.length; i++) steps[i].classList.remove("active");
  step.classList.add("active");
}

function showMsg(text, type) {
  msg.textContent = text;
  msg.className = type ? "msg-" + type : "";
}

function setRole(text) {
  if (text) {
    roleLabelEl.textContent = "الدور: " + text;
    roleLabelEl.hidden = false;
  } else {
    roleLabelEl.textContent = "";
    roleLabelEl.hidden = true;
  }
}

function showAuthView() {
  appView.hidden = true;
  authView.hidden = false;
  menuButton.hidden = true;
  closeMenu();
}

function goToStep1() {
  currentId = "";
  idInput.value = "";
  setRole("");
  showMsg("", "");
  showStep(step1);
  showAuthView();
}

// ===== App shell =====
function enterApp(session) {
  currentSession = session;
  saveSession(session);

  appGreeting.textContent = greetingText(session);
  appRole.textContent = "الدور: " + roleDisplay(session);

  setRole("");
  showMsg("", "");

  const rk = roleKey(session);
  buildMenuForRole(rk);

  authView.hidden = true;
  appView.hidden = false;
  menuButton.hidden = false;

  const menu = MENUS[rk] || [];
  if (menu.length) navigateTo(menu[0].view);
}

function setContent(node) {
  appContent.textContent = "";
  appContent.appendChild(node);
}

function loadingNode() {
  return el("div", "loading", "جارِ التحميل...");
}

function errorNode(message) {
  return el("div", "view-error", message || "تعذّر تحميل البيانات");
}

function loadInto(payload, onSuccess) {
  setContent(loadingNode());
  cachedCall(payload)
    .then((result) => {
      if (!result || !result.success) {
        setContent(errorNode(result && result.message));
        return;
      }
      onSuccess(result);
    })
    .catch(() => setContent(errorNode("حدث خطأ، حاول مرة أخرى")));
}

// ===== Menus & routing =====
const MENUS = {
  student: [
    { label: "الصفحة الرئيسية", view: "studentHome" },
    { label: "الأسرة", view: "studentFamily" },
    { label: "السجل", view: "studentRecord" },
  ],
  supervisor: [
    { label: "الصفحة الرئيسية", view: "supervisorHome" },
    { label: "الطلاب", view: "supervisorStudents" },
    { label: "سجل الأسرة", view: "supervisorLog" },
  ],
  admin: [
    { label: "الصفحة الرئيسية", view: "adminHome" },
    { label: "إدارة الأسر", view: "adminFamilies" },
    { label: "إدارة المتطلبات", view: "adminRequirements" },
    { label: "إدارة الحسابات", view: "adminAccounts" },
  ],
  guardian: [{ label: "الصفحة الرئيسية", view: "guardianHome" }],
};

function buildMenuForRole(rk) {
  menuList.textContent = "";
  const items = MENUS[rk] || [];
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    const li = el("li");
    const btn = el("button", "menu-item", item.label);
    btn.type = "button";
    btn.addEventListener("click", () => {
      navigateTo(item.view);
      closeMenu();
    });
    li.appendChild(btn);
    frag.appendChild(li);
  });
  menuList.appendChild(frag);
}

// Home tabs all show the "الصفحة الرئيسية" heading; other tabs show their name.
const VIEWS = {
  studentHome: { title: "الصفحة الرئيسية", render: renderStudentHome },
  studentFamily: { title: "الأسرة", render: renderStudentFamily },
  studentRecord: { title: "السجل", render: renderStudentRecord },
  supervisorHome: { title: "الصفحة الرئيسية", render: renderSupervisorHome },
  supervisorStudents: { title: "الطلاب", render: renderSupervisorStudents },
  supervisorLog: { title: "سجل الأسرة", render: renderSupervisorLog },
  adminHome: { title: "الصفحة الرئيسية", render: renderAdminHome },
  adminFamilies: { title: "إدارة الأسر", render: renderAdminFamilies },
  adminRequirements: { title: "إدارة المتطلبات", render: renderAdminRequirements },
  adminAccounts: { title: "إدارة الحسابات", render: renderAdminAccounts },
  guardianHome: { title: "الصفحة الرئيسية", render: renderGuardianHome },
};

function navigateTo(viewName) {
  const view = VIEWS[viewName];
  if (!view) return;
  appViewTitle.textContent = view.title;
  view.render();
}

let menuOpen = false;

function openMenu() {
  menuOpen = true;
  menuButton.classList.add("open");
  menuPanel.classList.add("open");
  menuOverlay.classList.add("open");
  menuButton.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");
}

function closeMenu() {
  menuOpen = false;
  menuButton.classList.remove("open");
  menuPanel.classList.remove("open");
  menuOverlay.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

function toggleMenu() {
  if (menuOpen) closeMenu();
  else openMenu();
}

menuButton.addEventListener("click", toggleMenu);
menuOverlay.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuOpen) closeMenu();
});

logoutButton.addEventListener("click", () => {
  clearSession();
  clearApiCache();
  currentSession = null;
  closeMenu();
  goToStep1();
});

// ===== Shared render pieces =====
function ringChart(pct, label) {
  const box = el("div", "chart-box");
  const ring = el("div", "ring");
  ring.style.setProperty("--pct", pct);
  ring.appendChild(el("span", "ring-value", pct + "%"));
  box.appendChild(ring);
  if (label) box.appendChild(el("div", "chart-label", label));
  return box;
}

function barChart(pct) {
  const bar = el("div", "bar");
  const fill = el("div", "bar-fill");
  fill.style.width = pct + "%";
  bar.appendChild(fill);
  return bar;
}

function statusDot(done) {
  return el("span", "status-dot " + (done ? "done" : "todo"));
}

function familyHeader(name) {
  const header = el("div", "family-header");
  header.appendChild(el("span", "family-name", name));
  return header;
}

function contentNode(item, linkClass, textClass) {
  const href = contentUrl(item.content);
  if (href) {
    const a = el("a", linkClass, item.content);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  return el("span", textClass, item.content);
}

// ===== STUDENT views =====
function renderStudentHome() {
  loadInto(
    { action: "listRequirementsForUser", id: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.requirements.length) {
        wrap.appendChild(el("p", "empty", "لا توجد متطلبات حالياً"));
      } else {
        const list = el("ul", "todo-list");
        res.requirements.forEach((req) => list.appendChild(todoItem(req)));
        wrap.appendChild(list);
      }
      setContent(wrap);
    },
  );
}

function todoItem(req) {
  const upcoming = req.status === "قادم";
  const li = el("li", "todo-item" + (req.completed ? " done" : "") + (upcoming ? " dim" : ""));

  const body = el("div", "todo-body");
  body.appendChild(contentNode(req, "todo-link", "todo-text"));

  const meta = el("div", "todo-meta");
  const badge = statusBadge(req.status);
  if (badge) meta.appendChild(badge);
  const cd = countdownText(req.endTs);
  if (cd) meta.appendChild(el("span", "countdown", cd));
  body.appendChild(meta);
  li.appendChild(body);

  let btn;
  if (req.completed) {
    btn = el("button", "todo-check checked", "تم");
    btn.type = "button";
    btn.disabled = true;
  } else if (upcoming) {
    btn = el("button", "todo-check", "لم يبدأ");
    btn.type = "button";
    btn.disabled = true;
  } else {
    btn = el("button", "todo-check", "تم الإنجاز");
    btn.type = "button";
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "...";
      callApi({
        action: "completeRequirement",
        userId: currentSession.id,
        requirementNumber: req.number,
      })
        .then((r) => {
          if (r && r.success) {
            clearApiCache(); // this user's lists/records changed
            li.classList.add("done");
            btn.textContent = "تم";
            btn.classList.add("checked");
          } else {
            btn.disabled = false;
            btn.textContent = "تم الإنجاز";
            showMsg((r && r.message) || "تعذّر تسجيل الإنجاز", "error");
          }
        })
        .catch(() => {
          btn.disabled = false;
          btn.textContent = "تم الإنجاز";
        });
    });
  }
  li.appendChild(btn);
  return li;
}

function renderStudentFamily() {
  loadInto(
    { action: "getFamilyMembersSimpleStatus", studentId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      const fam = res.family;
      wrap.appendChild(familyHeader(fam.name));

      const sup = fullName(fam.supervisorFirstName, fam.supervisorLastName);
      const info = el("div", "info-row");
      info.appendChild(el("span", "k", "المشرف"));
      info.appendChild(el("span", "v", sup || "—"));
      wrap.appendChild(info);

      const list = el("ul", "member-list");
      res.members.forEach((m) => {
        const item = el("li", "member-item");
        item.appendChild(el("span", "member-name", fullName(m.firstName, m.lastName)));
        item.appendChild(statusDot(m.completed));
        list.appendChild(item);
      });
      wrap.appendChild(list);
      setContent(wrap);
    },
  );
}

function renderStudentRecord() {
  loadInto(
    { action: "getStudentRecord", studentId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.groups.length) {
        wrap.appendChild(el("p", "empty", "لا يوجد سجل بعد"));
        setContent(wrap);
        return;
      }
      res.groups.forEach((g) => {
        const section = el("section", "record-group");
        const head = el("div", "record-date");
        head.appendChild(el("span", null, g.date));
        if (g.dateSystem) head.appendChild(el("span", "record-date-system", g.dateSystem));
        section.appendChild(head);

        const list = el("ul", "record-list");
        g.items.forEach((it) => {
          const item = el("li", "record-item" + (it.completed ? " done" : ""));
          item.appendChild(statusDot(it.completed));
          item.appendChild(contentNode(it, "record-link", "record-text"));
          const badge = statusBadge(it.status);
          if (badge) item.appendChild(badge);
          list.appendChild(item);
        });
        section.appendChild(list);
        wrap.appendChild(section);
      });
      setContent(wrap);
    },
  );
}

// ===== SUPERVISOR views =====
function activeReqs(reqList) {
  return reqList.filter((r) => r.status !== "منتهي");
}

function renderSupervisorHome() {
  loadInto(
    { action: "getFamilyProgress", supervisorId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.family) {
        wrap.appendChild(el("p", "empty", "لا توجد أسرة مسندة إليك"));
        setContent(wrap);
        return;
      }
      wrap.appendChild(familyHeader(res.family.name));

      // Overall completion over non-expired (active/upcoming) requirements.
      const reqs = activeReqs(res.requirements);
      const activeSet = {};
      reqs.forEach((r) => (activeSet[r.number] = true));
      let total = 0;
      let done = 0;
      res.students.forEach((s) => {
        s.completions.forEach((c) => {
          if (activeSet[c.number]) {
            total++;
            if (c.completed) done++;
          }
        });
      });
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      wrap.appendChild(ringChart(pct, "نسبة إنجاز الأسرة"));
      wrap.appendChild(
        el("div", "child-count", res.students.length + " طلاب • " + reqs.length + " متطلبات فعّالة"),
      );

      // Active requirements with their remaining time.
      if (reqs.length) {
        wrap.appendChild(el("h3", "section-title", "المتطلبات الفعّالة"));
        const list = el("ul", "todo-list");
        reqs.forEach((r) => {
          const item = el("li", "todo-item" + (r.status === "قادم" ? " dim" : ""));
          const rbody = el("div", "todo-body");
          rbody.appendChild(contentNode(r, "todo-link", "todo-text"));
          const rmeta = el("div", "todo-meta");
          const b = statusBadge(r.status);
          if (b) rmeta.appendChild(b);
          const cd = countdownText(r.endTs);
          if (cd) rmeta.appendChild(el("span", "countdown", cd));
          rbody.appendChild(rmeta);
          item.appendChild(rbody);
          list.appendChild(item);
        });
        wrap.appendChild(list);
      }
      setContent(wrap);
    },
  );
}

function renderSupervisorStudents() {
  loadInto(
    { action: "getFamilyProgress", supervisorId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.family) {
        wrap.appendChild(el("p", "empty", "لا توجد أسرة مسندة إليك"));
        setContent(wrap);
        return;
      }
      if (!res.students.length) {
        wrap.appendChild(el("p", "empty", "لا يوجد طلاب في الأسرة"));
        setContent(wrap);
        return;
      }
      const reqs = activeReqs(res.requirements); // expired excluded from active detail
      const list = el("div", "student-progress-list");
      res.students.forEach((s) => list.appendChild(studentProgressCard(s, reqs)));
      wrap.appendChild(list);
      setContent(wrap);
    },
  );
}

function studentProgressCard(student, reqList) {
  const set = {};
  reqList.forEach((r) => (set[r.number] = true));
  const relevant = student.completions.filter((c) => set[c.number]);
  const total = relevant.length;
  const doneCount = relevant.filter((c) => c.completed).length;

  const card = el("div", "student-card");
  const head = el("div", "student-card-head");
  head.appendChild(el("span", "student-name", fullName(student.firstName, student.lastName)));
  head.appendChild(el("span", "student-count", doneCount + " / " + total));
  card.appendChild(head);

  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  card.appendChild(barChart(pct));

  const chips = el("div", "req-chips");
  relevant.forEach((c) => {
    chips.appendChild(el("span", "req-chip " + (c.completed ? "done" : "todo"), c.number));
  });
  card.appendChild(chips);
  return card;
}

function renderSupervisorLog() {
  loadInto(
    { action: "getFamilyProgress", supervisorId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.family) {
        wrap.appendChild(el("p", "empty", "لا توجد أسرة مسندة إليك"));
        setContent(wrap);
        return;
      }
      const reqByNum = {};
      res.requirements.forEach((r) => (reqByNum[r.number] = r));

      if (!res.students.length) {
        wrap.appendChild(el("p", "empty", "لا يوجد طلاب في الأسرة"));
        setContent(wrap);
        return;
      }

      res.students.forEach((s) => {
        const card = el("div", "log-student");
        card.appendChild(el("h3", "log-student-name", fullName(s.firstName, s.lastName)));

        const groups = {};
        const order = [];
        s.completions.forEach((c) => {
          const req = reqByNum[c.number] || {};
          const key = req.startDate ? String(req.startDate) : "غير محدد";
          if (!groups[key]) {
            groups[key] = [];
            order.push(key);
          }
          groups[key].push({ completed: c.completed, req: req });
        });

        order.forEach((key) => {
          const day = el("div", "log-day");
          day.appendChild(el("div", "log-day-date", key));
          const ul = el("ul", "record-list");
          groups[key].forEach((entry) => {
            const item = el("li", "record-item" + (entry.completed ? " done" : ""));
            item.appendChild(statusDot(entry.completed));
            const rbody = el("div", "record-body");
            rbody.appendChild(contentNode(entry.req, "record-link", "record-text"));
            if (entry.req.creator) {
              rbody.appendChild(el("div", "creator-label", "أنشأه: " + entry.req.creator));
            }
            item.appendChild(rbody);
            const badge = statusBadge(entry.req.status);
            if (badge) item.appendChild(badge);
            ul.appendChild(item);
          });
          day.appendChild(ul);
          card.appendChild(day);
        });
        wrap.appendChild(card);
      });
      setContent(wrap);
    },
  );
}

// ===== ADMIN views =====
function renderAdminHome() {
  loadInto(
    { action: "listFamiliesOverview", adminId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.families.length) {
        wrap.appendChild(el("p", "empty", "لا توجد أسر بعد"));
        setContent(wrap);
        return;
      }
      res.families.forEach((f) => {
        const card = el("div", "family-card");
        card.appendChild(el("h3", "family-card-name", f.name));
        const sup = fullName(f.supervisorFirstName, f.supervisorLastName);
        card.appendChild(el("div", "family-card-sup", "المشرف: " + (sup || "بدون مشرف")));
        card.appendChild(el("div", "family-card-count", "الطلاب: " + f.students.length));
        card.appendChild(barChart(f.completionPercentage));
        card.appendChild(el("div", "family-card-pct", f.completionPercentage + "% إنجاز"));
        wrap.appendChild(card);
      });
      setContent(wrap);
    },
  );
}

function renderAdminAccounts() {
  loadInto(
    { action: "listAllAccounts", adminId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      if (!res.accounts.length) {
        wrap.appendChild(el("p", "empty", "لا توجد حسابات"));
        setContent(wrap);
        return;
      }
      const PLURAL = { [STUDENTS]: "طلاب", [SUPERVISORS]: "مشرفين", [ADMINS]: "مسؤولون" };
      [STUDENTS, SUPERVISORS, ADMINS].forEach((role) => {
        const rows = res.accounts.filter((a) => a.role === role);
        if (!rows.length) return;
        wrap.appendChild(el("h3", "section-title", PLURAL[role]));
        const list = el("div", "account-list");
        rows.forEach((a) => {
          const item = el("div", "account-item");
          // Activated accounts show their name; unactivated ones (no name yet)
          // show their ID. Name and status are separate, spaced elements.
          const label = fullName(a.firstName, a.lastName) || String(a.id);
          item.appendChild(el("span", "account-name", label));
          item.appendChild(
            el(
              "span",
              "status-badge " + (a.activated ? "active" : "expired"),
              a.activated ? "مفعّل" : "غير مفعّل",
            ),
          );
          list.appendChild(item);
        });
        wrap.appendChild(list);
      });
      setContent(wrap);
    },
  );
}

// ===== Shared form helpers =====
function setFormMsg(node, text, ok) {
  node.textContent = text;
  node.className = "form-msg" + (ok === true ? " ok" : ok === false ? " err" : "");
}

function fieldRow(labelText, control) {
  const f = el("div", "field");
  const lab = el("label", null, labelText);
  if (control.id) lab.htmlFor = control.id;
  f.appendChild(lab);
  f.appendChild(control);
  return f;
}

function selectControl(id, options) {
  const sel = el("select");
  if (id) sel.id = id;
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  return sel;
}

// A toggle group that notifies onChange (used for date-system switching).
function toggleGroup(options, initial, onChange) {
  const node = el("div", "toggle-group");
  const btns = [];
  options.forEach((opt) => {
    const b = el("button", "toggle-btn" + (opt === initial ? " active" : ""), opt);
    b.type = "button";
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      onChange(opt);
    });
    btns.push(b);
    node.appendChild(b);
  });
  return node;
}

// A stateful segmented toggle with a getter (used for AM/PM).
function segmented(options, initial) {
  let value = initial;
  const node = el("div", "toggle-group");
  const btns = [];
  options.forEach((opt) => {
    const b = el("button", "toggle-btn" + (opt === value ? " active" : ""), opt);
    b.type = "button";
    b.addEventListener("click", () => {
      value = opt;
      btns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    });
    btns.push(b);
    node.appendChild(b);
  });
  return { node, get: () => value };
}

// ===== Stepper (shared by both wizards) =====
function buildStepper(labels, active) {
  const s = el("div", "stepper");
  for (let i = 1; i <= labels.length; i++) {
    const item = el(
      "div",
      "stepper-item" + (i === active ? " active" : "") + (i < active ? " done" : ""),
    );
    item.appendChild(el("span", "stepper-num", i < active ? "✓" : String(i)));
    item.appendChild(el("span", "stepper-label", labels[i - 1]));
    s.appendChild(item);
    if (i < labels.length) {
      s.appendChild(el("div", "stepper-line" + (i < active ? " done" : "")));
    }
  }
  return s;
}

// ===== ADMIN — family-creation wizard =====
let wizardState = null;
const WIZARD_STEPS = ["الأسرة", "المشرف", "الطلاب"];

function renderAdminFamilies() {
  setContent(loadingNode());
  Promise.all([
    callApi({ action: "listSupervisors", adminId: currentSession.id }),
    callApi({ action: "listStudents", adminId: currentSession.id }),
  ])
    .then(([supRes, stuRes]) => {
      if (!supRes || !supRes.success) {
        setContent(errorNode(supRes && supRes.message));
        return;
      }
      if (!stuRes || !stuRes.success) {
        setContent(errorNode(stuRes && stuRes.message));
        return;
      }
      wizardState = {
        step: 1,
        familyName: "",
        supervisorId: "",
        supervisors: supRes.supervisors || [],
        students: stuRes.students || [],
        selected: {},
      };
      renderWizard();
    })
    .catch(() => setContent(errorNode("حدث خطأ، حاول مرة أخرى")));
}

function renderWizard() {
  const wrap = el("div", "view");
  wrap.appendChild(buildStepper(WIZARD_STEPS, wizardState.step));
  const card = el("div", "admin-form wizard-card");
  if (wizardState.step === 1) buildWizardStep1(card);
  else if (wizardState.step === 2) buildWizardStep2(card);
  else buildWizardStep3(card);
  wrap.appendChild(card);
  setContent(wrap);
}

function supervisorNameById(id) {
  const s = wizardState.supervisors.find((x) => String(x.id) === String(id));
  return s ? fullName(s.firstName, s.lastName) : "—";
}

function buildWizardStep1(card) {
  card.appendChild(el("h3", null, "اسم الأسرة"));
  const input = el("input");
  input.type = "text";
  input.id = "wizFamName";
  input.placeholder = "أدخل اسم الأسرة";
  input.value = wizardState.familyName;
  input.addEventListener("input", () => (wizardState.familyName = input.value));
  card.appendChild(fieldRow("اسم الأسرة", input));

  const msgNode = el("div", "form-msg");
  card.appendChild(msgNode);
  const nav = el("div", "wizard-nav");
  const next = el("button", null, "التالي");
  next.type = "button";
  next.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) {
      setFormMsg(msgNode, "اسم الأسرة مطلوب", false);
      return;
    }
    wizardState.familyName = name;
    wizardState.step = 2;
    renderWizard();
  });
  nav.appendChild(next);
  card.appendChild(nav);
}

function buildWizardStep2(card) {
  card.appendChild(el("h3", null, "اختر المشرف"));
  if (!wizardState.supervisors.length) {
    card.appendChild(el("p", "empty", "لا يوجد مشرفون متاحون"));
  } else {
    const list = el("div", "select-list");
    wizardState.supervisors.forEach((sup) => {
      const item = el("div", "select-item" + (wizardState.supervisorId === sup.id ? " selected" : ""));
      item.appendChild(el("span", "radio"));
      item.appendChild(el("span", "select-name", fullName(sup.firstName, sup.lastName)));
      item.addEventListener("click", () => {
        wizardState.supervisorId = sup.id;
        list.querySelectorAll(".select-item").forEach((n) => n.classList.remove("selected"));
        item.classList.add("selected");
      });
      list.appendChild(item);
    });
    card.appendChild(list);
  }
  const msgNode = el("div", "form-msg");
  card.appendChild(msgNode);
  const nav = el("div", "wizard-nav");
  const back = el("button", "btn-secondary", "رجوع");
  back.type = "button";
  back.addEventListener("click", () => {
    wizardState.step = 1;
    renderWizard();
  });
  const next = el("button", null, "التالي");
  next.type = "button";
  next.addEventListener("click", () => {
    if (!wizardState.supervisorId) {
      setFormMsg(msgNode, "اختر مشرفاً للمتابعة", false);
      return;
    }
    wizardState.step = 3;
    renderWizard();
  });
  nav.appendChild(back);
  nav.appendChild(next);
  card.appendChild(nav);
}

function buildWizardStep3(card) {
  card.appendChild(el("h3", null, "اختر الطلاب"));
  card.appendChild(
    el("div", "wizard-review", "الأسرة: " + wizardState.familyName + " • المشرف: " + supervisorNameById(wizardState.supervisorId)),
  );
  if (!wizardState.students.length) {
    card.appendChild(el("p", "empty", "لا يوجد طلاب"));
  } else {
    const list = el("div", "check-list");
    wizardState.students.forEach((stu) => {
      const assigned = isAssignedFamily(stu.family);
      const item = el("div", "check-item" + (assigned ? " disabled" : ""));
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = !assigned && !!wizardState.selected[stu.id];
      cb.disabled = assigned;
      cb.addEventListener("change", () => {
        if (cb.checked) wizardState.selected[stu.id] = true;
        else delete wizardState.selected[stu.id];
      });
      item.appendChild(cb);
      item.appendChild(el("span", "cname", fullName(stu.firstName, stu.lastName)));
      if (assigned) {
        item.appendChild(el("span", "tag", "منضم لأسرة أخرى"));
        const rm = el("button", "remove-link", "إزالة");
        rm.type = "button";
        rm.addEventListener("click", () => {
          rm.disabled = true;
          rm.textContent = "...";
          callApi({ action: "removeStudentFromFamily", adminId: currentSession.id, studentId: stu.id })
            .then((r) => {
              if (r && r.success) {
                clearApiCache();
                stu.family = "";
                renderWizard();
              } else {
                rm.disabled = false;
                rm.textContent = "إزالة";
              }
            })
            .catch(() => {
              rm.disabled = false;
              rm.textContent = "إزالة";
            });
        });
        item.appendChild(rm);
      }
      list.appendChild(item);
    });
    card.appendChild(list);
  }
  const msgNode = el("div", "form-msg");
  card.appendChild(msgNode);
  const nav = el("div", "wizard-nav");
  const back = el("button", "btn-secondary", "رجوع");
  back.type = "button";
  back.addEventListener("click", () => {
    wizardState.step = 2;
    renderWizard();
  });
  const finish = el("button", null, "إنشاء الأسرة");
  finish.type = "button";
  finish.addEventListener("click", () => finalizeWizard(finish, back, msgNode));
  nav.appendChild(back);
  nav.appendChild(finish);
  card.appendChild(nav);
}

async function finalizeWizard(finishBtn, backBtn, msgNode) {
  finishBtn.disabled = true;
  backBtn.disabled = true;
  setFormMsg(msgNode, "جارِ الإنشاء...", null);
  try {
    let res = await callApi({ action: "createFamily", adminId: currentSession.id, name: wizardState.familyName });
    if (!res || !res.success) {
      setFormMsg(msgNode, (res && res.message) || "تعذّر إنشاء الأسرة", false);
      finishBtn.disabled = false;
      backBtn.disabled = false;
      return;
    }
    res = await callApi({
      action: "assignSupervisorToFamily",
      adminId: currentSession.id,
      familyName: wizardState.familyName,
      supervisorId: wizardState.supervisorId,
    });
    if (!res || !res.success) {
      setFormMsg(msgNode, "أُنشئت الأسرة، لكن تعذّر تعيين المشرف", false);
      finishBtn.disabled = false;
      backBtn.disabled = false;
      return;
    }
    const ids = Object.keys(wizardState.selected);
    let assigned = 0;
    let failed = 0;
    for (const sid of ids) {
      const r = await callApi({
        action: "assignStudentToFamily",
        adminId: currentSession.id,
        studentId: sid,
        familyName: wizardState.familyName,
      });
      if (r && r.success) assigned++;
      else failed++;
    }
    clearApiCache();
    let m = "تم إنشاء الأسرة «" + wizardState.familyName + "» وإسناد " + assigned + " طالب";
    if (failed) m += " (تعذّر إسناد " + failed + ")";
    setFormMsg(msgNode, m, true);
    setTimeout(renderAdminFamilies, 1500);
  } catch (e) {
    setFormMsg(msgNode, "حدث خطأ، حاول مرة أخرى", false);
    finishBtn.disabled = false;
    backBtn.disabled = false;
  }
}

// ===== ADMIN — requirement-creation wizard (3 steps) =====
let reqWizardState = null;
const REQ_WIZARD_STEPS = ["المتطلب", "البداية", "النهاية"];

function renderAdminRequirements() {
  reqWizardState = {
    step: 1,
    content: "",
    includeSupervisors: false,
    dateSystem: "هجري",
    start: { dateStr: "", timeStr: "" },
    end: { dateStr: "", timeStr: "" },
    picker: null,
  };
  renderReqWizard();
}

function renderReqWizard() {
  const wrap = el("div", "view");
  wrap.appendChild(buildStepper(REQ_WIZARD_STEPS, reqWizardState.step));
  const card = el("div", "admin-form wizard-card");
  if (reqWizardState.step === 1) buildReqStep1(card);
  else if (reqWizardState.step === 2) buildReqStep2(card);
  else buildReqStep3(card);
  wrap.appendChild(card);
  setContent(wrap);
}

// Date + time picker. system: هجري|ميلادي; initial {dateStr,timeStr}.
function buildDateTimePicker(system, initial) {
  const wrap = el("div");
  const pd = parseDateStr(initial.dateStr);
  const pt = parseTimeStr(initial.timeStr);
  let getDate;

  if (system === "هجري") {
    const curHy = gregorianToHijri(new Date()).hy;
    const yearSel = selectControl(null, [{ value: String(curHy), label: String(curHy) }]);
    const monthSel = selectControl(null, range(1, 12).map((n) => ({ value: pad2(n), label: HIJRI_MONTHS[n - 1] })));
    const daySel = selectControl(null, range(1, 30).map((n) => ({ value: pad2(n), label: String(n) })));
    if (pd.mo) monthSel.value = pad2(Number(pd.mo));
    if (pd.d) daySel.value = pad2(Number(pd.d));
    const row = el("div", "inline-fields");
    row.appendChild(daySel);
    row.appendChild(monthSel);
    row.appendChild(yearSel);
    wrap.appendChild(fieldRow("التاريخ (هجري)", row));
    getDate = () => yearSel.value + "/" + monthSel.value + "/" + daySel.value;
  } else {
    const dateInput = el("input");
    dateInput.type = "date";
    if (pd.y && pd.mo && pd.d) dateInput.value = pd.y + "-" + pad2(Number(pd.mo)) + "-" + pad2(Number(pd.d));
    wrap.appendChild(fieldRow("التاريخ (ميلادي)", dateInput));
    getDate = () => (dateInput.value ? dateInput.value.replace(/-/g, "/") : "");
  }

  // Time: hour (1-12) + minute (00-59) + AM/PM
  const hourSel = selectControl(null, range(1, 12).map((n) => ({ value: pad2(n), label: pad2(n) })));
  hourSel.value = pt.hour;
  const minSel = selectControl(null, range(0, 59).map((n) => ({ value: pad2(n), label: pad2(n) })));
  minSel.value = pt.minute;
  const ampm = segmented(["صباحاً", "مساءً"], pt.period);
  const timeRow = el("div", "inline-fields");
  timeRow.appendChild(hourSel);
  timeRow.appendChild(minSel);
  timeRow.appendChild(ampm.node);
  wrap.appendChild(fieldRow("الوقت", timeRow));

  return {
    node: wrap,
    getValue: () => ({
      dateStr: getDate(),
      timeStr: hourSel.value + ":" + minSel.value + " " + ampm.get(),
    }),
  };
}

function buildReqStep1(card) {
  card.appendChild(el("h3", null, "المتطلب"));
  const content = el("textarea");
  content.placeholder = "اكتب محتوى المتطلب (نص أو رابط)";
  content.value = reqWizardState.content;
  content.addEventListener("input", () => (reqWizardState.content = content.value));
  card.appendChild(fieldRow("المحتوى", content));

  const checkRow = el("div", "check-row");
  const chk = el("input");
  chk.type = "checkbox";
  chk.id = "reqIncSup";
  chk.checked = reqWizardState.includeSupervisors;
  chk.addEventListener("change", () => (reqWizardState.includeSupervisors = chk.checked));
  const lbl = el("label", null, "إرسال للمشرفين أيضاً");
  lbl.htmlFor = "reqIncSup";
  checkRow.appendChild(chk);
  checkRow.appendChild(lbl);
  card.appendChild(checkRow);

  const msgNode = el("div", "form-msg");
  card.appendChild(msgNode);
  const nav = el("div", "wizard-nav");
  const next = el("button", null, "التالي");
  next.type = "button";
  next.addEventListener("click", () => {
    if (!content.value.trim()) {
      setFormMsg(msgNode, "المحتوى مطلوب", false);
      return;
    }
    reqWizardState.content = content.value.trim();
    reqWizardState.step = 2;
    renderReqWizard();
  });
  nav.appendChild(next);
  card.appendChild(nav);
}

function buildReqStep2(card) {
  card.appendChild(el("h3", null, "تاريخ ووقت البداية"));

  const sysToggle = toggleGroup(["هجري", "ميلادي"], reqWizardState.dateSystem, (val) => {
    if (val !== reqWizardState.dateSystem) {
      reqWizardState.dateSystem = val;
      reqWizardState.start = { dateStr: "", timeStr: "" };
      reqWizardState.end = { dateStr: "", timeStr: "" };
      renderReqWizard();
    }
  });
  card.appendChild(fieldRow("نظام التاريخ", sysToggle));

  const nowBtn = el("button", "btn-secondary now-btn", "الآن");
  nowBtn.type = "button";
  nowBtn.addEventListener("click", () => {
    reqWizardState.start = nowValue(reqWizardState.dateSystem);
    renderReqWizard();
  });
  card.appendChild(nowBtn);

  const picker = buildDateTimePicker(reqWizardState.dateSystem, reqWizardState.start);
  reqWizardState.picker = picker;
  card.appendChild(picker.node);

  const msgNode = el("div", "form-msg");
  card.appendChild(msgNode);
  const nav = el("div", "wizard-nav");
  const back = el("button", "btn-secondary", "رجوع");
  back.type = "button";
  back.addEventListener("click", () => {
    reqWizardState.start = picker.getValue();
    reqWizardState.step = 1;
    renderReqWizard();
  });
  const next = el("button", null, "التالي");
  next.type = "button";
  next.addEventListener("click", () => {
    const v = picker.getValue();
    if (!v.dateStr) {
      setFormMsg(msgNode, "حدد تاريخ البداية", false);
      return;
    }
    reqWizardState.start = v;
    reqWizardState.step = 3;
    renderReqWizard();
  });
  nav.appendChild(back);
  nav.appendChild(next);
  card.appendChild(nav);
}

function buildReqStep3(card) {
  card.appendChild(el("h3", null, "تاريخ ووقت النهاية"));
  card.appendChild(
    el(
      "div",
      "wizard-review",
      "النظام: " + reqWizardState.dateSystem + " • البداية: " +
        (reqWizardState.start.dateStr || "—") + " " + (reqWizardState.start.timeStr || ""),
    ),
  );
  const picker = buildDateTimePicker(reqWizardState.dateSystem, reqWizardState.end);
  reqWizardState.picker = picker;
  card.appendChild(picker.node);

  const msgNode = el("div", "form-msg");
  card.appendChild(msgNode);
  const nav = el("div", "wizard-nav");
  const back = el("button", "btn-secondary", "رجوع");
  back.type = "button";
  back.addEventListener("click", () => {
    reqWizardState.end = picker.getValue();
    reqWizardState.step = 2;
    renderReqWizard();
  });
  const finish = el("button", null, "إنشاء المتطلب");
  finish.type = "button";
  finish.addEventListener("click", () => finalizeReqWizard(finish, back, picker, msgNode));
  nav.appendChild(back);
  nav.appendChild(finish);
  card.appendChild(nav);
}

function finalizeReqWizard(finishBtn, backBtn, endPicker, msgNode) {
  const end = endPicker.getValue();
  if (!end.dateStr) {
    setFormMsg(msgNode, "حدد تاريخ النهاية", false);
    return;
  }
  reqWizardState.end = end;
  finishBtn.disabled = true;
  backBtn.disabled = true;
  setFormMsg(msgNode, "جارِ الحفظ...", null);
  callApi({
    action: "createRequirement",
    adminId: currentSession.id,
    content: reqWizardState.content,
    dateSystem: reqWizardState.dateSystem,
    startDate: reqWizardState.start.dateStr,
    startTime: reqWizardState.start.timeStr,
    endDate: reqWizardState.end.dateStr,
    endTime: reqWizardState.end.timeStr,
    includeSupervisors: reqWizardState.includeSupervisors,
  })
    .then((res) => {
      if (res && res.success) {
        clearApiCache();
        setFormMsg(msgNode, "تم إنشاء المتطلب رقم " + res.requirementNumber, true);
        setTimeout(renderAdminRequirements, 1500);
      } else {
        setFormMsg(msgNode, (res && res.message) || "تعذّر الحفظ", false);
        finishBtn.disabled = false;
        backBtn.disabled = false;
      }
    })
    .catch(() => {
      setFormMsg(msgNode, "حدث خطأ، حاول مرة أخرى", false);
      finishBtn.disabled = false;
      backBtn.disabled = false;
    });
}

// ===== GUARDIAN view =====
function renderGuardianHome() {
  loadInto(
    { action: "getChildProgress", guardianId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      wrap.appendChild(el("h3", "child-name", fullName(res.student.firstName, res.student.lastName)));
      wrap.appendChild(ringChart(res.completionPercentage, "نسبة الإنجاز"));
      wrap.appendChild(el("div", "child-count", res.completedCount + " من " + res.totalCount + " متطلب"));
      setContent(wrap);
    },
  );
}

// ===== Auth flow =====
idForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const id = idInput.value.trim();
  if (!/^\d{6}$/.test(id)) {
    showMsg("المعرف يجب أن يكون 6 أرقام فقط", "error");
    return;
  }
  showMsg("جارِ التحقق...", "info");
  submitRequest(idSubmitBtn, { action: "checkId", id: id }, (result) => {
    currentId = id;
    showMsg("", "");
    if (result.type === "guardian") {
      setRole("ولي أمر");
      showMsg("جارِ الدخول...", "info");
      return submitRequest(
        idSubmitBtn,
        { action: "guardianLogin", id: currentId },
        (guardianResult) => {
          enterApp({
            kind: "guardian",
            id: currentId,
            firstName: guardianResult.studentFirstName,
            lastName: guardianResult.studentLastName,
          });
        },
      );
    }
    setRole(ROLE_LABELS[result.role] || result.role);
    if (result.activated) showStep(step3);
    else showStep(step2);
  });
});

activateForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const password = newPasswordInput.value.trim();
  if (!/^\d{4}$/.test(password)) {
    showMsg("كلمة المرور يجب أن تكون 4 أرقام فقط", "error");
    return;
  }
  showMsg("جارِ التفعيل...", "info");
  submitRequest(
    activateSubmitBtn,
    { action: "activate", id: currentId, firstName: firstName, lastName: lastName, password: password },
    (result) => {
      const guardianId =
        result.guardianId !== undefined && result.guardianId !== null && result.guardianId !== ""
          ? result.guardianId
          : undefined;
      enterApp({
        kind: "account",
        id: currentId,
        role: result.role,
        firstName: firstName,
        lastName: lastName,
        guardianId: guardianId,
      });
    },
  );
});

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const password = passwordInput.value.trim();
  showMsg("جارِ الدخول...", "info");
  submitRequest(
    loginSubmitBtn,
    { action: "login", id: currentId, password: password },
    (result) => {
      enterApp({
        kind: "account",
        id: currentId,
        role: result.role,
        firstName: result.firstName,
        lastName: result.lastName,
      });
    },
  );
});

// ===== Init =====
(function restoreSession() {
  const s = loadSession();
  if (validSession(s)) enterApp(s);
  else if (s) clearSession();
})();
