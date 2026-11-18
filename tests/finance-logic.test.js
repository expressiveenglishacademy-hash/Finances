const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { console, Intl, URLSearchParams };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../finance-logic.js"), "utf8"), context);

const {
  paymentMonthOf,
  computeStudentStatsShared,
  computeStudentStatsByDepositDate,
  summarizeTransfers,
  collectQualityWarnings,
  balanceForStudent,
  buildReminderMessage,
  whatsappLink,
  digitsPhone,
  buildVistaData,
  isArchivedTeacher,
  isActiveTeacher,
  visibleTeachers,
  archiveTeacherById,
  mergeTeacherRecords,
  teacherNamesToImport,
  enrollmentTeacherNames,
  canonicalTeacherStatus
} = context;

const today = "2026-11-18T12:00:00";

function student(partial) {
  return {
    id: partial.id,
    name: partial.name,
    monthlyFee: partial.monthlyFee,
    dueDay: partial.dueDay,
    status: partial.status || "Activo",
    ...partial
  };
}

const data = {
  students: [
    student({ id: "a", name: "María López", monthlyFee: 25, dueDay: 5 }),
    student({ id: "b", name: "José Pérez", monthlyFee: 25, dueDay: 10 }),
    student({ id: "c", name: "Pedro Sánchez", monthlyFee: 25, dueDay: 20 })
  ],
  incomes: [
    { id: "p1", date: "2026-11-02", student: "María López", category: "Mensualidad", concept: "Mensualidad noviembre [MES:2026-11]", amount: 25, method: "Transferencia", currency: "USD", originalAmount: 25, account: "Banco USD" },
    { id: "p2", date: "2026-11-04", student: "José Pérez", category: "Mensualidad", concept: "Mensualidad octubre [MES:2026-10]", amount: 25, method: "Transferencia", currency: "USD", originalAmount: 25, account: "Banco USD" },
    { id: "p3", date: "2026-11-07", student: "Pedro Sánchez", category: "Mensualidad", concept: "Mensualidad marzo [MES:2026-11]", amount: 25, method: "Efectivo", currency: "USD", originalAmount: 25, account: "Efectivo USD" }
  ],
  expenses: [],
  accounts: [
    { name: "Efectivo C$", initialBalance: 0 }
  ]
};

assert.equal(paymentMonthOf(data.incomes[1]), "2026-10");
assert.equal(paymentMonthOf(data.incomes[0]), "2026-11");

const shared = computeStudentStatsShared(data, { today, exemptions: [] });
const legacy = computeStudentStatsByDepositDate(data, { today });

assert.equal(shared.onTime, 2);
assert.equal(shared.late, 1);
assert.equal(legacy.onTime, 3);
assert.notEqual(shared.onTime, legacy.onTime);

const jose = shared.details.find((item) => item.name === "José Pérez");
assert.equal(jose.statusPayment, "Retrasado");
assert.equal(jose.pendingAmount, 25);

const again = computeStudentStatsShared(data, { today, exemptions: [] });
assert.equal(again.onTime, shared.onTime);
assert.equal(again.pending, shared.pending);
assert.equal(again.late, shared.late);

const forgiven = computeStudentStatsShared(data, {
  today,
  exemptions: [{ student_id: "b", period: "2026-11", amount: 25, status: "active" }]
});
assert.equal(forgiven.details.find((item) => item.id === "b").statusPayment, "Al día");

const summary = summarizeTransfers(data.incomes, { p1: { withdrawnAt: "2026-11-12" } });
assert.equal(summary.outstanding.usd, 25);
assert.equal(summary.withdrawn.usd, 25);
assert.equal(summary.mistakes.length, 0);

const cashTransfer = summarizeTransfers([
  { id: "x", date: "2026-11-01", method: "Transferencia", currency: "USD", originalAmount: 10, amount: 10, account: "Efectivo USD" },
  { id: "y", date: "2026-11-02", method: "Transferencia", currency: "NIO", originalAmount: 365, amount: 10, account: "Banco C$" }
], {});
assert.equal(cashTransfer.mistakes.length, 1);
assert.equal(cashTransfer.outstanding.usd, 0);
assert.equal(cashTransfer.outstanding.nio, 365);

context.getAccountBalances = () => [{ name: "Efectivo C$", current: -80 }];
const warnings = collectQualityWarnings({
  ...data,
  students: data.students.concat([
    student({ id: "t", name: "Alumno Test", monthlyFee: 25, dueDay: 1, notes: "prueba" }),
    student({ id: "d1", name: "Ana Ruiz", monthlyFee: 30, dueDay: 1, status: "Activo", notes: "dado de baja en octubre" }),
    student({ id: "d2", name: "Ana Ruiz", monthlyFee: 30, dueDay: 1, status: "Dropped Off" })
  ]),
  expenses: [{ description: "gasto demo", amount: 5, account: "Efectivo C$" }]
}, { today, exemptions: [] });

const titles = warnings.map((item) => item.title);
assert.ok(titles.some((title) => title.includes("prueba")));
assert.ok(titles.some((title) => title.includes("etiqueta")));
assert.ok(titles.some((title) => title.includes("baja")));
assert.ok(titles.some((title) => title.includes("negativo")));
assert.ok(titles.some((title) => title.includes("mensualidad")));

