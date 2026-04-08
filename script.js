const STORAGE_KEY = "eea_finances_demo_v1";
const SESSION_KEY = "eea_finances_session";

const defaults = {
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
      name: "Efectivo",
      type: "Efectivo",
      initialBalance: 1200,
      notes: "Caja física para cobros directos"
    },
    {
      id: cryptoRandom(),
      name: "Cuenta en banco principal",
      type: "Banco",
      initialBalance: 5800,
      notes: "Cuenta operativa principal"
    }
  ],
  incomes: [
    {
      id: cryptoRandom(),
      date: "2026-04-02",
      student: "José Esteban",
      level: "Intermedio B1",
      concept: "Mensualidad abril",
      category: "Mensualidad",
      method: "Transferencia",
      amount: 1200,
      notes: "Pago puntual",
      account: "Cuenta en banco principal"
    },
    {
      id: cryptoRandom(),
      date: "2026-04-03",
      student: "Valeria Gómez",
      level: "Básico A2",
      concept: "Mensualidad abril",
      category: "Mensualidad",
      method: "Efectivo",
      amount: 950,
      notes: "Pago en recepción",
      account: "Efectivo"
    },
    {
      id: cryptoRandom(),
      date: "2026-04-05",
      student: "Luis Fernando Ruiz",
      level: "Avanzado C1",
      concept: "Mensualidad abril",
      category: "Mensualidad",
      method: "Transferencia",
      amount: 1350,
      notes: "Pago completo",
      account: "Cuenta en banco principal"
    },
    {
      id: cryptoRandom(),
      date: "2026-04-06",
      student: "Camila Torres",
      level: "Kids A1",
      concept: "Mensualidad abril",
      category: "Mensualidad",
      method: "Depósito",
      amount: 880,
      notes: "Incluye material",
      account: "Cuenta en banco principal"
    }
  ],
  expenses: [
    {
      id: cryptoRandom(),
      date: "2026-04-02",
      description: "Campaña de anuncios en redes",
      category: "publicidad",
      amount: 420,
      account: "Cuenta en banco principal",
      notes: "Promoción de cursos intensivos"
    },
    {
      id: cryptoRandom(),
      date: "2026-04-04",
      description: "Compra de marcadores y hojas",
      category: "marcadores",
      amount: 95,
      account: "Efectivo",
      notes: "Suministros de salón"
    },
    {
      id: cryptoRandom(),
      date: "2026-04-05",
      description: "Impresión de guías",
      category: "impresiones",
      amount: 130,
      account: "Efectivo",
      notes: "Material para grupos A2"
    }
  ],
  teacherPayments: [
    {
      id: cryptoRandom(),
      teacher: "María Fernanda López",
      date: "2026-04-04",
      amount: 1200,
      period: "Abril 2026",
      notes: "Pago primera quincena"
    },
    {
      id: cryptoRandom(),
      teacher: "Carlos Mendoza",
      date: "2026-04-06",
      amount: 980,
      period: "Abril 2026",
      notes: "Clases nocturnas"
    }
  ],
  investments: [
    {
      id: cryptoRandom(),
      date: "2026-04-03",
      concept: "Micrófono para clases online",
      category: "equipo",
      amount: 240,
      account: "Cuenta en banco principal",
      notes: "Mejora de audio"
    },
    {
      id: cryptoRandom(),
      date: "2026-04-07",
      concept: "Diseño de material visual",
      category: "mejoras",
      amount: 310,
      account: "Cuenta en banco principal",
      notes: "Renovación de recursos"
    }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  seedStorage();
  const page = document.body.dataset.page || "";
  bindLogout();

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
    ingresos: () => renderIncomesPage(data),
    gastos: () => renderExpensesPage(data),
    cuentas: () => renderAccountsPage(data),
    maestros: () => renderTeachersPage(data),
    inversiones: () => renderInvestmentsPage(data),
    reportes: () => renderReportsPage(data)
  };

  if (handlers[page]) handlers[page]();
});

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

    localStorage.setItem(SESSION_KEY, JSON.stringify({ email, at: new Date().toISOString() }));
    toast("Acceso concedido.");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
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

