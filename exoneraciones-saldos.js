
(() => {
  if (document.body.dataset.page !== "estudiantes") return;

  const originalStats = computeStudentStats;

  computeStudentStats = function (data) {
    const stats = originalStats(data);
    if (!stats || stats.exemptionsApplied || !window.eeaExemptions?.ready) {
      return stats;
    }
    const now = new Date();

    const period =
      `${now.getFullYear()}-` +
      String(now.getMonth() + 1).padStart(2, "0");

    stats.details = stats.details.map((student) => {
      if (!window.eeaExemptions.ready) return student;

      const forgiven = window.eeaExemptions.cents(
        student.id,
        period
      );

      const pending = Math.max(
        0,
        Math.round(
          Number(student.pendingAmount || 0) * 100
        ) - forgiven
      );

      let status = student.statusPayment;

      if (pending === 0) {
        status = "Al día";
      } else if (status !== "Revisar historial") {
        status = now > student.nextDueDate
          ? "Retrasado"
          : "Pendiente";
      }

      return {
        ...student,
        pendingAmount: pending / 100,
        exoneratedThisMonth: forgiven / 100,
        statusPayment: status
      };
    });

    stats.onTime = stats.details.filter(
      (student) => student.statusPayment === "Al día"
    ).length;

    stats.pending = stats.details.filter(
      (student) =>
        ["Pendiente", "Revisar historial"].includes(
          student.statusPayment
        )
    ).length;

    stats.late = stats.details.filter(
      (student) => student.statusPayment === "Retrasado"
    ).length;

    const order = {
      "Revisar historial": 0,
      "Retrasado": 1,
      "Pendiente": 2,
      "Al día": 3
    };

    stats.details.sort(
      (a, b) =>
        order[a.statusPayment] - order[b.statusPayment]
    );

    return stats;
  };

  const originalRender = renderStudentsPage;

  renderStudentsPage = async function (data) {
    try {
      await window.eeaExemptions.load();
    } catch (error) {
      console.error("Exoneraciones:", error);

      const notice = document.createElement("p");
      notice.setAttribute("role", "alert");
      notice.textContent =
        "No se pudieron consultar las exoneraciones. " +
        "Los saldos no restan becas ni excepciones hasta recargar.";

      document.querySelector("main")?.prepend(notice);
    }

    return originalRender(data);
  };
})();
