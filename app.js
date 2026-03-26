import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8w43kVVgzpFFq9DHyr_vGC4t02m0iwrA",
  authDomain: "korzinka-4cafa.firebaseapp.com",
  databaseURL: "https://korzinka-4cafa-default-rtdb.firebaseio.com",
  projectId: "korzinka-4cafa",
  storageBucket: "korzinka-4cafa.firebasestorage.app",
  messagingSenderId: "381504619841",
  appId: "1:381504619841:web:ad703fcafb29c74d00cdc0",
  measurementId: "G-RV9Y4ZRM67"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STORAGE_KEY = "basket_groups_firestore_cache_v1";
const THEME_KEY = "spiska_theme";

let groups = {};
let products = {};
let currentGroup = null;
let deleteGroupId = null;
let deleteIndex = null;
let editIndex = null;
let currentFilter = "all";
let allSelected = false;
let selectedColor = "#6c63ff";
let editGroupId = null;
let deferredPrompt = null;
const unsubAllProducts = {};

loadLocalCache();

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeGroups(source) {
  const result = {};
  if (!source || typeof source !== "object") return result;

  Object.entries(source).forEach(([id, group]) => {
    result[id] = {
      id,
      name: String(group?.name || "Nomsiz guruh").trim() || "Nomsiz guruh",
      color: String(group?.color || "#6c63ff"),
      createdAt: Number(group?.createdAt || Date.now()),
      itemCount: Number(group?.itemCount || 0),
      doneCount: Number(group?.doneCount || 0)
    };
  });

  return result;
}

function normalizeProducts(source) {
  const result = {};
  if (!source || typeof source !== "object") return result;

  Object.entries(source).forEach(([groupId, items]) => {
    result[groupId] = Array.isArray(items)
      ? items.map((item) => ({
          id: String(item?.id || uid()),
          name: String(item?.name || "").trim(),
          done: Boolean(item?.done),
          selected: Boolean(item?.selected),
          createdAt: Number(item?.createdAt || Date.now())
        }))
      : [];
  });

  return result;
}

function saveLocalCache() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ groups, products }));
}

function loadLocalCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return;
    groups = normalizeGroups(raw.groups);
    products = normalizeProducts(raw.products);
  } catch {
    groups = {};
    products = {};
  }
}

function setSyncStatus(state) {
  const dot = document.getElementById("syncDot");
  const txt = document.getElementById("syncText");
  if (!dot || !txt) return;

  const labels = {
    syncing: "Saqlanmoqda...",
    ok: "Sinxron",
    error: "Xato",
    offline: "Oflayn"
  };

  dot.className = `sync-dot ${state}`;
  txt.textContent = labels[state] || "";
}

function getSortedGroups() {
  return Object.values(groups).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function getCurrentProducts() {
  return currentGroup ? products[currentGroup] || [] : [];
}

function showGroupsPage() {
  if (currentGroup) {
    updateGroupStatsLocal(currentGroup);
  }
  const groupsPage = document.getElementById("groupsPage");
  const listPage = document.getElementById("listPage");
  groupsPage.hidden = false;
  listPage.hidden = true;
  groupsPage.classList.add("active");
  listPage.classList.remove("active");
  currentGroup = null;
  renderGroups();
}

function showListPage(groupId) {
  currentGroup = groupId;
  currentFilter = "all";
  const group = groups[groupId];
  const groupsPage = document.getElementById("groupsPage");
  const listPage = document.getElementById("listPage");

  groupsPage.hidden = true;
  listPage.hidden = false;
  groupsPage.classList.remove("active");
  listPage.classList.add("active");
  document.getElementById("listPageTitle").textContent = group ? group.name : "Guruh";
  document.getElementById("listPageTitle").style.color = group?.color || "";
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === "all");
  });

  render();
}

