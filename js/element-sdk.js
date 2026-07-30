// ── element-sdk.js — Integración con Element SDK (temas dinámicos) ──

const defaultConfig = {
  page_title: 'The Stardust Tarot',
  ornament_text: '⊹ ୨ᰔ୧ ⊹',
  background_color: '#faf6f2',
  surface_color: '#f5f0eb',
  accent_color: '#a97791',
  text_color: '#32292a',
  soft_color: '#7a6d80',
  font_family: 'Cormorant Garamond',
  font_size: 16
};

function applyConfig(config) {
  const c = { ...defaultConfig, ...config };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = c.page_title;
  const orn = document.getElementById('ornament');
  if (orn) orn.textContent = c.ornament_text;
  document.body.style.backgroundColor = c.background_color;
  document.documentElement.style.setProperty('--accent', c.accent_color);
  const style = document.getElementById('dynamicStyle') || (() => {
    const s = document.createElement('style'); s.id = 'dynamicStyle';
    document.head.appendChild(s); return s;
  })();
  style.textContent = `
    .chip.active { background: ${c.accent_color} !important; border-color: ${c.accent_color} !important; }
    .category-btn:hover { border-color: ${c.accent_color} !important; background: rgba(169,119,145,0.06) !important; }
    .category-btn.active { background: ${c.accent_color} !important; border-color: ${c.accent_color} !important; color: #fff !important; }
    .chip:hover { border-color: ${c.accent_color} !important; }
    .toggle-track.on { background: ${c.accent_color} !important; }
    .text-accent, #receiptTotal { color: ${c.accent_color} !important; }
    .bg-accent { background-color: ${c.accent_color} !important; }
    .border-accent { border-color: ${c.accent_color} !important; }
    .bg-surface, .bg-surface\\/50 { background-color: ${c.surface_color} !important; }
    .hover\\:bg-surface:hover { background-color: ${c.surface_color} !important; }
    body { color: ${c.text_color}; }
    .text-txtsoft { color: ${c.soft_color} !important; }
  `;
  const font = c.font_family || defaultConfig.font_family;
  const baseSize = c.font_size || defaultConfig.font_size;
  document.querySelectorAll('.font-title, h1, h2').forEach(el => {
    el.style.fontFamily = `${font}, serif`;
  });
  if (titleEl) titleEl.style.fontSize = `${baseSize * 2}px`;
  document.querySelectorAll('h2').forEach(el => el.style.fontSize = `${baseSize * 1.5}px`);
}

if (window.elementSdk && typeof window.elementSdk.init === 'function') {
  window.elementSdk.init({
    defaultConfig,
    onConfigChange: async (config) => applyConfig(config),
    mapToCapabilities: (config) => ({
      recolorables: [
        { get: () => config.background_color || defaultConfig.background_color, set: v => { config.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
        { get: () => config.surface_color || defaultConfig.surface_color, set: v => { config.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
        { get: () => config.text_color || defaultConfig.text_color, set: v => { config.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
        { get: () => config.accent_color || defaultConfig.accent_color, set: v => { config.accent_color = v; window.elementSdk.setConfig({ accent_color: v }); } },
        { get: () => config.soft_color || defaultConfig.soft_color, set: v => { config.soft_color = v; window.elementSdk.setConfig({ soft_color: v }); } },
      ],
      borderables: [],
      fontEditable: { get: () => config.font_family || defaultConfig.font_family, set: v => { config.font_family = v; window.elementSdk.setConfig({ font_family: v }); } },
      fontSizeable: { get: () => config.font_size || defaultConfig.font_size, set: v => { config.font_size = v; window.elementSdk.setConfig({ font_size: v }); } },
    }),
    mapToEditPanelValues: (config) => new Map([
      ['page_title', config.page_title || defaultConfig.page_title],
      ['ornament_text', config.ornament_text || defaultConfig.ornament_text],
    ])
  });
} else {
  console.warn('elementSdk no disponible; se continúa con la vista estática.');
}