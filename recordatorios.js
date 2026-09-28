/* Recordatorios EEA: archivo independiente del script principal */
(() => {
  const page = document.body.dataset.page;
  if (page !== "estudiantes" && page !== "ingresos") return;

  const money = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);

  const escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const monthOf = (concept) =>
    String(concept || "").match(
      /\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/
    )?.[1] || "";

  function addMonthToIncomeForm() {
    const form = document.getElementById("incomeForm");
    if (!form || form.querySelector('[name="eeaReminderMonth"]')) return;

    const field = document.createElement("label");
    field.className = "field";
    field.innerHTML = `
      <span>Mes correspondiente a la mensualidad</span>
      <input
        type="month"
        name="eeaReminderMonth"
        value="${new Date().toISOString().slice(0, 7)}"
      >
    `;

    const concept = form.elements["concept"];
    const category = form.elements["category"];
    const conceptLabel = concept?.closest("label");

    if (conceptLabel) {
      conceptLabel.after(field);
    } else {
      form.append(field);
    }

    const updateVisibility = () => {
      field.hidden = category?.value !== "Mensualidad";
    };

    category?.addEventListener("change", updateVisibility);
    updateVisibility();

    form.addEventListener(
      "submit",
      (event) => {
        if (category?.value !== "Mensualidad") return;

        const month = form.elements["eeaReminderMonth"]?.value;

        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          alert("Selecciona el mes al que corresponde la mensualidad.");
          return;
        }

        if (concept) {
          concept.value =
            concept.value
              .replace(/\s*\[MES:\d{4}-\d{2}\]/g, "")
              .trim() + ` [MES:${month}]`;
        }
      },
      true
    );
  }

  function calculate(student, incomes) {
    const name = String(student.name || "")
      .trim()
      .toLocaleLowerCase();

    const payments = incomes.filter(
      (payment) =>
        String(payment.student || "")
          .trim()
          .toLocaleLowerCase() === name &&
        String(payment.category || "Mensualidad") === "Mensualidad"
    );

    const unknown = payments.filter(
      (payment) => !monthOf(payment.concept)
    );

    const start = String(
      student.enrollment_date || student.payment_date || ""
    ).slice(0, 7);

    // Evita generar un saldo cuando falta información histórica.
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) ||
      unknown.length
    ) {
      return {
        review: true,
        count: unknown.length,
        items: [],
        total: 0
      };
    }

    const [year, month] = start.split("-").map(Number);
    const now = new Date();
    const items = [];

    for (
      let cursor = new Date(year, month - 1, 1), n = 0;
      cursor <= now && n < 120;
      cursor.setMonth(cursor.getMonth() + 1), n++
    ) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();

      const lastDay = new Date(y, m + 1, 0).getDate();
      const dueDay = Math.min(
        Number(student.due_day || 1),
        lastDay
      );

      const dueDate = new Date(y, m, dueDay, 23, 59, 59);
      if (now <= dueDate) continue;

      const key =
        `${y}-${String(m + 1).padStart(2, "0")}`;

      const paidCents = payments
        .filter(
          (payment) => monthOf(payment.concept) === key
        )
        .reduce(
          (sum, payment) =>
            sum +
            Math.round(Number(payment.amount || 0) * 100),
          0
        );

      const monthlyFeeCents = Math.round(
        Number(student.monthly_fee || 0) * 100
      );

      const pending = Math.max(
        0,
        monthlyFeeCents - paidCents
      ) / 100;

      if (pending > 0) {
        items.push({ month: key, amount: pending });
      }
    }

    return {
      review: false,
      items,
      total: items.reduce(
        (sum, item) => sum + item.amount,
        0
      )
    };
  }

  function message(student, balance) {
    const child = student.student_type === "nino";

    const recipient = String(
      child
        ? student.mother_name || ""
        : student.name || ""
    ).trim();

    if (!recipient) return "";

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const date = new Intl.DateTimeFormat("es-NI", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(deadline);

    const lines = balance.items.map(
      ({ month, amount }) => {
        const [y, m] = month.split("-").map(Number);

        const label = new Intl.DateTimeFormat(
          "es-NI",
          { month: "long", year: "numeric" }
        ).format(new Date(y, m - 1, 1));

        return (
          `${label[0].toUpperCase() + label.slice(1)}: ` +
          `${money(amount)} pendiente`
        );
      }
    );

    const introduction = child
      ? `Al revisar la cuenta de ${student.name}, encontramos estas mensualidades pendientes:`
      : "Al revisar tu cuenta, encontramos estas mensualidades pendientes:";

    return (
      `Hola, ${recipient.split(/\s+/)[0]}. ` +
      `Te saludamos de Expressive English Academy.\n\n` +
      `${introduction}\n\n` +
      `${lines.join("\n")}\n` +
      `Total pendiente: ${money(balance.total)}\n\n` +
      `Te agradeceríamos ponerte al día a más tardar el ${date}. ` +
      `Si ya realizaste algún pago o necesitas coordinarlo, ` +
      `escríbenos para revisarlo contigo. Después de esa ` +
      `fecha tendríamos que pausar el ingreso a clases hasta ` +
      `regularizar el saldo. Gracias por tu comprensión.`
    );
  }

  async function renderReminders() {
    const anchor = document
      .getElementById("studentsTableBody")
      ?.closest("section");

    if (!anchor || document.getElementById("eeaReminders")) {
      return;
    }

    const panel = document.createElement("section");
    panel.id = "eeaReminders";
    panel.className = "glass-card";

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <span class="eyebrow">Seguimiento</span>
          <h2>Recordatorios de pago</h2>
          <p>Revisa el mensaje antes de enviarlo.</p>
        </div>
      </div>

      <div id="eeaReminderRows">
        Cargando recordatorios...
      </div>

      <div
        id="eeaReminderEditor"
        hidden
        style="margin-top: 1rem;"
      >
        <textarea
          id="eeaReminderText"
          rows="13"
          style="width: 100%; padding: 1rem;"
        ></textarea>

        <button
          id="eeaReminderCopy"
          class="btn btn-primary"
          type="button"
        >
          Copiar mensaje
        </button>
      </div>
    `;

    anchor.before(panel);

    const rows = panel.querySelector("#eeaReminderRows");

    try {
      if (typeof supabaseClient === "undefined") {
        throw new Error(
          "No se encontró la conexión del CRM."
        );
      }

      const [studentsResult, incomesResult] =
        await Promise.all([
          supabaseClient
            .from("students")
            .select("*"),

          supabaseClient
            .from("incomes")
            .select("*")
        ]);

      if (studentsResult.error) {
        throw studentsResult.error;
      }

      if (incomesResult.error) {
        throw incomesResult.error;
      }

      const students = studentsResult.data || [];
      const incomes = incomesResult.data || [];

      const entries = students
        .filter(
          (student) =>
            !["dropped off", "inactivo"].includes(
              String(
                student.status || "Activo"
              ).toLowerCase()
            )
        )
        .map((student) => ({
          student,
          balance: calculate(student, incomes)
        }))
        .filter(
          ({ balance }) =>
            balance.review ||
            balance.total > 0
        );

      rows.innerHTML = entries.length
        ? entries
            .map(
              ({ student, balance }, index) => `
                <div
                  class="mini-stat-card"
                  style="margin-bottom: .5rem;"
                >
                  <span>
                    ${escape(student.name)}
                  </span>

                  ${
                    balance.review
                      ? `<small>
                           Revisar historial:
                           ${balance.count} pago(s) sin mes
                           o falta fecha de matrícula
                         </small>`
                      : `<strong>
                           ${money(balance.total)}
                           · ${balance.items.length} mes(es)
                         </strong>

                         <button
                           class="btn btn-primary btn-sm"
                           type="button"
                           data-eea-index="${index}"
                         >
                           Preparar recordatorio
                         </button>`
                  }
                </div>
              `
            )
            .join("")
        : "<p>No hay mensualidades vencidas para generar recordatorios.</p>";

      rows
        .querySelectorAll("[data-eea-index]")
        .forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              const { student, balance } =
                entries[Number(
                  button.dataset.eeaIndex
                )];

              const value = message(
                student,
                balance
              );

              if (!value) {
                alert(
                  `Falta el nombre del responsable de ${student.name}.`
                );
                return;
              }

              panel.querySelector(
                "#eeaReminderText"
              ).value = value;

              panel.querySelector(
                "#eeaReminderEditor"
              ).hidden = false;
            }
          );
        });

      panel
        .querySelector("#eeaReminderCopy")
        .addEventListener(
          "click",
          async () => {
            const textarea =
              panel.querySelector(
                "#eeaReminderText"
              );

            try {
              await navigator.clipboard.writeText(
                textarea.value
              );
              alert("Mensaje copiado.");
            } catch (error) {
              textarea.select();
              alert(
                "Texto seleccionado. Cópialo manualmente."
              );
            }
          }
        );
    } catch (error) {
      console.error(
        "Recordatorios EEA:",
        error
      );

      rows.textContent =
        "No se pudieron cargar los recordatorios. " +
        "El resto del CRM sigue disponible.";
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      if (page === "ingresos") {
        addMonthToIncomeForm();
      }

      if (page === "estudiantes") {
        renderReminders();
      }
    }
  );
})();