function renderGroups() {
  const grid = document.getElementById("groupsGrid");
  const empty = document.getElementById("groupsEmpty");
  const list = getSortedGroups();

  grid.innerHTML = "";
  empty.classList.toggle("show", list.length === 0);

  list.forEach((group) => {
    const groupProducts = products[group.id] || [];
    const liveTotal = groupProducts.length;
    const liveDone = groupProducts.filter((item) => item.done).length;
    const total = Math.max(Number(group.itemCount || 0), liveTotal);
    const done = Math.max(Number(group.doneCount || 0), liveDone);

    const card = document.createElement("div");
    card.className = "group-card";
    card.style.setProperty("--gcolor", group.color || "#6c63ff");
    card.dataset.id = group.id;
    card.innerHTML = `
      <div class="group-card-top">
        <div class="group-actions-row">
          <button class="group-act-btn edit-group-btn" data-id="${group.id}" title="Tahrirlash">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="group-act-btn del-group-btn" data-id="${group.id}" title="O'chirish">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
        <div class="group-icon">📋</div>
        <div class="group-name">${escHtml(group.name)}</div>
      </div>
      <div class="group-card-bot">
        <div class="group-stats">${total} ta mahsulot</div>
        <div class="group-progress-bar">
          <div class="group-progress-fill" style="width:${total > 0 ? Math.round((done / total) * 100) : 0}%"></div>
        </div>
      </div>
    `;

    card.addEventListener("click", (event) => {
      if (event.target.closest(".group-act-btn")) return;
      showListPage(group.id);
    });

    grid.appendChild(card);
  });

  grid.querySelectorAll(".edit-group-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditGroup(btn.dataset.id);
    });
  });

  grid.querySelectorAll(".del-group-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openDeleteGroup(btn.dataset.id);
    });
  });
}

