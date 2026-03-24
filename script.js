/* ==========================================
   SPISKA — Xaridlar ro'yxati
   PWA | localStorage | Dark mode | Filter
========================================== */

// ── STATE ──────────────────────────────────
let products    = JSON.parse(localStorage.getItem("spiska_v2") || "[]");
let deleteIndex = null;
let editIndex   = null;
let currentFilter = "all";
let allSelected   = false;
let deferredPrompt = null;

// ── DOM ────────────────────────────────────
const form        = document.getElementById("productForm");
const nameInput   = document.getElementById("nameInput");
const listEl      = document.getElementById("productList");
const emptyState  = document.getElementById("emptyState");
const progressWrap= document.getElementById("progressWrap");
const progressFill= document.getElementById("progressFill");
const doneCountEl = document.getElementById("doneCount");
const progressPct = document.getElementById("progressPct");
const itemCountEl = document.getElementById("itemCount");
const selCountEl  = document.getElementById("selectedCount");

// ── SAVE ───────────────────────────────────
function save() {
  localStorage.setItem("spiska_v2", JSON.stringify(products));
}

// ── RENDER ─────────────────────────────────
function render() {
  listEl.innerHTML = "";

  const filtered = products.filter(p => {
    if (currentFilter === "done")   return p.done;
    if (currentFilter === "active") return !p.done;
    return true;
  });

  // Empty state
  if (filtered.length === 0) {
    emptyState.classList.add("show");
  } else {
    emptyState.classList.remove("show");
  }

  // Items
  filtered.forEach((product, fi) => {
    const realIndex = products.indexOf(product);
    const card = document.createElement("div");
    card.className = "card" + (product.done ? " done" : "");
    card.dataset.index = realIndex;

    card.innerHTML = `
      <div class="card-select${product.selected ? " selected" : ""}"
           onclick="toggleSelect(${realIndex})"></div>
      <div class="card-check${product.done ? " checked" : ""}"
           onclick="toggleDone(${realIndex})"></div>
      <span class="card-name">${escHtml(product.name)}</span>
      <div class="card-actions">
        <button class="card-btn btn-edit" onclick="openEdit(${realIndex})" title="Tahrirlash">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="card-btn btn-del" onclick="openDeleteModal(${realIndex})" title="O'chirish">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    `;

    // Stagger animation delay
    card.style.animationDelay = (fi * 0.04) + "s";
    listEl.appendChild(card);
  });

  updateStats();
  updateSelectAll();
}

