const THEME_KEY = "edward_theme_v1";
const themeMap = { dark: "themeDark", ira: "themeIra", pink: "themePink" };
const themeIds = Object.values(themeMap);
/** Retrieve saved theme from localStorage or default "dark" */
function getSavedTheme() {
  const value = localStorage.getItem(THEME_KEY);
  if (value === "dark" || value === "ira" || value === "pink") return value;
  return "dark";
}
/** Apply the given theme by enabling its stylesheet */
function applyTheme(themeName) {
  const base = document.getElementById("baseStyles");
  if (base) base.media = "all";
  themeIds.forEach(id => {
    const link = $(id);
    if (!link) return;
    link.disabled = false;
    link.media = (id === themeMap[themeName]) ? "all" : "not all";
  });
}
/** Save theme selection to localStorage */
function saveTheme(name) {
  localStorage.setItem(THEME_KEY, name);
}
/** Cycle through themes in order: dark -> ira -> pink -> dark ... */
function cycleTheme() {
  const order = ["dark", "ira", "pink"];
  const current = getSavedTheme();
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  saveTheme(next);
  applyTheme(next);
}
const themeBtnEl = $("themeBtn");
if (themeBtnEl) {
  themeBtnEl.addEventListener("click", cycleTheme);
}
// Apply saved theme immediately on load
applyTheme(getSavedTheme());

// Navigation and global event elements
const navDash = $("navDash");
const navTodo = $("navTodo");
const navHabits = $("navHabits");
const navExpenses = $("navExpenses");
const navWishlist = $("navWishlist");
const navAddHabits = $("navAddHabits");
const navAddTodo = $("navAddTodo");
const navAddExpenses = $("navAddExpenses");
const navAddWishlist = $("navAddWishlist");

const boxTopA = document.querySelector(".box.topA");
const tableBox = document.querySelector(".tableBox");
const todoBox = $("todoBox");
const bottomBox = document.querySelector(".bottomBox");
const wishWrap = document.querySelector(".wishWrap");

const wishNameInput = $("wishName");

// Helper to smoothly scroll to an element's top
function scrollToEl(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}
// Set active highlight on sidebar navigation
function setNavActive(button) {
  document.querySelectorAll(".navItem").forEach(el => el.classList.remove("isActive"));
  if (button) button.classList.add("isActive");
}

// Sidebar navigation events
if (navDash) {
  navDash.addEventListener("click", () => {
    setNavActive(navDash);
    scrollToEl(boxTopA);
  });
}
if (navHabits) {
  navHabits.addEventListener("click", () => {
    setNavActive(navHabits);
    scrollToEl(tableBox);
  });
  navHabits.addEventListener("dblclick", () => {
    setNavActive(navHabits);
    // Open add habit modal on double-click habits (same as clicking +)
    openHabitModal();
  });
}
if (navTodo) {
  navTodo.addEventListener("click", () => {
    setNavActive(navTodo);
    scrollToEl(todoBox);
  });
  navTodo.addEventListener("dblclick", () => {
    setNavActive(navTodo);
    openTodoModal(getSelectedDateObj());
  });
}
if (navExpenses) {
  navExpenses.addEventListener("click", () => {
    setNavActive(navExpenses);
    scrollToEl(bottomBox);
  });
  // Double-click "Wydatki" scrolls to Wishlist quick-add
  navExpenses.addEventListener("dblclick", (e) => {
    e.preventDefault();
    setNavActive(navExpenses);
    focusWishlistQuickAdd();
  });
}
if (navWishlist) {
  navWishlist.addEventListener("click", () => {
    setNavActive(navWishlist);
    scrollToEl(wishWrap || bottomBox);
  });
  navWishlist.addEventListener("dblclick", () => {
    setNavActive(navWishlist);
    openWishModal();
  });
}
if (navAddHabits) {
  navAddHabits.addEventListener("click", (e) => {
    e.stopPropagation();
    setNavActive(navHabits);
    openHabitModal();
  });
}
if (navAddTodo) {
  navAddTodo.addEventListener("click", (e) => {
    e.stopPropagation();
    setNavActive(navTodo);
    openTodoModal(getSelectedDateObj());
  });
}
if (navAddExpenses) {
  navAddExpenses.addEventListener("click", (e) => {
    // Shift+click on Expenses "+" opens Wishlist quick-add instead
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      setNavActive(navExpenses);
      focusWishlistQuickAdd();
    } else {
      e.stopPropagation();
      setNavActive(navExpenses);
      openExpModal();
    }
  });
}
if (navAddWishlist) {
  navAddWishlist.addEventListener("click", (e) => {
    e.stopPropagation();
    setNavActive(navWishlist);
    openWishModal();
  });
}

// Quick-add to wishlist from expenses section
function focusWishlistQuickAdd() {
  if (!bottomBox) return;
  bottomBox.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => { wishNameInput?.focus(); }, 250);
}

