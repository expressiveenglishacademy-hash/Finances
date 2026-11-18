/* Shared calculations for EEA Finances.
   Loaded before script.js. No network and no writes. */
(function (root) {
  const MONTHS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  function stripAccents(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function nameKey(name) {
    return stripAccents(name).trim().replace(/\s+/g, " ");
  }

  function padMonth(month) {
    return String(month).padStart(2, "0");
  }

  function monthKey(year, month) {
    return `${year}-${padMonth(month)}`;
  }

  function paymentText(payment) {
    return `${payment.concept || ""} ${payment.notes || ""} ${payment.description || ""}`;
  }

  function paymentMonthOf(payment) {
    const text = paymentText(payment);
    const assigned = text.match(/\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/i);
    if (assigned) return assigned[1];

    const clean = stripAccents(text);
    const match = clean.match(
      /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?:\s+(20\d{2}))?/
    );
    if (!match) return "";

    const name = match[1] === "setiembre" ? "septiembre" : match[1];
    const month = MONTHS.indexOf(name) + 1;
    const date = String(payment.date || "");
    const year = match[2] || date.slice(0, 4);
    if (!/^\d{4}$/.test(year)) return "";
    if (!match[2] && month > Number(date.slice(5, 7))) return "";
    return monthKey(year, month);
  }

  function describedMonthKeys(payment) {
    const clean = stripAccents(paymentText(payment).replace(/\[MES:\d{4}-\d{2}\]/gi, " "));
    const found = [];
    const pattern = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?:\s+(20\d{2}))?/g;
    let match;
    while ((match = pattern.exec(clean))) {
      const name = match[1] === "setiembre" ? "septiembre" : match[1];
      const month = MONTHS.indexOf(name) + 1;
      const date = String(payment.date || "");
      const year = match[2] || date.slice(0, 4);
      if (/^\d{4}$/.test(year)) found.push(monthKey(year, month));
    }
    return found;
  }

  function taggedMonth(payment) {
    const match = paymentText(payment).match(/\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/i);
    return match ? match[1] : "";
  }

  function pick(record, keys) {
    for (const key of keys) {
      if (record && record[key] !== undefined && record[key] !== null && record[key] !== "") {
        return record[key];
      }
    }
    return "";
  }

  function normalizeStatus(status) {
    const value = String(status || "Activo").trim().toLowerCase();
    if (value === "inactivo" || value === "dropped off") return "Dropped Off";
    return "Activo";
  }

  function exemptionCents(rows, studentId, period) {
    return (rows || [])
      .filter((row) =>
        String(row.status || "active") === "active" &&
        String(row.student_id) === String(studentId) &&
        row.period === period
      )
      .reduce((sum, row) => sum + Math.max(0, Math.round(Number(row.amount || 0) * 100)), 0);
  }

  function activeExemptions(options) {
    if (Array.isArray(options.exemptions)) return options.exemptions;
    if (root.eeaExemptionsReady && Array.isArray(root.eeaExemptionRows)) return root.eeaExemptionRows;
    return null;
  }

  function computeStudentStatsShared(data, options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const year = today.getFullYear();
    const monthIndex = today.getMonth();
    const currentMonth = monthKey(year, monthIndex + 1);
    const exemptions = activeExemptions(options);
    const students = Array.isArray(data.students) ? data.students : [];
    const incomes = Array.isArray(data.incomes) ? data.incomes : [];

    const activeStudents = students.filter((student) => normalizeStatus(student.status) === "Activo");

    const details = activeStudents.map((student) => {
      const payments = incomes.filter((payment) =>
        nameKey(payment.student) === nameKey(student.name) &&
        String(payment.category || "Mensualidad").trim().toLowerCase() === "mensualidad"
      );

      const paidCents = payments
        .filter((payment) => paymentMonthOf(payment) === currentMonth)
        .reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0) * 100), 0);

      const feeCents = Math.round(Number(pick(student, ["monthlyFee", "monthly_fee"]) || 0) * 100);
      const forgiven = exemptions ? exemptionCents(exemptions, student.id, currentMonth) : 0;
      const pendingCents = Math.max(0, feeCents - paidCents - forgiven);

      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const dueDay = Math.min(
        Math.max(1, Number(pick(student, ["dueDay", "due_day"]) || 1)),
        lastDay
      );
      const nextDueDate = new Date(year, monthIndex, dueDay, 23, 59, 59);

      const lastPayment = payments
        .map((payment) => String(payment.date || ""))
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      let statusPayment;
      if (pendingCents <= 0) statusPayment = "Al día";
      else if (today > nextDueDate) statusPayment = "Retrasado";
      else statusPayment = "Pendiente";

      const unclearThisMonth = payments.some((payment) =>
        !paymentMonthOf(payment) && String(payment.date || "").slice(0, 7) === currentMonth
      );
      if (pendingCents > 0 && unclearThisMonth) statusPayment = "Revisar historial";

      return {
        ...student,
        dueDay,
        monthlyFee: feeCents / 100,
        lastPayment,
        paidThisMonth: paidCents / 100,
        pendingAmount: pendingCents / 100,
        exoneratedThisMonth: forgiven / 100,
        nextDueDate,
        statusPayment
      };
    });

    const order = {
      "Revisar historial": 0,
      "Retrasado": 1,
      "Pendiente": 2,
      "Al día": 3
    };

    return {
      active: details.length,
      onTime: details.filter((student) => student.statusPayment === "Al día").length,
      pending: details.filter((student) =>
        student.statusPayment === "Pendiente" || student.statusPayment === "Revisar historial"
      ).length,
      late: details.filter((student) => student.statusPayment === "Retrasado").length,
      review: details.filter((student) => student.statusPayment === "Revisar historial").length,
      exemptionsApplied: exemptions !== null,
      details: details.sort((a, b) => order[a.statusPayment] - order[b.statusPayment])
    };
  }

  function computeStudentStatsByDepositDate(data, options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const students = Array.isArray(data.students) ? data.students : [];
    const incomes = Array.isArray(data.incomes) ? data.incomes : [];
    const activeStudents = students.filter((student) => normalizeStatus(student.status) === "Activo");

    const details = activeStudents.map((student) => {
      const payments = incomes.filter((payment) =>
        nameKey(payment.student) === nameKey(student.name) &&
        String(payment.category || "Mensualidad").trim().toLowerCase() === "mensualidad"
      );
      const paidThisMonth = payments
        .filter((payment) => {
          const date = String(payment.date || "");
          return date.slice(0, 7) === monthKey(today.getFullYear(), today.getMonth() + 1);
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const fee = Number(pick(student, ["monthlyFee", "monthly_fee"]) || 0);
      const pendingAmount = Math.max(fee - paidThisMonth, 0);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const dueDay = Math.min(Math.max(1, Number(pick(student, ["dueDay", "due_day"]) || 1)), lastDay);
      const nextDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay, 23, 59, 59);
      let statusPayment = "Pendiente";
      if (pendingAmount <= 0) statusPayment = "Al día";
      else if (today > nextDueDate) statusPayment = "Retrasado";
      return { ...student, statusPayment, pendingAmount, paidThisMonth };
    });

    return {
      active: details.length,
      onTime: details.filter((student) => student.statusPayment === "Al día").length,
      pending: details.filter((student) => student.statusPayment === "Pendiente").length,
      late: details.filter((student) => student.statusPayment === "Retrasado").length,
      details
    };
  }

  function isTransferMethod(method) {
    return stripAccents(method).trim() === "transferencia";
  }

  function isCashBoxAccount(name) {
    const value = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
    return value === "efectivo usd" || value === "efectivo c$" || value === "efectivo c";
  }

  function moneyParts(income) {
    const currency = String(income.currency || "USD").toUpperCase();
    const original = Number(income.originalAmount ?? income.amount ?? 0);
    const usd = Number(income.amount || 0);
    if (currency === "NIO") return { usd: 0, nio: original, usdEquivalent: usd };
    return { usd: original, nio: 0, usdEquivalent: usd };
  }

  function addParts(target, parts) {
    target.usd += parts.usd;
    target.nio += parts.nio;
    target.usdEquivalent += parts.usdEquivalent;
  }

  function summarizeTransfers(incomes, withdrawalMap = {}) {
    const list = Array.isArray(incomes) ? incomes : [];
    const transfers = list.filter((income) => isTransferMethod(income.method));
    const mistakes = transfers.filter((income) => isCashBoxAccount(income.account));
    const tracked = transfers.filter((income) => !isCashBoxAccount(income.account));
    const groups = new Map();
    const outstanding = { usd: 0, nio: 0, usdEquivalent: 0 };
    const withdrawn = { usd: 0, nio: 0, usdEquivalent: 0 };

    tracked.forEach((income) => {
      const key = /^\d{4}-\d{2}/.test(String(income.date || ""))
        ? String(income.date).slice(0, 7)
        : "sin-fecha";
      if (!groups.has(key)) groups.set(key, []);
      const mark = withdrawalMap[income.id] || null;
      const row = { ...income, withdrawnAt: mark && mark.withdrawnAt ? mark.withdrawnAt : "" };
      groups.get(key).push(row);
      const parts = moneyParts(income);
      if (row.withdrawnAt) addParts(withdrawn, parts);
      else addParts(outstanding, parts);
    });

    const months = Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, rows]) => ({
        month,
        rows: rows.sort((a, b) => String(b.date).localeCompare(String(a.date))),
        outstanding: rows.filter((row) => !row.withdrawnAt),
        withdrawn: rows.filter((row) => row.withdrawnAt)
      }));

    return { months, mistakes, outstanding, withdrawn, trackedCount: tracked.length };
  }

  function looksLikeTest(value) {
    return /\b(test|tests|prueba|pruebas|demo|asdf|falso|falsa|xxx+)\b/i.test(String(value || ""));
  }

  function collectQualityWarnings(data, options = {}) {
    const warnings = [];
    const students = Array.isArray(data.students) ? data.students : [];
    const incomes = Array.isArray(data.incomes) ? data.incomes : [];
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const teachers = Array.isArray(data.teachers) ? data.teachers : [];
    const investments = Array.isArray(data.investments) ? data.investments : [];
    const teacherPayments = Array.isArray(data.teacherPayments) ? data.teacherPayments : [];

    const tests = [];
    students.forEach((student) => {
      if (looksLikeTest(student.name) || looksLikeTest(student.notes)) {
        tests.push(`Estudiante: ${student.name || "sin nombre"}`);
      }
    });
    incomes.forEach((income) => {
      if (looksLikeTest(income.student) || looksLikeTest(income.concept) || looksLikeTest(income.notes)) {
        tests.push(`Ingreso: ${income.student || "sin estudiante"} · ${income.concept || "sin concepto"}`);
      }
    });
    expenses.forEach((expense) => {
      if (looksLikeTest(expense.description) || looksLikeTest(expense.notes)) {
        tests.push(`Gasto: ${expense.description || "sin descripción"}`);
      }
    });
    teachers.forEach((teacher) => {
      if (looksLikeTest(teacher.name)) tests.push(`Maestro: ${teacher.name}`);
    });
    teacherPayments.forEach((payment) => {
      if (looksLikeTest(payment.teacher) || looksLikeTest(payment.description)) {
        tests.push(`Pago a maestro: ${payment.teacher || ""} ${payment.description || ""}`.trim());
      }
    });
    investments.forEach((item) => {
      if (looksLikeTest(item.concept) || looksLikeTest(item.notes)) {
        tests.push(`Inversión: ${item.concept || "sin concepto"}`);
      }
    });
    if (tests.length) {
      warnings.push({
        tone: "warn",
        title: "Posibles registros de prueba",
        detail: "Estos textos parecen ensayos. Revísalos antes de usarlos en un reporte.",
        items: tests
      });
    }

    const monthConflicts = [];
    incomes.forEach((income) => {
      const tag = taggedMonth(income);
      if (!tag) return;
      const described = describedMonthKeys(income).filter((key) => key !== tag);
      if (!described.length) return;
      monthConflicts.push(
        `${income.student || "Sin estudiante"} · texto ${described.join(", ")} · etiqueta ${tag}`
      );
    });
    if (monthConflicts.length) {
      warnings.push({
        tone: "warn",
        title: "El mes escrito no coincide con la etiqueta [MES]",
        detail: "La descripción menciona un mes y la etiqueta [MES:YYYY-MM] dice otro. El estado de pago usa la etiqueta.",
        items: monthConflicts
      });
    }

    const mixed = [];
    const byName = new Map();
    students.forEach((student) => {
      const key = nameKey(student.name);
      if (!key) return;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(student);
    });
    byName.forEach((group) => {
      const statuses = new Set(group.map((student) => normalizeStatus(student.status)));
      if (statuses.has("Activo") && statuses.has("Dropped Off")) {
        mixed.push(`${group[0].name}: hay un registro activo y otro en Dropped Off`);
      }
    });
    students.forEach((student) => {
      if (normalizeStatus(student.status) !== "Activo") return;
      const droppedDate = pick(student, ["droppedOffDate", "dropped_off_date"]);
      const notes = stripAccents(student.notes);
      if (droppedDate) {
        mixed.push(`${student.name}: está activo y también tiene fecha de Dropped Off (${droppedDate})`);
      } else if (/\b(dropped off|dropped|dado de baja|de baja)\b/.test(notes)) {
        mixed.push(`${student.name}: está activo, pero las notas hablan de baja o dropped`);
      }
    });
    if (mixed.length) {
      warnings.push({
        tone: "warn",
        title: "Estudiantes activos y dados de baja a la vez",
        detail: "Un alumno no debería estar activo y dropped al mismo tiempo.",
        items: mixed
      });
    }

    if (typeof root.getAccountBalances === "function") {
      const negative = root.getAccountBalances(data)
        .filter((account) => Number(account.current) < -0.009)
        .map((account) => `${account.name}: ${Number(account.current).toFixed(2)} USD`);
      if (negative.length) {
        warnings.push({
          tone: "danger",
          title: "Cuentas con saldo negativo",
          detail: "El saldo calculado quedó por debajo de cero. Puede faltar un ingreso o sobrar un gasto.",
          items: negative
        });
      }
    }

    const shared = computeStudentStatsShared(data, options);
    const legacy = computeStudentStatsByDepositDate(data, options);
    if (
      shared.onTime !== legacy.onTime ||
      shared.pending !== legacy.pending ||
      shared.late !== legacy.late
    ) {
      const legacyByName = new Map(legacy.details.map((student) => [nameKey(student.name), student.statusPayment]));
      const diffs = shared.details
        .filter((student) => legacyByName.get(nameKey(student.name)) !== student.statusPayment)
        .map((student) =>
          `${student.name}: por mes de la mensualidad está ${student.statusPayment}; por fecha del depósito estaría ${legacyByName.get(nameKey(student.name))}`
        );
      warnings.push({
        tone: "info",
        title: "La fecha del depósito no es el mes de la mensualidad",
        detail: `Inicio y Estudiantes muestran lo mismo: ${shared.onTime} al día, ${shared.pending} pendientes y ${shared.late} retrasados, según el mes que cubre el pago. Si se contara solo por la fecha en que entró el dinero, serían ${legacy.onTime} al día, ${legacy.pending} pendientes y ${legacy.late} retrasados.`,
        items: diffs
      });
    }

    if (options.exemptionsUnavailable) {
      warnings.push({
        tone: "info",
        title: "Exoneraciones no disponibles",
        detail: "No se leyeron becas ni excepciones. Los saldos no las restan hasta que la tabla responda.",
        items: []
      });
    }

    return warnings;
  }

  function digitsPhone(student) {
    const child = String(pick(student, ["student_type", "studentType"])).toLowerCase() === "nino";
    const raw = child
      ? pick(student, ["guardian_phone", "guardianPhone", "contact"])
      : pick(student, ["contact", "guardian_phone", "guardianPhone"]);
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length === 8) digits = `505${digits}`;
    if (digits.length < 11 || digits.length > 15) return "";
    return digits;
  }

  function balanceForStudent(student, incomes, options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const name = nameKey(student.name);
    const payments = (incomes || []).filter((payment) =>
      nameKey(payment.student) === name &&
      String(payment.category || "Mensualidad").toLowerCase() === "mensualidad"
    );
    const unknown = payments.filter((payment) => !paymentMonthOf(payment));
    const firstPaymentDate = payments
      .map((payment) => String(payment.date || "").slice(0, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .sort()[0] || "";
    const start = String(
      pick(student, ["enrollment_date", "enrollmentDate", "payment_date", "paymentDate"]) || firstPaymentDate
    ).slice(0, 7);

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || unknown.length) {
      return { review: true, missingDate: !start, unknown, items: [], total: 0, daysOverdue: 0 };
    }

    const feeCents = Math.round(Number(pick(student, ["monthly_fee", "monthlyFee"]) || 0) * 100);
    if (feeCents <= 0) {
      return { review: true, missingDate: false, unknown, items: [], total: 0, daysOverdue: 0 };
    }

    const [year, month] = start.split("-").map(Number);
    const items = [];
    const exemptions = options.exemptions || null;

    for (
      let cursor = new Date(year, month - 1, 1), count = 0;
      cursor <= today && count < 120;
      cursor.setMonth(cursor.getMonth() + 1), count += 1
    ) {
      const itemYear = cursor.getFullYear();
      const itemMonth = cursor.getMonth();
      const lastDay = new Date(itemYear, itemMonth + 1, 0).getDate();
      const dueDay = Math.min(Number(pick(student, ["due_day", "dueDay"]) || 1), lastDay);
      const dueDate = new Date(itemYear, itemMonth, dueDay, 23, 59, 59);
      if (today <= dueDate) continue;

      const key = monthKey(itemYear, itemMonth + 1);
      const paidCents = payments
        .filter((payment) => paymentMonthOf(payment) === key)
        .reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0) * 100), 0);
      const forgiven = exemptions ? exemptionCents(exemptions, student.id, key) : 0;
      const pending = Math.max(0, feeCents - paidCents - forgiven) / 100;
      if (pending > 0) {
        const daysOverdue = Math.floor((today - dueDate) / 86400000);
        items.push({ month: key, pending, dueDate, daysOverdue });
      }
    }

    return {
      review: false,
      unknown: [],
      items,
      total: items.reduce((sum, item) => sum + item.pending, 0),
      daysOverdue: items.reduce((max, item) => Math.max(max, item.daysOverdue), 0)
    };
  }

  function buildReminderMessage(student, balance, options = {}) {
    const child = String(pick(student, ["student_type", "studentType"])).toLowerCase() === "nino";
    const recipient = String(
      child
        ? pick(student, ["mother_name", "motherName"]) || ""
        : student.name || ""
    ).trim();
    if (!recipient || !balance || balance.review || !balance.items.length) return "";

    const today = options.today ? new Date(options.today) : new Date();
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + 7);
    const dateFormatter = new Intl.DateTimeFormat("es-NI", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const firstName = recipient.split(/\s+/)[0];
    const lines = balance.items.map((item) => {
      const [itemYear, itemMonth] = item.month.split("-").map(Number);
      const label = new Intl.DateTimeFormat("es-NI", { month: "long", year: "numeric" })
        .format(new Date(itemYear, itemMonth - 1, 1));
      const pretty = label.charAt(0).toUpperCase() + label.slice(1);
      const late = item.daysOverdue === 1 ? "1 día de atraso" : `${item.daysOverdue} días de atraso`;
      return `${pretty}: $${Number(item.pending).toFixed(2)} (${late})`;
    });
    const about = child
      ? `la mensualidad de ${student.name}`
      : "tu mensualidad";

    return (
      `Hola, ${firstName}, ¿cómo estás? Te escribo de Expressive English Academy para recordarte ${about}.\n\n` +
      `Al revisar la cuenta, esto es lo que sigue pendiente:\n\n` +
      `${lines.join("\n")}\n\n` +
      `Total pendiente: $${Number(balance.total).toFixed(2)}.\n` +
      `Lleva ${balance.daysOverdue} ${balance.daysOverdue === 1 ? "día" : "días"} de atraso.\n\n` +
      `¿Podés ponerte al día antes del ${dateFormatter.format(deadline)}? ` +
      `Si ya pagaste o necesitás coordinar, respondé este mensaje y lo revisamos juntos. ` +
      `Así seguimos las clases sin interrupciones.\n\n` +
      `Gracias por confiar en la academia. Tu pago nos ayuda a seguir creciendo.\n\n` +
      `Expressive English Academy — Embrace the Extraordinary`
    );
  }

  function whatsappLink(phone, text) {
    if (!phone || !text) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  function buildVistaData() {
    return {
      incomeCategories: ["Mensualidad"],
      expenseCategories: ["alquiler", "otros"],
      investmentCategories: ["equipo"],
      accounts: [
        { id: "account_cash_usd", name: "Efectivo USD", type: "Efectivo", initialBalance: 40, notes: "Caja en dólares" },
        { id: "account_cash_nio", name: "Efectivo C$", type: "Efectivo", initialBalance: 0, notes: "Caja en córdobas" },
        { id: "account_bank_usd", name: "Banco USD", type: "Banco", initialBalance: 100, notes: "Referencia" },
        { id: "account_bank_nio", name: "Banco C$", type: "Banco", initialBalance: 0, notes: "Referencia" }
      ],
      students: [
        { id: "s1", name: "María López", level: "B1", monthlyFee: 25, dueDay: 5, status: "Activo", contact: "88881212", notes: "", studentType: "adulto" },
        { id: "s2", name: "José Pérez", level: "A2", monthlyFee: 25, dueDay: 10, status: "Activo", contact: "77773434", notes: "", studentType: "adulto" },
        { id: "s3", name: "Lucía Gómez", level: "Kids", monthlyFee: 20, dueDay: 8, status: "Activo", contact: "", guardianPhone: "88880011", motherName: "Carmen Gómez", studentType: "nino", enrollmentDate: "2026-09-01" },
        { id: "s4", name: "Alumno Test", level: "A1", monthlyFee: 25, dueDay: 3, status: "Activo", contact: "55550000", notes: "registro de prueba", studentType: "adulto" },
        { id: "s5", name: "Ana Ruiz", level: "B2", monthlyFee: 30, dueDay: 12, status: "Activo", contact: "88887777", notes: "dado de baja en octubre, confirmar", studentType: "adulto" },
        { id: "s6", name: "Ana Ruiz", level: "B2", monthlyFee: 30, dueDay: 12, status: "Dropped Off", contact: "88887777", notes: "", droppedOffDate: "2026-10-01" },
        { id: "s7", name: "Pedro Sánchez", level: "B1", monthlyFee: 25, dueDay: 20, status: "Activo", contact: "86661111", notes: "", studentType: "adulto" }
      ],
      teachers: [{ id: "t1", name: "Andrés", contact: "", status: "Activo", notes: "" }],
      incomes: [
        { id: "i1", date: "2026-11-02", student: "María López", level: "B1", concept: "Mensualidad noviembre [MES:2026-11]", category: "Mensualidad", method: "Transferencia", currency: "USD", originalAmount: 25, amount: 25, account: "Banco USD", notes: "" },
        { id: "i2", date: "2026-11-04", student: "José Pérez", level: "A2", concept: "Mensualidad octubre [MES:2026-10]", category: "Mensualidad", method: "Transferencia", currency: "USD", originalAmount: 25, amount: 25, account: "Banco USD", notes: "" },
        { id: "i3", date: "2026-11-06", student: "Lucía Gómez", level: "Kids", concept: "Mensualidad noviembre [MES:2026-11]", category: "Mensualidad", method: "Transferencia", currency: "NIO", exchangeRate: 36.5, originalAmount: 730, amount: 20, account: "Banco C$", notes: "" },
        { id: "i4", date: "2026-11-07", student: "Pedro Sánchez", level: "B1", concept: "Mensualidad marzo [MES:2026-11]", category: "Mensualidad", method: "Efectivo", currency: "USD", originalAmount: 25, amount: 25, account: "Efectivo USD", notes: "" },
        { id: "i5", date: "2026-11-09", student: "Alumno Test", level: "A1", concept: "pago de prueba [MES:2026-11]", category: "Mensualidad", method: "Transferencia", currency: "USD", originalAmount: 25, amount: 25, account: "Efectivo USD", notes: "test" },
        { id: "i6", date: "2026-10-15", student: "María López", level: "B1", concept: "Mensualidad octubre [MES:2026-10]", category: "Mensualidad", method: "Efectivo", currency: "USD", originalAmount: 25, amount: 25, account: "Efectivo USD", notes: "" }
      ],
      expenses: [
        { id: "e1", date: "2026-11-03", description: "Alquiler del local", category: "alquiler", amount: 80, account: "Efectivo C$", notes: "" }
      ],
      teacherPayments: [],
      investments: []
    };
  }

  root.paymentMonthOf = paymentMonthOf;
  root.computeStudentStatsShared = computeStudentStatsShared;
  root.computeStudentStatsByDepositDate = computeStudentStatsByDepositDate;
  root.summarizeTransfers = summarizeTransfers;
  root.isTransferMethod = isTransferMethod;
  root.isCashBoxAccount = isCashBoxAccount;
  root.collectQualityWarnings = collectQualityWarnings;
  root.balanceForStudent = balanceForStudent;
  root.buildReminderMessage = buildReminderMessage;
  root.whatsappLink = whatsappLink;
  root.digitsPhone = digitsPhone;
  root.buildVistaData = buildVistaData;
  root.eeaNameKey = nameKey;
})(typeof window !== "undefined" ? window : globalThis);
