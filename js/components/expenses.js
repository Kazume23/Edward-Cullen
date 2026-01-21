// Expenses component: manage expense log and modal
const expAmountInput = $("expAmount");
const expWhatInput = $("expWhat");
const expCategorySelect = $("expCategory");
const expScoreSelect = $("expScore");
const expPeriodSelect = $("expPeriod");
const expDateInput = $("expDate");
const expAddBtn = $("expAdd");
const expListContainer = $("expList");
const expSummaryLabel = $("expSummary");

/** Ensure state.expenses array exists */
function ensureExpenses() {
  if (!state.expenses) state.expenses = [];
}
/** Calculate sum of given expenses list */
function sumExpenses(items) {
  return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
}
/** Add a new expense from input fields */
function addExpense() {
  ensureExpenses();
  const amt = Number(String(expAmountInput.value || "").replace(",", "."));
  const what = String(expWhatInput.value || "").trim();
  const dateISO = expDateInput.value || state.selectedDate;
  if (!Number.isFinite(amt) || amt <= 0) return;
  if (String(Math.floor(amt)).length > 10) return;
  if (!what) return;
  state.expenses.push({
    id: crypto.randomUUID(),
    dateISO,
    amount: amt,
    what,
    category: expCategorySelect.value,
    score: expScoreSelect.value,
    period: expPeriodSelect.value,
    createdAt: Date.now()
  });
  expAmountInput.value = "";
  expWhatInput.value = "";
  expPeriodSelect.value = "once";
  saveState();
  renderExpenses();
  renderCalendar();
}
/** Delete an expense by id */
function deleteExpense(id) {
  ensureExpenses();
  state.expenses = state.expenses.filter(x => x.id !== id);
  saveState();
  renderExpenses();
  renderCalendar();
}
/** Render the expense list for the selected date (or for all if filtered off) */
function renderExpenses() {
  ensureExpenses();
  const filterISO = state.selectedDate;
  expDateInput.value = filterISO;
  const items = [...state.expenses];
  items.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return b.dateISO.localeCompare(a.dateISO);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const total = sumExpenses(items.filter(it => it.dateISO === filterISO || $("expOnlySelected")?.checked !== true));
  expSummaryLabel.textContent = "Suma: " + total.toFixed(2).replace(".", ",") + " zł";
  expListContainer.innerHTML = "";
  if (!items.length) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "todoEmpty";
    emptyMsg.textContent = "Brak wpisów.";
    expListContainer.appendChild(emptyMsg);
    return;
  }
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "expItem";
    const amtDiv = document.createElement("div");
    amtDiv.className = "expAmt";
    amtDiv.textContent = (Number(it.amount).toFixed(2).replace(".", ",")) + " zł";
    const whatBox = document.createElement("div");
    const whatDiv = document.createElement("div");
    whatDiv.textContent = it.what;
    const metaDiv = document.createElement("div");
    metaDiv.className = "expMeta";
    metaDiv.textContent = fmtPL(fromISO(it.dateISO));
    whatBox.appendChild(whatDiv);
    whatBox.appendChild(metaDiv);
    const catDiv = document.createElement("div");
    catDiv.className = "expTag";
    catDiv.textContent = it.category;
    const scoreDiv = document.createElement("div");
    scoreDiv.className = "expTag";
    scoreDiv.textContent = (it.score === "A" ? "A — Wysoki priorytet"
                         : it.score === "B" ? "B — Konieczny"
                         : it.score === "C" ? "C — Opcjonalny"
                         : "D — Zbędny");
    const periodDiv = document.createElement("div");
    periodDiv.className = "expTag";
    periodDiv.textContent = (it.period === "weekly" ? "Tygodniowe"
                           : it.period === "monthly" ? "Miesięczne"
                           : it.period === "yearly" ? "Roczne"
                           : "Jednorazowe");
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "expDel";
    delBtn.textContent = "×";
    delBtn.title = "Usuń";
    delBtn.addEventListener("click", () => deleteExpense(it.id));
    row.appendChild(amtDiv);
    row.appendChild(whatBox);
    row.appendChild(catDiv);
    row.appendChild(scoreDiv);
    row.appendChild(periodDiv);
    row.appendChild(delBtn);
    expListContainer.appendChild(row);
  }
}

// Input masking for expense amount (allow only digits and comma)
expAmountInput?.addEventListener("input", () => {
  let v = expAmountInput.value.replace(/[^0-9.,]/g, "");
  const parts = v.split(/[.,]/);
  if (parts[0].length > 9) parts[0] = parts[0].slice(0, 9);
  expAmountInput.value = parts.length > 1 ? parts[0] + "," + parts[1].slice(0, 2) : parts[0];
});

// Expense form actions
expAddBtn?.addEventListener("click", addExpense);
expWhatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addExpense();
});
