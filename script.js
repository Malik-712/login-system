const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw0gDByt3iDBcFaBJDVUWZEY-BkMx2ApTLWpt6zKYRaZCxqzyDyEQKGdqfoaFLUGb19dg/exec";

let currentId = "";

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");
const msg = document.getElementById("msg");

function showStep(step) {
  [step1, step2, step3, step4].forEach((s) =>
    s.classList.remove("active"),
  );
  step.classList.add("active");
}

function showMsg(text, color) {
  msg.textContent = text;
  msg.style.color = color;
}

function goToStep1() {
  currentId = "";
  document.getElementById("idInput").value = "";
  showMsg("", "black");
  showStep(step1);
}

function callApi(payload) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  }).then((res) => res.json());
}

document
  .getElementById("idForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const id = document.getElementById("idInput").value.trim();

    if (!/^\d{6}$/.test(id)) {
      showMsg("المعرف يجب أن يكون 6 أرقام فقط", "red");
      return;
    }

    showMsg("جارِ التحقق...", "black");

    callApi({ action: "checkId", id: id })
      .then((result) => {
        if (!result.success) {
          showMsg(result.message, "red");
          return;
        }

        currentId = id;
        showMsg("", "black");

        if (result.activated) {
          showStep(step3);
        } else {
          showStep(step2);
        }
      })
      .catch(() => showMsg("حدث خطأ، حاول مرة أخرى", "red"));
  });

document
  .getElementById("activateForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const firstName = document
      .getElementById("firstNameInput")
      .value.trim();
    const lastName = document
      .getElementById("lastNameInput")
      .value.trim();
    const password = document
      .getElementById("newPasswordInput")
      .value.trim();

    if (!/^\d{4}$/.test(password)) {
      showMsg("كلمة المرور يجب أن تكون 4 أرقام فقط", "red");
      return;
    }

    showMsg("جارِ التفعيل...", "black");

    callApi({
      action: "activate",
      id: currentId,
      firstName: firstName,
      lastName: lastName,
      password: password,
    })
      .then((result) => {
        if (!result.success) {
          showMsg(result.message, "red");
          return;
        }

        document.getElementById("welcomeName").textContent = firstName;
        showMsg("", "black");
        showStep(step4);
      })
      .catch(() => showMsg("حدث خطأ، حاول مرة أخرى", "red"));
  });

document
  .getElementById("loginForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const password = document
      .getElementById("passwordInput")
      .value.trim();

    showMsg("جارِ الدخول...", "black");

    callApi({ action: "login", id: currentId, password: password })
      .then((result) => {
        if (!result.success) {
          showMsg(result.message, "red");
          return;
        }

        document.getElementById("welcomeName").textContent =
          result.firstName;
        showMsg("", "black");
        showStep(step4);
      })
      .catch(() => showMsg("حدث خطأ، حاول مرة أخرى", "red"));
  });
