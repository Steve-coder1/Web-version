const appState = {
  geminiKeyConfigured: false,
  geminiUnlocked: false,
  uiState: "success",
  activeScreen: "home",
  notes: [
    {
      id: crypto.randomUUID(),
      title: "Research Sprint Plan",
      body: "Define weekly milestones for AI paper review and extract key findings.",
      tags: ["research", "weekly"],
      folder: "Projects",
      updatedAt: new Date().toISOString().slice(0, 10)
    },
    {
      id: crypto.randomUUID(),
      title: "API Security Checklist",
      body: "Rotate keys monthly, enforce 2FA fallback, and validate encrypted sync payloads.",
      tags: ["security", "dev"],
      folder: "Engineering",
      updatedAt: new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    }
  ],
  currentEditingId: null,
  activeTag: "all"
};

const el = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];
const navButtons = [...document.querySelectorAll("[data-nav]")];

function showToast(message, isError = false) {
  const toast = el("toastDialog");
  toast.textContent = message;
  toast.style.background = isError ? "#a12f2f" : "#20243f";
  toast.show();
  setTimeout(() => toast.open && toast.close(), 1500);
}

function setScreen(screen) {
  appState.activeScreen = screen;
  screens.forEach((node) => node.classList.toggle("active", node.dataset.screen === screen));
  [...document.querySelectorAll(".nav-item")].forEach((btn) => btn.classList.toggle("active", btn.dataset.nav === screen));
  const titleMap = {
    home: "Landing / Dashboard",
    editor: "Note Editor",
    search: "Search / Organization",
    settings: "Settings / Profile"
  };
  el("screenTitle").textContent = titleMap[screen] || "Notepad Pro";
}

function renderNotes() {
  const search = el("homeSearch").value.toLowerCase();
  const list = el("noteList");
  const notes = appState.notes.filter((note) => {
    const hay = `${note.title} ${note.body} ${note.tags.join(" ")} ${note.updatedAt}`.toLowerCase();
    return hay.includes(search);
  });

  list.innerHTML = notes
    .map((note) => `
      <article class="note-card" data-note-id="${note.id}">
        <h4>${note.title}</h4>
        <p>${appState.geminiUnlocked ? note.body.slice(0, 100) : "Encrypted snippet • unlock key"}</p>
        <footer>#${note.tags.join(" #")} · ${note.updatedAt}</footer>
      </article>`)
    .join("");

  el("homePlaceholder").classList.toggle("hidden", notes.length > 0);
}

function renderSearch() {
  const q = el("globalSearch").value.toLowerCase();
  const scope = appState.activeTag;
  const results = appState.notes.filter((note) => {
    const tagOkay = scope === "all" || note.tags.includes(scope);
    const qOkay = `${note.title} ${note.body} ${note.tags.join(" ")} ${note.updatedAt}`.toLowerCase().includes(q);
    return tagOkay && qOkay;
  });

  el("searchResults").innerHTML = results
    .map((note) => `
      <article class="note-card" data-note-id="${note.id}">
        <h4>${note.title}</h4>
        <p>${appState.geminiUnlocked ? note.body.slice(0, 100) : "Encrypted preview"}</p>
        <footer>${note.folder} · ${note.updatedAt}</footer>
      </article>`)
    .join("");

  el("searchPlaceholder").classList.toggle("hidden", results.length > 0);
}

function renderChips() {
  const uniqueTags = [...new Set(appState.notes.flatMap((n) => n.tags))];
  const tags = ["all", ...uniqueTags];
  el("chipContainer").innerHTML = tags
    .map((tag) => `<button class="chip ${appState.activeTag === tag ? "active" : ""}" data-tag="${tag}">${tag}</button>`)
    .join("");
}

function fillEditor(note) {
  el("noteTitle").value = note?.title || "";
  el("noteBody").innerText = note?.body || "Start typing…";
  el("tagInput").value = note?.tags?.join(", ") || "";
  el("folderInput").value = note?.folder || "";
}

