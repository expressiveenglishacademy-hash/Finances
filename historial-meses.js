
(() => {
  if (document.body.dataset.page !== "historial") return;

  if (typeof renderPaymentHistoryPage !== "function") {
    console.error("Falta cargar el script principal.");
    return;
  }

  const months = [
    "Enero", "Febrero", "Marzo", "Abril",
    "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const originalRender = renderPaymentHistoryPage;

  renderPaymentHistoryPage = function (data) {
    originalRender(data);

    const tbody = document.getElementById("paymentHistoryTableBody");
    if (!tbody || tbody.dataset.monthEditorReady) return;

    tbody.dataset.monthEditorReady = "true";

    const header = tbody.closest("table")?.querySelector("thead tr");

    if (header && !header.querySelector("[data-month-header]")) {
      const th = document.createElement("th");
      th.textContent = "Mes";
      th.dataset.monthHeader = "true";
      header.children[3]?.after(th);
    }

    function readMonth(payment) {
      const text = `${payment.concept || ""} ${payment.notes || ""}`;

      const saved = text.match(
        /\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/i
      );

      if (saved) return saved[1];

      const normalized = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const matches = [
        ...normalized.matchAll(
          /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?:\s+(20\d{2}))?/g
        )
      ];

      // Si menciona varios meses, permite asignarlo manualmente.
      if (matches.length !== 1) return "";

      const match = matches[0];
      const name = match[1] === "setiembre"
        ? "septiembre"
        : match[1];

      const month = months
        .map((value) => value.toLowerCase())
        .indexOf(name) + 1;

      const year = match[2] ||
        String(payment.date || "").slice(0, 4);

      const paymentMonth = Number(
        String(payment.date || "").slice(5, 7)
      );

      if (!/^\d{4}$/.test(year)) return "";

      if (!match[2] && month > paymentMonth) return "";

      return `${year}-${String(month).padStart(2, "0")}`;
    }

    function decorateRows() {
      for (const row of tbody.rows) {
        if (row.querySelector("[data-month-cell]")) continue;

        const receipt = row.querySelector("[data-receipt-id]");

        if (!receipt) {
          if (row.cells.length === 1) {
            row.cells[0].colSpan = 11;
          }
          continue;
        }

        const payment = data.incomes.find(
          (item) =>
            String(item.id) === receipt.dataset.receiptId
        );

        if (!payment) continue;

        const cell = document.createElement("td");
        cell.dataset.monthCell = "true";

        const value = readMonth(payment);
        const label = document.createElement("span");

        label.textContent = value
          ? `${months[Number(value.slice(5)) - 1]} ${value.slice(0, 4)}`
          : "Sin asignar";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-secondary btn-sm";
        button.textContent = "Editar";
        button.onclick = () => openEditor(payment);

        cell.append(
          label,
          document.createElement("br"),
          button
        );

        row.cells[3]?.after(cell);
      }
    }

    function openEditor(payment) {
      document.getElementById("paymentMonthDialog")?.remove();

      const dialog = document.createElement("dialog");
      dialog.id = "paymentMonthDialog";

      dialog.style.cssText = `
        width: min(440px, 90vw);
        padding: 24px;
        border-radius: 16px;
        border: 1px solid #456;
        background: #102033;
        color: white;
      `;

      dialog.innerHTML = `
        <h2>Editar mes del pago</h2>
        <p data-person></p>

        <form class="form-grid">
          <label class="field">
            <span>PIN</span>
            <input
              name="pin"
              type="password"
              inputmode="numeric"
              maxlength="4"
              required
              autocomplete="off"
            >
          </label>

          <label class="field">
            <span>Mes</span>
            <select name="month" required>
              ${months.map((name, index) => `
                <option value="${String(index + 1).padStart(2, "0")}">
                  ${name}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="field">
            <span>Año</span>
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              required
            >
          </label>

          <p role="status" data-status></p>

          <button class="btn btn-primary" type="submit">
            Guardar mes
          </button>

          <button
            class="btn btn-secondary"
            type="button"
            data-cancel
          >
            Cancelar
          </button>
        </form>
      `;

      dialog.querySelector("[data-person]").textContent =
        `${payment.student} · $${Number(payment.amount || 0).toFixed(2)} USD`;

      const form = dialog.querySelector("form");

      const current = readMonth(payment) ||
        String(payment.date || "").slice(0, 7);

      form.elements.month.value =
        current.slice(5, 7) ||
        String(new Date().getMonth() + 1).padStart(2, "0");

      form.elements.year.value =
        current.slice(0, 4) ||
        new Date().getFullYear();

      dialog.querySelector("[data-cancel]").onclick =
        () => dialog.remove();

      form.onsubmit = async (event) => {
        event.preventDefault();

        const status = dialog.querySelector("[data-status]");

        if (form.elements.pin.value !== "8681") {
          status.textContent = "PIN incorrecto.";
          return;
        }

        const month =
          `${form.elements.year.value}-${form.elements.month.value}`;

        if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) {
          status.textContent = "Revisa el mes y el año.";
          return;
        }

        // Conserva el texto original. Solo cambia la etiqueta del mes.
        const concept = String(payment.concept || "")
          .replace(/\s*\[MES:\d{4}-\d{2}\]/gi, "") +
          ` [MES:${month}]`;

        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        status.textContent = "Guardando...";

        try {
          const { data: updated, error } = await supabaseClient
            .from("incomes")
            .update({ concept })
            .eq("id", payment.id)
            .select("id,concept")
            .single();

          if (error || !updated) {
            throw error || new Error("No se confirmó el cambio.");
          }

          payment.concept = updated.concept;

          // Actualiza también el respaldo local del CRM.
          saveData(data, { skipRemote: true });

          tbody
            .querySelectorAll("[data-month-cell]")
            .forEach((cell) => cell.remove());

          decorateRows();
          dialog.remove();

          toast("Mes guardado correctamente.");
        } catch (error) {
          console.error("No se pudo guardar el mes:", error);

          status.textContent =
            "No se pudo guardar. Revisa tu conexión y vuelve a intentar.";

          button.disabled = false;
        }
      };

      document.body.append(dialog);
      dialog.showModal();
    }

    // Mantiene la columna al buscar, filtrar o cambiar el orden.
    const observer = new MutationObserver(decorateRows);
    observer.observe(tbody, { childList: true });

    decorateRows();
  };
})();
