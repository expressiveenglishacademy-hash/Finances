const STORAGE_KEY = "eea_finances_app_v4";
const SESSION_KEY = "eea_finances_session";
const DELETE_CODE = "8681";

document.addEventListener("DOMContentLoaded", () => {
  seedStorage();

  const page = document.body.dataset.page || "";

  bindLogout();
  bindResetButtons();

  if (page !== "login" && !localStorage.getItem(SESSION_KEY)) {
    window.location.href = "login.html";
    return;
  }

  if (page === "login") {
    initLogin();
    return;
  }

  const data = getData();
  updateSidebarCaja(data);

  const handlers = {
    dashboard: () => renderDashboard(data),
    estudiantes: () => renderStudentsPage(data),
    matricula: () => renderEnrollmentPage(data),
    ingresos: () => renderIncomesPage(data),
    historial: () => renderPaymentHistoryPage(data),
    gastos: () => renderExpensesPage(data),
    cuentas: () => renderAccountsPage(data),
    maestros: () => renderTeachersPage(data),
    inversiones: () => renderInvestmentsPage(data),
    reportes: () => renderReportsPage(data)
  };

  if (handlers[page]) handlers[page]();
});

function createEmptyData() {
  return {
    incomeCategories: ["Mensualidad"],
    expenseCategories: [
      "publicidad",
      "material didáctico",
      "marcadores",
      "impresiones",
      "transporte",
      "otros"
    ],
    investmentCategories: [
      "publicidad",
      "material didáctico",
      "equipo",
      "mejoras",
      "otros"
    ],
    accounts: [
      {
        id: cryptoRandom(),
        name: "Efectivo USD",
        type: "Efectivo",
        initialBalance: 0,
        notes: "Caja en dólares"
      },
      {
        id: cryptoRandom(),
        name: "Efectivo C$",
        type: "Efectivo",
        initialBalance: 0,
        notes: "Caja en córdobas"
      },
      {
        id: cryptoRandom(),
        name: "Banco USD",
        type: "Banco",
        initialBalance: 0,
        notes: "Cuenta bancaria en dólares"
      },
      {
        id: cryptoRandom(),
        name: "Banco C$",
        type: "Banco",
        initialBalance: 0,
        notes: "Cuenta bancaria en córdobas"
      }
    ],
    students: [],
    teachers: [],
    incomes: [],
    expenses: [],
    teacherPayments: [],
    investments: []
  };
}

function seedStorage() {
  const current = localStorage.getItem(STORAGE_KEY);
  const v2 = localStorage.getItem("eea_finances_demo_v2");
  const v1 = localStorage.getItem("eea_finances_demo_v1");

  if (!current) {
    if (v2) {
      localStorage.setItem(STORAGE_KEY, v2);
    } else if (v1) {
      localStorage.setItem(STORAGE_KEY, v1);
    } else {
      saveData(createEmptyData());
    }
  }

  const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || createEmptyData();
  const base = createEmptyData();

  const merged = {
    incomeCategories: Array.isArray(parsed.incomeCategories) ? parsed.incomeCategories : base.incomeCategories,
    expenseCategories: Array.isArray(parsed.expenseCategories) ? parsed.expenseCategories : base.expenseCategories,
    investmentCategories: Array.isArray(parsed.investmentCategories) ? parsed.investmentCategories : base.investmentCategories,
    accounts: Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts : base.accounts,
    students: normalizeStudents(Array.isArray(parsed.students) ? parsed.students : []),
    teachers: normalizeTeachers(Array.isArray(parsed.teachers) ? parsed.teachers : []),
    incomes: normalizeLegacyTimestamps(
      Array.isArray(parsed.incomes) ? parsed.incomes : [],
      "income"
    ).map((item) => ({
      ...item,
      currency: item.currency || "USD",
      exchangeRate: Number(item.exchangeRate || 1),
      originalAmount: item.originalAmount ?? item.amount,
      receiptLevel: item.receiptLevel || item.level || ""
    })),
    expenses: normalizeLegacyTimestamps(
      Array.isArray(parsed.expenses) ? parsed.expenses : [],
      "expense"
    ),
    teacherPayments: normalizeLegacyTimestamps(
      Array.isArray(parsed.teacherPayments) ? parsed.teacherPayments : [],
      "teacher"
    ).map((item) => ({
      ...item,
      subcategory: item.subcategory || "Horas laborales regulares",
      currency: item.currency || "USD",
      exchangeRate: Number(item.exchangeRate || 1),
      originalAmount: item.originalAmount ?? item.amount,
      description: item.description || buildTeacherPaymentDescription(
        item.teacher,
        item.subcategory || "Horas laborales regulares"
      )
    })),
    investments: normalizeLegacyTimestamps(
      Array.isArray(parsed.investments) ? parsed.investments : [],
      "investment"
    )
  };

  saveData(merged);
}

function normalizeStudents(list) {
  return list.map((item) => ({
    id: item.id || cryptoRandom(),
    name: item.name || "",
    level: item.level || "",
    monthlyFee: Number(item.monthlyFee || 0),
    dueDay: Number(item.dueDay || 1),
    status: item.status || "Activo",
    contact: item.contact || "",
    notes: item.notes || "",
    studentType: item.studentType || "adulto",
    motherName: item.motherName || "",
    guardianPhone: item.guardianPhone || "",
    assignedTeacher: item.assignedTeacher || "",
    paymentDate: item.paymentDate || "",
    materialFee: Number(item.materialFee || 0),
    enrollmentDate: item.enrollmentDate || ""
  }));
}

function normalizeTeachers(list) {
  return list.map((item) => ({
    id: item.id || cryptoRandom(),
    name: item.name || "",
    contact: item.contact || "",
    status: item.status || "Activo",
    notes: item.notes || "",
    createdAt: item.createdAt || new Date().toISOString()
  }));
}