function render() {
  renderGroups();

  if (!currentGroup) return;

  const listEl = document.getElementById("productList");
  const emptyEl = document.getElementById("emptyState");
  const list = getCurrentProducts();
  const filtered = list.filter((item) => {
    if (currentFilter === "done") return item.done;
    if (currentFilter === "active") return !item.done;
    return true;
  });

  listEl.innerHTML = "";
  emptyEl.classList.toggle("show", filtered.length === 0);

  filtered.forEach((product, fi) => {
    const realIndex = list.findIndex((item) => item.id === product.id);
    const card = document.createElement("div");
    card.className = `card${product.done ? " done" : ""}`;
    card.dataset.index = String(realIndex);
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
      </div>
    `;
    card.style.animationDelay = `${fi * 0.04}s`;
    listEl.appendChild(card);
  });

  updateStats();
  updateSelectAll();
}

function updateStats() {
  const list = getCurrentProducts();
  const total = list.length;
  const done = list.filter((item) => item.done).length;
  const selected = list.filter((item) => item.selected).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById("itemCount").textContent = `${total} ta mahsulot`;
  document.getElementById("doneCount").textContent = `${done} ta bajarildi`;
  document.getElementById("progressPct").textContent = `${pct}%`;
  document.getElementById("progressFill").style.width = `${pct}%`;
  document.getElementById("progressWrap").classList.toggle("show", total > 0);
  document.getElementById("selectedCount").textContent = selected > 0 ? `${selected} ta tanlandi` : "";
}

function updateSelectAll() {
  const btn = document.getElementById("selectAllBtn");
  const list = getCurrentProducts();
  const everySelected = list.length > 0 && list.every((item) => item.selected);
  allSelected = everySelected;

  btn.innerHTML = everySelected
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Tanlovni bekor`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Hammasini tanlash`;
}

function syncGroupLocal(groupId, patch) {
  groups[groupId] = {
    ...(groups[groupId] || { id: groupId, createdAt: Date.now() }),
    ...patch,
    id: groupId
  };
  if (!products[groupId]) {
    products[groupId] = [];
  }
  saveLocalCache();
}

function getGroupStats(groupId) {
  const list = products[groupId] || [];
  return {
    itemCount: list.length,
    doneCount: list.filter((item) => item.done).length
  };
}

function updateGroupStatsLocal(groupId) {
  if (!groups[groupId]) return;
  Object.assign(groups[groupId], getGroupStats(groupId));
  saveLocalCache();
}

async function persistGroupStats(groupId) {
  if (!groups[groupId]) return;
  const stats = getGroupStats(groupId);
  Object.assign(groups[groupId], stats);
  saveLocalCache();

  try {
    await setDoc(doc(db, "groups", groupId), stats, { merge: true });
  } catch (error) {
    console.error("Group stats saqlash xatosi:", error);
  }
}

function syncProductsLocal(groupId, list) {
  const selectedMap = Object.fromEntries((products[groupId] || []).map((item) => [item.id, Boolean(item.selected)]));
  products[groupId] = list.map((item) => ({
    ...item,
    selected: selectedMap[item.id] || false
  }));
  updateGroupStatsLocal(groupId);
  saveLocalCache();
}

function subscribeGroupProducts(groupId) {
  if (unsubAllProducts[groupId]) return;

  unsubAllProducts[groupId] = onSnapshot(
    collection(db, "groups", groupId, "products"),
    (snapshot) => {
      const list = [];
      snapshot.forEach((snap) => {
        list.push({
          id: snap.id,
          ...snap.data(),
          createdAt: Number(snap.data()?.createdAt || 0)
        });
      });

      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      syncProductsLocal(groupId, list);
      render();
      setSyncStatus("ok");
    },
    (error) => {
      console.error("Products snapshot error:", error);
      setSyncStatus(navigator.onLine ? "error" : "offline");
    }
  );
}

function initSync() {
  setSyncStatus("syncing");

  onSnapshot(
    collection(db, "groups"),
    (snapshot) => {
      const nextGroups = {};
      snapshot.forEach((snap) => {
        nextGroups[snap.id] = {
          id: snap.id,
          name: String(snap.data()?.name || "Nomsiz guruh"),
          color: String(snap.data()?.color || "#6c63ff"),
          createdAt: Number(snap.data()?.createdAt || 0),
          itemCount: Number(snap.data()?.itemCount || 0),
          doneCount: Number(snap.data()?.doneCount || 0)
        };
      });

      Object.keys(unsubAllProducts).forEach((groupId) => {
        if (nextGroups[groupId]) return;
        unsubAllProducts[groupId]();
        delete unsubAllProducts[groupId];
        delete products[groupId];
      });

      groups = nextGroups;
      Object.keys(groups).forEach((groupId) => {
        if (!products[groupId]) products[groupId] = [];
        subscribeGroupProducts(groupId);
      });

      if (currentGroup && !groups[currentGroup]) {
        showGroupsPage();
      }

      saveLocalCache();
      render();
      setSyncStatus("ok");
    },
    (error) => {
      console.error("Groups snapshot error:", error);
      setSyncStatus(navigator.onLine ? "error" : "offline");
      render();
    }
  );
}

async function saveGroup(id, data) {
  syncGroupLocal(id, data);
  updateGroupStatsLocal(id);
  render();
  setSyncStatus("syncing");

  try {
    await setDoc(doc(db, "groups", id), data, { merge: true });
    setSyncStatus("ok");
  } catch (error) {
    console.error("Guruh saqlash xatosi:", error);
    setSyncStatus(navigator.onLine ? "error" : "offline");
  }
}

async function deleteGroup(groupId) {
  delete groups[groupId];
  delete products[groupId];
  if (currentGroup === groupId) {
    showGroupsPage();
  }
  saveLocalCache();
  render();
  setSyncStatus("syncing");

  try {
    const snap = await getDocs(collection(db, "groups", groupId, "products"));
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
    await deleteDoc(doc(db, "groups", groupId));
    setSyncStatus("ok");
  } catch (error) {
    console.error("Guruh o'chirish xatosi:", error);
    setSyncStatus(navigator.onLine ? "error" : "offline");
  }
}

async function saveProduct(groupId, product) {
  if (!groupId) return;

  if (!products[groupId]) products[groupId] = [];
  const index = products[groupId].findIndex((item) => item.id === product.id);
  const nextProduct = { ...product };

  if (index >= 0) {
    products[groupId][index] = nextProduct;
  } else {
    products[groupId].push(nextProduct);
  }

  updateGroupStatsLocal(groupId);
  saveLocalCache();
  render();
  setSyncStatus("syncing");

  try {
    const { selected, ...toSave } = nextProduct;
    await setDoc(doc(db, "groups", groupId, "products", nextProduct.id), toSave, { merge: true });
    await persistGroupStats(groupId);
    setSyncStatus("ok");
  } catch (error) {
    console.error("Mahsulot saqlash xatosi:", error);
    setSyncStatus(navigator.onLine ? "error" : "offline");
  }
}

async function deleteProduct(groupId, productId) {
  if (!groupId) return;

  products[groupId] = (products[groupId] || []).filter((item) => item.id !== productId);
  updateGroupStatsLocal(groupId);
  saveLocalCache();
  render();
  setSyncStatus("syncing");

  try {
    await deleteDoc(doc(db, "groups", groupId, "products", productId));
    await persistGroupStats(groupId);
    setSyncStatus("ok");
  } catch (error) {
    console.error("Mahsulot o'chirish xatosi:", error);
    setSyncStatus(navigator.onLine ? "error" : "offline");
  }
}

function openAddGroup() {
  editGroupId = null;
  selectedColor = "#6c63ff";
  document.getElementById("groupModalTitle").textContent = "Yangi guruh";
  document.getElementById("groupModalIcon").textContent = "📁";
  document.getElementById("groupNameInput").value = "";
  updateColorPicker();
  document.getElementById("groupModal").classList.add("open");
  setTimeout(() => document.getElementById("groupNameInput").focus(), 100);
}

function openEditGroup(groupId) {
  const group = groups[groupId];
  if (!group) return;

  editGroupId = groupId;
  selectedColor = group.color || "#6c63ff";
  document.getElementById("groupModalTitle").textContent = "Guruhni tahrirlash";
  document.getElementById("groupModalIcon").textContent = "✏️";
  document.getElementById("groupNameInput").value = group.name;
  updateColorPicker();
  document.getElementById("groupModal").classList.add("open");
  setTimeout(() => document.getElementById("groupNameInput").focus(), 100);
}

function closeGroupModal() {
  editGroupId = null;
  document.getElementById("groupModal").classList.remove("open");
}

function updateColorPicker() {
  document.querySelectorAll(".color-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.color === selectedColor);
  });
}

function openDeleteGroup(groupId) {
  deleteGroupId = groupId;
  document.getElementById("deleteGroupText").textContent = `"${groups[groupId]?.name || ""}" guruhi va uning barcha mahsulotlari o'chib ketadi!`;
  document.getElementById("deleteGroupModal").classList.add("open");
}

function openDeleteModal(index) {
  deleteIndex = index;
  document.getElementById("modalText").textContent = `"${getCurrentProducts()[index]?.name || ""}" o'chirasizmi?`;
  document.getElementById("deleteModal").classList.add("open");
}

function openEdit(index) {
  editIndex = index;
  document.getElementById("editInput").value = getCurrentProducts()[index]?.name || "";
  document.getElementById("editModal").classList.add("open");
  setTimeout(() => document.getElementById("editInput").focus(), 100);
}

function toggleDone(index) {
  const product = getCurrentProducts()[index];
  if (!product) return;
  saveProduct(currentGroup, { ...product, done: !product.done });
}

function toggleSelect(index) {
  const list = getCurrentProducts();
  if (!list[index]) return;
  list[index].selected = !list[index].selected;
  saveLocalCache();
  render();
}

function toggleSelectAll() {
  const nextValue = !allSelected;
  getCurrentProducts().forEach((item) => {
    item.selected = nextValue;
  });
  saveLocalCache();
  render();
}

function applyTheme() {
  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeIcon").textContent = isDark ? "☀️" : "🌙";
  document.getElementById("themeIconList").textContent = isDark ? "☀️" : "🌙";
}

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
}
applyTheme();

document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    selectedColor = dot.dataset.color;
    updateColorPicker();
  });
});

