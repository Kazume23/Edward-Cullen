// Wishlist component: manage wishlist and modal
const wishNameInputField = $("wishName");
const wishPriceInputField = $("wishPrice");
const wishAddBtn = $("wishAdd");
const wishListContainer = $("wishList");

/** Ensure state.wishlist array exists */
function ensureWishlist() {
  if (!state.wishlist) state.wishlist = [];
}
/** Add a new wishlist item from input fields */
function addWish() {
  ensureWishlist();
  const name = String(wishNameInputField.value || "").trim();
  const priceRaw = String(wishPriceInputField.value || "").trim();
  if (!name) return;
  let price = null;
  if (priceRaw !== "") {
    const n = Number(priceRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    price = n;
  }
  state.wishlist.push({
    id: crypto.randomUUID(),
    name,
    price,
    createdAt: Date.now()
  });
  wishNameInputField.value = "";
  wishPriceInputField.value = "";
  saveState();
  renderWishlist();
}
/** Delete a wishlist item by id */
function deleteWish(id) {
  ensureWishlist();
  state.wishlist = state.wishlist.filter(x => x.id !== id);
  saveState();
  renderWishlist();
}
/** Render the wishlist items */
function renderWishlist() {
  ensureWishlist();
  wishListContainer.innerHTML = "";
  const items = [...state.wishlist].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!items.length) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "todoEmpty";
    emptyMsg.textContent = "Brak wishlisty.";
    wishListContainer.appendChild(emptyMsg);
    return;
  }
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "wishItem";
    const left = document.createElement("div");
    left.className = "wishLeft";
    const nameDiv = document.createElement("div");
    nameDiv.className = "wishName";
    nameDiv.textContent = it.name;
    const priceDiv = document.createElement("div");
    priceDiv.className = "wishPrice";
    priceDiv.textContent = it.price === null ? "Cena: brak" : "Cena: " + (Number(it.price).toFixed(2).replace(".", ",")) + " zł";
    left.appendChild(nameDiv);
    left.appendChild(priceDiv);
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "wishDel";
    delBtn.textContent = "×";
    delBtn.title = "Usuń";
    delBtn.addEventListener("click", () => deleteWish(it.id));
    row.appendChild(left);
    row.appendChild(delBtn);
    wishListContainer.appendChild(row);
  }
}

// Input masking for price (allow only numbers and comma)
wishPriceInputField?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWish();
});
wishNameInputField?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWish();
});
wishAddBtn?.addEventListener("click", addWish);