function normalizeLegacyTimestamps(list, type) {
  const groupedByDate = {};

  list.forEach((item) => {
    const dateKey = item.date || todayValue();
    if (!Object.prototype.hasOwnProperty.call(groupedByDate, dateKey)) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(item);
  });

  Object.keys(groupedByDate).forEach((dateKey) => {
    groupedByDate[dateKey].forEach((item, index) => {
      if (!item.createdAt) {
        item.createdAt = buildLegacyTimestamp(dateKey, type, index);
      }
    });
  });

  return list;
}

function buildLegacyTimestamp(dateString, type, index) {
  const baseHours = {
    income: 9,
    expense: 11,
    teacher: 14,
    investment: 16
  };

  const baseMinutes = {
    income: 10,
    expense: 20,
    teacher: 30,
    investment: 40
  };

  const hour = Math.min((baseHours[type] || 10) + Math.floor(index / 3), 20);
  const minute = ((baseMinutes[type] || 0) + index * 7) % 60;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  return `${dateString}T${hh}:${mm}:00`;
}

function getData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || createEmptyData();
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function initLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!email || !password) {
      toast("Completa correo y contraseña.");
      return;
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email, at: new Date().toISOString() })
    );

    window.location.href = "index.html";
  });
}

function bindLogout() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = "login.html";
    });
  });
}