document.getElementById("addGroupBtn").addEventListener("click", openAddGroup);
document.getElementById("cancelGroupModal").addEventListener("click", closeGroupModal);
document.getElementById("confirmGroupModal").addEventListener("click", async () => {
  const name = document.getElementById("groupNameInput").value.trim();
  if (!name) return;

  const groupId = editGroupId || uid();
  await saveGroup(groupId, {
    name,
    color: selectedColor,
    createdAt: groups[groupId]?.createdAt || Date.now(),
    itemCount: groups[groupId]?.itemCount || 0,
    doneCount: groups[groupId]?.doneCount || 0
  });

  closeGroupModal();
});

document.getElementById("groupNameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("confirmGroupModal").click();
  }
  if (event.key === "Escape") {
    closeGroupModal();
  }
});

document.getElementById("cancelDeleteGroup").addEventListener("click", () => {
  deleteGroupId = null;
  document.getElementById("deleteGroupModal").classList.remove("open");
});

document.getElementById("confirmDeleteGroup").addEventListener("click", async () => {
  if (!deleteGroupId) return;
  const groupId = deleteGroupId;
  deleteGroupId = null;
  document.getElementById("deleteGroupModal").classList.remove("open");
  await deleteGroup(groupId);
});

document.getElementById("backBtn").addEventListener("click", showGroupsPage);

