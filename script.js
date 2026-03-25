/* ==========================================
   Ro'yxat — Firebase Realtime Database
   FIX: onclick inline yo'q — addEventListener
========================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── FIREBASE CONFIG ────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB8w43kVVgzpFFq9DHyr_vGC4t02m0iwrA",
  authDomain: "korzinka-4cafa.firebaseapp.com",
  databaseURL: "https://korzinka-4cafa-default-rtdb.firebaseio.com",
  projectId: "korzinka-4cafa",
  storageBucket: "korzinka-4cafa.firebasestorage.app",
  messagingSenderId: "381504619841",
  appId: "1:381504619841:web:ad703fcafb29c74d00cdc0"
};

const app   = initializeApp(firebaseConfig);
const db    = getDatabase(app);
const dbRef = ref(db, "spiska");

// ── STATE ──────────────────────────────────
let products      = JSON.parse(localStorage.getItem("spiska_v2") || "[]");
let deleteIndex   = null;
let editIndex     = null;
let currentFilter = "all";
let allSelected   = false;
let isSyncing     = false;
let deferredPrompt = null;

// ── DOM ────────────────────────────────────
const form         = document.getElementById("productForm");
const nameInput    = document.getElementById("nameInput");
const listEl       = document.getElementById("productList");
const emptyState   = document.getElementById("emptyState");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const doneCountEl  = document.getElementById("doneCount");
const progressPct  = document.getElementById("progressPct");
const itemCountEl  = document.getElementById("itemCount");
const selCountEl   = document.getElementById("selectedCount");

// ── SYNC STATUS ────────────────────────────
function setSyncStatus(state) {
  const dot = document.getElementById("syncDot");
  const txt = document.getElementById("syncText");
  if (!dot || !txt) return;
  dot.className = "sync-dot " + state;
  const labels = { syncing:"Saqlanmoqda...", ok:"Sinxron ✓", error:"Xato!", offline:"Oflayn" };
  txt.textContent = labels[state] || "";
}

// ── LOCAL SAVE ─────────────────────────────
function saveLocal() {
  localStorage.setItem("spiska_v2", JSON.stringify(products));
}

// ── FIREBASE WRITE ─────────────────────────
async function saveAndSync() {
  saveLocal();
  isSyncing = true;
  setSyncStatus("syncing");
  try {
    const toSave = products.map(({ selected, ...rest }) => rest);
    await set(dbRef, toSave);
    setSyncStatus("ok");
  } catch (e) {
    setSyncStatus(navigator.onLine ? "error" : "offline");
    console.error("Firebase write:", e);
  } finally {
    setTimeout(() => { isSyncing = false; }, 500);
  }
}

// ── REAL-TIME LISTENER ─────────────────────
function initSync() {
  setSyncStatus("syncing");
  onValue(dbRef, (snapshot) => {
    if (isSyncing) return;
    const data = snapshot.val();
    const remote = Array.isArray(data) ? data : [];
    const selectedMap = {};
    products.forEach(p => { if (p.id) selectedMap[p.id] = p.selected; });
    products = remote.map(p => ({ ...p, selected: selectedMap[p.id] || false }));
    saveLocal();
    render();
    setSyncStatus("ok");
  }, (error) => {
    console.error("Firebase listener:", error);
    setSyncStatus(navigator.onLine ? "error" : "offline");
  });
}

// ── HELPER ─────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ── RENDER ─────────────────────────────────
function render() {
  listEl.innerHTML = "";
  const filtered = products.filter(p => {
    if (currentFilter === "done")   return p.done;
    if (currentFilter === "active") return !p.done;
    return true;
  });
  emptyState.classList.toggle("show", filtered.length === 0);

  filtered.forEach((product, fi) => {
    const realIndex = products.indexOf(product);
    const card = document.createElement("div");
    card.className = "card" + (product.done ? " done" : "");
    card.dataset.index = realIndex;
    card.innerHTML = `
      <div class="card-select${product.selected ? " selected" : ""}" data-action="select" data-index="${realIndex}"></div>
      <div class="card-check${product.done ? " checked" : ""}" data-action="done" data-index="${realIndex}"></div>
      <span class="card-name">${escHtml(product.name)}</span>
      <div class="card-actions">
        <button class="card-btn btn-edit" data-action="edit" data-index="${realIndex}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="card-btn btn-del" data-action="delete" data-index="${realIndex}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>`;
    card.style.animationDelay = (fi * 0.04) + "s";
    listEl.appendChild(card);
  });
  updateStats();
  updateSelectAll();
}

// ── EVENT DELEGATION (card buttons) ────────
listEl.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const index  = parseInt(el.dataset.index, 10);
  if (action === "done")   toggleDone(index);
  if (action === "select") toggleSelect(index);
  if (action === "edit")   openEdit(index);
  if (action === "delete") openDeleteModal(index);
});

// ── STATS ───────────────────────────────────
function updateStats() {
  const total = products.length;
  const done  = products.filter(p => p.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  itemCountEl.textContent = total + " ta mahsulot";
  doneCountEl.textContent = done + " ta bajarildi";
  progressPct.textContent = pct + "%";
  progressFill.style.width = pct + "%";
  progressWrap.classList.toggle("show", total > 0);
  const sel = products.filter(p => p.selected).length;
  selCountEl.textContent = sel > 0 ? sel + " ta tanlandi" : "";
}

// ── FORM ───────────────────────────────────
form.addEventListener("submit", e => {
  e.preventDefault();
  const raw = nameInput.value.trim();
  if (!raw) return;
  raw.split(/[\n,،]+/).map(w => w.trim()).filter(w => w).forEach(word => {
    products.unshift({ id: Date.now() + Math.random(), name: word, done: false, selected: false });
  });
  saveAndSync(); render();
  nameInput.value = ""; nameInput.focus();
  if (navigator.vibrate) navigator.vibrate(30);
});

// ── TOGGLE DONE / SELECT ───────────────────
function toggleDone(i) {
  products[i].done = !products[i].done;
  saveAndSync(); render();
  if (navigator.vibrate) navigator.vibrate(20);
}
function toggleSelect(i) {
  products[i].selected = !products[i].selected;
  saveLocal(); render();
}

// ── SELECT ALL ─────────────────────────────
function toggleSelectAll() {
  allSelected = !allSelected;
  products.forEach(p => p.selected = allSelected);
  saveLocal(); render();
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
document.getElementById("selectAllBtn").addEventListener("click", toggleSelectAll);

// ── DELETE SELECTED ─────────────────────────
document.getElementById("deleteSelBtn").addEventListener("click", () => {
  if (!products.some(p => p.selected)) return;
  products = products.filter(p => !p.selected);
  saveAndSync(); render();
});

// ── DELETE MODAL ───────────────────────────
function openDeleteModal(i) {
  deleteIndex = i;
  document.getElementById("modalText").textContent = `"${products[i].name}" — o'chirasizmi?`;
  document.getElementById("deleteModal").classList.add("open");
}
function closeDeleteModal() {
  document.getElementById("deleteModal").classList.remove("open");
  deleteIndex = null;
}
document.getElementById("cancelDelete").addEventListener("click", closeDeleteModal);
document.getElementById("confirmDelete").addEventListener("click", () => {
  if (deleteIndex === null) return;
  const card = listEl.querySelector(`[data-index="${deleteIndex}"]`);
  const doDelete = () => { products.splice(deleteIndex, 1); deleteIndex = null; saveAndSync(); render(); };
  if (card) { card.classList.add("removing"); setTimeout(doDelete, 260); } else doDelete();
  closeDeleteModal();
});

// ── CLEAR MODAL ────────────────────────────
document.getElementById("clearAllBtn").addEventListener("click", () => {
  document.getElementById("clearModal").classList.add("open");
});
document.getElementById("cancelClear").addEventListener("click", () => {
  document.getElementById("clearModal").classList.remove("open");
});
document.getElementById("confirmClear").addEventListener("click", () => {
  products = []; saveAndSync(); render();
  document.getElementById("clearModal").classList.remove("open");
});

// ── EDIT MODAL ─────────────────────────────
function openEdit(i) {
  editIndex = i;
  document.getElementById("editInput").value = products[i].name;
  document.getElementById("editModal").classList.add("open");
  setTimeout(() => document.getElementById("editInput").focus(), 100);
}
function closeEditModal() {
  document.getElementById("editModal").classList.remove("open");
  editIndex = null;
}
document.getElementById("cancelEdit").addEventListener("click", closeEditModal);
document.getElementById("confirmEdit").addEventListener("click", () => {
  if (editIndex === null) return;
  const val = document.getElementById("editInput").value.trim();
  if (!val) return;
  products[editIndex].name = val;
  saveAndSync(); render(); closeEditModal();
});
document.getElementById("editInput").addEventListener("keydown", e => {
  if (e.key === "Enter")  document.getElementById("confirmEdit").click();
  if (e.key === "Escape") closeEditModal();
});

// ── FILTER TABS ────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
    render();
  });
});

// ── THEME ──────────────────────────────────
function applyTheme() {
  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeIcon").textContent = isDark ? "☀️" : "🌙";
}
if (localStorage.getItem("spiska_theme") === "dark") {
  document.body.classList.add("dark");
}
applyTheme();
document.getElementById("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("spiska_theme", document.body.classList.contains("dark") ? "dark" : "light");
  applyTheme();
});

// ── MODAL BACKDROP CLICK ───────────────────
document.querySelectorAll(".modal-backdrop").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      m.classList.remove("open");
      deleteIndex = null; editIndex = null;
    }
  });
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape")
    document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
});

// ── PWA INSTALL ────────────────────────────
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    const b = document.getElementById("installBanner");
    if (b && !localStorage.getItem("installDismissed")) b.classList.add("show");
  }, 3000);
});
document.getElementById("installBtn").addEventListener("click", () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    document.getElementById("installBanner").classList.remove("show");
  });
});
document.getElementById("dismissBtn").addEventListener("click", () => {
  document.getElementById("installBanner").classList.remove("show");
  localStorage.setItem("installDismissed", "1");
});
window.addEventListener("appinstalled", () => {
  document.getElementById("installBanner").classList.remove("show");
});

// ── SERVICE WORKER ─────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ── START ──────────────────────────────────
initSync();
