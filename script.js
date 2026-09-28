function eeaMonthFromPayment(payment) {
  const match = String(payment.concept || "").match(
    /\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/
  );
  return match ? match[1] : "";
}

function eeaStudentPayments(data, student) {
  return data.incomes.filter((payment) =>
    String(payment.student || "").trim().toLowerCase() ===
      String(student.name || "").trim().toLowerCase() &&
    String(payment.category || "Mensualidad") === "Mensualidad"
  );
}

function eeaOverdueBalance(data, student) {
  const payments = eeaStudentPayments(data, student);
  const unassigned = payments.filter((payment) => !eeaMonthFromPayment(payment));
  const start = String(student.enrollmentDate || student.paymentDate || "")
    .slice(0, 7);

  // No generar cobros automáticos con un historial incompleto.
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || unassigned.length) {
    return { needsReview: true, unassigned, months: [], total: 0 };
  }

  const [startYear, startMonth] = start.split("-").map(Number);
  const today = new Date();
  const months = [];
  const monthlyFeeCents = Math.round(Number(student.monthlyFee || 0) * 100);

  for (
    let cursor = new Date(startYear, startMonth - 1, 1);
    cursor <= today && months.length < 120;
    cursor.setMonth(cursor.getMonth() + 1)
  ) {
    const year = cursor.getFullYear();
    const monthNumber = cursor.getMonth() + 1;
    const month = `${year}-${String(monthNumber).padStart(2, "0")}`;

    const lastDay = new Date(year, monthNumber, 0).getDate();
    const dueDay = Math.min(Number(student.dueDay || 1), lastDay);
    const dueDate = new Date(year, monthNumber - 1, dueDay, 23, 59, 59);

    if (today <= dueDate) continue;

    const paidCents = payments
      .filter((payment) => eeaMonthFromPayment(payment) === month)
      .reduce(
        (sum, payment) =>
          sum + Math.round(Number(payment.amount || 0) * 100),
        0
      );

    const pendingCents = Math.max(0, monthlyFeeCents - paidCents);

    if (pendingCents > 0) {
      months.push({ month, amount: pendingCents / 100 });
    }
  }

  return {
    needsReview: false,
    unassigned: [],
    months,
    total: months.reduce((sum, item) => sum + item.amount, 0)
  };
}

function eeaReminderText(student, balance) {
  const isChild = student.studentType === "nino";
  const recipient = isChild
    ? String(student.motherName || "").trim()
    : String(student.name || "").trim();

  if (!recipient) return "";

  const firstName = recipient.split(/\s+/)[0];
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);

  const deadlineText = new Intl.DateTimeFormat("es-NI", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(deadline);

  const monthLines = balance.months.map(({ month, amount }) => {
    const [year, monthNumber] = month.split("-").map(Number);

    const label = new Intl.DateTimeFormat("es-NI", {
      month: "long",
      year: "numeric"
    }).format(new Date(year, monthNumber - 1, 1));

    return `${label.charAt(0).toUpperCase() + label.slice(1)}: ${formatCurrency(amount)} pendiente`;
  });

  const introduction = isChild
    ? `Al revisar la cuenta de ${student.name}, encontramos las siguientes mensualidades pendientes:`
    : "Al revisar tu cuenta, encontramos las siguientes mensualidades pendientes:";

  return (
    `Hola, ${firstName}. Te saludamos de Expressive English Academy.\n\n` +
    `${introduction}\n\n` +
    `${monthLines.join("\n")}\n` +
    `Total pendiente: ${formatCurrency(balance.total)}\n\n` +
    `Te agradeceríamos ponerte al día a más tardar el ${deadlineText}. ` +
    `Si ya realizaste algún pago o necesitas coordinarlo, escríbenos para revisarlo contigo. ` +
    `Después de esa fecha tendríamos que pausar el ingreso a clases hasta regularizar el saldo. ` +
    `Gracias por tu comprensión.`
  );
}