function saveNote() {
  if (!appState.geminiUnlocked) {
    showToast("Re-authenticate to continue.", true);
    el("authDialog").showModal();
    return;
  }
  const note = {
    id: appState.currentEditingId || crypto.randomUUID(),
    title: el("noteTitle").value.trim() || "Untitled",
    body: el("noteBody").innerText.trim(),
    tags: el("tagInput").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    folder: el("folderInput").value.trim() || "Inbox",
    updatedAt: new Date().toISOString().slice(0, 10)
  };

  const idx = appState.notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) appState.notes[idx] = note;
  else appState.notes.unshift(note);

  appState.currentEditingId = note.id;
  renderNotes();
  renderChips();
  renderSearch();
  showToast("Saved & encrypted.");
}

function setInteractionState(state) {
  appState.uiState = state;
  const shell = el("appShell");
  shell.classList.remove("disabled-state");

  if (state === "loading") showToast("Loading notes…");
  if (state === "error") showToast("Failed to load notes. Retry.", true);
  if (state === "empty") {
    const previous = [...appState.notes];
    appState.notes = [];
    renderNotes();
    renderSearch();
    appState.notes = previous;
  }
  if (state === "disabled") {
    appState.geminiUnlocked = false;
    shell.classList.add("disabled-state");
    showToast("Gemini key timeout. Unlock required.", true);
  }

  if (["success", "loading", "error"].includes(state)) {
    renderNotes();
    renderSearch();
  }
}

function updateKeyUI() {
  el("keyStatusText").textContent = appState.geminiKeyConfigured
    ? appState.geminiUnlocked ? "Key active and unlocked." : "Key configured, locked."
    : "No key configured.";
  el("securityBanner").classList.toggle("hidden", appState.geminiUnlocked);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  const action = event.target.closest("[data-action]");
  const card = event.target.closest(".note-card");
  const chip = event.target.closest(".chip");

  if (nav) setScreen(nav.dataset.nav);

  if (action?.dataset.action === "create-note") {
    appState.currentEditingId = null;
    fillEditor(null);
    setScreen("editor");
  }

  if (action?.dataset.action === "create-notebook") {
    showToast("Notebook template ready (Phase 2).");
  }

  if (card) {
    const note = appState.notes.find((n) => n.id === card.dataset.noteId);
    if (!appState.geminiUnlocked) {
      el("authDialog").showModal();
      return;
    }
    appState.currentEditingId = note.id;
    fillEditor(note);
    setScreen("editor");
  }

  if (chip) {
    appState.activeTag = chip.dataset.tag;
    renderChips();
    renderSearch();
  }
});

el("homeSearch").addEventListener("input", renderNotes);
el("globalSearch").addEventListener("input", renderSearch);
el("saveNoteBtn").addEventListener("click", saveNote);
el("stateSelect").addEventListener("change", (e) => setInteractionState(e.target.value));
el("setupKeyBtn").addEventListener("click", () => {
  appState.geminiKeyConfigured = true;
  appState.geminiUnlocked = true;
  updateKeyUI();
  showToast("Gemini key generated and backed up.");
});
el("unlockBtn").addEventListener("click", () => el("authDialog").showModal());
el("manualSyncBtn").addEventListener("click", () => showToast("Manual sync complete."));
el("regenKeyBtn").addEventListener("click", () => showToast("Key regeneration requires confirmation."));
el("backupKeyBtn").addEventListener("click", () => showToast("Recovery phrase copied."));
el("openFilterBtn").addEventListener("click", () => showToast("Advanced filters modal (Phase 2)."));
el("conflictBtn").addEventListener("click", () => showToast("Conflict resolver opened."));
el("themeToggle").addEventListener("change", (e) => document.body.classList.toggle("dark", e.target.checked));
el("menuBtn").addEventListener("click", () => showToast("Sidebar shortcuts available on desktop."));
el("searchIconBtn").addEventListener("click", () => setScreen("search"));

el("authConfirmBtn").addEventListener("click", (event) => {
  event.preventDefault();
  const entered = el("keyInput").value.trim();
  if (!entered) {
    showToast("Key is required.", true);
    return;
  }
  appState.geminiKeyConfigured = true;
  appState.geminiUnlocked = true;
  el("authDialog").close();
  el("keyInput").value = "";
  updateKeyUI();
  setInteractionState("success");
  showToast("Authentication successful.");
});

for (const btn of document.querySelectorAll("[data-format]")) {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.format;
    const value = btn.dataset.value;
    document.execCommand(cmd, false, value);
    el("noteBody").focus();
  });
}

renderChips();
renderNotes();
renderSearch();
updateKeyUI();
