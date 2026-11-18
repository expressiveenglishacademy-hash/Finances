(() => {
  function storageKey() {
    return window.eeaVista ? "eea_vista_withdrawals" : "eea_withdrawals_v1";
  }

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeLocal(map) {
    localStorage.setItem(storageKey(), JSON.stringify(map));
  }

  function cordobas(value) {
    return `C$${Number(value || 0).toFixed(2)}`;
  }

  async function loadWithdrawalMap() {
    const local = readLocal();
    if (window.eeaVista) {
      window.eeaWithdrawalsRemote = false;
      return local;
    }

    try {
      const result = await supabaseClient
        .from("income_withdrawals")
        .select("income_id,withdrawn_at");

      if (result.error) throw result.error;

      const merged = { ...local };
      const remoteIds = new Set();

      (result.data || []).forEach((row) => {
        remoteIds.add(row.income_id);
        merged[row.income_id] = { withdrawnAt: String(row.withdrawn_at || "").slice(0, 10) };
      });

      for (const [incomeId, mark] of Object.entries(local)) {
        if (!mark?.withdrawnAt || remoteIds.has(incomeId)) continue;
        const upsert = await supabaseClient
          .from("income_withdrawals")
          .upsert({ income_id: incomeId, withdrawn_at: mark.withdrawnAt }, { onConflict: "income_id" });
        if (upsert.error) throw upsert.error;
      }

      writeLocal(merged);
      window.eeaWithdrawalsRemote = true;
      return merged;
    } catch (error) {
      console.warn("Por retirar usa este navegador:", error);
      window.eeaWithdrawalsRemote = false;
      return local;
    }
  }

  async function setWithdrawal(incomeId, withdrawnAt) {
    const map = readLocal();
    if (withdrawnAt) map[incomeId] = { withdrawnAt };
    else delete map[incomeId];
    writeLocal(map);

    if (window.eeaVista) return { remote: false };

    try {
      const result = withdrawnAt
        ? await supabaseClient
          .from("income_withdrawals")
          .upsert({ income_id: incomeId, withdrawn_at: withdrawnAt }, { onConflict: "income_id" })
        : await supabaseClient
          .from("income_withdrawals")
          .delete()
          .eq("income_id", incomeId);

      if (result.error) throw result.error;
      window.eeaWithdrawalsRemote = true;
      return { remote: true };
    } catch (error) {
      console.warn(error);
      window.eeaWithdrawalsRemote = false;
      return { remote: false };
    }
  }

  function monthLabel(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return "Sin fecha";
    const [year, number] = month.split("-").map(Number);
    const label = new Intl.DateTimeFormat("es-NI", { month: "long", year: "numeric" })
      .format(new Date(year, number - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function paint(data, map) {
    const summary = summarizeTransfers(data.incomes || [], map);
    const note = document.getElementById("withdrawSyncNote");
    if (note) {
      note.textContent = window.eeaVista
        ? "Vista de ejemplo: estas marcas no salen de este navegador."
        : window.eeaWithdrawalsRemote
          ? "Las marcas se guardan en Supabase y también en este navegador."
          : "Todavía no está la tabla income_withdrawals. Las marcas quedan guardadas solo en este navegador hasta que ejecutes migrations/2026-11-17-add-retiro.sql.";
    }

    setText("withdrawOutstandingUsd", formatCurrency(summary.outstanding.usd));
    setText("withdrawOutstandingNio", cordobas(summary.outstanding.nio));
    setText("withdrawOutstandingEquivalent", formatCurrency(summary.outstanding.usdEquivalent));
    setText("withdrawDoneUsd", formatCurrency(summary.withdrawn.usdEquivalent));

    const months = document.getElementById("withdrawMonths");
    if (months) {
      months.innerHTML = summary.months.length
        ? summary.months.map((group) => {
          const openUsd = group.outstanding.reduce((sum, row) => sum + Number(row.currency === "NIO" ? 0 : (row.originalAmount ?? row.amount) || 0), 0);
          const openNio = group.outstanding.reduce((sum, row) => sum + Number(row.currency === "NIO" ? (row.originalAmount ?? 0) : 0), 0);
          return `
            <article class="month-card">
              <div class="panel-header">
                <div>
                  <span class="eyebrow">${escapeHtml(monthLabel(group.month))}</span>
                  <h3>Por retirar ${formatCurrency(openUsd)} · ${cordobas(openNio)}</h3>
                </div>
              </div>
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Estudiante</th>
                      <th>Cuenta</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.rows.map((row) => `
                      <tr>
                        <td>${formatDate(row.date)}</td>
                        <td>${escapeHtml(row.student || "—")}<br><small>${escapeHtml(row.concept || "")}</small></td>
                        <td>${escapeHtml(row.account || "—")}</td>
                        <td>
                          ${escapeHtml(row.currency || "USD") === "NIO"
                            ? cordobas(row.originalAmount ?? row.amount)
                            : formatCurrency(row.originalAmount ?? row.amount)}
                          <br><small>${formatCurrency(row.amount)} USD</small>
                        </td>
                        <td>${row.withdrawnAt
                            ? `<span class="badge badge-ok">Retirado ${escapeHtml(formatDate(row.withdrawnAt))}</span>`
                            : statusBadge("Pendiente")}</td>
                        <td class="table-actions">
                          ${row.withdrawnAt
                            ? `<button class="btn btn-secondary btn-sm" type="button" data-unwithdraw="${escapeHtml(row.id)}">Quitar marca</button>`
                            : `<input type="date" value="${todayValue()}" data-withdraw-date="${escapeHtml(row.id)}" aria-label="Fecha de retiro">
                               <button class="btn btn-primary btn-sm" type="button" data-withdraw="${escapeHtml(row.id)}">Marcar retirado</button>`}
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </article>
          `;
        }).join("")
        : emptyMessage("No hay transferencias registradas en cuentas bancarias.");
    }

    const mistakes = document.getElementById("withdrawMistakes");
    if (mistakes) {
      mistakes.innerHTML = summary.mistakes.length
        ? summary.mistakes.map((row) => `
          <div class="mini-stat-card">
            <span>${formatDate(row.date)} · ${escapeHtml(row.student || "Sin estudiante")}</span>
            <strong>Transferencia en ${escapeHtml(row.account || "efectivo")}</strong>
            <small>${formatCurrency(row.amount)} · Revisa si el método o la cuenta quedaron mal. No entra en el total por retirar.</small>
          </div>
        `).join("")
        : emptyMessage("Ninguna transferencia está anotada en Efectivo USD o Efectivo C$.");
    }

    document.querySelectorAll("[data-withdraw]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-withdraw");
        const input = document.querySelector(`[data-withdraw-date="${CSS.escape(id)}"]`);
        const date = input?.value || todayValue();
        button.disabled = true;
        const result = await setWithdrawal(id, date);
        toast(result.remote
          ? "Marcado como retirado."
          : "Guardado en este navegador. En otros dispositivos aparece cuando exista la tabla de retiros.");
        paint(data, readLocal());
      });
    });

    document.querySelectorAll("[data-unwithdraw]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-unwithdraw");
        if (!window.confirm("¿Quitar la marca de retirado? El ingreso no se borra.")) return;
        button.disabled = true;
        await setWithdrawal(id, "");
        toast("Se quitó la marca. El ingreso sigue igual.");
        paint(data, readLocal());
      });
    });
  }

  window.renderDashboardInsights = async function renderDashboardInsights(data) {
    if (typeof summarizeTransfers !== "function") return;
    const map = await loadWithdrawalMap();
    const summary = summarizeTransfers(data.incomes || [], map);
    setText("metricPorRetirar", formatCurrency(summary.outstanding.usdEquivalent));
    const detail = document.getElementById("metricPorRetirarDetail");
    if (detail) {
      const count = summary.months.reduce((sum, group) => sum + group.outstanding.length, 0);
      const transferWord = count === 1 ? "transferencia" : "transferencias";
      detail.textContent = count
        ? `${formatCurrency(summary.outstanding.usd)} y ${cordobas(summary.outstanding.nio)} en ${count} ${transferWord} todavía en la cuenta personal.`
        : "No hay transferencias pendientes de pasar a la caja de la academia.";
    }
    const mistakes = document.getElementById("metricTransferMistakes");
    if (mistakes) {
      mistakes.textContent = summary.mistakes.length
        ? `${summary.mistakes.length} ${summary.mistakes.length === 1 ? "transferencia anotada" : "transferencias anotadas"} en efectivo.`
        : "";
    }
  };

  window.renderWithdrawalsPage = async function renderWithdrawalsPage(data) {
    const map = await loadWithdrawalMap();
    paint(data, map);
  };
})();
