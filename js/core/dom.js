/** Shortcut for getElementById */
const $ = (id) => document.getElementById(id);

/** Pad a number to 2 digits with leading zero */
function pad2(n) {
  return String(n).padStart(2, "0");
}
/** Format Date to YYYY-MM-DD */
function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** Parse YYYY-MM-DD to Date object */
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** Start of day (midnight) for a given Date */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Add n days to Date d */
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Compare if two dates (Date objects) fall on the same calendar day */
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
/** Get Monday-start week start date for the week containing Date d */
function startOfWeekMonday(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sunday, 1 = Monday
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(x, diff);
}
/** Polish month names */
function monthNamePL(m) {
  return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m];
}
/** Format Date to DD.MM.YYYY in Polish */
function fmtPL(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function getSelectedDateObj() {
  return fromISO(state.selectedDate);
}

