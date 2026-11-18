(() => {
  window.renderQualityPage = function renderQualityPage(data) {
    const host = document.getElementById("qualityWarnings");
    if (!host || typeof collectQualityWarnings !== "function") return;

    const warnings = collectQualityWarnings(data, {
      exemptionsUnavailable: window.eeaExemptionsUnavailable === true
    });

    host.innerHTML = warnings.length
      ? warnings.map((warning) => `
        <article class="warning-card ${escapeHtml(warning.tone)}">
          <h3>${escapeHtml(warning.title)}</h3>
          <p>${escapeHtml(warning.detail)}</p>
          ${warning.items.length
            ? `<ul>${warning.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : ""}
        </article>
      `).join("")
      : emptyMessage("No hay avisos. Inicio y Estudiantes usan el mismo conteo.");
  };

  window.renderSettingsPage = function renderSettingsPage() {
    const input = document.getElementById("resetPhrase");
    const button = document.querySelector("[data-reset-demo]");
    if (!input || !button) return;
    const sync = () => {
      button.disabled = input.value.trim() !== "RESETEAR";
    };
    input.addEventListener("input", sync);
    sync();
  };
})();
