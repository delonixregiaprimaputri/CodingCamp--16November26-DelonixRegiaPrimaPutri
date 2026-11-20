/* ═══════════════════════════════════════════════
   LIFE DASHBOARD — app.js
   Vanilla JS · LocalStorage · No frameworks
   ═══════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2, 10);

/** LocalStorage helpers */
const store = {
  get: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

/** Show a quick toast message */
let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}


/* ─────────────────────────────────────────────
   1. THEME  (Light / Dark)
───────────────────────────────────────────── */
(function initTheme() {
  const btn = $('#themeToggle');
  const saved = store.get('theme', 'light');
  applyTheme(saved);

  btn.addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    store.set('theme', next);
  });

  function applyTheme(mode) {
    document.body.classList.toggle('dark', mode === 'dark');
    document.body.classList.toggle('light', mode !== 'dark');
    btn.textContent = mode === 'dark' ? '☀️' : '🌙';
  }
})();


/* ─────────────────────────────────────────────
   2. GREETING  (clock, date, name)
───────────────────────────────────────────── */
(function initGreeting() {
  const clockEl   = $('#clockDisplay');
  const dateEl    = $('#dateDisplay');
  const msgEl     = $('#greetingMsg');
  const nameEl    = $('#greetingName');
  const nameInput = $('#nameInput');
  const saveBtn   = $('#saveName');

  /* Restore saved name */
  const savedName = store.get('userName', '');
  if (savedName) {
    nameEl.textContent = savedName;
    nameInput.value = savedName;
  }

  /* Save name */
  function saveName() {
    const val = nameInput.value.trim();
    if (!val) return;
    nameEl.textContent = val;
    store.set('userName', val);
    showToast(`Welcome, ${val}! 👋`);
  }
  saveBtn.addEventListener('click', saveName);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });

  /* Clock tick */
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}:${s}`;

    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const hour = now.getHours();
    if      (hour < 12) msgEl.textContent = 'Good Morning ☀️';
    else if (hour < 17) msgEl.textContent = 'Good Afternoon 🌤';
    else if (hour < 20) msgEl.textContent = 'Good Evening 🌇';
    else                msgEl.textContent = 'Good Night 🌙';
  }
  tick();
  setInterval(tick, 1000);
})();


/* ─────────────────────────────────────────────
   3. POMODORO TIMER
───────────────────────────────────────────── */
(function initTimer() {
  /* Elements */
  const display     = $('#timerDisplay');
  const statusEl    = $('#timerStatus');
  const startBtn    = $('#startTimer');
  const stopBtn     = $('#stopTimer');
  const resetBtn    = $('#resetTimer');
  const workInput   = $('#workMin');
  const breakInput  = $('#breakMin');
  const applyBtn    = $('#applyTimer');
  const sessionEl   = $('#sessionCount');
  const ring        = $('#ringProgress');
  const tabBtns     = $$('.tab-btn');

  const CIRCUMFERENCE = 326.73; // 2π × 52

  /* State */
  let workSec  = store.get('workMin', 25) * 60;
  let breakSec = store.get('breakMin', 5) * 60;
  let mode     = 'work';   // 'work' | 'break'
  let total    = workSec;
  let remaining = workSec;
  let running  = false;
  let interval = null;
  let sessions = store.get('sessions', 0);

  /* Seed inputs from storage */
  workInput.value  = store.get('workMin', 25);
  breakInput.value = store.get('breakMin', 5);
  sessionEl.textContent = sessions;

  /* Render */
  function render() {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    display.textContent = `${m}:${s}`;

    const progress = remaining / total;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    ring.style.stroke = mode === 'work'
      ? 'var(--primary)'
      : 'var(--success)';
  }

  function setStatus(text) { statusEl.textContent = text; }

  /* Apply custom durations */
  applyBtn.addEventListener('click', () => {
    const w = Math.max(1, Math.min(90, parseInt(workInput.value) || 25));
    const b = Math.max(1, Math.min(30, parseInt(breakInput.value) || 5));
    workSec  = w * 60;
    breakSec = b * 60;
    store.set('workMin', w);
    store.set('breakMin', b);
    workInput.value  = w;
    breakInput.value = b;
    resetToMode(mode);
    showToast('Timer updated ✓');
  });

  /* Tab switching */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (running) { clearInterval(interval); running = false; }
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      resetToMode(btn.dataset.mode);
    });
  });

  function resetToMode(m) {
    mode = m;
    total = mode === 'work' ? workSec : breakSec;
    remaining = total;
    render();
    setStatus('Ready');
  }

  /* Controls */
  startBtn.addEventListener('click', () => {
    if (running) return;
    if (remaining === 0) resetToMode(mode);
    running = true;
    setStatus(mode === 'work' ? '🎯 Focusing…' : '☕ Break time…');
    interval = setInterval(tick, 1000);
  });

  stopBtn.addEventListener('click', () => {
    if (!running) return;
    clearInterval(interval);
    running = false;
    setStatus('⏸ Paused');
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(interval);
    running = false;
    resetToMode(mode);
  });

  function tick() {
    if (remaining <= 0) {
      clearInterval(interval);
      running = false;
      if (mode === 'work') {
        sessions++;
        store.set('sessions', sessions);
        sessionEl.textContent = sessions;
        setStatus('✅ Session done! Take a break.');
        showToast('🎉 Focus session complete!');
      } else {
        setStatus('Break over! Ready to focus?');
        showToast('☕ Break over — back to work!');
      }
      playBeep();
      return;
    }
    remaining--;
    render();
  }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + .8);
    } catch {}
  }

  render();
})();


/* ─────────────────────────────────────────────
   4. TO-DO LIST
───────────────────────────────────────────── */
(function initTodo() {
  const input      = $('#taskInput');
  const addBtn     = $('#addTask');
  const listEl     = $('#taskList');
  const counterEl  = $('#taskCounter');
  const clearBtn   = $('#clearDone');
  const sortSelect = $('#sortSelect');
  const filterBtns = $$('.filter-btn');

  /* Modal */
  const modal      = $('#editModal');
  const editInput  = $('#editInput');
  const saveEdit   = $('#saveEdit');
  const cancelEdit = $('#cancelEdit');

  let tasks       = store.get('tasks', []);
  let activeFilter = 'all';
  let editId      = null;

  /* ── Render ── */
  function render() {
    let filtered = [...tasks];

    /* Filter */
    if (activeFilter === 'active') filtered = filtered.filter(t => !t.done);
    if (activeFilter === 'done')   filtered = filtered.filter(t => t.done);

    /* Sort */
    const sort = sortSelect.value;
    filtered.sort((a, b) => {
      if (sort === 'newest')     return b.createdAt - a.createdAt;
      if (sort === 'oldest')     return a.createdAt - b.createdAt;
      if (sort === 'az')         return a.text.localeCompare(b.text);
      if (sort === 'za')         return b.text.localeCompare(a.text);
      if (sort === 'done-last')  return Number(a.done) - Number(b.done);
      if (sort === 'done-first') return Number(b.done) - Number(a.done);
      return 0;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<li class="empty-state">${
        activeFilter === 'done' ? 'No completed tasks yet.' :
        activeFilter === 'active' ? 'No active tasks — great work! 🎉' :
        'No tasks yet. Add one above!'
      }</li>`;
    } else {
      listEl.innerHTML = '';
      filtered.forEach(task => listEl.appendChild(createTaskEl(task)));
    }

    /* Counter: active tasks */
    const left = tasks.filter(t => !t.done).length;
    counterEl.textContent = `${left} task${left !== 1 ? 's' : ''} left`;
  }

  function createTaskEl(task) {
    const li = document.createElement('li');
    li.className = `task-item${task.done ? ' done' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <input type="checkbox" class="task-check" ${task.done ? 'checked' : ''}
             aria-label="Mark done" />
      <span class="task-text">${escapeHtml(task.text)}</span>
      <div class="task-actions">
        <button class="task-btn edit" title="Edit">✏️</button>
        <button class="task-btn del" title="Delete">🗑</button>
      </div>`;

    li.querySelector('.task-check').addEventListener('change', () => toggleDone(task.id));
    li.querySelector('.task-btn.edit').addEventListener('click', () => openEdit(task.id));
    li.querySelector('.task-btn.del').addEventListener('click', () => deleteTask(task.id));
    return li;
  }

  /* ── CRUD ── */
  function addTask() {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    tasks.unshift({ id: uid(), text, done: false, createdAt: Date.now() });
    save();
    input.value = '';
    input.focus();
    showToast('Task added ✓');
  }

  function toggleDone(id) {
    const t = tasks.find(t => t.id === id);
    if (t) { t.done = !t.done; save(); }
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    showToast('Task deleted');
  }

  function openEdit(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    editId = id;
    editInput.value = t.text;
    modal.classList.remove('hidden');
    editInput.focus();
  }

  function closeEdit() {
    modal.classList.add('hidden');
    editId = null;
  }

  saveEdit.addEventListener('click', () => {
    const text = editInput.value.trim();
    if (!text) return;
    const t = tasks.find(t => t.id === editId);
    if (t) { t.text = text; save(); showToast('Task updated ✓'); }
    closeEdit();
  });
  cancelEdit.addEventListener('click', closeEdit);
  modal.addEventListener('click', e => { if (e.target === modal) closeEdit(); });
  editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit.click();
    if (e.key === 'Escape') closeEdit();
  });

  /* ── Save & filter/sort controls ── */
  function save() { store.set('tasks', tasks); render(); }

  addBtn.addEventListener('click', addTask);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  clearBtn.addEventListener('click', () => {
    const count = tasks.filter(t => t.done).length;
    if (!count) { showToast('No completed tasks to clear'); return; }
    tasks = tasks.filter(t => !t.done);
    save();
    showToast(`Cleared ${count} completed task${count !== 1 ? 's' : ''}`);
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  sortSelect.addEventListener('change', render);

  render();
})();


