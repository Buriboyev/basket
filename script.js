/* ==========================================
   SPISKA — Xaridlar ro'yxati
   GitHub Gist orqali real-time sync
========================================== */

// ══════════════════════════════════════════
//  BU YERNI TO'LDIRING:
//  1. github.com → Settings → Developer settings
//     → Personal access tokens → Tokens (classic)
//     → Generate new token → faqat "gist" belgini qo'ying
//  2. Yangi Gist yarating: gist.github.com
//     → bitta fayl "spiska.json" deb nomlang, ichiga [] yozing
//     → "Create public gist" bosing
//     → URL dagi ID ni oling (32 belgili)
// ══════════════════════════════════════════
const GITHUB_TOKEN = "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";   // ghp_xxxx...
const GIST_ID      = "76c7dae45338f3b47baad5109ea7d3f6"; // 32 belgili hex
// ══════════════════════════════════════════

const POLL_MS  = 4000;
const FILENAME = "spiska.json";

let products      = JSON.parse(localStorage.getItem("spiska_v2") || "[]");
let deleteIndex   = null;
let editIndex     = null;
let currentFilter = "all";
let allSelected   = false;
let deferredPrompt = null;
let pollTimer     = null;
let isSyncing     = false;
let lastEtag      = "";

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

// ── SYNC STATUS ────────────────────────────
function setSyncStatus(state) {
  const dot = document.getElementById("syncDot");
  const txt = document.getElementById("syncText");
  if (!dot || !txt) return;
  dot.className = "sync-dot " + state;
  txt.textContent = { syncing:"Saqlanmoqda...", ok:"Sinxron ✓", error:"Xato!", offline:"Oflayn" }[state] || "";
}

// ── GIST API ───────────────────────────────
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;
const HEADERS  = {
  "Authorization": `token ${GITHUB_TOKEN}`,
  "Accept": "application/vnd.github.v3+json",
};

async function gistRead() {
  const res = await fetch(GIST_URL, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error("Read " + res.status);
  const json = await res.json();
  const content = json.files[FILENAME]?.content || "[]";
  return JSON.parse(content);
}

async function gistWrite(data) {
  const res = await fetch(GIST_URL, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(data) } } }),
  });
  if (!res.ok) throw new Error("Write " + res.status);
}

// ── SAVE & SYNC ────────────────────────────
function saveLocal() {
  localStorage.setItem("spiska_v2", JSON.stringify(products));
}

async function saveAndSync() {
  saveLocal();
  isSyncing = true;
  setSyncStatus("syncing");
  try {
    await gistWrite(products);
    setSyncStatus("ok");
  } catch(e) {
    setSyncStatus(navigator.onLine ? "error" : "offline");
  } finally {
    setTimeout(() => { isSyncing = false; }, 500);
  }
}

// ── POLLING ────────────────────────────────
async function poll() {
  if (isSyncing) return;
  try {
    const remote = await gistRead();
    const remoteStr = JSON.stringify(remote);
    if (remoteStr !== JSON.stringify(products)) {
      products = remote;
      saveLocal();
      render();
    }
    setSyncStatus("ok");
  } catch(e) {
    setSyncStatus(navigator.onLine ? "error" : "offline");
  }
}

async function initSync() {
  setSyncStatus("syncing");
  try {
    products = await gistRead();
    saveLocal();
    setSyncStatus("ok");
  } catch(e) {
    setSyncStatus(navigator.onLine ? "error" : "offline");
  }
  render();
  pollTimer = setInterval(poll, POLL_MS);
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
      <div class="card-select${product.selected ? " selected" : ""}" onclick="toggleSelect(${realIndex})"></div>
      <div class="card-check${product.done ? " checked" : ""}" onclick="toggleDone(${realIndex})"></div>
      <span class="card-name">${escHtml(product.name)}</span>
      <div class="card-actions">
        <button class="card-btn btn-edit" onclick="openEdit(${realIndex})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="card-btn btn-del" onclick="openDeleteModal(${realIndex})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`;
    card.style.animationDelay = (fi * 0.04) + "s";
    listEl.appendChild(card);
  });
  updateStats();
  updateSelectAll();
}

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

form.addEventListener("submit", e => {
  e.preventDefault();
  const raw = nameInput.value.trim();
  if (!raw) return;
  raw.split(/[\s,،]+/).filter(w => w).forEach(word => {
    products.unshift({ id: Date.now() + Math.random(), name: word, done: false, selected: false });
  });
  saveAndSync(); render();
  nameInput.value = ""; nameInput.focus();
  if (navigator.vibrate) navigator.vibrate(30);
});

function toggleDone(i) { products[i].done = !products[i].done; saveAndSync(); render(); if (navigator.vibrate) navigator.vibrate(20); }
function toggleSelect(i) { products[i].selected = !products[i].selected; saveLocal(); render(); }
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

function openDeleteModal(i) {
  deleteIndex = i;
  document.getElementById("modalText").textContent = `"${products[i].name}" — o'chirasizmi?`;
  document.getElementById("deleteModal").classList.add("open");
}
function closeModal() { document.getElementById("deleteModal").classList.remove("open"); deleteIndex = null; }
document.getElementById("confirmDelete").onclick = () => {
  if (deleteIndex === null) return;
  const card = listEl.querySelector(`[data-index="${deleteIndex}"]`);
  const doDelete = () => { products.splice(deleteIndex, 1); deleteIndex = null; saveAndSync(); render(); };
  if (card) { card.classList.add("removing"); setTimeout(doDelete, 260); } else doDelete();
  closeModal();
};

function deleteSelected() {
  if (!products.some(p => p.selected)) return;
  products = products.filter(p => !p.selected);
  saveAndSync(); render();
}

function openClearModal()  { document.getElementById("clearModal").classList.add("open"); }
function closeClearModal() { document.getElementById("clearModal").classList.remove("open"); }
document.getElementById("confirmClear").onclick = () => { products = []; saveAndSync(); render(); closeClearModal(); };

function openEdit(i) {
  editIndex = i;
  document.getElementById("editInput").value = products[i].name;
  document.getElementById("editModal").classList.add("open");
  setTimeout(() => document.getElementById("editInput").focus(), 100);
}
function closeEditModal() { document.getElementById("editModal").classList.remove("open"); editIndex = null; }
document.getElementById("confirmEdit").onclick = () => {
  if (editIndex === null) return;
  const val = document.getElementById("editInput").value.trim();
  if (!val) return;
  products[editIndex].name = val;
  saveAndSync(); render(); closeEditModal();
};
document.getElementById("editInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("confirmEdit").click();
  if (e.key === "Escape") closeEditModal();
});

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.filter === filter));
  render();
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeIcon").textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("spiska_theme", isDark ? "dark" : "light");
}
(function() {
  if (localStorage.getItem("spiska_theme") === "dark") {
    document.body.classList.add("dark");
    const icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = "☀️";
  }
})();

document.querySelectorAll(".modal-backdrop").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) { m.classList.remove("open"); deleteIndex = null; editIndex = null; } });
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open")); }
});

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt = e;
  setTimeout(() => {
    const b = document.getElementById("installBanner");
    if (b && !localStorage.getItem("installDismissed")) b.classList.add("show");
  }, 3000);
});
function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; document.getElementById("installBanner").classList.remove("show"); });
}
function dismissBanner() { document.getElementById("installBanner").classList.remove("show"); localStorage.setItem("installDismissed", "1"); }
window.addEventListener("appinstalled", () => document.getElementById("installBanner").classList.remove("show"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// START
initSync();