const lucia = {
  id: "s3",
  name: "Lucía Gómez",
  student_type: "nino",
  mother_name: "Carmen Gómez",
  guardian_phone: "88880011",
  monthly_fee: 20,
  due_day: 8,
  enrollment_date: "2026-09-01"
};
const balance = balanceForStudent(lucia, [
  { student: "Lucía Gómez", category: "Mensualidad", date: "2026-09-02", concept: "[MES:2026-09]", amount: 20 }
], { today, exemptions: [] });
assert.equal(balance.review, false);
assert.ok(balance.total > 0);
assert.ok(balance.daysOverdue > 0);

const message = buildReminderMessage(lucia, balance, { today });
assert.match(message, /¿cómo estás\?/);
assert.match(message, /Te escribo de Expressive English Academy/);
assert.match(message, /¿Podés ponerte al día/);
assert.match(message, /necesitás/);
assert.equal(message.includes("api.whatsapp"), false);

const link = whatsappLink(digitsPhone(lucia), message);
assert.match(link, /^https:\/\/wa\.me\/50588880011\?text=/);
assert.equal(link.includes("send=true"), false);

const vista = buildVistaData();
assert.ok(vista.students.length > 0);
assert.ok(summarizeTransfers(vista.incomes, {}).mistakes.length >= 1);

const fernanda = { id: "t-fer", name: "Fernanda Hernandez", status: "Activo", contact: "111", notes: "" };
const irving = { id: "t-irv", name: "Irving Garcia", status: "Activo", contact: "222", notes: "" };
const joseTeacher = { id: "t-jose", name: "Jose Andres Martinez", status: "Activo", contact: "", notes: "" };
const karen = { id: "t-kar", name: "Karen Eligia Perez Delgado", status: "Activo", contact: "", notes: "" };
const fernandaPayment = {
  id: "pay-fer",
  teacher: "Fernanda Hernandez",
  amount: 80,
  subcategory: "Horas laborales regulares"
};
const payments = [fernandaPayment];
const paymentSnapshot = JSON.stringify(payments);

let teachers = archiveTeacherById([fernanda, irving, joseTeacher, karen], fernanda.id);
assert.equal(teachers.find((teacher) => teacher.id === "t-fer").status, "Archivado");
assert.equal(fernanda.status, "Activo");
assert.equal(JSON.stringify(payments), paymentSnapshot);

const remoteStillActive = [
  { ...fernanda, status: "Activo" },
  { id: "t-reimport", name: "Fernanda Hernández", status: "Activo", notes: "Importado desde pagos existentes" },
  irving,
  joseTeacher,
  karen
];
const merged = mergeTeacherRecords(remoteStillActive, teachers);
const fernandas = merged.filter((teacher) => /fernanda/i.test(teacher.name));
assert.equal(fernandas.length, 1);
assert.equal(fernandas[0].status, "Archivado");
assert.equal(fernandas[0].id, "t-fer");
assert.equal(merged.filter((teacher) => !/fernanda/i.test(teacher.name)).length, 3);
assert.equal(JSON.stringify([...teacherNamesToImport(merged, payments)]), "[]");
assert.equal(enrollmentTeacherNames(merged, payments).some((name) => /fernanda/i.test(name)), false);
assert.equal(visibleTeachers(merged).some((teacher) => /fernanda/i.test(teacher.name)), false);
assert.equal(
  JSON.stringify(visibleTeachers(merged).map((teacher) => teacher.name).sort()),
  JSON.stringify(["Irving Garcia", "Jose Andres Martinez", "Karen Eligia Perez Delgado"])
);
assert.equal(JSON.stringify(payments), paymentSnapshot);

const staleDevice = mergeTeacherRecords(
  [{ ...fernanda, status: "Archivado" }, irving, joseTeacher, karen],
  [fernanda, irving, joseTeacher, karen]
);
assert.equal(staleDevice.find((teacher) => teacher.id === "t-fer").status, "Archivado");
assert.equal(staleDevice.length, 4);

const contactEdit = mergeTeacherRecords(
  [{ ...irving, contact: "" }],
  [{ ...irving, contact: "555" }]
);
assert.equal(contactEdit.length, 1);
assert.equal(contactEdit[0].contact, "555");
assert.equal(contactEdit[0].status, "Activo");

const inactive = { id: "t-sub", name: "Sustituto", status: "Inactivo" };
assert.equal(isActiveTeacher(inactive), false);
assert.equal(isArchivedTeacher(inactive), false);
assert.equal(visibleTeachers([inactive, { ...fernanda, status: "Archivado" }]).length, 1);
assert.equal(canonicalTeacherStatus(" archivado "), "Archivado");
assert.equal(
  JSON.stringify([...teacherNamesToImport([irving], [{ teacher: "Maestro Nuevo" }])]),
  JSON.stringify(["Maestro Nuevo"])
);
assert.ok(enrollmentTeacherNames([irving, joseTeacher, karen], payments).includes("Irving Garcia"));

console.log("finance-logic tests passed");
