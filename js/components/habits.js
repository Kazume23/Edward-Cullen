// Habits component: habit tracker table and chart logic
const habRangeLabel = $("habRange");
const habThead = $("habThead");
const habTbody = $("habTbody");
const habitNameInput = $("habitName");
const addHabitBtn = $("addHabit");

/** Re-render the habits table for the current week range */
function renderHabits() {
  const selectedDate = fromISO(state.selectedDate);
  const weekStart = startOfWeekMonday(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  if (habRangeLabel) {
    habRangeLabel.textContent = `${fmtPL(weekStart)} do ${fmtPL(addDays(weekStart, 6))}`;
  }
  // Table header row
  const trHead = document.createElement("tr");
  const thHabit = document.createElement("th");
  thHabit.textContent = "Nawyk";
  thHabit.className = "thHabit";
  trHead.appendChild(thHabit);
  const thEmpty = document.createElement("th");
  thEmpty.textContent = "";
  thEmpty.style.width = "44px";
  trHead.appendChild(thEmpty);
  weekDates.forEach(d => {
    const th = document.createElement("th");
    th.className = "thDay";
    th.textContent = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
    if (sameDay(d, selectedDate)) th.classList.add("thToday");
    trHead.appendChild(th);
  });
  if (habThead) {
    habThead.innerHTML = "";
    habThead.appendChild(trHead);
  }
  // Table body rows
  if (habTbody) habTbody.innerHTML = "";
  for (const habit of state.habits) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.className = "tdHabit";
    const nameDiv = document.createElement("div");
    nameDiv.className = "habitName";
    nameDiv.contentEditable = "true";
    nameDiv.spellcheck = false;
    nameDiv.textContent = habit.name;
    nameDiv.addEventListener("blur", () => {
      const v = nameDiv.textContent.trim();
      habit.name = v.length ? v : "Nawyk";
      saveState();
    });
    nameDiv.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); nameDiv.blur(); }
    });
    tdName.appendChild(nameDiv);
    tr.appendChild(tdName);
    const tdDel = document.createElement("td");
    tdDel.className = "tdCell";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "habitDel";
    delBtn.textContent = "×";
    delBtn.title = "Usuń nawyk";
    delBtn.addEventListener("click", () => deleteHabit(habit.id));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    for (const d of weekDates) {
      const dateISO = toISO(d);
      const entryKey = `${habit.id}|${dateISO}`;
      const val = state.entries[entryKey] ?? 0;
      const td = document.createElement("td");
      td.className = "tdCell";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cellBtn";
      if (val === 1) btn.classList.add("cellDone");
      if (val === -1) btn.classList.add("cellFail");
      btn.addEventListener("click", () => cycleEntry(habit.id, dateISO));
      td.appendChild(btn);
      tr.appendChild(td);
    }
    habTbody?.appendChild(tr);
  }
}
/** Toggle habit entry status: 0 -> 1 -> -1 -> 0 */
function cycleEntry(habitId, dateISO) {
  const key = `${habitId}|${dateISO}`;
  const current = state.entries[key] ?? 0;
  let next;
  if (current === 0) next = 1;
  else if (current === 1) next = -1;
  else next = 0;
  if (next === 0) {
    delete state.entries[key];
  } else {
    state.entries[key] = next;
  }
  saveState();
  renderHabits();
  renderChart();
}
/** Remove a habit and its entries */
function deleteHabit(habitId) {
  state.habits = state.habits.filter(h => h.id !== habitId);
  for (const entryKey of Object.keys(state.entries)) {
    if (entryKey.startsWith(habitId + "|")) {
      delete state.entries[entryKey];
    }
  }
  saveState();
  renderHabits();
  renderChart();
}
/** Compute statistics for the current chart mode (week or month) */
function computeChartStats() {
  const { start, end, daysCount } = (state.chartMode === "month")
    ? (() => {
        const d = fromISO(state.selectedDate);
        const y = d.getFullYear(), m = d.getMonth();
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0);
        return { start: startOfDay(start), end: startOfDay(end), daysCount: end.getDate() };
      })()
    : (() => {
        const weekStart = startOfWeekMonday(fromISO(state.selectedDate));
        return { start: startOfDay(weekStart), end: startOfDay(addDays(weekStart, 6)), daysCount: 7 };
      })();
  const totalCells = (state.habits.length || 0) * daysCount;
  let done = 0, fail = 0;
  const perHabit = state.habits.map(h => ({ id: h.id, name: h.name, done: 0, fail: 0, donePct: 0, failPct: 0 }));
  const perMap = Object.fromEntries(perHabit.map(x => [x.id, x]));
  for (let i = 0; i < daysCount; i++) {
    const date = addDays(start, i);
    const iso = toISO(date);
    for (const h of state.habits) {
      const val = state.entries[`${h.id}|${iso}`] ?? 0;
      if (val === 1) { done++; perMap[h.id].done++; }
      else if (val === -1) { fail++; perMap[h.id].fail++; }
    }
  }
  for (const ph of perHabit) {
    ph.donePct = daysCount > 0 ? Math.round((ph.done / daysCount) * 100) : 0;
    ph.failPct = daysCount > 0 ? Math.round((ph.fail / daysCount) * 100) : 0;
  }
  const empty = Math.max(0, totalCells - done - fail);
  const coverage = totalCells > 0 ? Math.round(((done + fail) / totalCells) * 100) : 0;
  const donePerDay = daysCount > 0 ? (done / daysCount).toFixed(2) : "0.00";
  const failPerDay = daysCount > 0 ? (fail / daysCount).toFixed(2) : "0.00";
  return { start, end, daysCount, totalCells, done, fail, empty, coverage, donePerDay, failPerDay, perHabit };
}

