const STORAGE_KEY = "eea_finances_app_v4";
const SESSION_KEY = "eea_finances_session";

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
    students: Array.isArray(parsed.students) ? parsed.students : [],
    incomes: Array.isArray(parsed.incomes)
      ? parsed.incomes.map((item) => ({
          ...item,
          currency: item.currency || "USD",
          exchangeRate: item.exchangeRate || 1,
          originalAmount: item.originalAmount ?? item.amount,
          receiptLevel: item.receiptLevel || item.level || ""
        }))
      : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    teacherPayments: Array.isArray(parsed.teacherPayments) ? parsed.teacherPayments : [],
    investments: Array.isArray(parsed.investments) ? parsed.investments : []
  };

  saveData(merged);
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

  const recent = buildRecentMovements(data).slice(0, 6);
  const movementContainer = document.getElementById("recentMovements");
  if (movementContainer) {
    movementContainer.innerHTML = recent.length
      ? recent.map((item) => `
        <div class="movement-item">
          <div class="movement-meta">
            <strong>${item.title}</strong>
            <small>${item.dateLabel} · ${item.subtitle}</small>
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
          <span>${student.name}</span>
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
        notes: form.elements["notes"].value.trim()
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
          <span>${student.name}</span>
          <strong>${student.statusPayment}</strong>
          <small>Último pago: ${student.lastPayment ? formatDate(student.lastPayment) : "Sin pago"}</small>
        </div>
      `).join("")
      : emptyMessage("Aún no hay estudiantes registrados.");
  }

  const tableBody = document.getElementById("studentsTableBody");
  if (tableBody) {
    tableBody.innerHTML = stats.details.length
      ? stats.details.map((student) => `
        <tr>
          <td>${student.name}</td>
          <td>${student.level}</td>
          <td>${formatCurrency(student.monthlyFee)}</td>
          <td>${student.lastPayment ? formatDate(student.lastPayment) : "Sin pago"}</td>
          <td>${formatDueDate(student.nextDueDate)}</td>
          <td>${formatCurrency(student.paidThisMonth)}</td>
          <td class="${student.pendingAmount > 0 ? "amount-negative" : "amount-positive"}">${formatCurrency(student.pendingAmount)}</td>
          <td>${student.statusPayment}</td>
          <td>${student.status}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="9">No hay estudiantes registrados.</td></tr>`;
  }
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
          <td>${item.student}</td>
          <td>${item.level}</td>
          <td>${item.category}</td>
          <td>${item.concept}</td>
          <td>${item.method}</td>
          <td>${item.currency || "USD"}</td>
          <td>${formatOriginalCurrency(item.originalAmount ?? item.amount, item.currency || "USD")}</td>
          <td>${item.currency === "NIO" ? item.exchangeRate : "1.00"}</td>
          <td class="amount-positive">${formatCurrency(item.amount)}</td>
          <td>${item.account}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-receipt-id="${item.id}">
              Recibo PDF
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="12">No hay ingresos registrados.</td></tr>`;
  }

  bindReceiptButtons(data);

  setText("incomeTotalCount", String(data.incomes.length));
  setText("incomeTotalAmount", formatCurrency(sumBy(data.incomes, "amount")));
  setText("incomeLastStudent", data.incomes[0]?.student || "Sin datos");
}

function renderPaymentHistoryPage(data) {
  const searchInput = document.getElementById("paymentHistorySearch");
  const currencySelect = document.getElementById("paymentHistoryCurrency");
  const orderSelect = document.getElementById("paymentHistoryOrder");
  const tableBody = document.getElementById("paymentHistoryTableBody");

  const renderRows = () => {
    let items = [...data.incomes];

    const search = (searchInput?.value || "").trim().toLowerCase();
    const currency = currencySelect?.value || "all";
    const order = orderSelect?.value || "desc";

    if (search) {
      items = items.filter((item) =>
        item.student.toLowerCase().includes(search) ||
        item.level.toLowerCase().includes(search) ||
        item.concept.toLowerCase().includes(search)
      );
    }

    if (currency !== "all") {
      items = items.filter((item) => (item.currency || "USD") === currency);
    }

    items.sort((a, b) => {
      if (order === "asc") return new Date(a.date) - new Date(b.date);
      return new Date(b.date) - new Date(a.date);
    });

    if (tableBody) {
      tableBody.innerHTML = items.length
        ? items.map((item) => `
          <tr>
            <td>${formatDate(item.date)}</td>
            <td>${item.student}</td>
            <td>${item.receiptLevel || item.level || "-"}</td>
            <td>${item.concept}</td>
            <td>${item.method}</td>
            <td>${item.currency || "USD"}</td>
            <td>${formatOriginalCurrency(item.originalAmount ?? item.amount, item.currency || "USD")}</td>
            <td class="amount-positive">${formatCurrency(item.amount)}</td>
            <td>${item.account}</td>
            <td>
              <button class="btn btn-secondary btn-sm" data-receipt-id="${item.id}">
                Generar recibo
              </button>
            </td>
          </tr>
        `).join("")
        : `<tr><td colspan="10">No se encontraron pagos.</td></tr>`;
    }

    bindReceiptButtons(data);
  };

  setText("historyTotalCount", String(data.incomes.length));
  setText("historyTotalAmount", formatCurrency(sumBy(data.incomes, "amount")));
  setText("historyLastDate", data.incomes[0]?.date ? formatDate(data.incomes[0].date) : "-");
  setText("historyReceiptCount", String(data.incomes.length));

  [searchInput, currencySelect, orderSelect].forEach((element) => {
    if (!element) return;
    element.addEventListener("input", renderRows);
    element.addEventListener("change", renderRows);
  });

  renderRows();
}

function bindReceiptButtons(data) {
  document.querySelectorAll("[data-receipt-id]").forEach((button) => {
    button.onclick = () => {
      const id = button.getAttribute("data-receipt-id");
      generateReceiptPDF(data, id);
    };
  });
}

function generateReceiptPDF(data, incomeId) {
  const income = data.incomes.find((item) => item.id === incomeId);
  if (!income) {
    toast("No se encontró el ingreso para generar el recibo.");
    return;
  }

  const editedLevel = window.prompt(
    "Puedes editar el nivel para este recibo:",
    income.receiptLevel || income.level || ""
  );

  if (editedLevel === null) return;

  income.receiptLevel = editedLevel.trim() || income.level || "";
  saveData(data);

  const receiptNumber = `REC-${income.date.replaceAll("-", "")}-${income.id.slice(0, 4).toUpperCase()}`;
  const amountOriginal = formatOriginalCurrency(income.originalAmount ?? income.amount, income.currency || "USD");
  const amountUsd = formatCurrency(income.amount);
  const academyLogo = "foto8.jpg.jpg";

  const receiptWindow = window.open("", "_blank", "width=900,height=1100");

  if (!receiptWindow) {
    toast("Tu navegador bloqueó la ventana del recibo.");
    return;
  }

  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Recibo ${receiptNumber}</title>
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
          max-width: 850px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(16, 35, 59, 0.18);
          border: 1px solid rgba(16, 35, 59, 0.08);
        }
        .receipt-top {
          background: linear-gradient(135deg, #0e2238, #1e4f92 60%, #2f6fd0);
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
        .receipt-tag {
          text-align: right;
        }
        .receipt-tag span {
          display: block;
          font-size: 0.82rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.85;
        }
        .receipt-tag strong {
          display: block;
          margin-top: 10px;
          font-size: 1.2rem;
        }
        .receipt-body {
          padding: 34px;
        }
        .intro-box {
          background: linear-gradient(135deg, #f4f8fc, #ffffff);
          border: 1px solid rgba(16, 35, 59, 0.08);
          border-radius: 20px;
          padding: 22px;
          margin-bottom: 24px;
        }
        .intro-box h2 {
          margin: 0 0 8px;
          color: #0f2b4b;
        }
        .intro-box p {
          margin: 0;
          color: #50657f;
          line-height: 1.6;
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
        .footer-note {
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px dashed rgba(16, 35, 59, 0.18);
          color: #5c6f85;
          line-height: 1.7;
        }
        .print-actions {
          max-width: 850px;
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
            <img src="${academyLogo}" alt="Logo Academia" />
            <div>
              <h1>Expressive English Academy</h1>
              <p>Recibo de pago</p>
            </div>
          </div>

          <div class="receipt-tag">
            <span>Recibo</span>
            <strong>${receiptNumber}</strong>
          </div>
        </div>

        <div class="receipt-body">
          <div class="intro-box">
            <h2>Pago recibido correctamente</h2>
            <p>
              Este documento confirma la recepción del pago realizado a
              Expressive English Academy.
            </p>
          </div>

          <div class="detail-grid">
            <div class="detail-card">
              <span>Fecha de pago</span>
              <strong>${formatDate(income.date)}</strong>
            </div>

            <div class="detail-card">
              <span>Estudiante</span>
              <strong>${income.student}</strong>
            </div>

            <div class="detail-card">
              <span>Nivel</span>
              <strong>${income.receiptLevel || income.level || "-"}</strong>
            </div>

            <div class="detail-card">
              <span>Concepto</span>
              <strong>${income.concept}</strong>
            </div>

            <div class="detail-card">
              <span>Método de pago</span>
              <strong>${income.method}</strong>
            </div>

            <div class="detail-card">
              <span>Cuenta destino</span>
              <strong>${income.account}</strong>
            </div>
          </div>

          <div class="amount-box">
            <span>Monto recibido</span>
            <strong>${amountOriginal}</strong>
            <small>Equivalente en USD: ${amountUsd}</small>
          </div>

          <div class="footer-note">
            Gracias por confiar en Expressive English Academy.
            Este recibo fue generado desde la plataforma privada de administración financiera.
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

function renderExpensesPage(data) {
  fillSelect("expenseCategorySelect", data.expenseCategories);
  fillSelect("expenseAccountSelect", data.accounts.map((a) => a.name));
  renderTagList("expenseCategoriesList", data.expenseCategories);

  const form = document.getElementById("expenseForm");
  if (form) {
    form.date.value = todayValue();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        date: form.elements["date"].value,
        description: form.elements["description"].value.trim(),
        category: form.elements["category"].value,
        amount: Number(form.elements["amount"].value),
        account: form.elements["account"].value,
        notes: form.elements["notes"].value.trim()
      };

      if (!payload.date || !payload.description || payload.amount <= 0) {
        toast("Completa correctamente todos los campos del gasto.");
        return;
      }

      data.expenses.unshift(payload);
      saveData(data);
      toast("Gasto guardado correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }

  const categoryForm = document.getElementById("expenseCategoryForm");
  if (categoryForm) {
    categoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = categoryForm.elements["categoryName"].value.trim().toLowerCase();
      if (!name) return;

      if (!data.expenseCategories.includes(name)) {
        data.expenseCategories.push(name);
        saveData(data);
        toast("Categoría agregada.");
        setTimeout(() => window.location.reload(), 300);
      } else {
        toast("Esa categoría ya existe.");
      }
    });
  }

  const table = document.getElementById("expenseTableBody");
  if (table) {
    table.innerHTML = data.expenses.length
      ? data.expenses.map((item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${item.description}</td>
          <td>${item.category}</td>
          <td class="amount-negative">${formatCurrency(item.amount)}</td>
          <td>${item.account}</td>
          <td>${item.notes || "-"}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="6">No hay gastos registrados.</td></tr>`;
  }

  setText("expenseTotalAmount", formatCurrency(sumBy(data.expenses, "amount")));
  setText("expenseTotalCount", String(data.expenses.length));
  setText("expenseTopCategory", topCategory(data.expenses, "category"));
}

