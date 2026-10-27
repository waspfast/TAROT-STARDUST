// ── state.js — Única fuente de verdad para toda la app ──
const state = {
  esConsultanteNueva: null,
  platform: '', contacto: '', nombre: '', readings: {},
  emergency: false, fecha: '',
  horario: '',        // texto para el recibo/telegram: "10:30 · 25 min"
  inicio: '',         // inicio del bloque elegido: "10:30"
  duracion: 0,        // minutos de la lectura: 25 (corta) | 35 (extensa)
  slotTipo: '',       // 'normal' | 'emergencia' con el que se tomó el horario
  pago: '', detalle: '',
  readingType: '', readingCategory: '',
  payRef: '', payEmail: '', payBanco: '', payTelefono: '', payRefPayPal: ''
};