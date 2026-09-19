// ── ui/quiz-ui.js — Flujo del test "¿Qué lectura necesitas hoy?" ──

let _quizStep = 0;
let _quizAnswers = {};

function resetQuiz() {
  _quizStep = 0;
  _quizAnswers = {};
}

function startQuiz() {
  resetQuiz();
  renderQuizStep();
}

function renderQuizStep() {
  const container = document.getElementById('quizBody');
  if (!container) return;
  const total = quizQuestions.length;
  const q = quizQuestions[_quizStep];

  let html = '<div class="quiz-fade">';

  // Barra de progreso
  html += '<div class="quiz-progress">';
  for (let i = 0; i < total; i++) {
    html += '<div class="quiz-progress-dot' + (i <= _quizStep ? ' done' : '') + '"></div>';
  }
  html += '</div>';

  html += '<p class="text-xs text-txtsoft mb-1">pregunta ' + (_quizStep + 1) + ' de ' + total + '</p>';
  html += '<p class="font-title text-xl italic text-txt mb-1">' + q.title + '</p>';
  html += '<p class="text-xs text-txtsoft mb-4">' + q.subtitle + '</p>';
  html += '<div class="mb-3">';
  q.options.forEach(function (opt) {
    const active = _quizAnswers[q.id] === opt.value ? ' active' : '';
    html += '<button type="button" class="quiz-option' + active + '" data-value="' + opt.value + '">' + opt.label + '</button>';
  });
  html += '</div>';

  if (_quizStep > 0) {
    html += '<button type="button" id="quizPrevBtn" class="text-xs text-txtsoft hover:text-accent transition underline underline-offset-2">‹ atrás</button>';
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.quiz-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _quizAnswers[q.id] = btn.dataset.value;
      container.querySelectorAll('.quiz-option').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      setTimeout(function () {
        if (_quizStep < total - 1) {
          _quizStep++;
          renderQuizStep();
        } else {
          renderQuizResult();
        }
      }, 220);
    });
  });

  const prevBtn = document.getElementById('quizPrevBtn');
  if (prevBtn) prevBtn.addEventListener('click', function () {
    if (_quizStep > 0) { _quizStep--; renderQuizStep(); }
  });
}

function renderQuizResult() {
  const container = document.getElementById('quizBody');
  if (!container) return;
  const id = resolveQuizResult(_quizAnswers);
  const reading = readingsCatalog.find(function (r) { return r.id === id; });
  if (!reading) return;

  let html = '<div class="quiz-fade">';
  html += '<div class="text-center">';
  html += '<p class="text-xs uppercase tracking-wide text-txtsoft mb-2">tu lectura es</p>';
  html += '<p class="font-title text-2xl italic font-normal text-txt mb-2">' + reading.title + '</p>';
  html += '<p class="text-sm text-txtsoft leading-relaxed mb-3">' + getQuizReason(id) + '</p>';
  html += '<p class="text-xs text-accent mb-5">' + reading.detail + '</p>';
  html += '<button type="button" id="quizBookBtn" class="w-full bg-accent text-white rounded-xl py-3 text-sm font-medium hover:opacity-90 transition mb-2">reservar esta lectura</button>';
  html += '<button type="button" id="quizRestartBtn" class="block mx-auto text-xs text-txtsoft hover:text-accent transition underline underline-offset-2 mt-1">volver a empezar</button>';
  html += '</div>';
  html += '<div class="border-t border-dashed border-gray-200 my-5"></div>';
  html += '<div class="text-center">';
  html += '<p class="text-xs text-txtsoft italic mb-2">¿no te convence?</p>';
  html += '<button type="button" id="quizSeeAllBtn" class="text-sm text-accent font-medium hover:underline underline-offset-2 transition">puedes ver todas las lecturas</button>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  const bookBtn = document.getElementById('quizBookBtn');
  if (bookBtn) bookBtn.addEventListener('click', function () {
    if (typeof selectReadingById === 'function') selectReadingById(id);
    hideQuiz();
  });
  const restartBtn = document.getElementById('quizRestartBtn');
  if (restartBtn) restartBtn.addEventListener('click', function () {
    resetQuiz();
    renderQuizStep();
  });
  const seeAllBtn = document.getElementById('quizSeeAllBtn');
  if (seeAllBtn) seeAllBtn.addEventListener('click', function () {
    hideQuiz();
    if (typeof showLecturasGuide === 'function') showLecturasGuide();
  });
}