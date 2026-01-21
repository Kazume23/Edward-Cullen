const LS_KEY = "habit_app_v1";
/** Load state object from localStorage or initialize default state */
function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const today = new Date();
    const isoToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    return {
      habits: [
        { id: crypto.randomUUID(), name: "Wstać o 6:00" },
        { id: crypto.randomUUID(), name: "Trening" },
        { id: crypto.randomUUID(), name: "Czytanie" }
      ],
      entries: {},
      todos: [],
      expenses: [],
      wishlist: [],
      selectedDate: isoToday,
      viewMonth: today.getMonth(),
      viewYear: today.getFullYear(),
      chartMode: "week"
    };
  }
  try {
    const s = JSON.parse(raw);
    if (!s.habits) s.habits = [];
    if (!s.entries) s.entries = {};
    if (!s.todos) s.todos = [];
    if (!s.expenses) s.expenses = [];
    if (!s.wishlist) s.wishlist = [];
    if (!s.selectedDate) {
      const today = new Date();
      s.selectedDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    }
    if (typeof s.viewMonth !== "number") s.viewMonth = new Date().getMonth();
    if (typeof s.viewYear !== "number") s.viewYear = new Date().getFullYear();
    if (!s.chartMode || (s.chartMode !== "week" && s.chartMode !== "month")) {
      s.chartMode = "week";
    }
    return s;
  } catch {
    localStorage.removeItem(LS_KEY);
    return loadState();
  }
}
/** Save current state to localStorage */
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
/** Initialize global state */
state = loadState();