function renderAccountsPage(data) {
  const balances = getAccountBalances(data);

  const cards = document.getElementById("accountsCards");
  if (cards) {
    cards.innerHTML = balances.map((account) => `
      <article class="metric-card glass-card">
        <span class="eyebrow">${account.type}</span>
        <h3>${formatCurrency(account.current)}</h3>
        <p>${account.name}</p>
      </article>
    `).join("");
  }

  const table = document.getElementById("accountsTableBody");
  if (table) {
    table.innerHTML = balances.map((account) => `
      <tr>
        <td>${account.name}</td>
        <td>${account.type}</td>
        <td>${formatCurrency(account.initialBalance)}</td>
        <td class="${account.current >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(account.current)}</td>
        <td>${account.notes || "-"}</td>
      </tr>
    `).join("");
  }

  const total = balances.reduce((sum, item) => sum + item.current, 0);
  setText("accountsTotal", formatCurrency(total));
  setText("accountsSidebarTotal", formatCurrency(total));
  setText("accountsCount", String(balances.length));
  setText("accountsPrimaryName", balances[0]?.name || "Sin datos");

  const form = document.getElementById("accountForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        name: form.elements["name"].value.trim(),
        type: form.elements["type"].value,
        initialBalance: Number(form.elements["initialBalance"].value),
        notes: form.elements["notes"].value.trim()
      };

      if (!payload.name || Number.isNaN(payload.initialBalance)) {
        toast("Completa correctamente la cuenta.");
        return;
      }

      data.accounts.push(payload);
      saveData(data);
      toast("Cuenta guardada correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }
}

function renderTeachersPage(data) {
  const form = document.getElementById("teacherForm");
  if (form) {
    form.date.value = todayValue();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        teacher: form.elements["teacher"].value.trim(),
        date: form.elements["date"].value,
        amount: Number(form.elements["amount"].value),
        period: form.elements["period"].value.trim(),
        notes: form.elements["notes"].value.trim()
      };

      if (!payload.teacher || !payload.date || payload.amount <= 0 || !payload.period) {
        toast("Completa correctamente todos los campos del pago.");
        return;
      }

      data.teacherPayments.unshift(payload);
      saveData(data);
      toast("Pago registrado correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }

  const table = document.getElementById("teacherTableBody");
  if (table) {
    table.innerHTML = data.teacherPayments.length
      ? data.teacherPayments.map((item) => `
        <tr>
          <td>${item.teacher}</td>
          <td>${formatDate(item.date)}</td>
          <td class="amount-negative">${formatCurrency(item.amount)}</td>
          <td>${item.period}</td>
          <td>${item.notes || "-"}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="5">No hay pagos a maestros registrados.</td></tr>`;
  }

  const summary = summarizeBy(data.teacherPayments, "teacher");
  const container = document.getElementById("teacherSummaryCards");
  if (container) {
    const entries = Object.entries(summary);
    container.innerHTML = entries.length
      ? entries.map(([teacher, amount]) => `
        <div class="mini-stat-card">
          <span>${teacher}</span>
          <strong>${formatCurrency(amount)}</strong>
          <small>Total acumulado pagado</small>
        </div>
      `).join("")
      : emptyMessage("Aún no hay pagos registrados.");
  }
}

function renderInvestmentsPage(data) {
  fillSelect("investmentCategorySelect", data.investmentCategories);
  fillSelect("investmentAccountSelect", data.accounts.map((a) => a.name));
  renderTagList("investmentCategoriesList", data.investmentCategories);

  const form = document.getElementById("investmentForm");
  if (form) {
    form.date.value = todayValue();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        date: form.elements["date"].value,
        concept: form.elements["concept"].value.trim(),
        category: form.elements["category"].value,
        amount: Number(form.elements["amount"].value),
        account: form.elements["account"].value,
        notes: form.elements["notes"].value.trim()
      };

      if (!payload.date || !payload.concept || payload.amount <= 0) {
        toast("Completa correctamente todos los campos de la inversión.");
        return;
      }

      data.investments.unshift(payload);
      saveData(data);
      toast("Inversión guardada correctamente.");
      setTimeout(() => window.location.reload(), 300);
    });
  }

  const categoryForm = document.getElementById("investmentCategoryForm");
  if (categoryForm) {
    categoryForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = categoryForm.elements["categoryName"].value.trim().toLowerCase();
      if (!name) return;

      if (!data.investmentCategories.includes(name)) {
        data.investmentCategories.push(name);
        saveData(data);
        toast("Categoría agregada.");
        setTimeout(() => window.location.reload(), 300);
      } else {
        toast("Esa categoría ya existe.");
      }
    });
  }

  const table = document.getElementById("investmentTableBody");
  if (table) {
    table.innerHTML = data.investments.length
      ? data.investments.map((item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${item.concept}</td>
          <td>${item.category}</td>
          <td class="amount-negative">${formatCurrency(item.amount)}</td>
          <td>${item.account}</td>
          <td>${item.notes || "-"}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="6">No hay inversiones registradas.</td></tr>`;
  }

  setText("investmentTotalAmount", formatCurrency(sumBy(data.investments, "amount")));
  setText("investmentTotalCount", String(data.investments.length));
  setText("investmentLastItem", data.investments[0]?.concept || "Sin datos");
}

function renderReportsPage(data) {
  const metrics = computeMetrics(data);
  const studentStats = computeStudentStats(data);

  setText("reportIncome", formatCurrency(metrics.totalIncome));
  setText("reportExpenses", formatCurrency(metrics.totalExpenses));
  setText("reportBalance", formatCurrency(metrics.totalBalance));
  setText("reportCaja", formatCurrency(metrics.cajaTotal));

  setText("reportStudentsActive", String(studentStats.active));
  setText("reportStudentsOnTime", String(studentStats.onTime));
  setText("reportStudentsPending", String(studentStats.pending));
  setText("reportStudentsLate", String(studentStats.late));

  const categories = buildCategoryReport(data);
  const categoryBars = document.getElementById("categoryBars");
  const maxCategory = Math.max(...categories.map((item) => item.amount), 1);

  if (categoryBars) {
    categoryBars.innerHTML = categories.length
      ? categories.map((item) => `
        <div class="bar-row">
          <div class="bar-row-head">
            <strong>${item.label}</strong>
            <span>${formatCurrency(item.amount)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(item.amount / maxCategory) * 100}%"></div>
          </div>
        </div>
      `).join("")
      : emptyMessage("No hay datos para generar categorías.");
  }

  const teacherSummary = summarizeBy(data.teacherPayments, "teacher");
  const teacherCards = document.getElementById("teacherReportCards");
  if (teacherCards) {
    const entries = Object.entries(teacherSummary);
    teacherCards.innerHTML = entries.length
      ? entries.map(([teacher, amount]) => `
        <div class="mini-stat-card">
          <span>${teacher}</span>
          <strong>${formatCurrency(amount)}</strong>
          <small>Pagos acumulados</small>
        </div>
      `).join("")
      : emptyMessage("No hay pagos a maestros registrados.");
  }

  const studentCards = document.getElementById("studentStatusCards");
  if (studentCards) {
    studentCards.innerHTML = studentStats.details.length
      ? studentStats.details.slice(0, 6).map((student) => `
        <div class="mini-stat-card">
          <span>${student.name}</span>
          <strong>${student.statusPayment}</strong>
          <small>Saldo pendiente: ${formatCurrency(student.pendingAmount)}</small>
        </div>
      `).join("")
      : emptyMessage("No hay estudiantes registrados.");
  }

  const summaryTable = document.getElementById("reportSummaryTable");
  if (summaryTable) {
    summaryTable.innerHTML = `
      <tr><td>Ingresos acumulados</td><td>${formatCurrency(metrics.totalIncome)}</td></tr>
      <tr><td>Gastos operativos</td><td>${formatCurrency(sumBy(data.expenses, "amount"))}</td></tr>
      <tr><td>Pagos a maestros</td><td>${formatCurrency(sumBy(data.teacherPayments, "amount"))}</td></tr>
      <tr><td>Inversiones</td><td>${formatCurrency(sumBy(data.investments, "amount"))}</td></tr>
      <tr><td>Balance general</td><td>${formatCurrency(metrics.totalBalance)}</td></tr>
      <tr><td>Total en caja</td><td>${formatCurrency(metrics.cajaTotal)}</td></tr>
      <tr><td>Estudiantes activos</td><td>${studentStats.active}</td></tr>
      <tr><td>Al día</td><td>${studentStats.onTime}</td></tr>
      <tr><td>Pendientes</td><td>${studentStats.pending}</td></tr>
      <tr><td>Retrasados</td><td>${studentStats.late}</td></tr>
    `;
  }

  const downloadButton = document.getElementById("downloadMonthlyReportBtn");
  if (downloadButton) {
    downloadButton.addEventListener("click", () => downloadCurrentMonthReport(data, studentStats));
  }
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

function computeStudentStats(data) {
  const activeStudents = data.students.filter((student) => student.status === "Activo");

  const details = activeStudents.map((student) => {
    const payments = data.incomes
      .filter((income) => income.student.toLowerCase() === student.name.toLowerCase())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const lastPayment = payments[0]?.date || null;
    const paidThisMonth = payments
      .filter((payment) => isSameMonth(payment.date, currentMonth(), currentYear()))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const pendingAmount = Math.max(Number(student.monthlyFee || 0) - paidThisMonth, 0);
    const nextDueDate = buildDueDate(student.dueDay);

    let statusPayment = "Pendiente";
    if (pendingAmount <= 0) {
      statusPayment = "Al día";
    } else if (new Date() > nextDueDate) {
      statusPayment = "Retrasado";
    }

    return {
      ...student,
      lastPayment,
      paidThisMonth,
      pendingAmount,
      nextDueDate,
      statusPayment
    };
  });

  return {
    active: activeStudents.length,
    onTime: details.filter((item) => item.statusPayment === "Al día").length,
    pending: details.filter((item) => item.statusPayment === "Pendiente").length,
    late: details.filter((item) => item.statusPayment === "Retrasado").length,
    details: details.sort((a, b) => {
      const order = { "Retrasado": 0, "Pendiente": 1, "Al día": 2 };
      return order[a.statusPayment] - order[b.statusPayment];
    })
  };
}

function getAccountBalances(data) {
  return data.accounts.map((account) => {
    const incomeTotal = data.incomes
      .filter((item) => item.account === account.name)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expenseTotal = data.expenses
      .filter((item) => item.account === account.name)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const investmentTotal = data.investments
      .filter((item) => item.account === account.name)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const teacherTotal = account.name === "Banco USD"
      ? sumBy(data.teacherPayments, "amount")
      : 0;

    const current = Number(account.initialBalance || 0) + incomeTotal - expenseTotal - investmentTotal - teacherTotal;

    return { ...account, current };
  });
}

function syncIncomeToStudent(data, income) {
  const foundStudent = data.students.find(
    (student) => student.name.toLowerCase() === income.student.toLowerCase()
  );
  if (!foundStudent) return;
  if (!foundStudent.level && income.level) {
    foundStudent.level = income.level;
  }
}

function buildRecentMovements(data) {
  const entries = [
    ...data.incomes.map((item) => ({
      title: item.student,
      subtitle: `${item.concept} · ${item.account}`,
      amount: item.amount,
      date: item.date,
      positive: true
    })),
    ...data.expenses.map((item) => ({
      title: item.description,
      subtitle: `${item.category} · ${item.account}`,
      amount: item.amount,
      date: item.date,
      positive: false
    })),
    ...data.teacherPayments.map((item) => ({
      title: item.teacher,
      subtitle: `Pago ${item.period}`,
      amount: item.amount,
      date: item.date,
      positive: false
    })),
    ...data.investments.map((item) => ({
      title: item.concept,
      subtitle: `${item.category} · ${item.account}`,
      amount: item.amount,
      date: item.date,
      positive: false
    }))
  ];

  return entries
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((item) => ({ ...item, dateLabel: formatDate(item.date) }));
}

function buildCategoryReport(data) {
  const map = {};
  data.expenses.forEach((item) => addToMap(map, `Gasto: ${capitalize(item.category)}`, item.amount));
  data.investments.forEach((item) => addToMap(map, `Inversión: ${capitalize(item.category)}`, item.amount));
  addToMap(map, "Pagos a maestros", sumBy(data.teacherPayments, "amount"));

  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function summarizeBy(list, field) {
  return list.reduce((acc, item) => {
    acc[item[field]] = (acc[item[field]] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
}

function topCategory(list, field) {
  if (!list.length) return "Sin datos";
  const summary = list.reduce((acc, item) => {
    acc[item[field]] = (acc[item[field]] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
  return Object.entries(summary).sort((a, b) => b[1] - a[1])[0][0];
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderTagList(id, items) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = items.map((item) => `<div class="tag-item">${capitalize(item)}</div>`).join("");
}

function ensureStudentDatalist(students) {
  const id = "studentsDatalist";
  let datalist = document.getElementById(id);

  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = id;
    document.body.appendChild(datalist);
  }

  datalist.innerHTML = students
    .filter((student) => student.status === "Activo")
    .map((student) => `<option value="${student.name}"></option>`)
    .join("");

  return id;
}

function buildDueDate(dueDay) {
  const year = currentYear();
  const month = currentMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(Number(dueDay || 1), lastDay);
  return new Date(year, month, safeDay, 23, 59, 59);
}

function downloadCurrentMonthReport(data, studentStats) {
  const month = currentMonth();
  const year = currentYear();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric"
  });

  const incomes = data.incomes.filter((item) => isSameMonth(item.date, month, year));

  const rows = [
    ["Reporte mensual", monthLabel],
    ["Ingresos", sumBy(incomes, "amount")],
    ["Estudiantes activos", studentStats.active],
    ["Al día", studentStats.onTime],
    ["Pendientes", studentStats.pending],
    ["Retrasados", studentStats.late],
    [],
    ["Ingresos"],
    ["Fecha", "Estudiante", "Nivel", "Concepto", "Categoría", "Método", "Moneda", "Monto original", "Tasa", "Monto USD", "Cuenta"],
    ...incomes.map((item) => [
      item.date,
      item.student,
      item.level,
      item.concept,
      item.category,
      item.method,
      item.currency || "USD",
      item.originalAmount ?? item.amount,
      item.exchangeRate || 1,
      item.amount,
      item.account
    ])
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte_mensual_${year}-${String(month + 1).padStart(2, "0")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  toast("Reporte mensual descargado.");
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
  return `<div class="mini-stat-card"><span>${message}</span></div>`;
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
