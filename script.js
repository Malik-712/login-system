const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw0gDByt3iDBcFaBJDVUWZEY-BkMx2ApTLWpt6zKYRaZCxqzyDyEQKGdqfoaFLUGb19dg/exec";

// Backend sheet names (roles) and their friendly Arabic labels.
const STUDENTS = "الطلاب";
const SUPERVISORS = "المشرفين";
const ADMINS = "مسؤولون";
const ROLE_LABELS = {
  [STUDENTS]: "طالب",
  [SUPERVISORS]: "مشرف",
  [ADMINS]: "مسؤول",
};

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

// ===== Small DOM helpers =====
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

// Auto-detect whether a requirement's content is a URL. Returns a safe href
// to link to, or null when the content should be shown as plain text.
function contentUrl(content) {
  const s = String(content == null ? "" : content).trim();
  if (!s || /\s/.test(s)) return null; // a link is a single token, no spaces
  if (/^https?:\/\/\S+$/i.test(s)) return s; // explicit http(s) URL
  if (/^www\.\S+$/i.test(s)) return "https://" + s; // www.example.com
  // bare domain with a real 2+ letter TLD, optional path/query
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(s)) return "https://" + s;
  return null;
}

function fullName(first, last) {
  return ((first || "") + " " + (last || "")).trim();
}

function isAssignedFamily(family) {
  return family !== "" && family !== null && family !== undefined;
}

// ===== Session persistence (localStorage) =====
function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    /* storage unavailable — session just won't persist across refreshes */
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

// Auth helper: disables the in-flight submit button, re-enables on settle.
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

// ===== Auth UI helpers =====
function showStep(step) {
  for (let i = 0; i < steps.length; i++) {
    steps[i].classList.remove("active");
  }
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

  appGreeting.textContent = greetingText(session); // no emoji
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

// Fetch, show a spinner while loading, then hand the result to onSuccess.
function loadInto(payload, onSuccess) {
  setContent(loadingNode());
  callApi(payload)
    .then((result) => {
      if (!result || !result.success) {
        setContent(errorNode(result && result.message));
        return;
      }
      onSuccess(result);
    })
    .catch(() => setContent(errorNode("حدث خطأ، حاول مرة أخرى")));
}

// ===== Menu (right-side drawer), role-specific items =====
// Each role's menu is data-driven — add entries here to extend a role's menu.
const MENUS = {
  student: [
    { label: "الصفحة الرئيسية", view: "studentHome" },
    { label: "الأسرة", view: "studentFamily" },
    { label: "السجل", view: "studentRecord" },
  ],
  supervisor: [
    { label: "الصفحة الرئيسية", view: "supervisorHome" },
    { label: "سجل الأسرة", view: "supervisorLog" },
  ],
  admin: [
    { label: "الصفحة الرئيسية", view: "adminHome" },
    { label: "إدارة الأسر", view: "adminFamilies" },
    { label: "إدارة المتطلبات", view: "adminRequirements" },
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

const VIEWS = {
  studentHome: { title: "المتطلبات", render: renderStudentHome },
  studentFamily: { title: "الأسرة", render: renderStudentFamily },
  studentRecord: { title: "السجل", render: renderStudentRecord },
  supervisorHome: { title: "متابعة الأسرة", render: renderSupervisorHome },
  supervisorLog: { title: "سجل الأسرة", render: renderSupervisorLog },
  adminHome: { title: "نظرة عامة على الأسر", render: renderAdminHome },
  adminFamilies: { title: "إدارة الأسر", render: renderAdminFamilies },
  adminRequirements: { title: "إدارة المتطلبات", render: renderAdminRequirements },
  guardianHome: { title: "متابعة الابن", render: renderGuardianHome },
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
  currentSession = null;
  closeMenu();
  goToStep1();
});

// =====================================================================
// Shared render pieces
// =====================================================================
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

// Render a requirement's content: a clickable link when it looks like a URL,
// otherwise plain text — the type is auto-detected (content is stored as text).
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

// =====================================================================
// STUDENT views
// =====================================================================
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
  const li = el("li", "todo-item");
  if (req.completed) li.classList.add("done");

  const body = el("div", "todo-body");
  const content = contentNode(req, "todo-link", "todo-text");
  body.appendChild(content);
  const metaText =
    (req.date ? req.date : "") + (req.time ? " • " + req.time : "");
  if (metaText) body.appendChild(el("div", "todo-meta", metaText));
  li.appendChild(body);

  const btn = el("button", "todo-check", req.completed ? "تم" : "تم الإنجاز");
  btn.type = "button";
  if (req.completed) {
    btn.disabled = true;
    btn.classList.add("checked");
  } else {
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
            li.classList.add("done");
            btn.textContent = "تم";
            btn.classList.add("checked");
          } else {
            btn.disabled = false;
            btn.textContent = "تم الإنجاز";
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
        if (g.dateSystem)
          head.appendChild(el("span", "record-date-system", g.dateSystem));
        section.appendChild(head);

        const list = el("ul", "record-list");
        g.items.forEach((it) => {
          const item = el("li", "record-item" + (it.completed ? " done" : ""));
          item.appendChild(statusDot(it.completed));
          item.appendChild(contentNode(it, "record-link", "record-text"));
          list.appendChild(item);
        });
        section.appendChild(list);
        wrap.appendChild(section);
      });
      setContent(wrap);
    },
  );
}

