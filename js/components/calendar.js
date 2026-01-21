// Calendar component: manages calendar view and date selection
const calTitle = $("calTitle");
const calGrid = $("calGrid");
const btnPrev = $("calPrev");
const btnNext = $("calNext");
const btnToday = $("calToday");

/** Build an array of Date objects representing the 6-week calendar grid for given month */
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const gridStart = startOfWeekMonday(first);

  const days = [];
  let d = gridStart;

  for (let i = 0; i < 42; i++) {
    days.push(new Date(d));
    d = addDays(d, 1);
  }

  return days;
}


/** Re-render the calendar grid based on state.viewYear and state.viewMonth */
function renderCalendar() {
  if (calTitle) {
    calTitle.textContent = `${monthNamePL(state.viewMonth)} ${state.viewYear}`;
  }
  if (!calGrid) return;
  calGrid.innerHTML = "";
  const days = buildMonthGrid(state.viewYear, state.viewMonth);
  const selectedDate = fromISO(state.selectedDate);
  const weekStart = startOfWeekMonday(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  for (const d of days) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calDay";
    const inMonth = d.getMonth() === state.viewMonth;
    if (!inMonth) cell.classList.add("calMuted");
    if (sameDay(d, selectedDate)) cell.classList.add("calSelected");
    if (d >= weekStart && d <= weekEnd) cell.classList.add("calWeek");
    cell.textContent = String(d.getDate());
    cell.addEventListener("click", () => setSelectedDate(d));
    cell.addEventListener("dblclick", (e) => {
      e.preventDefault();
      console.log("DBLCLICK", toISO(d), typeof openTodoModal);
      setSelectedDate(d);
      if (typeof openTodoModal === "function") openTodoModal(d);
    });
    calGrid.appendChild(cell);
  }
}
/** Set selected date in state and update calendar and other components */
function setSelectedDate(date) {
  const x = startOfDay(date);
  state.selectedDate = toISO(x);
  state.viewMonth = x.getMonth();
  state.viewYear = x.getFullYear();
  saveState();
  renderAll();
}
/** Change calendar view month/year (without changing selected date) */
function setViewMonthYear(year, month) {
  state.viewYear = year;
  state.viewMonth = month;
  saveState();
  renderCalendar();
}

// Hook up calendar navigation buttons
btnPrev?.addEventListener("click", () => {
  let y = state.viewYear;
  let m = state.viewMonth - 1;
  if (m < 0) { m = 11; y -= 1; }
  setViewMonthYear(y, m);
});
btnNext?.addEventListener("click", () => {
  let y = state.viewYear;
  let m = state.viewMonth + 1;
  if (m > 11) { m = 0; y += 1; }
  setViewMonthYear(y, m);
});
btnToday?.addEventListener("click", () => {
  setSelectedDate(new Date());
});