function bindResetButtons() {
  document.querySelectorAll("[data-reset-demo]").forEach((button) => {
    button.addEventListener("click", () => {
      const confirmed = window.confirm("Se borrarán todos los datos guardados. ¿Deseas continuar?");
      if (!confirmed) return;

      saveData(createEmptyData());
      toast("Datos reiniciados correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  });
}

function confirmDelete() {
  const entered = window.prompt("Ingresa el código de seguridad para borrar este registro:");
  if (entered === null) return false;
  if (entered.trim() !== DELETE_CODE) {
    toast("Código incorrecto. No se eliminó el registro.");
    return false;
  }
  return true;
}

function renderDashboard(data) {
  const metrics = computeMetrics(data);
  const studentStats = computeStudentStats(data);

  setText("metricIngresosMes", formatCurrency(metrics.incomesMonth));
  setText("metricGastosMes", formatCurrency(metrics.expensesMonth));
  setText("metricBalance", formatCurrency(metrics.balanceMonth));
  setText("metricCaja", formatCurrency(metrics.cajaTotal));
  setText("heroCaja", formatCurrency(metrics.cajaTotal));
  setText("sidebarCaja", formatCurrency(metrics.cajaTotal));

  setText("dashboardStudentsActive", String(studentStats.active));
  setText("dashboardStudentsOnTime", String(studentStats.onTime));
  setText("dashboardStudentsPending", String(studentStats.pending));
  setText("dashboardStudentsLate", String(studentStats.late));

  const recent = buildRecentMovementsWithRunningBalance(data).slice(0, 8);
  const movementContainer = document.getElementById("recentMovements");

  const recentIncome = recent
    .filter((item) => item.positive)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const recentDeductions = recent
    .filter((item) => !item.positive)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const recentNet = recentIncome - recentDeductions;

  setText("recentIncomeTotal", formatCurrency(recentIncome));
  setText("recentDeductionTotal", formatCurrency(recentDeductions));
  setText("recentNetTotal", formatCurrency(recentNet));
  setText("recentBalanceAfter", formatCurrency(metrics.cajaTotal));

  if (movementContainer) {
    movementContainer.innerHTML = recent.length
      ? recent.map((item) => `
        <div class="movement-item">
          <div class="movement-meta">
            <strong>${escapeHtml(item.title)}</strong>
            <small>${item.dateLabel} · ${item.timeLabel} · ${escapeHtml(item.subtitle)}</small>
            <small>Nuevo balance: ${formatCurrency(item.balanceAfter)}</small>
          </div>
          <div class="${item.positive ? "amount-positive" : "amount-negative"}">
            ${item.positive ? "+" : "-"}${formatCurrency(item.amount)}
          </div>
        </div>
      `).join("")
      : emptyMessage("Aún no hay movimientos registrados.");
  }

  const alertsContainer = document.getElementById("studentsAlerts");
  if (alertsContainer) {
    const alerts = studentStats.details
      .filter((item) => item.statusPayment === "Pendiente" || item.statusPayment === "Retrasado")
      .slice(0, 5);

    alertsContainer.innerHTML = alerts.length
      ? alerts.map((student) => `
        <div class="mini-stat-card">
          <span>${escapeHtml(student.name)}</span>
          <strong>${student.statusPayment}</strong>
          <small>Saldo pendiente: ${formatCurrency(student.pendingAmount)}</small>
        </div>
      `).join("")
      : emptyMessage("No hay alumnos pendientes o retrasados.");
  }
}

function renderStudentsPage(data) {
  const form = document.getElementById("studentForm");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        name: form.elements["name"].value.trim(),
        level: form.elements["level"].value.trim(),
        monthlyFee: Number(form.elements["monthlyFee"].value),
        dueDay: Number(form.elements["dueDay"].value),
        status: form.elements["status"].value,
        contact: form.elements["contact"].value.trim(),
        notes: form.elements["notes"].value.trim(),
        studentType: "adulto",
        motherName: "",
        guardianPhone: "",
        assignedTeacher: "",
        paymentDate: "",
        materialFee: 0,
        enrollmentDate: todayValue()
      };

      if (!payload.name || !payload.level || payload.monthlyFee <= 0 || payload.dueDay < 1 || payload.dueDay > 31) {
        toast("Completa correctamente los datos del estudiante.");
        return;
      }

      const exists = data.students.some(
        (student) => student.name.toLowerCase() === payload.name.toLowerCase()
      );

      if (exists) {
        toast("Ya existe un estudiante con ese nombre.");
        return;
      }

      data.students.unshift(payload);
      saveData(data);
      toast("Estudiante guardado correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }

  const stats = computeStudentStats(data);

  setText("studentsActiveCount", String(stats.active));
  setText("studentsOnTimeCount", String(stats.onTime));
  setText("studentsPendingCount", String(stats.pending));
  setText("studentsLateCount", String(stats.late));

  const summaryCards = document.getElementById("studentsSummaryCards");
  if (summaryCards) {
    summaryCards.innerHTML = stats.details.length
      ? stats.details.slice(0, 5).map((student) => `
        <div class="mini-stat-card">
          <span>${escapeHtml(student.name)}</span>
          <strong>${student.statusPayment}</strong>
          <small>Último pago: ${student.lastPayment ? formatDate(student.lastPayment) : "Sin pago"}</small>
          <small>Due date actual: día ${student.dueDay}</small>
        </div>
      `).join("")
      : emptyMessage("Aún no hay estudiantes registrados.");
  }

  const tableBody = document.getElementById("studentsTableBody");
  if (tableBody) {
    tableBody.innerHTML = stats.details.length
      ? stats.details.map((student) => `
        <tr>
          <td>${escapeHtml(student.name)}</td>
          <td>${escapeHtml(student.level)}</td>
          <td>${formatCurrency(student.monthlyFee)}</td>
          <td>${student.lastPayment ? formatDate(student.lastPayment) : "Sin pago"}</td>
          <td>${formatDueDate(student.nextDueDate)}</td>
          <td>${formatCurrency(student.paidThisMonth)}</td>
          <td class="${student.pendingAmount > 0 ? "amount-negative" : "amount-positive"}">${formatCurrency(student.pendingAmount)}</td>
          <td>${student.statusPayment}</td>
          <td>${escapeHtml(student.status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-edit-due-date="${student.id}">
              Cambiar fecha
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="10">No hay estudiantes registrados.</td></tr>`;
  }

  bindStudentDueDateButtons(data);
}

function bindStudentDueDateButtons(data) {
  document.querySelectorAll("[data-edit-due-date]").forEach((button) => {
    button.onclick = () => {
      const studentId = button.getAttribute("data-edit-due-date");
      const student = data.students.find((item) => item.id === studentId);

      if (!student) return;

      const newDueDay = window.prompt(
        `Ingresa el nuevo due date para ${student.name} (día del 1 al 31):`,
        String(student.dueDay || "")
      );

      if (newDueDay === null) return;

      const parsedDay = Number(newDueDay);

      if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        toast("Debes ingresar un día válido entre 1 y 31.");
        return;
      }

      student.dueDay = parsedDay;
      saveData(data);
      toast(`Due date actualizado para ${student.name}.`);
      setTimeout(() => window.location.reload(), 300);
    };
  });
}

function renderEnrollmentPage(data) {
  ensureTeacherCatalog(data);

  const form = document.getElementById("matriculaForm");
  const teacherSelect = document.getElementById("matriculaTeacherSelect");
  const studentTypeSelect = document.getElementById("studentTypeSelect");
  const motherNameField = document.getElementById("motherNameField");
  const guardianPhoneField = document.getElementById("guardianPhoneField");
  const receiptPreview = document.getElementById("receiptPreview");
  const downloadButton = document.getElementById("downloadReceipt");

  let latestEnrollmentReceipt = null;

  fillTeacherSelect(teacherSelect, data.teachers);

  if (form?.elements["paymentDate"]) {
    form.elements["paymentDate"].value = todayValue();
  }

  const toggleDependentFields = () => {
    const isChild = studentTypeSelect?.value === "nino";

    if (motherNameField) {
      motherNameField.classList.toggle("hidden-field", !isChild);
      motherNameField.querySelector("input").required = isChild;
    }

    if (guardianPhoneField) {
      guardianPhoneField.classList.toggle("hidden-field", !isChild);
      guardianPhoneField.querySelector("input").required = isChild;
    }
  };

  toggleDependentFields();

  if (studentTypeSelect) {
    studentTypeSelect.addEventListener("change", toggleDependentFields);
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const studentType = form.elements["studentType"].value;
      const nombre = form.elements["nombre"].value.trim();
      const nivel = form.elements["nivel"].value.trim();
      const docente = form.elements["docente"].value.trim();
      const mensualidad = Number(form.elements["mensualidad"].value);
      const material = Number(form.elements["material"].value);
      const paymentDate = form.elements["paymentDate"].value;
      const dueDay = Number(form.elements["dueDay"].value);
      const motherName = form.elements["motherName"]?.value.trim() || "";
      const guardianPhone = form.elements["guardianPhone"]?.value.trim() || "";
      const notes = form.elements["notes"].value.trim();

      if (!nombre || !nivel || !docente || mensualidad <= 0 || material < 0 || !paymentDate || dueDay < 1 || dueDay > 31) {
        toast("Completa correctamente todos los campos obligatorios.");
        return;
      }

      if (studentType === "nino" && (!motherName || !guardianPhone)) {
        toast("Para estudiantes niños debes agregar nombre de la mamá y teléfono.");
        return;
      }

      const exists = data.students.some(
        (student) => student.name.toLowerCase() === nombre.toLowerCase()
      );

      if (exists) {
        toast("Ya existe un estudiante con ese nombre.");
        return;
      }

      const studentPayload = {
        id: cryptoRandom(),
        name: nombre,
        level: nivel,
        monthlyFee: mensualidad,
        dueDay,
        status: "Activo",
        contact: studentType === "nino" ? guardianPhone : "",
        notes,
        studentType,
        motherName,
        guardianPhone,
        assignedTeacher: docente,
        paymentDate,
        materialFee: material,
        enrollmentDate: todayValue()
      };

      data.students.unshift(studentPayload);
      saveData(data);

      latestEnrollmentReceipt = {
        studentName: nombre,
        level: nivel,
        assignedTeacher: docente,
        monthlyFee: mensualidad,
        materialFee: material,
        paymentDate,
        dueDay,
        studentType,
        motherName,
        guardianPhone,
        notes,
        generatedAt: new Date().toISOString()
      };

      if (receiptPreview) {
        receiptPreview.innerHTML = buildEnrollmentReceiptPreview(latestEnrollmentReceipt);
      }

      toast("Matrícula guardada correctamente. El estudiante ya aparece en la sección Estudiantes.");
      form.reset();
      if (form.elements["paymentDate"]) {
        form.elements["paymentDate"].value = todayValue();
      }
      toggleDependentFields();
      fillTeacherSelect(teacherSelect, data.teachers);
    });
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      if (!latestEnrollmentReceipt) {
        toast("Primero genera una matrícula para descargar el comprobante.");
        return;
      }

      generateEnrollmentReceiptPDF(latestEnrollmentReceipt);
    });
  }
}

function buildEnrollmentReceiptPreview(receipt) {
  return `
    <div class="mini-stat-card">
      <span>Estudiante</span>
      <strong>${escapeHtml(receipt.studentName)}</strong>
      <small>Nivel: ${escapeHtml(receipt.level)}</small>
      <small>Docente asignado: ${escapeHtml(receipt.assignedTeacher)}</small>
      <small>Fecha de pago: ${formatDate(receipt.paymentDate)}</small>
      <small>Due date: día ${receipt.dueDay}</small>
      <small>Mensualidad: ${formatCurrency(receipt.monthlyFee)}</small>
      <small>Material: ${formatCurrency(receipt.materialFee)}</small>
      <small>Tipo: ${receipt.studentType === "nino" ? "Niño" : "Adulto"}</small>
      ${receipt.studentType === "nino" ? `<small>Mamá: ${escapeHtml(receipt.motherName)}</small>` : ""}
      ${receipt.studentType === "nino" ? `<small>Teléfono: ${escapeHtml(receipt.guardianPhone)}</small>` : ""}
      <small>Total inicial: ${formatCurrency(receipt.monthlyFee + receipt.materialFee)}</small>
    </div>
  `;
}

function generateEnrollmentReceiptPDF(receipt) {
  const safeStudentName = sanitizeFileName(receipt.studentName || "estudiante");
  const safeDate = (receipt.paymentDate || todayValue()).replaceAll("-", "_");
  const documentTitle = `Matricula_${safeStudentName}_${safeDate}`;
  const total = Number(receipt.monthlyFee || 0) + Number(receipt.materialFee || 0);

  const receiptWindow = window.open("", "_blank", "width=920,height=1100");
  if (!receiptWindow) {
    toast("Tu navegador bloqueó la ventana del comprobante.");
    return;
  }

  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${documentTitle}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", Arial, sans-serif;
          background: #eef3f8;
          color: #10233b;
          padding: 32px;
        }
        .receipt-sheet {
          max-width: 880px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(16, 35, 59, 0.18);
          border: 1px solid rgba(16, 35, 59, 0.08);
        }
        .receipt-top {
          background: linear-gradient(135deg, #0e2238, #18457c 60%, #2f6fd0);
          color: white;
          padding: 36px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .brand img {
          width: 92px;
          height: 92px;
          object-fit: cover;
          background: rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 6px;
        }
        .brand h1 {
          margin: 0 0 6px;
          font-size: 1.7rem;
        }
        .brand p {
          margin: 0;
          opacity: 0.9;
        }
        .receipt-body {
          padding: 34px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }
        .detail-card {
          border: 1px solid rgba(16, 35, 59, 0.08);
          border-radius: 18px;
          padding: 18px;
          background: #fbfdff;
        }
        .detail-card span {
          display: block;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6d7f94;
          margin-bottom: 8px;
        }
        .detail-card strong {
          display: block;
          font-size: 1.08rem;
          color: #10233b;
        }
        .amount-box {
          margin-top: 10px;
          background: linear-gradient(135deg, #0f2742, #173e6c);
          color: white;
          border-radius: 22px;
          padding: 24px;
        }
        .amount-box span {
          display: block;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 0.82rem;
          margin-bottom: 10px;
        }
        .amount-box strong {
          font-size: 2.3rem;
          display: block;
          margin-bottom: 8px;
        }
        .amount-box small {
          opacity: 0.86;
          display: block;
        }
        .print-actions {
          max-width: 880px;
          margin: 18px auto 0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .print-actions button {
          border: 0;
          border-radius: 12px;
          padding: 12px 16px;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .btn-print {
          background: #1e4f92;
          color: white;
        }
        .btn-close {
          background: #dfe8f2;
          color: #10233b;
        }
        @media print {
          body {
            background: white;
            padding: 0;
          }
          .print-actions {
            display: none;
          }
          .receipt-sheet {
            box-shadow: none;
            border: none;
            border-radius: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-sheet">
        <div class="receipt-top">
          <div class="brand">
            <img src="foto8.jpg.jpg" alt="Logo Academia" />
            <div>
              <h1>Expressive English Academy</h1>
              <p>Comprobante de matrícula</p>
            </div>
          </div>
        </div>

        <div class="receipt-body">
          <div class="detail-grid">
            <div class="detail-card">
              <span>Estudiante</span>
              <strong>${escapeHtml(receipt.studentName)}</strong>
            </div>

            <div class="detail-card">
              <span>Nivel</span>
              <strong>${escapeHtml(receipt.level)}</strong>
            </div>

            <div class="detail-card">
              <span>Docente asignado</span>
              <strong>${escapeHtml(receipt.assignedTeacher)}</strong>
            </div>

            <div class="detail-card">
              <span>Fecha de pago</span>
              <strong>${formatDate(receipt.paymentDate)}</strong>
            </div>

            <div class="detail-card">
              <span>Due date</span>
              <strong>Día ${receipt.dueDay}</strong>
            </div>

            <div class="detail-card">
              <span>Tipo de estudiante</span>
              <strong>${receipt.studentType === "nino" ? "Niño" : "Adulto"}</strong>
            </div>

            ${receipt.studentType === "nino" ? `
              <div class="detail-card">
                <span>Nombre de la mamá</span>
                <strong>${escapeHtml(receipt.motherName)}</strong>
              </div>

              <div class="detail-card">
                <span>Teléfono</span>
                <strong>${escapeHtml(receipt.guardianPhone)}</strong>
              </div>
            ` : ""}

            <div class="detail-card">
              <span>Mensualidad</span>
              <strong>${formatCurrency(receipt.monthlyFee)}</strong>
            </div>

            <div class="detail-card">
              <span>Material</span>
              <strong>${formatCurrency(receipt.materialFee)}</strong>
            </div>
          </div>

          <div class="amount-box">
            <span>Total inicial</span>
            <strong>${formatCurrency(total)}</strong>
            <small>Incluye mensualidad y material.</small>
          </div>
        </div>
      </div>

      <div class="print-actions">
        <button class="btn-close" onclick="window.close()">Cerrar</button>
        <button class="btn-print" onclick="window.print()">Descargar / Guardar PDF</button>
      </div>
    </body>
    </html>
  `);

  receiptWindow.document.close();
}

function renderIncomesPage(data) {
  fillSelect("incomeCategorySelect", data.incomeCategories);
  fillSelect("incomeAccountSelect", data.accounts.map((a) => a.name));

  const form = document.getElementById("incomeForm");
  if (form) {
    form.date.value = todayValue();

    const studentInput = form.elements["student"];
    if (studentInput) {
      studentInput.setAttribute("list", ensureStudentDatalist(data.students));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const currency = form.elements["currency"].value;
      let exchangeRate = 1;

      if (currency === "NIO") {
        const rateInput = window.prompt("Ingresa la tasa de conversión C$ por 1 USD:", "36.50");
        exchangeRate = Number(rateInput);

        if (!exchangeRate || exchangeRate <= 0) {
          toast("Debes ingresar una tasa válida.");
          return;
        }
      }

      const originalAmount = Number(form.elements["amount"].value);
      const amountUsd = currency === "NIO" ? originalAmount / exchangeRate : originalAmount;

      const payload = {
        id: cryptoRandom(),
        date: form.elements["date"].value,
        createdAt: new Date().toISOString(),
        student: form.elements["student"].value.trim(),
        level: form.elements["level"].value.trim(),
        receiptLevel: form.elements["level"].value.trim(),
        concept: form.elements["concept"].value.trim(),
        category: form.elements["category"].value,
        method: form.elements["method"].value,
        currency,
        exchangeRate,
        originalAmount,
        amount: amountUsd,
        notes: form.elements["notes"].value.trim(),
        account: form.elements["account"].value
      };

      if (!payload.date || !payload.student || !payload.level || !payload.concept || payload.originalAmount <= 0) {
        toast("Completa correctamente todos los campos del ingreso.");
        return;
      }

      data.incomes.unshift(payload);
      syncIncomeToStudent(data, payload);
      saveData(data);
      toast("Ingreso guardado correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }

  const table = document.getElementById("incomeTableBody");
  if (table) {
    table.innerHTML = data.incomes.length
      ? data.incomes.map((item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(item.student)}</td>
          <td>${escapeHtml(item.level)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(item.concept)}</td>
          <td>${escapeHtml(item.method)}</td>
          <td>${escapeHtml(item.currency || "USD")}</td>
          <td>${formatOriginalCurrency(item.originalAmount ?? item.amount, item.currency || "USD")}</td>
          <td>${item.currency === "NIO" ? item.exchangeRate : "1.00"}</td>
          <td class="amount-positive">${formatCurrency(item.amount)}</td>
          <td>${escapeHtml(item.account)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-receipt-id="${item.id}">
              Recibo PDF
            </button>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" data-delete-income="${item.id}">
              Borrar
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="13">No hay ingresos registrados.</td></tr>`;
  }

  bindReceiptButtons(data);
  bindDeleteIncomeButtons(data);

  setText("incomeTotalCount", String(data.incomes.length));
  setText("incomeTotalAmount", formatCurrency(sumBy(data.incomes, "amount")));
  setText("incomeLastStudent", data.incomes[0]?.student || "Sin datos");
}

function renderTeachersPage(data) {
  ensureTeacherCatalog(data);

  const form = document.getElementById("teacherForm");
  const teacherSelect = document.getElementById("teacherSelect");
  const subcategorySelect = document.getElementById("teacherSubcategorySelect");
  const descriptionPreview = document.getElementById("teacherDescriptionPreview");
  const teacherModal = document.getElementById("teacherModal");
  const teacherProfileForm = document.getElementById("teacherProfileForm");
  const openTeacherModalBtn = document.getElementById("openTeacherModalBtn");
  const openTeacherModalInlineBtn = document.getElementById("openTeacherModalInlineBtn");
  const closeTeacherModalBtn = document.getElementById("closeTeacherModalBtn");

  fillTeacherSelect(teacherSelect, data.teachers);
  updateTeacherDescriptionPreview();

  if (openTeacherModalBtn) {
    openTeacherModalBtn.addEventListener("click", () => openTeacherModal(teacherModal, teacherProfileForm));
  }

  if (openTeacherModalInlineBtn) {
    openTeacherModalInlineBtn.addEventListener("click", () => openTeacherModal(teacherModal, teacherProfileForm));
  }

  if (closeTeacherModalBtn) {
    closeTeacherModalBtn.addEventListener("click", () => closeTeacherModal(teacherModal, teacherProfileForm));
  }

  if (teacherModal) {
    teacherModal.addEventListener("click", (event) => {
      if (event.target === teacherModal) {
        closeTeacherModal(teacherModal, teacherProfileForm);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && teacherModal?.classList.contains("is-open")) {
      closeTeacherModal(teacherModal, teacherProfileForm);
    }
  });

  if (teacherSelect) {
    teacherSelect.addEventListener("change", updateTeacherDescriptionPreview);
  }

  if (subcategorySelect) {
    subcategorySelect.addEventListener("change", updateTeacherDescriptionPreview);
  }

  if (teacherProfileForm) {
    teacherProfileForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        name: teacherProfileForm.elements["name"].value.trim(),
        contact: teacherProfileForm.elements["contact"].value.trim(),
        status: teacherProfileForm.elements["status"].value,
        notes: teacherProfileForm.elements["notes"].value.trim(),
        createdAt: new Date().toISOString()
      };

      if (!payload.name) {
        toast("Ingresa el nombre del maestro.");
        return;
      }

      const exists = data.teachers.some(
        (teacher) => teacher.name.toLowerCase() === payload.name.toLowerCase()
      );

      if (exists) {
        toast("Ya existe un maestro con ese nombre.");
        return;
      }

      data.teachers.unshift(payload);
      saveData(data);
      fillTeacherSelect(teacherSelect, data.teachers);
      if (teacherSelect) teacherSelect.value = payload.name;
      updateTeacherDescriptionPreview();
      closeTeacherModal(teacherModal, teacherProfileForm);
      toast("Maestro registrado correctamente.");
      renderTeacherSummary(data);
    });
  }

  if (form) {
    form.date.value = todayValue();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const teacher = form.elements["teacher"].value.trim();
      const subcategory = form.elements["subcategory"].value;
      const currency = form.elements["currency"].value;

      let exchangeRate = 1;
      if (currency === "NIO") {
        const rateInput = window.prompt("Ingresa la tasa de conversión C$ por 1 USD:", "36.50");
        exchangeRate = Number(rateInput);

        if (!exchangeRate || exchangeRate <= 0) {
          toast("Debes ingresar una tasa válida.");
          return;
        }
      }

      const originalAmount = Number(form.elements["amount"].value);
      const amountUsd = currency === "NIO" ? originalAmount / exchangeRate : originalAmount;

      const payload = {
        id: cryptoRandom(),
        teacher,
        date: form.elements["date"].value,
        createdAt: new Date().toISOString(),
        subcategory,
        description: buildTeacherPaymentDescription(teacher, subcategory),
        currency,
        exchangeRate,
        originalAmount,
        amount: amountUsd,
        period: form.elements["period"].value.trim(),
        notes: form.elements["notes"].value.trim()
      };

      if (!payload.teacher || !payload.date || payload.originalAmount <= 0 || !payload.period) {
        toast("Completa correctamente todos los campos del pago.");
        return;
      }

      data.teacherPayments.unshift(payload);
      saveData(data);
      toast("Pago registrado correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }

  renderTeacherSummary(data);

  function updateTeacherDescriptionPreview() {
    if (!descriptionPreview) return;
    const teacherName = teacherSelect?.value || "";
    const subcategory = subcategorySelect?.value || "";
    descriptionPreview.value = buildTeacherPaymentDescription(teacherName, subcategory);
  }
}

function renderTeacherSummary(data) {
  const activeTeachers = data.teachers.filter((item) => item.status === "Activo");

  setText("teacherRegisteredCount", String(activeTeachers.length));
  setText("teacherPaymentsCount", String(data.teacherPayments.length));
  setText("teacherPaymentsTotal", formatCurrency(sumBy(data.teacherPayments, "amount")));

  const table = document.getElementById("teacherTableBody");
  if (table) {
    table.innerHTML = data.teacherPayments.length
      ? data.teacherPayments.map((item) => `
        <tr>
          <td>${escapeHtml(item.teacher)}</td>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(item.subcategory || "-")}</td>
          <td>${escapeHtml(item.description || buildTeacherPaymentDescription(item.teacher, item.subcategory))}</td>
          <td>${escapeHtml(item.currency || "USD")}</td>
          <td>${formatOriginalCurrency(item.originalAmount ?? item.amount, item.currency || "USD")}</td>
          <td>${item.currency === "NIO" ? Number(item.exchangeRate || 1).toFixed(2) : "1.00"}</td>
          <td class="amount-negative">${formatCurrency(item.amount)}</td>
          <td>${escapeHtml(item.period)}</td>
          <td>${escapeHtml(item.notes || "-")}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-teacher-receipt-id="${item.id}">
              Recibo PDF
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="11">No hay pagos a maestros registrados.</td></tr>`;
  }

  bindTeacherReceiptButtons(data);

  const summary = summarizeBy(data.teacherPayments, "teacher");
  const summaryContainer = document.getElementById("teacherSummaryCards");
  if (summaryContainer) {
    const entries = Object.entries(summary);
    summaryContainer.innerHTML = entries.length
      ? entries.map(([teacher, amount]) => `
        <div class="mini-stat-card">
          <span>${escapeHtml(teacher)}</span>
          <strong>${formatCurrency(amount)}</strong>
          <small>Total acumulado pagado</small>
        </div>
      `).join("")
      : emptyMessage("Aún no hay pagos registrados.");
  }

  const profilesTable = document.getElementById("teacherProfilesTableBody");
  if (profilesTable) {
    profilesTable.innerHTML = data.teachers.length
      ? data.teachers.map((teacher) => {
        const payments = data.teacherPayments.filter(
          (item) => item.teacher.toLowerCase() === teacher.name.toLowerCase()
        );
        const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const lastPayment = payments.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date || null;

        return `
          <tr>
            <td>${escapeHtml(teacher.name)}</td>
            <td>${escapeHtml(teacher.contact || "-")}</td>
            <td>${escapeHtml(teacher.status)}</td>
            <td>${formatCurrency(totalPaid)}</td>
            <td>${payments.length}</td>
            <td>${lastPayment ? formatDate(lastPayment) : "-"}</td>
            <td>
              <button class="btn btn-secondary btn-sm" data-delete-teacher="${teacher.id}">
                Borrar
              </button>
            </td>
          </tr>
        `;
      }).join("")
      : `<tr><td colspan="7">No hay maestros registrados.</td></tr>`;
  }

  bindDeleteTeacherButtons(data);

  const breakdownContainer = document.getElementById("teacherBreakdownCards");
  if (breakdownContainer) {
    const teachersWithTotals = data.teachers.map((teacher) => {
      const payments = data.teacherPayments.filter(
        (item) => item.teacher.toLowerCase() === teacher.name.toLowerCase()
      );

      const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const bySubcategory = payments.reduce((acc, item) => {
        const key = item.subcategory || "Sin categoría";
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {});

      return {
        teacher,
        total,
        paymentCount: payments.length,
        bySubcategory
      };
    });

    breakdownContainer.innerHTML = teachersWithTotals.length
      ? teachersWithTotals.map(({ teacher, total, paymentCount, bySubcategory }) => {
        const subRows = Object.entries(bySubcategory)
          .sort((a, b) => b[1] - a[1])
          .map(([label, amount]) => `
            <div class="teacher-breakdown-item">
              <span>${escapeHtml(label)}</span>
              <strong>${formatCurrency(amount)}</strong>
            </div>
          `)
          .join("");

        return `
          <div class="mini-stat-card">
            <span>${escapeHtml(teacher.name)}</span>
            <strong>${formatCurrency(total)}</strong>
            <small>${paymentCount} pago(s) registrados</small>
            <div class="teacher-breakdown-list">
              ${subRows || `<span>Sin pagos registrados</span>`}
            </div>
          </div>
        `;
      }).join("")
      : emptyMessage("No hay maestros registrados para mostrar el desglose.");
  }
}

function bindTeacherReceiptButtons(data) {
  document.querySelectorAll("[data-teacher-receipt-id]").forEach((button) => {
    button.onclick = () => {
      const id = button.getAttribute("data-teacher-receipt-id");
      generateTeacherReceiptPDF(data, id);
    };
  });
}

function generateTeacherReceiptPDF(data, paymentId) {
  const payment = data.teacherPayments.find((item) => item.id === paymentId);
  if (!payment) {
    toast("No se encontró el pago para generar el recibo.");
    return;
  }

  const teacherProfile = data.teachers.find(
    (item) => item.name.toLowerCase() === payment.teacher.toLowerCase()
  );

  const safeTeacherName = sanitizeFileName(payment.teacher || "maestro");
  const safeDate = (payment.date || todayValue()).replaceAll("-", "_");
  const documentTitle = `Colilla_${safeTeacherName}_${safeDate}`;
  const receiptNumber = `PMA-${payment.date.replaceAll("-", "")}-${payment.id.slice(0, 4).toUpperCase()}`;
  const amountOriginal = formatOriginalCurrency(payment.originalAmount ?? payment.amount, payment.currency || "USD");
  const amountUsd = formatCurrency(payment.amount);

  const receiptWindow = window.open("", "_blank", "width=920,height=1100");
  if (!receiptWindow) {
    toast("Tu navegador bloqueó la ventana del comprobante.");
    return;
  }

  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${documentTitle}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", Arial, sans-serif;
          background: #eef3f8;
          color: #10233b;
          padding: 32px;
        }
        .receipt-sheet {
          max-width: 880px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(16, 35, 59, 0.18);
          border: 1px solid rgba(16, 35, 59, 0.08);
        }
        .receipt-top {
          background: linear-gradient(135deg, #0e2238, #18457c 60%, #2f6fd0);
          color: white;
          padding: 36px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .brand img {
          width: 92px;
          height: 92px;
          object-fit: cover;
          background: rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 6px;
        }
        .brand h1 {
          margin: 0 0 6px;
          font-size: 1.7rem;
        }
        .brand p {
          margin: 0;
          opacity: 0.9;
        }
        .receipt-body {
          padding: 34px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }
        .detail-card {
          border: 1px solid rgba(16, 35, 59, 0.08);
          border-radius: 18px;
          padding: 18px;
          background: #fbfdff;
        }
        .detail-card span {
          display: block;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6d7f94;
          margin-bottom: 8px;
        }
        .detail-card strong {
          display: block;
          font-size: 1.08rem;
          color: #10233b;
        }
        .amount-box {
          margin-top: 10px;
          background: linear-gradient(135deg, #0f2742, #173e6c);
          color: white;
          border-radius: 22px;
          padding: 24px;
        }
        .amount-box span {
          display: block;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 0.82rem;
          margin-bottom: 10px;
        }
        .amount-box strong {
          font-size: 2.3rem;
          display: block;
          margin-bottom: 8px;
        }
        .amount-box small {
          opacity: 0.86;
          display: block;
        }
        .print-actions {
          max-width: 880px;
          margin: 18px auto 0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .print-actions button {
          border: 0;
          border-radius: 12px;
          padding: 12px 16px;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .btn-print {
          background: #1e4f92;
          color: white;
        }
        .btn-close {
          background: #dfe8f2;
          color: #10233b;
        }
        @media print {
          body {
            background: white;
            padding: 0;
          }
          .print-actions {
            display: none;
          }
          .receipt-sheet {
            box-shadow: none;
            border: none;
            border-radius: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-sheet">
        <div class="receipt-top">
          <div class="brand">
            <img src="foto8.jpg.jpg" alt="Logo Academia" />
            <div>
              <h1>Expressive English Academy</h1>
              <p>Comprobante de pago a maestro</p>
            </div>
          </div>
        </div>

        <div class="receipt-body">
          <div class="detail-grid">
            <div class="detail-card">
              <span>Fecha de pago</span>
              <strong>${formatDate(payment.date)}</strong>
            </div>

            <div class="detail-card">
              <span>Profesor</span>
              <strong>${escapeHtml(payment.teacher)}</strong>
            </div>

            <div class="detail-card">
              <span>Subcategoría</span>
              <strong>${escapeHtml(payment.subcategory || "-")}</strong>
            </div>

            <div class="detail-card">
              <span>Período</span>
              <strong>${escapeHtml(payment.period || "-")}</strong>
            </div>

            <div class="detail-card">
              <span>Descripción</span>
              <strong>${escapeHtml(payment.description || "-")}</strong>
            </div>

            <div class="detail-card">
              <span>Contacto</span>
              <strong>${escapeHtml(teacherProfile?.contact || "-")}</strong>
            </div>
          </div>

          <div class="amount-box">
            <span>Monto pagado</span>
            <strong>${amountOriginal}</strong>
            <small>Equivalente en USD: ${amountUsd}</small>
          </div>
        </div>
      </div>

      <div class="print-actions">
        <button class="btn-close" onclick="window.close()">Cerrar</button>
        <button class="btn-print" onclick="window.print()">Descargar / Guardar PDF</button>
      </div>
    </body>
    </html>
  `);

  receiptWindow.document.close();
}

function bindDeleteTeacherButtons(data) {
  document.querySelectorAll("[data-delete-teacher]").forEach((button) => {
    button.onclick = () => {
      const teacherId = button.getAttribute("data-delete-teacher");
      const teacher = data.teachers.find((item) => item.id === teacherId);
      if (!teacher) return;

      const confirmed = window.confirm(
        `Se eliminará el maestro ${teacher.name} y también todos sus pagos registrados. ¿Deseas continuar?`
      );
      if (!confirmed) return;
      if (!confirmDelete()) return;

      data.teachers = data.teachers.filter((item) => item.id !== teacherId);
      data.teacherPayments = data.teacherPayments.filter(
        (item) => item.teacher.toLowerCase() !== teacher.name.toLowerCase()
      );

      saveData(data);
      toast("Maestro y pagos asociados eliminados correctamente.");
      setTimeout(() => window.location.reload(), 300);
    };
  });
}

function ensureTeacherCatalog(data) {
  if (!Array.isArray(data.teachers)) {
    data.teachers = [];
  }

  const namesFromPayments = Array.from(new Set(
    data.teacherPayments
      .map((item) => (item.teacher || "").trim())
      .filter(Boolean)
  ));

  let changed = false;

  namesFromPayments.forEach((name) => {
    const exists = data.teachers.some((teacher) => teacher.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      data.teachers.push({
        id: cryptoRandom(),
        name,
        contact: "",
        status: "Activo",
        notes: "Importado desde pagos existentes",
        createdAt: new Date().toISOString()
      });
      changed = true;
    }
  });

  if (changed) {
    saveData(data);
  }
}

function fillTeacherSelect(select, teachers) {
  if (!select) return;

  const activeTeachers = teachers.filter((item) => item.status === "Activo");
  select.innerHTML = activeTeachers.length
    ? activeTeachers.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")
    : `<option value="">Primero registra un maestro</option>`;
}

function openTeacherModal(modal, form) {
  if (!modal) return;
  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    form?.elements["name"]?.focus();
  }, 30);
}

function closeTeacherModal(modal, form) {
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
  form?.reset();
  if (form?.elements["status"]) {
    form.elements["status"].value = "Activo";
  }
}

function buildTeacherPaymentDescription(teacher, subcategory) {
  const cleanTeacher = teacher || "sin nombre";
  const cleanSubcategory = (subcategory || "pago docente").toLowerCase();
  return `Pago al profesor ${cleanTeacher} por ${cleanSubcategory}`;
}

function computeMetrics(data) {
  const totalIncome = sumBy(data.incomes, "amount");
  const totalExpenses =
    sumBy(data.expenses, "amount") +
    sumBy(data.teacherPayments, "amount") +
    sumBy(data.investments, "amount");

  const totalBalance = totalIncome - totalExpenses;
  const month = currentMonth();
  const year = currentYear();

  const incomesMonth = data.incomes
    .filter((item) => isSameMonth(item.date, month, year))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const expensesMonth =
    data.expenses.filter((item) => isSameMonth(item.date, month, year)).reduce((sum, item) => sum + Number(item.amount || 0), 0) +
    data.teacherPayments.filter((item) => isSameMonth(item.date, month, year)).reduce((sum, item) => sum + Number(item.amount || 0), 0) +
    data.investments.filter((item) => isSameMonth(item.date, month, year)).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const balanceMonth = incomesMonth - expensesMonth;
  const cajaTotal = getAccountBalances(data).reduce((sum, item) => sum + item.current, 0);

  return {
    totalIncome,
    totalExpenses,
    totalBalance,
    incomesMonth,
    expensesMonth,
    balanceMonth,
    cajaTotal
  };
}

function updateSidebarCaja(data) {
  const metrics = computeMetrics(data);
  setText("sidebarCaja", formatCurrency(metrics.cajaTotal));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatOriginalCurrency(value, currency) {
  if (currency === "NIO") {
    return new Intl.NumberFormat("es-NI", {
      style: "currency",
      currency: "NIO",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }
  return formatCurrency(value);
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTime(isoString) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDueDate(date) {
  if (!date) return "-";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function sumBy(list, field) {
  return list.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function currentMonth() {
  return new Date().getMonth();
}

function currentYear() {
  return new Date().getFullYear();
}

function todayValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizeFileName(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isSameMonth(dateString, month, year) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getMonth() === month && date.getFullYear() === year;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function addToMap(map, key, value) {
  map[key] = (map[key] || 0) + Number(value || 0);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function emptyMessage(message) {
  return `<div class="mini-stat-card"><span>${escapeHtml(message)}</span></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);

  setTimeout(() => node.remove(), 2200);
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}