// ── STATS ──────────────────────────────────
function updateStats() {
  const total = products.length;
  const done  = products.filter(p => p.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  itemCountEl.textContent = total + " ta mahsulot";
  doneCountEl.textContent = done + " ta bajarildi";
  progressPct.textContent = pct + "%";
  progressFill.style.width = pct + "%";

  if (total > 0) {
    progressWrap.classList.add("show");
  } else {
    progressWrap.classList.remove("show");
  }

  // Selected count
  const selCount = products.filter(p => p.selected).length;
  if (selCount > 0) {
    selCountEl.textContent = selCount + " ta tanlandi";
  } else {
    selCountEl.textContent = "";
  }
}

// ── ADD ────────────────────────────────────
form.addEventListener("submit", e => {
  e.preventDefault();
  const raw = nameInput.value.trim();
  if (!raw) return;

  // Multiple words → multiple items
  const words = raw.split(/[\s,،]+/).filter(w => w.length > 0);

  words.forEach(word => {
    products.unshift({
      id:       Date.now() + Math.random(),
      name:     word,
      done:     false,
      selected: false,
    });
  });

  save();
  render();
  nameInput.value = "";
  nameInput.focus();

  // Haptic feedback (if supported)
  if (navigator.vibrate) navigator.vibrate(30);
});

// ── TOGGLE DONE ────────────────────────────
function toggleDone(index) {
  products[index].done = !products[index].done;
  save();
  render();
  if (navigator.vibrate) navigator.vibrate(20);
}

// ── TOGGLE SELECT ──────────────────────────
function toggleSelect(index) {
  products[index].selected = !products[index].selected;
  save();
  render();
}

function toggleSelectAll() {
  allSelected = !allSelected;
  products.forEach(p => p.selected = allSelected);
  save();
  render();
}

function updateSelectAll() {
  const btn = document.getElementById("selectAllBtn");
  if (!btn) return;
  const allSel = products.length > 0 && products.every(p => p.selected);
  btn.innerHTML = allSel
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Tanlovni bekor`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Hammasini tanlash`;
  allSelected = allSel;
}

// ── DELETE SINGLE ──────────────────────────
function openDeleteModal(index) {
  deleteIndex = index;
  document.getElementById("modalText").textContent =
    `"${products[index].name}" — o'chirasizmi?`;
  document.getElementById("deleteModal").classList.add("open");
}

function closeModal() {
  document.getElementById("deleteModal").classList.remove("open");
  deleteIndex = null;
}

document.getElementById("confirmDelete").onclick = () => {
  if (deleteIndex === null) return;
  animateRemove(deleteIndex, () => {
    products.splice(deleteIndex, 1);
    deleteIndex = null;
    save();
    render();
  });
  closeModal();
};

function animateRemove(index, cb) {
  // Find card by data-index
  const card = listEl.querySelector(`[data-index="${index}"]`);
  if (card) {
    card.classList.add("removing");
    setTimeout(cb, 260);
  } else {
    cb();
  }
}

// ── DELETE SELECTED ────────────────────────
function deleteSelected() {
  const hasSelected = products.some(p => p.selected);
  if (!hasSelected) return;
  products = products.filter(p => !p.selected);
  save();
  render();
  if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
}

// ── CLEAR ALL MODAL ────────────────────────
function openClearModal() {
  document.getElementById("clearModal").classList.add("open");
}
function closeClearModal() {
  document.getElementById("clearModal").classList.remove("open");
}

document.getElementById("confirmClear").onclick = () => {
  products = [];
  save();
  render();
  closeClearModal();
};

// ── EDIT ───────────────────────────────────
function openEdit(index) {
  editIndex = index;
  document.getElementById("editInput").value = products[index].name;
  document.getElementById("editModal").classList.add("open");
  setTimeout(() => document.getElementById("editInput").focus(), 100);
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("open");
  editIndex = null;
}

document.getElementById("confirmEdit").onclick = () => {
  if (editIndex === null) return;
  const val = document.getElementById("editInput").value.trim();
  if (!val) return;
  products[editIndex].name = val;
  save();
  render();
  closeEditModal();
};

document.getElementById("editInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("confirmEdit").click();
  if (e.key === "Escape") closeEditModal();
});

// ── FILTER ─────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.filter === filter);
  });
  render();
}

// ── THEME ──────────────────────────────────
function toggleTheme() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeIcon").textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("spiska_theme", isDark ? "dark" : "light");
}

// Load saved theme
(function loadTheme() {
  const saved = localStorage.getItem("spiska_theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    const icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = "☀️";
  }
})();

// ── CLOSE MODALS ON BACKDROP ───────────────
document.querySelectorAll(".modal-backdrop").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      m.classList.remove("open");
      deleteIndex = null;
      editIndex   = null;
    }
  });
});

// ── ESC KEY ────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.open").forEach(m =>
      m.classList.remove("open")
    );
    deleteIndex = null;
    editIndex   = null;
  }
});

// ── PWA INSTALL ────────────────────────────
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  // Show banner after 3 seconds
  setTimeout(() => {
    const banner = document.getElementById("installBanner");
    if (banner && !localStorage.getItem("installDismissed")) {
      banner.classList.add("show");
    }
  }, 3000);
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    document.getElementById("installBanner").classList.remove("show");
  });
}

function dismissBanner() {
  document.getElementById("installBanner").classList.remove("show");
  localStorage.setItem("installDismissed", "1");
}

window.addEventListener("appinstalled", () => {
  document.getElementById("installBanner").classList.remove("show");
});

// ── SERVICE WORKER ─────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ── HELPER ─────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── INIT ───────────────────────────────────
render();
