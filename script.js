const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw0gDByt3iDBcFaBJDVUWZEY-BkMx2ApTLWpt6zKYRaZCxqzyDyEQKGdqfoaFLUGb19dg/exec";

// Map backend role values to friendly Arabic labels.
const ROLE_LABELS = {
  "الطلاب": "طالب",
  "المشرفين": "مشرف",
  "مسؤولون": "مسؤول",
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

const SESSION_KEY = "loginSession";

let currentId = "";

// ===== Cached DOM references (queried once) =====
const roleLabelEl = document.getElementById("roleLabel");
const msg = document.getElementById("msg");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");
const steps = [step1, step2, step3, step4];

const idForm = document.getElementById("idForm");
const activateForm = document.getElementById("activateForm");
const loginForm = document.getElementById("loginForm");

const idInput = document.getElementById("idInput");
const firstNameInput = document.getElementById("firstNameInput");
const lastNameInput = document.getElementById("lastNameInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const passwordInput = document.getElementById("passwordInput");

const welcomeName = document.getElementById("welcomeName");
const welcomeRole = document.getElementById("welcomeRole");
const guardianInfo = document.getElementById("guardianInfo");

const idSubmitBtn = idForm.querySelector('button[type="submit"]');
const activateSubmitBtn = activateForm.querySelector('button[type="submit"]');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

// Hamburger menu elements
const menuButton = document.getElementById("menuButton");
const menuOverlay = document.getElementById("menuOverlay");
const menuPanel = document.getElementById("menuPanel");
const menuList = document.getElementById("menuList");
const logoutButton = document.getElementById("logoutButton");

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

// Build the welcome-screen text from a stored session so a restored session
// renders identically to a fresh login. For guardians, firstName/lastName
// hold the linked student's names.
function welcomeLinesFromSession(s) {
  if (s.kind === "guardian") {
    return {
      nameLine: "أهلاً بك 👋",
      roleLine: "ولي أمر " + s.firstName + " " + s.lastName,
      guardianText: "",
    };
  }
  return {
    nameLine: "أهلاً " + s.firstName + " " + s.lastName + " 👋",
    roleLine: "أنت مسجل كـ " + roleLabel(s.role),
    guardianText: s.guardianId ? "معرف ولي الأمر: " + s.guardianId : "",
  };
}

// ===== UI helpers =====
function showStep(step) {
  for (let i = 0; i < steps.length; i++) {
    steps[i].classList.remove("active");
  }
  step.classList.add("active");

  // The hamburger menu is only available on the welcome/home view.
  const onWelcome = step === step4;
  menuButton.hidden = !onWelcome;
  if (!onWelcome) {
    closeMenu();
  }
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

function renderWelcome(lines) {
  welcomeName.textContent = lines.nameLine;
  welcomeRole.textContent = lines.roleLine;

  if (lines.guardianText) {
    guardianInfo.textContent = lines.guardianText;
    guardianInfo.hidden = false;
  } else {
    guardianInfo.textContent = "";
    guardianInfo.hidden = true;
  }

  setRole("");
  showMsg("", "");
  showStep(step4);
}

// Persist the session, then show the welcome/home screen.
function enterWelcome(session) {
  saveSession(session);
  renderWelcome(welcomeLinesFromSession(session));
}

function goToStep1() {
  currentId = "";
  idInput.value = "";
  setRole("");
  showMsg("", "");
  showStep(step1);
}

// ===== Hamburger menu =====
// Menu items are data-driven — add new entries to this array and they render
// automatically. Kept simple so the menu stays easy to extend later.
const MENU_ITEMS = [
  { label: "الصفحة الرئيسية", onSelect: () => showStep(step4) },
  { label: "الإنجاز", onSelect: () => {} }, // placeholder — page not built yet
];

function buildMenu() {
  const frag = document.createDocumentFragment();
  MENU_ITEMS.forEach((item) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu-item";
    btn.textContent = item.label;
    btn.addEventListener("click", () => {
      item.onSelect();
      closeMenu();
    });
    li.appendChild(btn);
    frag.appendChild(li);
  });
  menuList.appendChild(frag);
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
  if (menuOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}

menuButton.addEventListener("click", toggleMenu);
menuOverlay.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuOpen) {
    closeMenu();
  }
});

logoutButton.addEventListener("click", () => {
  clearSession();
  closeMenu();
  goToStep1();
});

// ===== API =====
function callApi(payload) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  }).then((res) => res.json());
}

// Disables the in-flight submit button, re-enables it once the request settles.
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

// ===== Flow =====
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
          enterWelcome({
            kind: "guardian",
            firstName: guardianResult.studentFirstName,
            lastName: guardianResult.studentLastName,
          });
        },
      );
    }

    // type === "account"
    setRole(roleLabel(result.role));

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

      enterWelcome({
        kind: "account",
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
      enterWelcome({
        kind: "account",
        role: result.role,
        firstName: result.firstName,
        lastName: result.lastName,
      });
    },
  );
});

// ===== Init =====
buildMenu();

// Restore a persisted session on load; otherwise stay on the ID entry step.
(function restoreSession() {
  const s = loadSession();
  if (
    s &&
    s.firstName &&
    s.lastName &&
    (s.kind === "guardian" || (s.kind === "account" && s.role))
  ) {
    renderWelcome(welcomeLinesFromSession(s));
  } else if (s) {
    clearSession(); // malformed / stale — discard and show the ID form
  }
})();
