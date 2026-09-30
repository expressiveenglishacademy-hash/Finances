(() => {
  if (document.body.dataset.page !== "estudiantes") return;

  const money = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);

  const escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const monthNames = [
    "enero", "febrero", "marzo", "abril",
    "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"
  ];

  function monthOf(payment) {
    const text =
      `${payment.concept || ""} ${payment.notes || ""}`;

    const tag = text.match(
      /\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/i
    );

    if (tag) return tag[1];

    const normalized = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const match = normalized.match(
      /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?:\s+(20\d{2}))?/
    );

    if (!match) return "";

    const name = match[1] === "setiembre"
      ? "septiembre"
      : match[1];

    const month = monthNames.indexOf(name) + 1;
    const paymentDate = String(payment.date || "");
    const paymentYear = Number(paymentDate.slice(0, 4));
    const paymentMonth = Number(paymentDate.slice(5, 7));

    const year = match[2]
      ? Number(match[2])
      : paymentYear;

    if (!year || !paymentMonth || !month) return "";

    // No adivinar entre un anticipo y una deuda del año anterior.
    if (!match[2] && month > paymentMonth) return "";

    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function balanceFor(student, incomes, today = new Date()) {
    const name = String(student.name || "")
      .trim()
      .toLocaleLowerCase();

    const payments = incomes.filter((payment) =>
      String(payment.student || "")
        .trim()
        .toLocaleLowerCase() === name &&
      String(payment.category || "Mensualidad")
        .toLocaleLowerCase() === "mensualidad"
    );

    const unknown = payments.filter(
      (payment) => !monthOf(payment)
    );

    // Cuando falta la matrícula, usar el primer pago registrado.
    const firstPaymentDate = payments
      .map((payment) =>
        String(payment.date || "").slice(0, 10)
      )
      .filter((date) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date)
      )
      .sort()[0] || "";

    const start = String(
      student.enrollment_date ||
      student.payment_date ||
      firstPaymentDate
    ).slice(0, 7);

    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) ||
      unknown.length
    ) {
      return {
        review: true,
        missingDate: !start,
        unknown,
        items: [],
        total: 0
      };
    }

    const [year, month] = start.split("-").map(Number);
    const feeCents = Math.round(
      Number(student.monthly_fee || 0) * 100
    );

    if (feeCents <= 0) {
      return {
        review: true,
        missingDate: false,
        unknown,
        items: [],
        total: 0
      };
    }

    const items = [];

    for (
      let cursor = new Date(year, month - 1, 1), count = 0;
      cursor <= today && count < 120;
      cursor.setMonth(cursor.getMonth() + 1), count++
    ) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();

      const dueDay = Math.min(
        Number(student.due_day || 1),
        lastDay
      );

      const dueDate = new Date(
        y, m, dueDay, 23, 59, 59
      );

      if (today <= dueDate) continue;

      const key =
        `${y}-${String(m + 1).padStart(2, "0")}`;

      const paidCents = payments
        .filter((payment) => monthOf(payment) === key)
        .reduce(
          (sum, payment) =>
            sum + Math.round(
              Number(payment.amount || 0) * 100
            ),
          0
        );

      const pending = Math.max(
        0,
        feeCents - paidCents
      ) / 100;

      if (pending > 0) {
        items.push({ month: key, pending });
      }
    }

    return {
      review: false,
      unknown: [],
      items,
      total: items.reduce(
        (sum, item) => sum + item.pending,
        0
      )
    };
  }

  function buildMessage(student, balance) {
    const child = student.student_type === "nino";

    const recipient = String(
      child
        ? student.mother_name || ""
        : student.name || ""
    ).trim();

    if (!recipient) return "";

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const deadlineText = new Intl.DateTimeFormat(
      "es-NI",
      {
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    ).format(deadline);

    const lines = balance.items.map(({ month, pending }) => {
      const [year, number] = month.split("-").map(Number);

      const label = new Intl.DateTimeFormat(
        "es-NI",
        { month: "long", year: "numeric" }
      ).format(new Date(year, number - 1, 1));

      return (
        label[0].toUpperCase() +
        label.slice(1) +
        `: ${money(pending)} pendiente`
      );
    });

    const introduction = child
      ? `Al revisar la cuenta de ${student.name}, encontramos las siguientes mensualidades pendientes:`
      : "Al revisar tu cuenta, encontramos las siguientes mensualidades pendientes:";

    return (
      `Hola, ${recipient.split(/\s+/)[0]}. ` +
      `Te saludamos de Expressive English Academy.\n\n` +
      `${introduction}\n\n` +
      `${lines.join("\n")}\n` +
      `Total pendiente: ${money(balance.total)}\n\n` +
      `Te agradeceríamos ponerte al día a más tardar el ${deadlineText}. ` +
      `Si ya realizaste algún pago o necesitas coordinarlo, ` +
      `escríbenos para revisarlo contigo. Después de esa fecha ` +
      `tendríamos que pausar el ingreso a clases hasta regularizar ` +
      `el saldo. Gracias por tu comprensión.`
    );
  }

  async function render() {
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
          <p>Revisa los saldos antes de enviar mensajes.</p>
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
        throw new Error("No se encontró la conexión del CRM.");
      }

      const [studentsResult, incomesResult] = await Promise.all([
        supabaseClient.from("students").select("*"),
        supabaseClient.from("incomes").select("*")
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (incomesResult.error) throw incomesResult.error;

      const entries = (studentsResult.data || [])
        .filter((student) =>
          !["dropped off", "inactivo"].includes(
            String(student.status || "Activo").toLowerCase()
          )
        )
        .map((student) => ({
          student,
          balance: balanceFor(
            student,
            incomesResult.data || []
          )
        }))
        .filter(({ balance }) =>
          balance.review || balance.total > 0
        );

      rows.innerHTML = entries.length
        ? entries.map(({ student, balance }, index) => `
          <div
            class="mini-stat-card"
            style="margin-bottom: .5rem;"
          >
            <span>${escape(student.name)}</span>

            ${
              balance.review
                ? `
                  <small>
                    Revisar historial:
                    ${balance.unknown.length} pago(s) sin mes claro
                    ${balance.missingDate
                      ? "; falta fecha de matrícula y no hay pagos registrados"
                      : ""}.
                  </small>
                `
                : `
                  <strong>
                    ${money(balance.total)}
                    · ${balance.items.length} mes(es)
                  </strong>

                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    data-eea-index="${index}"
                  >
                    Preparar recordatorio
                  </button>
                `
            }
          </div>
        `).join("")
        : `
          <p>
            No hay mensualidades vencidas
            para generar recordatorios.
          </p>
        `;

      rows.querySelectorAll("[data-eea-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const { student, balance } = entries[
            Number(button.dataset.eeaIndex)
          ];

          const message = buildMessage(student, balance);

          if (!message) {
            alert(
              `Falta el nombre del responsable de ${student.name}.`
            );
            return;
          }

          panel.querySelector("#eeaReminderText").value = message;
          panel.querySelector("#eeaReminderEditor").hidden = false;
        });
      });

      panel.querySelector("#eeaReminderCopy").addEventListener(
        "click",
        async () => {
          const textarea = panel.querySelector("#eeaReminderText");

          try {
            await navigator.clipboard.writeText(textarea.value);
            alert("Mensaje copiado.");
          } catch (error) {
            textarea.select();
            alert("Texto seleccionado. Cópialo manualmente.");
          }
        }
      );
    } catch (error) {
      console.error("Recordatorios EEA:", error);

      rows.textContent =
        "No se pudieron cargar los recordatorios. " +
        "El resto del CRM sigue disponible.";
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
