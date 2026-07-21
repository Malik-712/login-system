const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw0gDByt3iDBcFaBJDVUWZEY-BkMx2ApTLWpt6zKYRaZCxqzyDyEQKGdqfoaFLUGb19dg/exec";

// Map backend role values to friendly Arabic labels.
const ROLE_LABELS = {
  "الطلاب": "طالب",
  "المشرفين": "مشرف",
  "الأدمن": "أدمن",
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

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

// ===== UI helpers =====
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

function showWelcome(nameLine, roleLine, guardianText) {
  welcomeName.textContent = nameLine;
  welcomeRole.textContent = roleLine;

  if (guardianText) {
    guardianInfo.textContent = guardianText;
    guardianInfo.hidden = false;
  } else {
    guardianInfo.textContent = "";
    guardianInfo.hidden = true;
  }

  setRole("");
  showMsg("", "");
  showStep(step4);
}

function goToStep1() {
  currentId = "";
  idInput.value = "";
  setRole("");
  showMsg("", "");
  showStep(step1);
}

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
          showWelcome(
            "أهلاً بك 👋",
            "ولي أمر " +
              guardianResult.studentFirstName +
              " " +
              guardianResult.studentLastName,
            "",
          );
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
      let guardianText = "";
      if (
        result.guardianId !== undefined &&
        result.guardianId !== null &&
        result.guardianId !== ""
      ) {
        guardianText = "معرف ولي الأمر: " + result.guardianId;
      }

      showWelcome(
        "أهلاً " + firstName + " " + lastName + " 👋",
        "أنت مسجل كـ " + roleLabel(result.role),
        guardianText,
      );
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
      showWelcome(
        "أهلاً " + result.firstName + " " + result.lastName + " 👋",
        "أنت مسجل كـ " + roleLabel(result.role),
        "",
      );
    },
  );
});