document.getElementById("productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentGroup) return;

  const input = document.getElementById("nameInput");
  const raw = input.value.trim();
  if (!raw) return;

  const values = raw
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const name of values) {
    await saveProduct(currentGroup, {
      id: uid(),
      name,
      done: false,
      selected: false,
      createdAt: Date.now()
    });
  }

  input.value = "";
  input.focus();
});

document.getElementById("productList").addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;

  const action = el.dataset.action;
  const index = Number(el.dataset.index);

  if (action === "done") toggleDone(index);
  if (action === "select") toggleSelect(index);
  if (action === "edit") openEdit(index);
  if (action === "delete") openDeleteModal(index);
});

document.getElementById("selectAllBtn").addEventListener("click", toggleSelectAll);

document.getElementById("deleteSelBtn").addEventListener("click", async () => {
  const selected = getCurrentProducts().filter((item) => item.selected);
  for (const item of selected) {
    await deleteProduct(currentGroup, item.id);
  }
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  document.getElementById("clearModal").classList.add("open");
});

document.getElementById("cancelDelete").addEventListener("click", () => {
  deleteIndex = null;
  document.getElementById("deleteModal").classList.remove("open");
});

document.getElementById("confirmDelete").addEventListener("click", async () => {
  const product = getCurrentProducts()[deleteIndex];
  if (!product) return;

  const card = document.getElementById("productList").querySelector(`[data-index="${deleteIndex}"]`);
  const doDelete = async () => {
    await deleteProduct(currentGroup, product.id);
    deleteIndex = null;
  };

  if (card) {
    card.classList.add("removing");
    setTimeout(() => {
      doDelete();
    }, 220);
  } else {
    await doDelete();
  }

  document.getElementById("deleteModal").classList.remove("open");
});

document.getElementById("cancelClear").addEventListener("click", () => {
  document.getElementById("clearModal").classList.remove("open");
});

document.getElementById("confirmClear").addEventListener("click", async () => {
  const current = [...getCurrentProducts()];
  for (const item of current) {
    await deleteProduct(currentGroup, item.id);
  }
  document.getElementById("clearModal").classList.remove("open");
});

document.getElementById("cancelEdit").addEventListener("click", () => {
  editIndex = null;
  document.getElementById("editModal").classList.remove("open");
});

document.getElementById("confirmEdit").addEventListener("click", async () => {
  const value = document.getElementById("editInput").value.trim();
  const current = getCurrentProducts()[editIndex];
  if (!value || !current) return;

  await saveProduct(currentGroup, { ...current, name: value });
  editIndex = null;
  document.getElementById("editModal").classList.remove("open");
});

document.getElementById("editInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("confirmEdit").click();
  }
  if (event.key === "Escape") {
    document.getElementById("cancelEdit").click();
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach((entry) => {
      entry.classList.toggle("active", entry === tab);
    });
    render();
  });
});

document.getElementById("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  applyTheme();
});

document.getElementById("themeBtnList").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  applyTheme();
});

document.querySelectorAll(".modal-backdrop").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    modal.classList.remove("open");
    deleteIndex = null;
    editIndex = null;
    deleteGroupId = null;
    editGroupId = null;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".modal-backdrop.open").forEach((modal) => modal.classList.remove("open"));
  deleteIndex = null;
  editIndex = null;
  deleteGroupId = null;
  editGroupId = null;
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  setTimeout(() => {
    const banner = document.getElementById("installBanner");
    if (banner && !localStorage.getItem("installDismissed")) {
      banner.classList.add("show");
    }
  }, 3000);
});

document.getElementById("installBtn").addEventListener("click", () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.finally(() => {
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

renderGroups();
showGroupsPage();
initSync();