/* ─────────────────────────────────────────────
   5. QUICK LINKS
───────────────────────────────────────────── */
(function initLinks() {
  const labelInput = $('#linkLabel');
  const urlInput   = $('#linkUrl');
  const addBtn     = $('#addLink');
  const grid       = $('#linkGrid');

  /* Edit modal */
  const modal        = $('#editLinkModal');
  const editLabel    = $('#editLinkLabel');
  const editUrl      = $('#editLinkUrl');
  const saveEditLink = $('#saveEditLink');
  const cancelLink   = $('#cancelEditLink');

  let links  = store.get('links', []);
  let editId = null;

  /* Default links on first load */
  if (!links.length) {
    links = [
      { id: uid(), label: 'Google',   url: 'https://google.com' },
      { id: uid(), label: 'YouTube',  url: 'https://youtube.com' },
      { id: uid(), label: 'GitHub',   url: 'https://github.com' },
    ];
    store.set('links', links);
  }

  /* ── Render ── */
  function render() {
    if (!links.length) {
      grid.innerHTML = '<p class="empty-state">No links yet. Add one above!</p>';
      return;
    }
    grid.innerHTML = '';
    links.forEach(link => grid.appendChild(createChip(link)));
  }

  function getFaviconUrl(url) {
    try {
      const origin = new URL(url).origin;
      return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
    } catch { return ''; }
  }

  function createChip(link) {
    const chip = document.createElement('div');
    chip.className = 'link-chip';
    chip.dataset.id = link.id;

    const faviconUrl = getFaviconUrl(link.url);

    chip.innerHTML = `
      ${faviconUrl ? `<img class="favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'" />` : ''}
      <a href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer"
         title="${escapeAttr(link.url)}">${escapeHtml(link.label)}</a>
      <div class="link-chip-actions">
        <button class="chip-btn edit-chip" title="Edit">✏️</button>
        <button class="chip-btn del-chip" title="Delete">✕</button>
      </div>`;

    chip.querySelector('.edit-chip').addEventListener('click', e => {
      e.preventDefault();
      openEdit(link.id);
    });
    chip.querySelector('.del-chip').addEventListener('click', e => {
      e.preventDefault();
      links = links.filter(l => l.id !== link.id);
      save();
      showToast('Link removed');
    });

    return chip;
  }

  /* ── Add ── */
  function addLink() {
    const label = labelInput.value.trim();
    let url     = urlInput.value.trim();
    if (!label || !url) { showToast('Enter both a label and a URL'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    links.push({ id: uid(), label, url });
    save();
    labelInput.value = '';
    urlInput.value   = '';
    labelInput.focus();
    showToast('Link added ✓');
  }

  addBtn.addEventListener('click', addLink);
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addLink(); });

  /* ── Edit modal ── */
  function openEdit(id) {
    const l = links.find(l => l.id === id);
    if (!l) return;
    editId = id;
    editLabel.value = l.label;
    editUrl.value   = l.url;
    modal.classList.remove('hidden');
    editLabel.focus();
  }

  function closeEdit() { modal.classList.add('hidden'); editId = null; }

  saveEditLink.addEventListener('click', () => {
    const label = editLabel.value.trim();
    let url     = editUrl.value.trim();
    if (!label || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const l = links.find(l => l.id === editId);
    if (l) { l.label = label; l.url = url; save(); showToast('Link updated ✓'); }
    closeEdit();
  });
  cancelLink.addEventListener('click', closeEdit);
  modal.addEventListener('click', e => { if (e.target === modal) closeEdit(); });

  function save() { store.set('links', links); render(); }

  render();
})();


/* ─────────────────────────────────────────────
   SHARED SANITISATION HELPERS
───────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(str) { return escapeHtml(str); }