function eeaRenderReminderPanel(data) {
  const studentsSection = document
    .getElementById("studentsTableBody")
    ?.closest("section");

  if (!studentsSection) return;

  document.getElementById("eeaReminderPanel")?.remove();

  const panel = document.createElement("section");
  panel.id = "eeaReminderPanel";
  panel.className = "glass-card";

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <span class="eyebrow">Seguimiento de pagos</span>
        <h2>Recordatorios personalizados</h2>
        <p>
          Revisa los saldos antes de enviar un mensaje.
          Los pagos antiguos sin mes asignado requieren revisión.
        </p>
      </div>
    </div>

    <div id="eeaReminderList"></div>

    <div id="eeaReminderEditor" hidden style="margin-top: 1rem;">
      <h3 id="eeaReminderTitle"></h3>

      <textarea
        id="eeaReminderMessage"
        rows="13"
        style="width: 100%; padding: 1rem;"
      ></textarea>

      <div style="margin-top: .75rem;">
        <button
          type="button"
          class="btn btn-primary"
          id="eeaCopyReminder"
        >
          Copiar mensaje
        </button>
      </div>
    </div>
  `;

  studentsSection.before(panel);

  const activeStudents = data.students.filter(
    (student) => normalizeStudentStatus(student.status) === "Activo"
  );

  const entries = activeStudents
    .map((student) => ({
      student,
      balance: eeaOverdueBalance(data, student)
    }))
    .filter(
      ({ balance }) => balance.needsReview || balance.total > 0
    );

  const list = panel.querySelector("#eeaReminderList");

  list.innerHTML = entries.length
    ? entries.map(({ student, balance }) => {
        let action;

        if (balance.needsReview) {
          action = `
            <span>
              Revisar historial:
              ${balance.unassigned.length} pago(s) sin mes asignado
            </span>

            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-eea-assign-month="${escapeHtml(student.id)}"
            >
              Asignar mes
            </button>
          `;
        } else {
          action = `
            <strong>
              ${formatCurrency(balance.total)}
              · ${balance.months.length} mes(es) vencido(s)
            </strong>

            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-eea-reminder="${escapeHtml(student.id)}"
            >
              Preparar recordatorio
            </button>
          `;
        }

        return `
          <div class="mini-stat-card" style="margin-bottom: .5rem;">
            <span>${escapeHtml(student.name)}</span>
            ${action}
          </div>
        `;
      }).join("")
    : "<p>No hay mensualidades vencidas para generar recordatorios.</p>";

  list.querySelectorAll("[data-eea-reminder]").forEach((button) => {
    button.addEventListener("click", () => {
      const student = activeStudents.find(
        (item) => item.id === button.dataset.eeaReminder
      );

      if (!student) return;

      const balance = eeaOverdueBalance(data, student);
      const message = eeaReminderText(student, balance);

      if (!message) {
        toast(
          "Falta el nombre del responsable. Complétalo antes de preparar el mensaje."
        );
        return;
      }

      panel.querySelector("#eeaReminderTitle").textContent =
        `Mensaje sobre ${student.name}`;

      panel.querySelector("#eeaReminderMessage").value = message;
      panel.querySelector("#eeaReminderEditor").hidden = false;

      panel.querySelector("#eeaReminderEditor").scrollIntoView({
        behavior: "smooth"
      });
    });
  });

  list.querySelectorAll("[data-eea-assign-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const student = activeStudents.find(
        (item) => item.id === button.dataset.eeaAssignMonth
      );

      if (!student) return;

      const balance = eeaOverdueBalance(data, student);
      const payment = balance.unassigned[0];

      if (!payment) {
        toast(
          "Este estudiante no tiene fecha de matrícula. Revisa su registro antes de calcular deudas."
        );
        return;
      }

      const month = window.prompt(
        `Pago de ${student.name}: ${formatCurrency(payment.amount)} ` +
        `registrado el ${payment.date}.\n\n` +
        `¿A qué mensualidad corresponde? Escribe AAAA-MM.\n` +
        `Si un pago cubre varios meses, revísalo manualmente antes de asignarlo.`,
        String(payment.date || "").slice(0, 7)
      );

      if (month === null) return;

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        toast("Escribe el mes en formato AAAA-MM, por ejemplo 2026-09.");
        return;
      }

      payment.concept =
        `${String(payment.concept || "").trim()} [MES:${month}]`;

      saveData(data);
      eeaRenderReminderPanel(data);
    });
  });

  panel.querySelector("#eeaCopyReminder").addEventListener(
    "click",
    async () => {
      const textarea = panel.querySelector("#eeaReminderMessage");

      try {
        await navigator.clipboard.writeText(textarea.value);
        toast("Mensaje copiado. Ya puedes pegarlo en WhatsApp.");
      } catch (error) {
        textarea.select();
        toast("Mensaje seleccionado. Cópialo manualmente.");
      }
    }
  );
}

/*
  Añadir el panel después de que la página Estudiantes termine
  de construir su tabla.
*/
const eeaOriginalRenderStudentsPage = renderStudentsPage;

renderStudentsPage = function (data) {
  eeaOriginalRenderStudentsPage(data);
  eeaRenderReminderPanel(data);
};

/*
  En Ingresos se agrega el mes que se está pagando.
  El dato se guarda dentro del concepto para que funcione
  con tu tabla actual de Supabase, sin modificarla.
*/
const eeaOriginalRenderIncomesPage = renderIncomesPage;

renderIncomesPage = function (data) {
  eeaOriginalRenderIncomesPage(data);

  const form = document.getElementById("incomeForm");
  if (!form) return;

  const monthField = document.createElement("label");
  monthField.className = "field";

  monthField.innerHTML = `
    <span>Mes que se está pagando</span>
    <input
      type="month"
      name="eeaPaymentMonth"
      value="${todayValue().slice(0, 7)}"
    >
  `;

  const conceptLabel = form
    .querySelector('[name="concept"]')
    ?.closest("label");

  if (conceptLabel) {
    conceptLabel.after(monthField);
  } else {
    form.append(monthField);
  }

  const updateVisibility = () => {
    monthField.hidden =
      form.elements["category"]?.value !== "Mensualidad";
  };

  updateVisibility();
  form.elements["category"]?.addEventListener(
    "change",
    updateVisibility
  );

  // Se ejecuta antes del registro normal del ingreso.
  form.addEventListener(
    "submit",
    (event) => {
      if (form.elements["category"]?.value !== "Mensualidad") {
        return;
      }

      const month = form.elements["eeaPaymentMonth"]?.value || "";

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast("Selecciona el mes al que corresponde el pago.");
        return;
      }

      const concept = form.elements["concept"];
      if (!concept) return;

      concept.value = concept.value
        .replace(/\s*\[MES:\d{4}-\d{2}\]/g, "")
        .trim() + ` [MES:${month}]`;
    },
    true
  );
};