function renderDashboard(data) {
  const metrics = computeMetrics(data);

  setText("metricIngresosMes", formatCurrency(metrics.incomesMonth));
  setText("metricGastosMes", formatCurrency(metrics.expensesMonth));
  setText("metricBalance", formatCurrency(metrics.balanceMonth));
  setText("metricCaja", formatCurrency(metrics.cajaTotal));
  setText("heroCaja", formatCurrency(metrics.cajaTotal));

  const movementContainer = document.getElementById("recentMovements");
  const recent = buildRecentMovements(data).slice(0, 6);
  movementContainer.innerHTML = recent.map((item) => `
    <div class="movement-item">
      <div class="movement-meta">
        <strong>${item.title}</strong>
        <small>${item.dateLabel} · ${item.subtitle}</small>
      </div>
      <div class="${item.positive ? "amount-positive" : "amount-negative"}">
        ${item.positive ? "+" : "-"}${formatCurrency(item.amount)}
      </div>
    </div>
  `).join("");

  const accountsSummary = document.getElementById("accountsSummary");
  const accountBalances = getAccountBalances(data);
  accountsSummary.innerHTML = accountBalances.map((account) => `
    <div class="account-mini-item">
      <div>
        <strong>${account.name}</strong>
        <span>${account.type}</span>
      </div>
      <div class="${account.current >= 0 ? "amount-positive" : "amount-negative"}">
        ${formatCurrency(account.current)}
      </div>
    </div>
  `).join("");

  setText("sidebarCaja", formatCurrency(metrics.cajaTotal));
}

function renderIncomesPage(data) {
  fillSelect("incomeCategorySelect", data.incomeCategories);
  fillSelect("incomeAccountSelect", data.accounts.map((a) => a.name));

  const form = document.getElementById("incomeForm");
  if (form) {
    form.date.value = todayValue();
    form.category.value = data.incomeCategories[0] || "Mensualidad";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = {
        id: cryptoRandom(),
        date: form.date.value,
        student: form.student.value.trim(),
        level: form.level.value.trim(),
        concept: form.concept.value.trim(),
        category: form.category.value,
        method: form.method.value,
        amount: Number(form.amount.value),
        notes: form.notes.value.trim(),
        account: form.account.value
      };

      if (!payload.date || !payload.student || !payload.level || !payload.concept || payload.amount <= 0) {
        toast("Completa correctamente todos los campos del ingreso.");
        return;
      }

      data.incomes.unshift(payload);
      saveData(data);
      toast("Ingreso guardado correctamente.");
      window.location.reload();
    });
  }

  document.getElementById("incomeTableBody").innerHTML = data.incomes.map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${item.student}</td>
      <td>${item.level}</td>
      <td>${item.category}</td>
      <td>${item.concept}</td>
      <td>${item.method}</td>
      <td class="amount-positive">${formatCurrency(item.amount)}</td>
      <td>${item.account}</td>
    </tr>
  `).join("");

  setText("incomeTotalCount", data.incomes.length);
  setText("incomeTotalAmount", formatCurrency(sumBy(data.incomes, "amount")));
  setText("incomeLastStudent", data.incomes[0]?.student || "Sin datos");
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
        date: form.date.value,
        description: form.description.value.trim(),
        category: form.category.value,
        amount: Number(form.amount.value),
        account: form.account.value,
        notes: form.notes.value.trim()
      };

      if (!payload.date || !payload.description || payload.amount <= 0) {
        toast("Completa correctamente todos los campos del gasto.");
        return;
      }

      data.expenses.unshift(payload);
      saveData(data);
      toast("Gasto guardado correctamente.");
      window.location.reload();
    });
  }

  const categoryForm = document.getElementById("expenseCategoryForm");
  if (categoryForm) {
    categoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = categoryForm.categoryName.value.trim().toLowerCase();
      if (!name) return;

      if (!data.expenseCategories.includes(name)) {
        data.expenseCategories.push(name);
        saveData(data);
        toast("Categoría agregada.");
        window.location.reload();
      } else {
        toast("Esa categoría ya existe.");
      }
    });
  }

  document.getElementById("expenseTableBody").innerHTML = data.expenses.map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${item.description}</td>
      <td>${item.category}</td>
      <td class="amount-negative">${formatCurrency(item.amount)}</td>
      <td>${item.account}</td>
      <td>${item.notes || "-"}</td>
    </tr>
  `).join("");

  setText("expenseTotalAmount", formatCurrency(sumBy(data.expenses, "amount")));
  setText("expenseTotalCount", data.expenses.length);
  setText("expenseTopCategory", topCategory(data.expenses, "category"));
}