// =====================================================================
// SUPERVISOR views
// =====================================================================
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

      const total = res.students.length * res.requirements.length;
      let done = 0;
      res.students.forEach((s) => (done += s.completedCount));
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      wrap.appendChild(ringChart(pct, "نسبة إنجاز الأسرة"));

      if (!res.students.length) {
        wrap.appendChild(el("p", "empty", "لا يوجد طلاب في الأسرة"));
      } else {
        const list = el("div", "student-progress-list");
        res.students.forEach((s) =>
          list.appendChild(studentProgressCard(s, res.requirements.length)),
        );
        wrap.appendChild(list);
      }
      setContent(wrap);
    },
  );
}

function studentProgressCard(student, reqTotal) {
  const card = el("div", "student-card");
  const head = el("div", "student-card-head");
  head.appendChild(el("span", "student-name", fullName(student.firstName, student.lastName)));
  head.appendChild(
    el("span", "student-count", student.completedCount + " / " + reqTotal),
  );
  card.appendChild(head);

  const pct = reqTotal ? Math.round((student.completedCount / reqTotal) * 100) : 0;
  card.appendChild(barChart(pct));

  const chips = el("div", "req-chips");
  student.completions.forEach((c) => {
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
          const key = req.date ? String(req.date) : "غير محدد";
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
            item.appendChild(
              contentNode(entry.req, "record-link", "record-text"),
            );
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

// =====================================================================
// ADMIN views
// =====================================================================
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

function setFormMsg(node, text, ok) {
  node.textContent = text;
  node.className =
    "form-msg" + (ok === true ? " ok" : ok === false ? " err" : "");
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

// =====================================================================
// ADMIN — family-creation wizard (إدارة الأسر)
// Step 1: family name → Step 2: pick supervisor → Step 3: pick students.
// The family is created (createFamily → assignSupervisor → assignStudent*)
// only when the wizard is finalized.
// =====================================================================
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

function buildStepper(active) {
  const s = el("div", "stepper");
  for (let i = 1; i <= WIZARD_STEPS.length; i++) {
    const item = el(
      "div",
      "stepper-item" + (i === active ? " active" : "") + (i < active ? " done" : ""),
    );
    item.appendChild(el("span", "stepper-num", i < active ? "✓" : String(i)));
    item.appendChild(el("span", "stepper-label", WIZARD_STEPS[i - 1]));
    s.appendChild(item);
    if (i < WIZARD_STEPS.length) {
      s.appendChild(el("div", "stepper-line" + (i < active ? " done" : "")));
    }
  }
  return s;
}

function renderWizard() {
  const wrap = el("div", "view");
  wrap.appendChild(buildStepper(wizardState.step));
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
  input.addEventListener("input", () => {
    wizardState.familyName = input.value;
  });
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
    card.appendChild(el("p", "empty", "لا يوجد مشرفون"));
  } else {
    const list = el("div", "select-list");
    wizardState.supervisors.forEach((sup) => {
      const item = el(
        "div",
        "select-item" + (wizardState.supervisorId === sup.id ? " selected" : ""),
      );
      item.appendChild(el("span", "radio"));
      item.appendChild(el("span", "select-name", fullName(sup.firstName, sup.lastName)));
      item.addEventListener("click", () => {
        wizardState.supervisorId = sup.id;
        list
          .querySelectorAll(".select-item")
          .forEach((n) => n.classList.remove("selected"));
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
    el(
      "div",
      "wizard-review",
      "الأسرة: " +
        wizardState.familyName +
        " • المشرف: " +
        supervisorNameById(wizardState.supervisorId),
    ),
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
          callApi({
            action: "removeStudentFromFamily",
            adminId: currentSession.id,
            studentId: stu.id,
          })
            .then((r) => {
              if (r && r.success) {
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
    let res = await callApi({
      action: "createFamily",
      adminId: currentSession.id,
      name: wizardState.familyName,
    });
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

    let m = "تم إنشاء الأسرة «" + wizardState.familyName + "» وإسناد " + assigned + " طالب";
    if (failed) m += " (تعذّر إسناد " + failed + ")";
    setFormMsg(msgNode, m, true);
    setTimeout(renderAdminFamilies, 1500); // start a fresh wizard
  } catch (e) {
    setFormMsg(msgNode, "حدث خطأ، حاول مرة أخرى", false);
    finishBtn.disabled = false;
    backBtn.disabled = false;
  }
}

function renderAdminRequirements() {
  const wrap = el("div", "view");
  const form = el("form", "admin-form");
  form.appendChild(el("h3", null, "إنشاء متطلب"));

  // Content — a single plain field; link vs. text is auto-detected on display.
  const contentControl = el("textarea");
  contentControl.placeholder = "اكتب محتوى المتطلب (نص أو رابط)";
  form.appendChild(fieldRow("المحتوى", contentControl));

  // Date system + matching date input
  let dateSystem = "هجري";
  let dateControl;
  const dateField = el("div");
  function updateDateField() {
    dateField.textContent = "";
    if (dateSystem === "ميلادي") {
      dateControl = el("input");
      dateControl.type = "date";
    } else {
      dateControl = el("input");
      dateControl.type = "text";
      dateControl.placeholder = "مثال: 15/09/1447";
    }
    dateField.appendChild(dateControl);
  }
  updateDateField();
  form.appendChild(
    fieldRow(
      "نظام التاريخ",
      toggleGroup(["هجري", "ميلادي"], dateSystem, (val) => {
        dateSystem = val;
        updateDateField();
      }),
    ),
  );
  form.appendChild(fieldRow("التاريخ", dateField));

  // 12-hour time (hour : minute + صباحاً/مساءً)
  const hourSel = selectControl(
    "reqHour",
    range(1, 12).map((n) => ({ value: pad2(n), label: pad2(n) })),
  );
  const minSel = selectControl(
    "reqMin",
    range(0, 59).map((n) => ({ value: pad2(n), label: pad2(n) })),
  );
  const perSel = selectControl("reqPer", [
    { value: "صباحاً", label: "صباحاً" },
    { value: "مساءً", label: "مساءً" },
  ]);
  const timeRow = el("div", "inline-fields");
  timeRow.appendChild(hourSel);
  timeRow.appendChild(minSel);
  timeRow.appendChild(perSel);
  form.appendChild(fieldRow("الوقت", timeRow));

  // Include supervisors (unchecked by default)
  const checkRow = el("div", "check-row");
  const chk = el("input");
  chk.type = "checkbox";
  chk.id = "incSup";
  const chkLabel = el("label", null, "إرسال للمشرفين أيضاً");
  chkLabel.htmlFor = "incSup";
  checkRow.appendChild(chk);
  checkRow.appendChild(chkLabel);
  form.appendChild(checkRow);

  const submit = el("button", null, "إنشاء المتطلب");
  submit.type = "submit";
  form.appendChild(submit);
  const msgNode = el("div", "form-msg");
  form.appendChild(msgNode);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = (contentControl.value || "").trim();
    if (!content) {
      setFormMsg(msgNode, "المحتوى مطلوب", false);
      return;
    }
    const time = hourSel.value + ":" + minSel.value + " " + perSel.value;
    submit.disabled = true;
    setFormMsg(msgNode, "جارِ الحفظ...", null);
    callApi({
      action: "createRequirement",
      adminId: currentSession.id,
      content: content,
      dateSystem: dateSystem,
      dateValue: (dateControl.value || "").trim(),
      time: time,
      includeSupervisors: chk.checked,
    })
      .then((res) => {
        if (res && res.success) {
          setFormMsg(msgNode, "تم إنشاء المتطلب رقم " + res.requirementNumber, true);
          contentControl.value = "";
          dateControl.value = "";
          chk.checked = false;
          submit.disabled = false;
        } else {
          setFormMsg(msgNode, (res && res.message) || "تعذّر الحفظ", false);
          submit.disabled = false;
        }
      })
      .catch(() => {
        setFormMsg(msgNode, "حدث خطأ، حاول مرة أخرى", false);
        submit.disabled = false;
      });
  });

  wrap.appendChild(form);
  setContent(wrap);
}

// =====================================================================
// GUARDIAN view
// =====================================================================
function renderGuardianHome() {
  loadInto(
    { action: "getChildProgress", guardianId: currentSession.id },
    (res) => {
      const wrap = el("div", "view");
      wrap.appendChild(el("h3", "child-name", fullName(res.student.firstName, res.student.lastName)));
      wrap.appendChild(ringChart(res.completionPercentage, "نسبة الإنجاز"));
      wrap.appendChild(
        el("div", "child-count", res.completedCount + " من " + res.totalCount + " متطلب"),
      );
      setContent(wrap);
    },
  );
}

// =====================================================================
// Auth flow
// =====================================================================
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

    // type === "account"
    setRole(ROLE_LABELS[result.role] || result.role);

    if (result.activated) {
      showStep(step3);
    } else {
      showStep(step2);
    }
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
    {
      action: "activate",
      id: currentId,
      firstName: firstName,
      lastName: lastName,
      password: password,
    },
    (result) => {
      const guardianId =
        result.guardianId !== undefined &&
        result.guardianId !== null &&
        result.guardianId !== ""
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

// ===== Init: restore a persisted session, else show the login form =====
(function restoreSession() {
  const s = loadSession();
  if (validSession(s)) {
    enterApp(s);
  } else if (s) {
    clearSession();
  }
})();
