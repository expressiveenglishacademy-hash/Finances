
(() => {
  if (typeof computeStudentStats !== "function") return;

  const months = [
    "enero", "febrero", "marzo", "abril",
    "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const nameKey = (name) =>
    String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();

  function paymentMonth(payment) {
    const text =
      `${payment.concept || ""} ${payment.notes || ""}`;

    // Prioridad: mes seleccionado en Historial de pagos.
    const assigned = text.match(
      /\[MES:(\d{4}-(?:0[1-9]|1[0-2]))\]/i
    );

    if (assigned) return assigned[1];

    // Compatibilidad con registros anteriores.
    const clean = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const match = clean.match(
      /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?:\s+(20\d{2}))?/
    );

    if (!match) return "";

    const name = match[1] === "setiembre"
      ? "septiembre"
      : match[1];

    const month = months.indexOf(name) + 1;
    const date = String(payment.date || "");
    const year = match[2] || date.slice(0, 4);

    if (!/^\d{4}$/.test(year)) return "";

    if (
      !match[2] &&
      month > Number(date.slice(5, 7))
    ) {
      return "";
    }

    return `${year}-${String(month).padStart(2, "0")}`;
  }

  computeStudentStats = function (data) {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();

    const currentMonth =
      `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    const activeStudents = data.students.filter(
      (student) =>
        normalizeStudentStatus(student.status) === "Activo"
    );

    const details = activeStudents.map((student) => {
      const payments = data.incomes.filter(
        (payment) =>
          nameKey(payment.student) === nameKey(student.name) &&
          String(payment.category || "Mensualidad")
            .trim()
            .toLowerCase() === "mensualidad"
      );

      // Incluye pagos recibidos en otra fecha si pertenecen
      // al mes actual. Excluye pagos de otros meses.
      const paidCents = payments
        .filter(
          (payment) =>
            paymentMonth(payment) === currentMonth
        )
        .reduce(
          (sum, payment) =>
            sum + Math.round(
              Number(payment.amount || 0) * 100
            ),
          0
        );

      const feeCents = Math.round(
        Number(student.monthlyFee || 0) * 100
      );

      const pendingCents = Math.max(
        0,
        feeCents - paidCents
      );

      const lastDay = new Date(
        year,
        monthIndex + 1,
        0
      ).getDate();

      const dueDay = Math.min(
        Math.max(1, Number(student.dueDay || 1)),
        lastDay
      );

      const nextDueDate = new Date(
        year,
        monthIndex,
        dueDay,
        23,
        59,
        59
      );

      const lastPayment = payments
        .map((payment) => String(payment.date || ""))
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      let statusPayment;

      if (pendingCents <= 0) {
        statusPayment = "Al día";
      } else if (now > nextDueDate) {
        statusPayment = "Retrasado";
      } else {
        statusPayment = "Pendiente";
      }

      // Evita afirmar una deuda cuando un pago recibido
      // este mes aún no tiene un mes identificable.
      const unclearThisMonth = payments.some(
        (payment) =>
          !paymentMonth(payment) &&
          String(payment.date || "").slice(0, 7) === currentMonth
      );

      if (pendingCents > 0 && unclearThisMonth) {
        statusPayment = "Revisar historial";
      }

      return {
        ...student,
        lastPayment,
        paidThisMonth: paidCents / 100,
        pendingAmount: pendingCents / 100,
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

      onTime: details.filter(
        (student) => student.statusPayment === "Al día"
      ).length,

      pending: details.filter(
        (student) =>
          ["Pendiente", "Revisar historial"].includes(
            student.statusPayment
          )
      ).length,

      late: details.filter(
        (student) => student.statusPayment === "Retrasado"
      ).length,

      details: details.sort(
        (a, b) =>
          order[a.statusPayment] - order[b.statusPayment]
      )
    };
  };
})();