/** Generate an SVG arc path string */
function arcPath(cx, cy, r, startAngleDeg, endAngleDeg) {
  const toRad = (deg) => (deg - 90) * Math.PI / 180;

  const start = {
    x: cx + r * Math.cos(toRad(startAngleDeg)),
    y: cy + r * Math.sin(toRad(startAngleDeg))
  };
  const end = {
    x: cx + r * Math.cos(toRad(endAngleDeg)),
    y: cy + r * Math.sin(toRad(endAngleDeg))
  };

  const largeArc = (endAngleDeg - startAngleDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Render the summary donut chart in the dashboard */
function renderDonut(done, fail, empty) {
  const total = done + fail + empty;
  const chartSvg = $("chartSvg");
  if (!chartSvg) return;
  chartSvg.innerHTML = "";
  const cx = 110, cy = 110, r = 86;
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", cx);
  ring.setAttribute("cy", cy);
  ring.setAttribute("r", r);
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "#3a3a3a");
  ring.setAttribute("stroke-width", "18");
  chartSvg.appendChild(ring);
  if (total <= 0) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", cx);
    text.setAttribute("y", cy + 6);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "14");
    text.setAttribute("fill", "#e7e7e7");
    text.textContent = "Brak danych";
    chartSvg.appendChild(text);
    return;
  }
  const parts = [
    { value: empty, stroke: "#555" },
    { value: fail, stroke: "#ff2f5d" },
    { value: done, stroke: "#2f9dff" }
  ].filter(p => p.value > 0);
  let angle = 0;
  for (const p of parts) {
    const span = (p.value / total) * 360;
    const startAngle = angle;
    const endAngle = angle + span;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath(cx, cy, r, startAngle, endAngle));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", p.stroke);
    path.setAttribute("stroke-width", "18");
    path.setAttribute("stroke-linecap", "round");
    chartSvg.appendChild(path);
    angle = endAngle;
  }
  const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  innerCircle.setAttribute("cx", cx);
  innerCircle.setAttribute("cy", cy);
  innerCircle.setAttribute("r", "58");
  innerCircle.setAttribute("fill", "#2a2a2a");
  chartSvg.appendChild(innerCircle);
  const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  centerText.setAttribute("x", cx);
  centerText.setAttribute("y", cy + 6);
  centerText.setAttribute("text-anchor", "middle");
  centerText.setAttribute("font-size", "16");
  centerText.setAttribute("fill", "#e7e7e7");
  centerText.textContent = `${Math.round((done / total) * 100)}%`;
  chartSvg.appendChild(centerText);
}
/** Sync the chart mode toggle buttons (week vs month) */
function syncChartTabs() {
  const isWeek = state.chartMode === "week";
  $("chartWeek")?.classList.toggle("isActive", isWeek);
  $("chartMonth")?.classList.toggle("isActive", !isWeek);
}
/** Render the chart summary text and donut chart */
function renderChart() {
  const stats = computeChartStats();
  $("chartDone").textContent = String(stats.done);
  $("chartFail").textContent = String(stats.fail);
  $("chartEmpty").textContent = String(stats.empty);
  const rangeLabel = state.chartMode === "month"
    ? `${monthNamePL(getSelectedDateObj().getMonth())} ${getSelectedDateObj().getFullYear()}`
    : `${fmtPL(stats.start)} - ${fmtPL(stats.end)}`;
  $("chartRangeTxt").textContent = rangeLabel;
  syncChartTabs();
  renderDonut(stats.done, stats.fail, stats.empty);
}
/** Toggle chart mode to week or month */
$("chartWeek")?.addEventListener("click", () => {
  state.chartMode = "week";
  saveState();
  renderChart();
});
$("chartMonth")?.addEventListener("click", () => {
  state.chartMode = "month";
  saveState();
  renderChart();
});

// Add Habit form actions
addHabitBtn?.addEventListener("click", () => addHabit());
habitNameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addHabit();
});
/** Add a new habit from quick input field */
function addHabit() {
  const name = String(habitNameInput.value || "").trim();
  if (!name) return;
  state.habits.push({ id: crypto.randomUUID(), name });
  habitNameInput.value = "";
  saveState();
  renderHabits();
  renderChart();
}
