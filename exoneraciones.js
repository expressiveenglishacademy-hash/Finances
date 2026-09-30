/* Exoneraciones: no se registran en incomes ni aumentan la caja. */
(() => {
  if (document.body.dataset.page !== "ingresos") return;

  const form = document.getElementById("exemptionForm");
  if (!form) return;

  const status = document.getElementById("exemptionStatus");
  const tbody = document.getElementById("exemptionTableBody");
  const saveButton = form.querySelector('[type="submit"]');

  let students = [];
  let exemptions = [];

  const money = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);

  const safe = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  saveButton.disabled = true;

  const today = new Date();
  form.elements.month.value =
    String(today.getMonth() + 1).padStart(2, "0");

  form.elements.year.value = today.getFullYear();

  form.elements.student.addEventListener("change", () => {
    const student = students.find(
      (item) => String(item.id) === form.elements.student.value
    );

    form.elements.amount.value = student
      ? Number(student.monthly_fee || 0).toFixed(2)
      : "";
  });

  function renderTable() {
    tbody.innerHTML = exemptions.length
      ? exemptions.map((item) => {
          const [year, month] = item.period.split("-").map(Number);

          const period = new Intl.DateTimeFormat("es-NI", {
            month: "long",
            year: "numeric"
          }).format(new Date(year, month - 1, 1));

          return `
            <tr>
              <td>${safe(item.student_name)}</td>
              <td>${safe(period)}</td>
              <td>${money(item.amount)}</td>
              <td>
                ${safe(item.reason)}
                ${
                  item.notes
                    ? `<br><small>${safe(item.notes)}</small>`
                    : ""
                }
              </td>
              <td>
                ${item.status === "active" ? "Exonerado" : "Cancelada"}
              </td>
              <td>
                ${new Date(item.created_at).toLocaleDateString("es-NI")}
              </td>
              <td>
                ${
                  item.status === "active"
                    ? `
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-cancel-exemption="${safe(item.id)}"
                      >
                        Cancelar con PIN
                      </button>
                    `
                    : "—"
                }
              </td>
            </tr>
          `;
        }).join("")
      : `
        <tr>
          <td colspan="7">No hay exoneraciones registradas.</td>
        </tr>
      `;
  }

  async function loadData() {
    const [studentsResult, exemptionsResult] = await Promise.all([
      supabaseClient
        .from("students")
        .select("id,name,monthly_fee,status")
        .order("name"),

      supabaseClient
        .from("payment_exemptions")
        .select("*")
        .order("created_at", { ascending: false })
    ]);

    if (studentsResult.error) throw studentsResult.error;
    if (exemptionsResult.error) throw exemptionsResult.error;

    students = (studentsResult.data || []).filter(
      (student) =>
        !["inactivo", "dropped off"].includes(
          String(student.status || "Activo").toLowerCase()
        )
    );

    exemptions = exemptionsResult.data || [];

    const select = form.elements.student;
    const previous = select.value;

    select.replaceChildren(
      new Option("Selecciona un estudiante", "")
    );

    students.forEach((student) => {
      select.add(new Option(student.name, String(student.id)));
    });

    if (students.some((student) => String(student.id) === previous)) {
      select.value = previous;
    }

    renderTable();
    saveButton.disabled = !students.length;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.elements.pin.value !== "8681") {
      status.textContent = "PIN incorrecto.";
      return;
    }

    const student = students.find(
      (item) => String(item.id) === form.elements.student.value
    );

    const period =
      `${form.elements.year.value}-${form.elements.month.value}`;

    const amount = Number(form.elements.amount.value);

    if (
      !student ||
      !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(period) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      status.textContent =
        "Completa correctamente estudiante, mes, año y monto.";
      return;
    }

    saveButton.disabled = true;
    status.textContent = "Guardando exoneración...";

    try {
      const { error } = await supabaseClient
        .from("payment_exemptions")
        .insert({
          student_id: String(student.id),
          student_name: student.name,
          period,
          amount: Math.round(amount * 100) / 100,
          reason: form.elements.reason.value,
          notes: form.elements.notes.value.trim()
        })
        .select("id")
        .single();

      if (error) throw error;

      form.elements.pin.value = "";

      await loadData();

      status.textContent =
        "Exoneración guardada. No se registró ingreso de dinero.";
    } catch (error) {
      console.error("Exoneración:", error);

      status.textContent = error.code === "23505"
        ? "Ya hay una exoneración activa para ese mes. Cancélala antes de registrar otra."
        : "No se pudo completar. Revisa la lista antes de volver a intentar.";
    } finally {
      saveButton.disabled = !students.length;
    }
  });

  function askPin() {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");

      dialog.style.cssText = `
        padding: 24px;
        border-radius: 16px;
        background: #102033;
        color: white;
        border: 1px solid #456;
      `;

      dialog.innerHTML = `
        <form class="form-grid">
          <h3>Cancelar exoneración</h3>
          <p>El registro se conservará como cancelado.</p>

          <label class="field">
            <span>PIN</span>
            <input
              type="password"
              name="pin"
              inputmode="numeric"
              maxlength="4"
              required
            >
          </label>

          <button type="submit" class="btn btn-primary">
            Confirmar cancelación
          </button>

          <button
            type="button"
            class="btn btn-secondary"
            data-close
          >
            Volver
          </button>
        </form>
      `;

      const finish = (result) => {
        dialog.remove();
        resolve(result);
      };

      dialog.querySelector("form").onsubmit = (event) => {
        event.preventDefault();

        if (dialog.querySelector('[name="pin"]').value !== "8681") {
          alert("PIN incorrecto.");
          return;
        }

        finish(true);
      };

      dialog.querySelector("[data-close]").onclick =
        () => finish(false);

      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(false);
      });

      document.body.append(dialog);
      dialog.showModal();
    });
  }

  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cancel-exemption]");
    if (!button) return;

    button.disabled = true;

    try {
      if (!await askPin()) return;

      const { error } = await supabaseClient
        .from("payment_exemptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString()
        })
        .eq("id", button.dataset.cancelExemption)
        .eq("status", "active")
        .select("id")
        .single();

      if (error) throw error;

      await loadData();

      status.textContent =
        "Exoneración cancelada. Se conservó el registro.";
    } catch (error) {
      console.error(error);
      status.textContent = "No se pudo cancelar la exoneración.";
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await loadData();
      status.textContent = "";
    } catch (error) {
      console.error(error);

      status.textContent =
        "No se pudieron cargar las exoneraciones. Verifica que creaste la tabla en Supabase.";

      tbody.innerHTML = `
        <tr>
          <td colspan="7">Exoneraciones no disponibles.</td>
        </tr>
      `;
    }
  });
})();
