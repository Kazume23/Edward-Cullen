// Pomodoro component: timer logic and controls
const pomoFocusBtn = $("pomoFocus");
const pomoBreakBtn = $("pomoBreak");
const pomoLongBtn = $("pomoLong");
const pomoTimeEl = $("pomoTime");
const pomoStartBtn = $("pomoStart");
const pomoResetBtn = $("pomoReset");
const pomoSessionEl = $("pomoSession");

let pomoTimerId = null;
let pomoEditInput = null;

/** Format seconds to MM:SS */
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}
/** Stop the pomodoro interval timer */
function stopPomoInterval() {
  if (pomoTimerId) {
    clearInterval(pomoTimerId);
    pomoTimerId = null;
  }
}
/** Start the pomodoro interval timer (tick every 250ms) */
function startPomoInterval() {
  stopPomoInterval();
  pomoTimerId = setInterval(pomoTick, 250);
}
/** Sync UI state for pomodoro (timer display, mode buttons, start button text) */
function pomoSyncUI() {
  ensurePomodoro();
  const p = state.pomodoro;
  pomoTimeEl.textContent = fmtTime(p.remainingSec);
  pomoSessionEl.textContent = String(p.session);
  pomoFocusBtn.classList.toggle("isActive", p.mode === "focus");
  pomoBreakBtn.classList.toggle("isActive", p.mode === "break");
  pomoLongBtn.classList.toggle("isActive", p.mode === "long");
  pomoStartBtn.textContent = p.isRunning ? "Pause" : "Start";
}
/** Ensure state.pomodoro exists with default structure */
function ensurePomodoro() {
  if (!state.pomodoro) {
    state.pomodoro = {
      mode: "focus",
      durationsMin: { focus: 25, break: 5, long: 15 },
      remainingByMode: { focus: 25*60, break: 5*60, long: 15*60 },
      remainingSec: 25 * 60,
      isRunning: false,
      lastTick: 0,
      session: 0
    };
    return;
  }
  const p = state.pomodoro;
  if (!p.durationsMin) p.durationsMin = { focus: 25, break: 5, long: 15 };
  if (!p.remainingByMode) {
    p.remainingByMode = {
      focus: (Number(p.durationsMin.focus) || 25) * 60,
      break: (Number(p.durationsMin.break) || 5) * 60,
      long: (Number(p.durationsMin.long) || 15) * 60
    };
  }
  if (typeof p.mode !== "string") p.mode = "focus";
  if (typeof p.remainingSec !== "number") {
    p.remainingSec = p.remainingByMode[p.mode] ?? ((Number(p.durationsMin[p.mode]) || 25) * 60);
  }
  if (typeof p.isRunning !== "boolean") p.isRunning = false;
  if (typeof p.lastTick !== "number") p.lastTick = 0;
  if (typeof p.session !== "number") p.session = 0;
}
/** Save current remaining time for the current mode */
function savePomoRemaining() {
  ensurePomodoro();
  state.pomodoro.remainingByMode[state.pomodoro.mode] = state.pomodoro.remainingSec;
}
/** Switch pomodoro mode (focus/break/long) */
function switchPomoMode(nextMode) {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoEditInput) return;  // do not switch while editing duration
  savePomoRemaining();
  p.mode = nextMode;
  p.remainingSec = p.remainingByMode[nextMode] ?? ((Number(p.durationsMin[nextMode]) || 1) * 60);
  p.isRunning = false;
  p.lastTick = 0;
  saveState();
  stopPomoInterval();
  pomoSyncUI();
}
/** Handle completion of a focus/break cycle and switch to next */
function completePomoCycle() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (p.mode === "focus") {
    p.session += 1;
    p.mode = (p.session % 4 === 0) ? "long" : "break";
  } else {
    p.mode = "focus";
  }
  const mins = Number(p.durationsMin[p.mode]) || 1;
  p.remainingSec = Math.max(1, Math.round(mins * 60));
  p.remainingByMode[p.mode] = p.remainingSec;
  p.isRunning = false;
  p.lastTick = 0;
  saveState();
  stopPomoInterval();
  pomoSyncUI();
}
/** Interval tick handler for pomodoro timer */
function pomoTick() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (!p.isRunning) return;
  const now = Date.now();
  if (!p.lastTick) p.lastTick = now;
  const deltaMs = now - p.lastTick;
  if (deltaMs < 200) return;
  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec <= 0) return;
  p.lastTick += deltaSec * 1000;
  p.remainingSec -= deltaSec;
  if (p.remainingSec <= 0) {
    p.remainingSec = 0;
    p.remainingByMode[p.mode] = 0;
    saveState();
    pomoSyncUI();
    completePomoCycle();
    return;
  }
  p.remainingByMode[p.mode] = p.remainingSec;
  saveState();
  pomoSyncUI();
}
/** Start or pause the pomodoro timer */
function togglePomoStart() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoEditInput) return;  // ignore if editing time
  if (p.remainingSec <= 0) {
    // reset if at zero
    const mins = Number(p.durationsMin[p.mode]) || 1;
    p.remainingSec = Math.max(1, Math.round(mins * 60));
    p.remainingByMode[p.mode] = p.remainingSec;
  }
  p.isRunning = !p.isRunning;
  p.lastTick = Date.now();
  saveState();
  pomoSyncUI();
  if (p.isRunning) startPomoInterval();
  else stopPomoInterval();
}
/** Reset current pomodoro timer without changing mode */
function resetPomodoro() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoEditInput) return;
  const mins = Number(p.durationsMin[p.mode]) || 1;
  p.isRunning = false;
  p.lastTick = 0;
  p.remainingSec = Math.max(1, Math.round(mins * 60));
  p.remainingByMode[p.mode] = p.remainingSec;
  saveState();
  stopPomoInterval();
  pomoSyncUI();
}
/** Begin inline editing of pomodoro duration */
function beginPomoEdit() {
  if (!pomoTimeEl) return;
  if (!pomoCanEdit()) return;
  if (pomoEditInput) return;
  ensurePomodoro();
  const p = state.pomodoro;
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.className = "pomoEdit";
  input.value = String(Math.max(1, Math.round((p.remainingSec || 60) / 60)));
  pomoTimeEl.replaceWith(input);
  pomoEditInput = input;
  input.focus();
  input.select();
  const cancelEdit = () => {
    if (!pomoEditInput) return;
    pomoEditInput.replaceWith(pomoTimeEl);
    pomoEditInput = null;
    pomoSyncUI();
  };
  const commitEdit = () => {
    if (!pomoEditInput) return;
    const parsed = parsePomoInput(pomoEditInput.value);
    if (parsed) {
      p.durationsMin[p.mode] = parsed.mins;
      p.remainingSec = parsed.remainingSec;
      p.remainingByMode[p.mode] = parsed.remainingSec;
      p.isRunning = false;
      p.lastTick = 0;
      saveState();
    }
    pomoEditInput.replaceWith(pomoTimeEl);
    pomoEditInput = null;
    pomoSyncUI();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  });
  input.addEventListener("blur", commitEdit);
}
/** Check if pomodoro time can be edited (not running and at start of interval) */
function pomoCanEdit() {
  ensurePomodoro();
  const p = state.pomodoro;
  return !p.isRunning && p.lastTick === 0;
}
/** Parse user input string for inline time edit (MM or MM:SS) */
function parsePomoInput(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const mins = Math.max(1, Math.min(240, Math.round(Number(t))));
    return { remainingSec: mins * 60, mins };
  }
  const m = t.match(/^(\d{1,3})\s*:\s*(\d{1,2})$/);
  if (m) {
    const mm = Math.max(0, Math.min(240, Number(m[1])));
    const ss = Math.max(0, Math.min(59, Number(m[2])));
    const total = Math.max(1, (mm * 60) + ss);
    const mins = Math.max(1, Math.min(240, Math.round(total / 60)));
    return { remainingSec: total, mins };
  }
  return null;
}