function renderAccountsPage(data) {
  const balances = getAccountBalances(data);

  document.getElementById("accountsCards").innerHTML = balances.map((account) => `
    <article class="metric-card glass-card">
      <span class="eyebrow">${account.type}</span>
      <h3>${formatCurrency(account.current)}</h3>
      <p>${account.name}</p>
    </article>
  `).join("");

  document.getElementById("accountsTableBody").innerHTML = balances.map((account) => `
    <tr>
      <td>${account.name}</td>
      <td>${account.type}</td>
      <td>${formatCurrency(account.initialBalance)}</td>
      <td class="${account.current >= 0 ? "amount-positive" : "amount-negative"}">${formatCurrency(account.current)}</td>
      <td>${account.notes || "-"}</td>
    </tr>
  `).join("");

  const total = balances.reduce((sum, item) => sum + item.current, 0);
  setText("accountsTotal", formatCurrency(total));
  setText("accountsSidebarTotal", formatCurrency(total));
  setText("accountsCount", balances.length);
  setText("accountsPrimaryName", balances[0]?.name || "Sin datos");

  const form = document.getElementById("accountForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        id: cryptoRandom(),
        name: form.name.value.trim(),
        type: form.type.value,
        initialBalance: Number(form.initialBalance.value),
        notes: form.notes.value.trim()
      };

      if (!payload.name || Number.isNaN(payload.initialBalance)) {
        toast("Completa correctamente la cuenta.");
        return;
      }

      data.accounts.push(payload);
      saveData(data);
      toast("Cuenta guardada correctamente.");
      window.location.reload();
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
        teacher: form.teacher.value.trim(),
        date: form.date.value,
        amount: Number(form.amount.value),
        period: form.period.value.trim(),
        notes: form.notes.value.trim()
      };

      if (!payload.teacher || !payload.date || payload.amount <= 0 || !payload.period) {
        toast("Completa correctamente todos los campos del pago.");
        return;
      }

      data.teacherPayments.unshift(payload);
      saveData(data);
      toast("Pago registrado correctamente.");
      window.location.reload();
    });
  }

  document.getElementById("teacherTableBody").innerHTML = data.teacherPayments.map((item) => `
    <tr>
      <td>${item.teacher}</td>
      <td>${formatDate(item.date)}</td>
      <td class="amount-negative">${formatCurrency(item.amount)}</td>
      <td>${item.period}</td>
      <td>${item.notes || "-"}</td>
    </tr>
  `).join("");

  const summary = summarizeBy(data.teacherPayments, "teacher");
  document.getElementById("teacherSummaryCards").innerHTML = Object.entries(summary).map(([teacher, amount]) => `
    <div class="mini-stat-card">
      <span>${teacher}</span>
      <strong>${formatCurrency(amount)}</strong>
      <small>Total acumulado pagado</small>
    </div>
  `).join("");
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
        date: form.date.value,
        concept: form.concept.value.trim(),
        category: form.category.value,
        amount: Number(form.amount.value),
        account: form.account.value,
        notes: form.notes.value.trim()
      };

      if (!payload.date || !payload.concept || payload.amount <= 0) {
        toast("Completa correctamente todos los campos de la inversión.");
        return;
      }

      data.investments.unshift(payload);
      saveData(data);
      toast("Inversión guardada correctamente.");
      window.location.reload();
    });
  }

  const categoryForm = document.getElementById("investmentCategoryForm");
  if (categoryForm) {
    categoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = categoryForm.categoryName.value.trim().toLowerCase();
      if (!name) return;

      if (!data.investmentCategories.includes(name)) {
        data.investmentCategories.push(name);
        saveData(data);
        toast("Categoría agregada.");
        window.location.reload();
      } else {
        toast("Esa categoría ya existe.");
      }
    });
  }

  document.getElementById("investmentTableBody").innerHTML = data.investments.map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${item.concept}</td>
      <td>${item.category}</td>
      <td class="amount-negative">${formatCurrency(item.amount)}</td>
      <td>${item.account}</td>
      <td>${item.notes || "-"}</td>
    </tr>
  `).join("");

  setText("investmentTotalAmount", formatCurrency(sumBy(data.investments, "amount")));
  setText("investmentTotalCount", data.investments.length);
  setText("investmentLastItem", data.investments[0]?.concept || "Sin datos");
}

function renderReportsPage(data) {
  const metrics = computeMetrics(data);

  setText("reportIncome", formatCurrency(metrics.totalIncome));
  setText("reportExpenses", formatCurrency(metrics.totalExpenses));
  setText("reportBalance", formatCurrency(metrics.totalBalance));
  setText("reportCaja", formatCurrency(metrics.cajaTotal));

  const categories = buildCategoryReport(data);
  const maxCategory = Math.max(...categories.map((item) => item.amount), 1);

  document.getElementById("categoryBars").innerHTML = categories.map((item) => `
    <div class="bar-row">
      <div class="bar-row-head">
        <strong>${item.label}</strong>
        <span>${formatCurrency(item.amount)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(item.amount / maxCategory) * 100}%"></div>
      </div>
    </div>
  `).join("");

  const teacherSummary = summarizeBy(data.teacherPayments, "teacher");
  document.getElementById("teacherReportCards").innerHTML = Object.entries(teacherSummary).map(([teacher, amount]) => `
    <div class="mini-stat-card">
      <span>${teacher}</span>
      <strong>${formatCurrency(amount)}</strong>
      <small>Pagos acumulados</small>
    </div>
  `).join("");

  const compareMax = Math.max(metrics.totalIncome, metrics.totalExpenses, 1);
  document.getElementById("comparisonBars").innerHTML = `
    <div class="comparison-bar-card">
      <strong>Ingresos</strong>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(metrics.totalIncome / compareMax) * 100}%"></div>
      </div>
      <small class="subtle">${formatCurrency(metrics.totalIncome)}</small>
    </div>
    <div class="comparison-bar-card">
      <strong>Egresos</strong>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(metrics.totalExpenses / compareMax) * 100}%"></div>
      </div>
      <small class="subtle">${formatCurrency(metrics.totalExpenses)}</small>
    </div>
  `;

  document.getElementById("reportSummaryTable").innerHTML = `
    <tr><td>Ingresos acumulados</td><td>${formatCurrency(metrics.totalIncome)}</td></tr>
    <tr><td>Gastos operativos</td><td>${formatCurrency(sumBy(data.expenses, "amount"))}</td></tr>
    <tr><td>Pagos a maestros</td><td>${formatCurrency(sumBy(data.teacherPayments, "amount"))}</td></tr>
    <tr><td>Inversiones</td><td>${formatCurrency(sumBy(data.investments, "amount"))}</td></tr>
    <tr><td>Balance general</td><td>${formatCurrency(metrics.totalBalance)}</td></tr>
    <tr><td>Total en caja</td><td>${formatCurrency(metrics.cajaTotal)}</td></tr>
  `;
}

function computeMetrics(data) {
  const totalIncome = sumBy(data.incomes, "amount");
  const operationalExpenses = sumBy(data.expenses, "amount");
  const teacherExpenses = sumBy(data.teacherPayments, "amount");
  const investmentExpenses = sumBy(data.investments, "amount");
  const totalExpenses = operationalExpenses + teacherExpenses + investmentExpenses;
  const totalBalance = totalIncome - totalExpenses;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const incomesMonth = data.incomes
    .filter((item) => isCurrentMonth(item.date, currentMonth, currentYear))
    .reduce((sum, item) => sum + item.amount, 0);

  const expensesMonth =
    data.expenses.filter((item) => isCurrentMonth(item.date, currentMonth, currentYear)).reduce((sum, item) => sum + item.amount, 0) +
    data.teacherPayments.filter((item) => isCurrentMonth(item.date, currentMonth, currentYear)).reduce((sum, item) => sum + item.amount, 0) +
    data.investments.filter((item) => isCurrentMonth(item.date, currentMonth, currentYear)).reduce((sum, item) => sum + item.amount, 0);

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

function getAccountBalances(data) {
  return data.accounts.map((account) => {
    const incomeTotal = data.incomes
      .filter((item) => item.account === account.name)
      .reduce((sum, item) => sum + item.amount, 0);

    const expenseTotal = data.expenses
      .filter((item) => item.account === account.name)
      .reduce((sum, item) => sum + item.amount, 0);

    const investmentTotal = data.investments
      .filter((item) => item.account === account.name)
      .reduce((sum, item) => sum + item.amount, 0);

    const teacherTotal = account.name === "Cuenta en banco principal"
      ? sumBy(data.teacherPayments, "amount")
      : 0;

    const current = account.initialBalance + incomeTotal - expenseTotal - investmentTotal - teacherTotal;

    return { ...account, current };
  });
}

function buildRecentMovements(data) {
  const entries = [
    ...data.incomes.map((item) => ({
      type: "Ingreso",
      title: item.student,
      subtitle: `${item.concept} · ${item.account}`,
      amount: item.amount,
      date: item.date,
      positive: true
    })),
    ...data.expenses.map((item) => ({
      type: "Gasto",
      title: item.description,
      subtitle: `${item.category} · ${item.account}`,
      amount: item.amount,
      date: item.date,
      positive: false
    })),
    ...data.teacherPayments.map((item) => ({
      type: "Maestro",
      title: item.teacher,
      subtitle: `Pago ${item.period}`,
      amount: item.amount,
      date: item.date,
      positive: false
    })),
    ...data.investments.map((item) => ({
      type: "Inversión",
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
    acc[item[field]] = (acc[item[field]] || 0) + item.amount;
    return acc;
  }, {});
}

function topCategory(list, field) {
  if (!list.length) return "Sin datos";
  const summary = list.reduce((acc, item) => {
    acc[item[field]] = (acc[item[field]] || 0) + item.amount;
    return acc;
  }, {});
  return Object.entries(summary).sort((a, b) => b[1] - a[1])[0][0];
}

function renderTagList(id, items) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = items.map((item) => `<div class="tag-item">${capitalize(item)}</div>`).join("");
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function updateSidebarCaja(data) {
  const metrics = computeMetrics(data);
  setText("sidebarCaja", formatCurrency(metrics.cajaTotal));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function getData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function seedStorage() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  }
}

function sumBy(list, field) {
  return list.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function todayValue() {
  return new Date().toISOString().split("T")[0];
}

function isCurrentMonth(dateString, month, year) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getMonth() === month && date.getFullYear() === year;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function addToMap(map, key, value) {
  map[key] = (map[key] || 0) + value;
}

function toast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);

  setTimeout(() => {
    node.remove();
  }, 2400);
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}
