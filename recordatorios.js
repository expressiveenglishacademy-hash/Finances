(() => {
  function money(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(amount || 0));
  }

  window.renderRemindersPage = function renderRemindersPage(data) {
    const anchor = document.getElementById("eeaRemindersAnchor")
      || document.getElementById("studentsTableBody")?.closest("section");

    if (!anchor || typeof balanceForStudent !== "function") return;

    let panel = document.getElementById("eeaReminders");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "eeaReminders";
      panel.className = "glass-card";
      if (anchor.id === "eeaRemindersAnchor") anchor.appendChild(panel);
      else anchor.before(panel);
    }

    const incomes = data.incomes || [];
    const exemptions = window.eeaExemptionsReady ? (window.eeaExemptionRows || []) : [];
    const entries = (data.students || [])
      .filter((student) => typeof isActiveStudent === "function"
        ? isActiveStudent(student)
        : normalizeStudentStatus(student.status) === "Activo")
      .map((student) => ({
        student,
        balance: balanceForStudent(student, incomes, { exemptions })
      }))
      .filter(({ balance }) => balance.review || balance.total > 0)
      .sort((a, b) => (b.balance.daysOverdue || 0) - (a.balance.daysOverdue || 0));

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <span class="eyebrow">Seguimiento</span>
          <h2>Recordatorios de pago</h2>
          <p>El mensaje queda listo para copiar o abrir en WhatsApp. No se envía solo.</p>
        </div>
      </div>
      <div class="stack-cards" id="eeaReminderRows"></div>
      <div class="reminder-editor" id="eeaReminderEditor" hidden>
        <label class="field">
          <span>Mensaje</span>
          <textarea id="eeaReminderText" rows="12"></textarea>
        </label>
        <div class="reminder-actions">
          <button id="eeaReminderCopy" class="btn btn-primary" type="button">Copiar mensaje</button>
          <a id="eeaReminderWhatsapp" class="btn btn-secondary" target="_blank" rel="noopener" hidden>Abrir WhatsApp con el texto</a>
        </div>
        <p id="eeaReminderPhoneNote" class="muted-note"></p>
      </div>
    `;

    const rows = panel.querySelector("#eeaReminderRows");
    rows.innerHTML = entries.length
      ? entries.map(({ student, balance }, index) => `
        <article class="mini-stat-card reminder-card">
          <span>${escapeHtml(student.name)}</span>
          ${balance.review
            ? `<small>Revisar historial: ${balance.unknown.length} pago(s) sin mes claro${balance.missingDate ? "; falta fecha de matrícula y no hay pagos con fecha" : ""}.</small>`
            : `<strong>${money(balance.total)} · ${balance.items.length === 1 ? "1 mes" : `${balance.items.length} meses`} · ${balance.daysOverdue === 1 ? "1 día" : `${balance.daysOverdue} días`} de atraso</strong>
               <small>${balance.items.map((item) => `${escapeHtml(item.month)}: ${money(item.pending)}`).join(" · ")}</small>
               <div class="reminder-actions">
                 <button class="btn btn-primary btn-sm" type="button" data-reminder="${index}">Preparar mensaje</button>
               </div>`}
        </article>
      `).join("")
      : emptyMessage("No hay mensualidades vencidas para recordar.");

    const editor = panel.querySelector("#eeaReminderEditor");
    const textarea = panel.querySelector("#eeaReminderText");
    const link = panel.querySelector("#eeaReminderWhatsapp");
    const phoneNote = panel.querySelector("#eeaReminderPhoneNote");

    rows.querySelectorAll("[data-reminder]").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = entries[Number(button.dataset.reminder)];
        const message = buildReminderMessage(entry.student, entry.balance);
        if (!message) {
          toast("Falta el nombre de quien recibe el mensaje.");
          return;
        }
        textarea.value = message;
        editor.hidden = false;
        const phone = digitsPhone(entry.student);
        if (phone) {
          link.hidden = false;
          link.href = whatsappLink(phone, message);
          phoneNote.textContent = "WhatsApp se abre con el texto escrito. Hay que pulsar Enviar allá.";
        } else {
          link.hidden = true;
          link.removeAttribute("href");
          phoneNote.textContent = "No hay un teléfono útil guardado. Copia el mensaje y pégalo en el chat.";
        }
        editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });

    panel.querySelector("#eeaReminderCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        toast("Mensaje copiado.");
      } catch (error) {
        textarea.select();
        toast("Texto seleccionado. Cópialo manualmente.");
      }
    });
  };
})();
