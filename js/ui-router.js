/**
 * Azota Quiz Master - UI Router & Screen Renderer
 * Điều hướng màn hình, tab và render giao diện Liquid Glass di động
 */

// Hàm làm sạch chuỗi chống tấn công XSS từ file Word
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class UIRouter {
  constructor(stateManager, historyDb) {
    this.state = stateManager;
    this.db = historyDb;

    this.currentView = 'home'; // 'home' | 'quiz' | 'result'
    this.currentTab = 'study';  // 'study' | 'library' | 'mistakes'

    this.reviewFilter = 'all';  // 'all' | 'wrong' | 'flagged'

    this.initDOMElements();
  }

  initDOMElements() {
    // Views
    this.viewHome = document.getElementById('view-home');
    this.viewQuiz = document.getElementById('view-quiz');
    this.viewResult = document.getElementById('view-result');

    // Tabs inside Home View
    this.tabStudy = document.getElementById('tab-study');
    this.tabLibrary = document.getElementById('tab-library');
    this.tabMistakes = document.getElementById('tab-mistakes');

    // Bottom Navigation Bar
    this.bottomNav = document.getElementById('bottom-nav');
    this.navItems = document.querySelectorAll('.bottom-nav-item');

    // Question matrix bottom sheet
    this.matrixModal = document.getElementById('question-matrix-modal');
    this.matrixGrid = document.getElementById('question-matrix-grid');
    this.matrixSummary = document.getElementById('question-matrix-summary');
    this.matrixToggle = document.getElementById('btn-quiz-matrix-toggle');
    this.questionObserver = null;
    this.persistScrollPositionTimer = null;
  }

  // =========================================================================
  // ĐIỀU HƯỚNG MÀN HÌNH (VIEWS)
  // =========================================================================

  switchView(viewName) {
    this.currentView = viewName;
    if (viewName !== 'quiz') this.closeQuestionMatrix();

    // Ẩn tất cả view
    this.viewHome.classList.add('hidden');
    this.viewQuiz.classList.add('hidden');
    this.viewResult.classList.add('hidden');

    if (viewName === 'home') {
      this.viewHome.classList.remove('hidden');
      this.bottomNav.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'quiz') {
      this.viewQuiz.classList.remove('hidden');
      this.bottomNav.classList.add('hidden'); // Ẩn bottom nav để nhường chỗ cho Quiz Action Bar
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'result') {
      this.viewResult.classList.remove('hidden');
      this.bottomNav.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // =========================================================================
  // ĐIỀU HƯỚNG TAB CHÍNH (BOTTOM NAV)
  // =========================================================================

  switchTab(tabName) {
    this.currentTab = tabName;
    this.switchView('home');

    // Ẩn nội dung các tab
    this.tabStudy.classList.add('hidden');
    this.tabLibrary.classList.add('hidden');
    this.tabMistakes.classList.add('hidden');

    // Cập nhật trạng thái active trên Bottom Nav
    this.navItems.forEach(item => {
      const target = item.getAttribute('data-tab');
      if (target === tabName) {
        item.classList.add('text-primary-container', 'font-semibold');
        item.classList.remove('text-on-surface-variant');
        const icon = item.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        item.classList.remove('text-primary-container', 'font-semibold');
        item.classList.add('text-on-surface-variant');
        const icon = item.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
      }
    });

    if (tabName === 'study') {
      this.tabStudy.classList.remove('hidden');
    } else if (tabName === 'library') {
      this.tabLibrary.classList.remove('hidden');
      this.loadLibraryTab();
    } else if (tabName === 'mistakes') {
      this.tabMistakes.classList.remove('hidden');
      this.loadMistakesTab();
    }
  }

  // =========================================================================
  // RENDER MÀN HÌNH LÀM BÀI (QUIZ SCREEN)
  // =========================================================================

  renderQuizScreen() {
    if (!this.state.activeQuiz) return;

    this.renderQuizHeader();
    this.renderQuizProgress();
    this.renderQuestionStream();
    this.renderQuestionMatrix();

    if (this.state.currentQuestionIndex > 0) {
      requestAnimationFrame(() => this.scrollToQuestion(this.state.currentQuestionIndex, 'auto'));
    }
  }

  renderQuizHeader() {
    if (!this.state.activeQuiz) return;

    const titleEl = document.getElementById('quiz-header-title');
    const codeEl = document.getElementById('quiz-header-code');
    const totalQuestions = this.state.activeQuiz.questions.length;

    if (titleEl) titleEl.textContent = this.state.activeQuiz.title || 'Phòng Thi Trắc Nghiệm';
    if (codeEl) codeEl.textContent = `Câu ${this.state.currentQuestionIndex + 1} / ${totalQuestions}`;

    const timerContainer = document.getElementById('quiz-timer-container');
    const timerText = document.getElementById('quiz-timer-text');
    if (timerContainer) {
      if (this.state.mode === 'practice') {
        timerContainer.classList.add('hidden');
      } else {
        timerContainer.classList.remove('hidden');
        if (timerText) {
          if (this.state.timeLimit === 0) {
            timerText.textContent = 'Không giới hạn';
          } else {
            const minutes = Math.floor(this.state.timeLeft / 60);
            const seconds = this.state.timeLeft % 60;
            timerText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }
        }
      }
    }
  }

  renderQuizProgress() {
    if (!this.state.activeQuiz) return;

    const answeredCount = this.getAnsweredCount();
    const totalQ = this.state.activeQuiz.questions.length;
    const percent = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;

    const progressText = document.getElementById('quiz-progress-text');
    const progressPercent = document.getElementById('quiz-progress-percent');
    const progressBar = document.getElementById('quiz-progress-bar');
    const headerProgress = document.getElementById('quiz-header-progress');

    if (progressText) progressText.textContent = `ĐÃ HOÀN THÀNH ${answeredCount}/${totalQ} CÂU`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (headerProgress) headerProgress.style.width = `${percent}%`;
  }

  getAnsweredCount() {
    if (!this.state.activeQuiz?.questions) return 0;
    return this.state.activeQuiz.questions.filter(q => !!this.state.answers[q.id]).length;
  }

  refreshQuizStatus() {
    this.renderQuizHeader();
    this.renderQuizProgress();
    this.renderQuestionMatrix();
  }

  renderQuestionStream() {
    const stream = document.getElementById('quiz-question-stream');
    if (!stream || !this.state.activeQuiz) return;

    this.disconnectQuestionObserver();
    stream.innerHTML = this.state.activeQuiz.questions
      .map((question, index) => this.renderQuestionCard(question, index))
      .join('');

    this.observeQuestionCards();
  }

  renderQuestionCard(question, index) {
    const answer = this.state.answers[question.id];
    const isPracticeMode = this.state.mode === 'practice';
    const hasAnswer = !!answer;
    const hasCorrectAnswer = !!question.correctAnswer;
    const isFlagged = !!this.state.flagged[question.id];
    const displayNumber = question.displayNumber || question.number || (index + 1);

    const optionsHtml = (question.options || []).map(option => {
      const isSelected = answer === option.key;
      const isCorrect = question.correctAnswer === option.key;
      let optionClass = 'w-full option-tile p-4 rounded-[20px] bg-white border-2 flex items-center justify-between gap-3 text-left transition-all shadow-sm ';
      let badgeClass = 'w-9 h-9 rounded-full flex items-center justify-center font-mono-metric font-semibold text-[15px] shrink-0 ';
      let trailingIcon = '';

      if (isPracticeMode && hasAnswer && hasCorrectAnswer) {
        if (isCorrect) {
          optionClass += 'border-tertiary bg-[#F0FDF4] shadow-[0_4px_16px_rgba(16,185,129,0.15)] ';
          badgeClass += 'bg-tertiary text-white ';
          trailingIcon = '<span class="material-symbols-outlined text-tertiary text-[24px] shrink-0">check_circle</span>';
        } else if (isSelected) {
          optionClass += 'border-error bg-[#FEF2F2] shadow-[0_4px_16px_rgba(220,38,38,0.12)] ';
          badgeClass += 'bg-error text-white ';
          trailingIcon = '<span class="material-symbols-outlined text-error text-[24px] shrink-0">cancel</span>';
        } else {
          optionClass += 'border-slate-100 opacity-60 ';
          badgeClass += 'bg-surface-container text-on-surface-variant ';
        }
      } else if (isSelected) {
        optionClass += 'border-primary-container bg-primary-container/5 ring-1 ring-primary-container shadow-[0_4px_16px_rgba(0,82,255,0.12)] ';
        badgeClass += 'bg-primary-container text-white ';
        trailingIcon = '<span class="material-symbols-outlined text-primary-container text-[24px] shrink-0" style="font-variation-settings: \'FILL\' 1;">check_circle</span>';
      } else {
        optionClass += 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 ';
        badgeClass += 'bg-surface-container text-on-surface-variant ';
      }

      return `
        <button type="button" data-option-key="${escapeHtml(option.key)}" class="${optionClass}" aria-pressed="${isSelected}">
          <span class="flex items-center gap-3.5 flex-1 min-w-0">
            <span class="${badgeClass}">${escapeHtml(option.key)}</span>
            <span class="font-body-md text-on-surface text-[15px] leading-snug text-wrap-safe">${escapeHtml(option.text)}</span>
          </span>
          ${trailingIcon}
        </button>`;
    }).join('');

    let feedbackHtml = '';
    if (isPracticeMode && hasAnswer) {
      if (hasCorrectAnswer) {
        const isCorrect = answer === question.correctAnswer;
        const feedbackTitle = isCorrect ? 'Chính xác!' : 'Chưa chính xác';
        const feedbackClass = isCorrect
          ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-900'
          : 'bg-blue-50/70 border-blue-200/60 text-slate-800';
        const feedbackIcon = isCorrect ? 'check_circle' : 'lightbulb';
        const fallback = isCorrect
          ? `Bạn đã chọn đúng đáp án ${question.correctAnswer}.`
          : `Đáp án đúng là ${question.correctAnswer}.`;
        feedbackHtml = `
          <div class="mt-3 p-4 rounded-[20px] border shadow-sm text-xs leading-relaxed ${feedbackClass}">
            <div class="flex items-center gap-1.5 font-bold mb-1 text-[13px]">
              <span class="material-symbols-outlined text-[18px]">${feedbackIcon}</span>
              <span>${feedbackTitle}</span>
            </div>
            <p class="text-wrap-safe">${escapeHtml(question.explanation || fallback)}</p>
          </div>`;
      } else {
        feedbackHtml = `
          <div class="mt-3 p-4 rounded-[20px] bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <div class="flex items-center gap-1.5 font-bold mb-1 text-[13px]">
              <span class="material-symbols-outlined text-[18px]">info</span>
              <span>Chưa có đáp án chuẩn</span>
            </div>
            <p>Đề này chưa cung cấp đáp án để chấm tự động.</p>
          </div>`;
      }
    }

    return `
      <article id="quiz-question-${index}" data-question-index="${index}" class="quiz-question-card rounded-[24px] bg-white p-5 border border-outline-variant/30 shadow-[0_12px_32px_-8px_rgba(19,27,46,0.08)]">
        <div class="flex items-start justify-between gap-3 mb-3">
          <span class="px-3 py-1 rounded-full bg-primary-container/10 text-primary-container font-mono-metric text-xs font-bold tracking-wide shrink-0">CÂU ${escapeHtml(displayNumber)}</span>
          <button type="button" data-quiz-action="toggle-flag" title="${isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu câu này'}" aria-label="${isFlagged ? 'Bỏ đánh dấu câu ' : 'Đánh dấu câu '}${escapeHtml(displayNumber)}" class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${isFlagged ? 'bg-[#ffedd5] text-[#ea580c] border border-[#fdba74]' : 'bg-surface-container text-on-surface-variant border border-outline-variant/30'}">
            <span class="material-symbols-outlined text-[20px]" ${isFlagged ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>flag</span>
          </button>
        </div>
        <p class="font-body text-[16px] font-semibold text-on-surface leading-relaxed text-wrap-safe">${escapeHtml(question.text || '')}</p>
        <div class="mt-4 space-y-2.5">${optionsHtml}</div>
        ${feedbackHtml}
      </article>`;
  }

  updateQuestionCard(index) {
    if (!this.state.activeQuiz?.questions?.[index]) return;

    const oldCard = document.getElementById(`quiz-question-${index}`);
    if (oldCard) {
      this.questionObserver?.unobserve(oldCard);
      oldCard.outerHTML = this.renderQuestionCard(this.state.activeQuiz.questions[index], index);
      const newCard = document.getElementById(`quiz-question-${index}`);
      if (newCard) this.questionObserver?.observe(newCard);
    }

    this.refreshQuizStatus();
  }

  renderQuestionMatrix() {
    if (!this.matrixGrid || !this.state.activeQuiz) return;

    const questions = this.state.activeQuiz.questions;
    const answeredCount = this.getAnsweredCount();
    if (this.matrixSummary) this.matrixSummary.textContent = `Đã làm ${answeredCount}/${questions.length} câu`;

    this.matrixGrid.innerHTML = questions.map((question, index) => {
      const isCurrent = index === this.state.currentQuestionIndex;
      const isAnswered = !!this.state.answers[question.id];
      const isFlagged = !!this.state.flagged[question.id];
      const displayNumber = question.displayNumber || question.number || (index + 1);
      let buttonClass = 'relative h-11 rounded-xl font-mono-metric text-sm font-semibold flex items-center justify-center transition-all active:scale-95 ';

      if (isCurrent) {
        buttonClass += 'ring-2 ring-primary-container ring-offset-2 bg-primary text-on-primary shadow-md ';
      } else if (isAnswered) {
        buttonClass += 'bg-primary-container text-on-primary shadow-[0_2px_6px_rgba(0,82,255,0.3)] ';
      } else {
        buttonClass += 'bg-surface-container text-on-surface hover:bg-surface-container-high ';
      }

      const status = [
        `Câu ${displayNumber}`,
        isAnswered ? 'đã trả lời' : 'chưa trả lời',
        isFlagged ? 'đã đánh dấu' : ''
      ].filter(Boolean).join(', ');

      return `
        <button type="button" data-matrix-index="${index}" class="${buttonClass}" aria-label="${escapeHtml(status)}" ${isCurrent ? 'aria-current="true"' : ''}>
          ${escapeHtml(displayNumber)}
          ${isFlagged ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#f97316] text-white flex items-center justify-center shadow-sm"><span class="material-symbols-outlined text-[9px]" style="font-variation-settings: \'FILL\' 1;">flag</span></span>' : ''}
        </button>`;
    }).join('');
  }

  openQuestionMatrix() {
    if (!this.matrixModal) return;
    this.renderQuestionMatrix();
    this.matrixModal.classList.remove('hidden');
    this.matrixModal.setAttribute('aria-hidden', 'false');
    this.matrixToggle?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('question-matrix-open');
  }

  closeQuestionMatrix() {
    if (!this.matrixModal) return;
    this.matrixModal.classList.add('hidden');
    this.matrixModal.setAttribute('aria-hidden', 'true');
    this.matrixToggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('question-matrix-open');
  }

  scrollToQuestion(index, behavior = 'smooth') {
    const card = document.getElementById(`quiz-question-${index}`);
    if (card) card.scrollIntoView({ behavior, block: 'start' });
  }

  observeQuestionCards() {
    if (typeof IntersectionObserver === 'undefined') return;

    this.questionObserver = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visibleEntry) return;

      const index = Number(visibleEntry.target.dataset.questionIndex);
      if (!Number.isInteger(index) || index === this.state.currentQuestionIndex) return;

      this.state.currentQuestionIndex = index;
      this.renderQuizHeader();
      this.renderQuestionMatrix();
      clearTimeout(this.persistScrollPositionTimer);
      this.persistScrollPositionTimer = setTimeout(() => this.state.saveSession(), 300);
    }, { rootMargin: '-18% 0px -58% 0px', threshold: 0.15 });

    document.querySelectorAll('.quiz-question-card').forEach(card => this.questionObserver.observe(card));
  }

  disconnectQuestionObserver() {
    if (this.questionObserver) this.questionObserver.disconnect();
    this.questionObserver = null;
    clearTimeout(this.persistScrollPositionTimer);
  }

  // =========================================================================
  // RENDER MÀN HÌNH KẾT QUẢ & RÀ SOÁT (RESULT SCREEN)
  // =========================================================================

  renderResultScreen(result) {
    if (!result) return;

    // 1. Hero Score Card
    const scoreVal = document.getElementById('result-score-value');
    const ratingBadge = document.getElementById('result-rating-badge');
    const testCode = document.getElementById('result-test-code');
    const dateText = document.getElementById('result-date-text');
    const completionText = document.getElementById('result-completion-text');

    if (scoreVal) scoreVal.textContent = result.score.toFixed(1);
    if (testCode) testCode.textContent = result.title || 'AZT-2026';
    if (dateText) dateText.textContent = new Date(result.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • Hôm nay';
    if (completionText) completionText.textContent = `Hoàn thành ${result.correctCount + result.incorrectCount}/${result.totalQuestions} câu`;

    if (ratingBadge) {
      if (result.score >= 8.5) {
        ratingBadge.innerHTML = `<span class="material-symbols-outlined text-tertiary text-[20px]" style="font-variation-settings: 'FILL' 1;">emoji_events</span>
          <span class="font-caption text-caption text-on-surface font-semibold text-left">Xuất sắc! Bạn thuộc <strong class="text-tertiary">top 10%</strong> điểm cao nhất</span>`;
      } else if (result.score >= 6.5) {
        ratingBadge.innerHTML = `<span class="material-symbols-outlined text-primary text-[20px]" style="font-variation-settings: 'FILL' 1;">thumb_up</span>
          <span class="font-caption text-caption text-on-surface font-semibold text-left">Làm rất tốt! Bạn đã vượt qua mức trung bình</span>`;
      } else {
        ratingBadge.innerHTML = `<span class="material-symbols-outlined text-warning text-[20px]" style="font-variation-settings: 'FILL' 1;">school</span>
          <span class="font-caption text-caption text-on-surface font-semibold text-left">Cần cố gắng thêm! Hãy luyện lại các câu sai nhé</span>`;
      }
    }

    // 2. Lưới 2x2 Performance Tiles
    const correctTile = document.getElementById('result-tile-correct');
    const wrongTile = document.getElementById('result-tile-wrong');
    const skippedTile = document.getElementById('result-tile-skipped');
    const timeTile = document.getElementById('result-tile-time');

    if (correctTile) correctTile.textContent = result.correctCount.toString().padStart(2, '0');
    if (wrongTile) wrongTile.textContent = result.incorrectCount.toString().padStart(2, '0');
    if (skippedTile) skippedTile.textContent = result.skippedCount.toString().padStart(2, '0');

    if (timeTile) {
      const minutes = Math.floor(result.durationSeconds / 60);
      const seconds = result.durationSeconds % 60;
      timeTile.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // 3. Render danh sách rà soát chi tiết
    this.renderReviewList(result.details);
  }

  renderReviewList(details) {
    const listEl = document.getElementById('result-review-list');
    if (!listEl || !details) return;

    // Lọc theo tab: 'all' | 'wrong' | 'flagged'
    let filtered = details;
    if (this.reviewFilter === 'wrong') {
      filtered = details.filter(d => !d.isCorrect && !d.isSkipped);
    } else if (this.reviewFilter === 'flagged') {
      filtered = details.filter(d => d.isFlagged);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="p-8 text-center text-on-surface-variant font-body-md rounded-2xl bg-surface-container-low">
          Không có câu hỏi nào trong bộ lọc này.
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map((d) => {
      let statusBadge = '';
      if (d.isCorrect) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-container/20 text-tertiary flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">check</span> Đúng
        </span>`;
      } else if (d.isSkipped) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-outline flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">remove</span> Bỏ qua
        </span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error-container/40 text-error flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">close</span> Sai
        </span>`;
      }

      const optionsHtml = (d.options || []).map(opt => {
        let optStyle = 'p-3 rounded-xl border text-sm flex items-center justify-between ';
        if (opt.key === d.correctAnswer) {
          optStyle += 'border-tertiary bg-[#F0FDF4] font-medium text-slate-900';
        } else if (opt.key === d.userAnswer && !d.isCorrect) {
          optStyle += 'border-error bg-[#FEF2F2] font-medium text-slate-900';
        } else {
          optStyle += 'border-slate-100 bg-white text-slate-600';
        }

        return `
          <div class="${optStyle}">
            <div class="flex items-center gap-2.5">
              <span class="w-6 h-6 rounded-md font-mono text-xs font-semibold flex items-center justify-center ${opt.key === d.correctAnswer ? 'bg-tertiary text-white' : (opt.key === d.userAnswer ? 'bg-error text-white' : 'bg-slate-100')}">
                ${opt.key}
              </span>
              <span>${escapeHtml(opt.text)}</span>
            </div>
            ${opt.key === d.correctAnswer ? '<span class="text-xs font-semibold text-tertiary">Đáp án đúng</span>' : ''}
            ${opt.key === d.userAnswer && !d.isCorrect ? '<span class="text-xs font-semibold text-error">Bạn chọn</span>' : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="p-5 rounded-[22px] bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono-metric text-xs font-bold text-primary">CÂU ${d.number}</span>
            ${statusBadge}
          </div>
          <p class="font-body-md text-on-surface text-[15px] font-medium leading-relaxed">
            ${escapeHtml(d.text)}
          </p>
          <div class="flex flex-col gap-2 mt-1">
            ${optionsHtml}
          </div>
          ${d.explanation ? `
            <div class="mt-2 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100/80 text-xs text-slate-700 leading-relaxed">
              <strong class="text-accent font-semibold flex items-center gap-1 mb-1">
                <span class="material-symbols-outlined text-[16px]">info</span> Lời giải chi tiết:
              </strong>
              ${escapeHtml(d.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // RENDER TAB KHO ĐỀ CỦA TÔI (LIBRARY TAB)
  // =========================================================================

  async loadLibraryTab() {
    const listEl = document.getElementById('library-quiz-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="p-8 text-center text-on-surface-variant font-body-md">
        <span class="material-symbols-outlined text-[32px] animate-spin mb-2 text-primary">progress_activity</span>
        <p>Đang tải kho đề...</p>
      </div>
    `;

    const quizzes = await this.db.getAllQuizzes();
    if (quizzes.length === 0) {
      listEl.innerHTML = `
        <div class="p-10 text-center text-on-surface-variant rounded-2xl bg-surface-container-low flex flex-col items-center">
          <span class="material-symbols-outlined text-[48px] text-outline mb-2">folder_open</span>
          <p class="font-title-md font-semibold text-on-surface mb-1">Kho đề chưa có dữ liệu</p>
          <p class="font-body-md text-sm text-outline mb-4">Các đề thi Word bạn tải lên và làm sẽ được tự động lưu tại đây để luyện lại.</p>
          <button class="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary font-medium text-sm shadow-sm" onclick="window.quizApp.router.switchTab('study')">
            Tải đề thi ngay
          </button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = quizzes.map(q => {
      const dateStr = new Date(q.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const highScoreStr = q.highScore !== undefined ? `${q.highScore.toFixed(1)}/10` : 'Chưa thi';

      return `
        <div class="p-4 rounded-[20px] bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex items-start justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-11 h-11 rounded-2xl bg-primary-container/10 text-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div class="flex flex-col min-w-0">
              <h4 class="font-title-md text-[15px] font-semibold text-on-surface text-wrap-safe leading-tight mb-0.5">
                ${escapeHtml(q.title)}
              </h4>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-caption text-xs text-on-surface-variant">
                <span>${q.totalQuestions} câu</span>
                <span>•</span>
                <span class="text-tertiary font-semibold">Cao nhất: ${highScoreStr}</span>
                <span>•</span>
                <span>${dateStr}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button title="Làm đề này" class="p-2.5 rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all active:scale-95 shadow-sm" onclick="window.quizApp.loadQuizFromData('${q.id}')">
              <span class="material-symbols-outlined text-[20px]">play_arrow</span>
            </button>
            <button title="Xóa đề" class="p-2.5 rounded-xl bg-surface-container text-outline hover:text-error hover:bg-red-50 transition-all active:scale-95" onclick="window.quizApp.deleteQuiz('${q.id}')">
              <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // RENDER TAB HỘP CÂU SAI (MISTAKES TAB)
  // =========================================================================

  async loadMistakesTab() {
    const listEl = document.getElementById('mistakes-list');
    const headerEl = document.getElementById('mistakes-header-count');
    const practiceBtn = document.getElementById('btn-practice-mistakes');
    if (!listEl) return;

    const mistakes = await this.db.getAllMistakes();

    if (headerEl) headerEl.textContent = `(${mistakes.length} câu)`;
    if (practiceBtn) {
      practiceBtn.disabled = mistakes.length === 0;
      practiceBtn.classList.toggle('opacity-50', mistakes.length === 0);
    }

    if (mistakes.length === 0) {
      listEl.innerHTML = `
        <div class="p-10 text-center text-on-surface-variant rounded-2xl bg-surface-container-low flex flex-col items-center">
          <span class="material-symbols-outlined text-[48px] text-tertiary mb-2">verified</span>
          <p class="font-title-md font-semibold text-on-surface mb-1">Hộp câu sai trống!</p>
          <p class="font-body-md text-sm text-outline">Tuyệt vời! Bạn chưa có câu làm sai nào được lưu, hoặc đã giải quyết hết các câu khó.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = mistakes.map((m, idx) => {
      return `
        <div class="p-4 rounded-[20px] bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col gap-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-mono-metric text-xs font-bold text-error">CÂU SAI #${idx + 1}</span>
            <span class="font-caption text-xs text-outline text-right text-wrap-safe">${escapeHtml(m.quizTitle)}</span>
          </div>
          <p class="font-body-md text-on-surface text-[14px] font-medium leading-relaxed">
            ${escapeHtml(m.text)}
          </p>
          <div class="p-3 rounded-xl bg-surface-container-low text-xs flex flex-col gap-1">
            <div class="text-error font-medium">Bạn đã chọn: ${escapeHtml(m.userAnswer) || 'Chưa chọn'}</div>
            <div class="text-tertiary font-medium">Đáp án đúng: ${escapeHtml(m.correctAnswer)}</div>
            ${m.explanation ? `<div class="text-slate-600 mt-1 italic">${escapeHtml(m.explanation)}</div>` : ''}
          </div>
          <div class="flex justify-end pt-1">
            <button class="px-3 py-1.5 rounded-lg text-xs font-medium text-tertiary bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 transition-all" onclick="window.quizApp.resolveMistake('${m.id}')">
              <span class="material-symbols-outlined text-[16px]">done</span> Đã thuộc câu này
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Hỗ trợ cả môi trường Browser và Node.js
if (typeof window !== 'undefined') {
  window.UIRouter = UIRouter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIRouter;
}