// Attach events for pomodoro controls
pomoFocusBtn?.addEventListener("click", () => switchPomoMode("focus"));
pomoBreakBtn?.addEventListener("click", () => switchPomoMode("break"));
pomoLongBtn?.addEventListener("click", () => switchPomoMode("long"));
pomoStartBtn?.addEventListener("click", togglePomoStart);
pomoResetBtn?.addEventListener("click", resetPomodoro);
pomoTimeEl?.addEventListener("click", beginPomoEdit);

/** Restore timer state if it was running when page reloaded */
function restorePomoRunning() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (!p.isRunning) {
    pomoSyncUI();
    return;
  }
  const now = Date.now();
  const last = p.lastTick || now;
  const deltaSec = Math.floor((now - last) / 1000);
  p.lastTick = now;
  if (deltaSec > 0) p.remainingSec -= deltaSec;
  if (p.remainingSec <= 0) {
    p.remainingSec = 0;
    p.remainingByMode[p.mode] = 0;
    p.isRunning = false;
    saveState();
    pomoSyncUI();
    completePomoCycle();
    return;
  }
  p.remainingByMode[p.mode] = p.remainingSec;
  saveState();
  pomoSyncUI();
  startPomoInterval();
}

// Start pomodoro if it was running before
restorePomoRunning();
