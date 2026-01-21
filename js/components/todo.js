// ToDo component: manage to-do list and modal
const todoEmptyMsg = $("todoEmpty");
const todoListContainer = $("todoList");
const todoAddBtnEl = $("todoAddBtn");
const todoTitleSubEl = $("todoTitleSub");
const todoOverlay = $("todoOverlay");
const todoDateInput = $("todoDate");
const todoTextInput = $("todoText");
const todoSaveBtn = $("todoSave");
const todoCloseBtn = $("todoClose");
const todoCancelBtn = $("todoCancel");

/** Open the ToDo modal for a given date */
function openTodoModal(dateObj) {
  if (!dateObj) dateObj = new Date();
  todoDateInput.value = toISO(dateObj);
  todoTextInput.value = "";
  todoOverlay.classList.add("isOpen");
  todoOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => todoTextInput.focus(), 0);
}
/** Close the ToDo modal */
function closeTodoModal() {
  todoOverlay.classList.remove("isOpen");
  todoOverlay.setAttribute("aria-hidden", "true");
}
/** Add a new ToDo item to state */
function addTodo(dateISO, text) {
  const t = String(text || "").trim();
  if (!t) return;
  state.todos.push({
    id: crypto.randomUUID(),
    dateISO,
    text: t,
    done: false,
    createdAt: Date.now()
  });
  saveState();
  renderTodos();
}
/** Toggle the completion status of a ToDo by id */
function toggleTodo(id) {
  const item = state.todos.find(x => x.id === id);
  if (!item) return;
  item.done = !item.done;
  saveState();
  renderTodos();
}
/** Delete a ToDo by id */
function deleteTodo(id) {
  state.todos = state.todos.filter(x => x.id !== id);
  saveState();
  renderTodos();
}
/** Re-render the ToDo list for the current viewMonth/viewYear */
function renderTodos() {
  if (todoTitleSubEl) {
    todoTitleSubEl.textContent = `• ${monthNamePL(state.viewMonth)} ${state.viewYear}`;
  }
  todoListContainer.innerHTML = "";
  const items = [...state.todos].sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  if (!items.length) {
    todoEmptyMsg.style.display = "block";
    return;
  }
  todoEmptyMsg.style.display = "none";
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "todoItem";
    if (it.done) row.classList.add("todoDone");
    const left = document.createElement("div");
    left.className = "todoLeft";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todoCheck";
    checkbox.checked = !!it.done;
    checkbox.addEventListener("change", () => toggleTodo(it.id));
    const textBox = document.createElement("div");
    const txt = document.createElement("div");
    txt.className = "todoText";
    txt.textContent = it.text;
    const meta = document.createElement("div");
    meta.className = "todoMeta";
    meta.textContent = fmtPL(fromISO(it.dateISO));
    textBox.appendChild(txt);
    textBox.appendChild(meta);
    left.appendChild(checkbox);
    left.appendChild(textBox);
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "todoDel";
    delBtn.textContent = "×";
    delBtn.title = "Usuń";
    delBtn.addEventListener("click", () => deleteTodo(it.id));
    row.appendChild(left);
    row.appendChild(delBtn);
    todoListContainer.appendChild(row);
  }
}

// Event listeners for ToDo modal and add button
todoAddBtnEl?.addEventListener("click", () => {
  openTodoModal(getSelectedDateObj());
});
todoCloseBtn?.addEventListener("click", closeTodoModal);
todoCancelBtn?.addEventListener("click", closeTodoModal);
todoOverlay?.addEventListener("click", (e) => {
  if (e.target === todoOverlay) closeTodoModal();
});
document.addEventListener("keydown", (e) => {
  if (todoOverlay.classList.contains("isOpen") && e.key === "Escape") {
    closeTodoModal();
  }
});
todoSaveBtn?.addEventListener("click", () => {
  addTodo(todoDateInput.value, todoTextInput.value);
  closeTodoModal();
});
