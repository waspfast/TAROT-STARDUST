// ── ui/readings-ui.js — Renderizado e interacción de lecturas ──

function renderReadingsForCategory(category) {
  const container = document.getElementById('readingsContainer');
  const readings = readingsCatalog.filter(r => r.categories.includes(category));
  container.innerHTML = readings.map(r => `
    <div class="reading-chip-wrap">
      <div class="chip reading-chip border border-gray-200 rounded-xl px-4 py-3 text-sm${state.readings[r.id] ? ' active' : ''}"
           data-reading="${r.id}" data-price="${r.price}">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-medium">${r.title}</div>
            <div class="text-xs opacity-70">${r.detail}</div>
          </div>
          ${r.paraTi ? `<button type="button" class="reading-expand-btn" data-expand="${r.id}" aria-label="Ver descripción"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>` : ''}
        </div>
      </div>
      ${r.paraTi ? `
        <div class="reading-expand" data-expand-content="${r.id}">
          <div class="text-xs leading-relaxed text-txtsoft bg-surface rounded-xl px-4 py-3 mt-1">
            <p>${r.paraTi}</p>
            ${r.ejemplo ? `<p class="mt-1.5 italic opacity-90">ej. ${r.ejemplo}</p>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Selección
  container.querySelectorAll('.reading-chip').forEach(c => {
    c.addEventListener('click', () => toggleReading(c));
  });

  // Expansión de descripción (no interfiere con selección)
  container.querySelectorAll('[data-expand]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.expand;
      const content = container.querySelector(`[data-expand-content="${id}"]`);
      if (!content) return;
      content.classList.toggle('open');
      btn.style.transform = content.classList.contains('open') ? 'rotate(180deg)' : '';
    });
  });
}

function toggleReading(chip) {
  chip.classList.toggle('active');
  const key = chip.dataset.reading;
  if (state.readings[key]) {
    delete state.readings[key];
  } else {
    state.readings[key] = parseFloat(chip.dataset.price);
  }
  backToCategories();
  updateSelectedReadingsSummary();
}

function updateSelectedReadingsSummary() {
  const summary = document.getElementById('selectedReadingsSummary');
  const list = document.getElementById('selectedReadingsList');
  const keys = Object.keys(state.readings);
  if (keys.length === 0) {
    summary.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  summary.classList.remove('hidden');
  list.innerHTML = keys.map(key => `
    <span class="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs">
      ${readingNames[key]}
      <button type="button" class="text-txtsoft hover:text-accent transition" data-remove="${key}" aria-label="Quitar lectura">×</button>
    </span>
  `).join('');
  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.remove;
      delete state.readings[key];
      document.querySelectorAll(`.reading-chip[data-reading="${key}"]`).forEach(c => c.classList.remove('active'));
      updateSelectedReadingsSummary();
    });
  });
}

function showReadingCategory(category) {
  state.readingCategory = category;
  document.getElementById('categoryMenu').classList.add('hidden');
  document.getElementById('lecturasGuideLink').classList.add('hidden');
  document.getElementById('readingsPanel').classList.remove('hidden');
  document.getElementById('selectedCategoryLabel').textContent = categoryLabels[category];
  document.getElementById('readingStepHint').textContent = 'Selecciona una o varias lecturas de esta categoría';
  renderReadingsForCategory(category);
  setTimeout(() => lucide.createIcons(), 50);
}

function backToCategories() {
  state.readingCategory = '';
  document.getElementById('readingsPanel').classList.add('hidden');
  document.getElementById('lecturasGuideLink').classList.remove('hidden');
  document.getElementById('categoryMenu').classList.remove('hidden');
  document.getElementById('readingStepHint').textContent = 'Elige una categoría para ver las lecturas disponibles';
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
}

function renderCategorySubtitles() {
  document.querySelectorAll('.category-btn').forEach(btn => {
    const cat = btn.dataset.category;
    if (categoryDescriptions[cat] && !btn.querySelector('.category-subtitle')) {
      const sub = document.createElement('span');
      sub.className = 'category-subtitle block text-[11px] font-normal opacity-60 mt-0.5';
      sub.textContent = categoryDescriptions[cat];
      btn.appendChild(sub);
    }
  });
}