/**
 * Azota Quiz Master - UI Router & Screen Renderer
 * Điều hướng màn hình, tab và render giao diện Liquid Glass di động
 */

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

    // Modals
    this.matrixModal = document.getElementById('matrix-modal');
  }

  // =========================================================================
  // ĐIỀU HƯỚNG MÀN HÌNH (VIEWS)
  // =========================================================================

  switchView(viewName) {
    this.currentView = viewName;

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

    const currentQ = this.state.activeQuiz.questions[this.state.currentQuestionIndex];
    if (!currentQ) return;

    // 1. Cập nhật Header
    const titleEl = document.getElementById('quiz-header-title');
    const codeEl = document.getElementById('quiz-header-code');
    if (titleEl) titleEl.textContent = this.state.activeQuiz.title || 'Phòng Thi Trắc Nghiệm';
    if (codeEl) codeEl.textContent = `Câu ${this.state.currentQuestionIndex + 1} / ${this.state.activeQuiz.questions.length}`;

    // 2. Cập nhật Timer Pill
    const timerContainer = document.getElementById('quiz-timer-container');
    if (timerContainer) {
      if (this.state.mode === 'practice') {
        timerContainer.classList.add('hidden');
      } else {
        timerContainer.classList.remove('hidden');
      }
    }

    // 3. Cập nhật Progress Bar
    const answeredCount = Object.keys(this.state.answers).length;
    const totalQ = this.state.activeQuiz.questions.length;
    const percent = Math.round((answeredCount / totalQ) * 100);

    const progressText = document.getElementById('quiz-progress-text');
    const progressPercent = document.getElementById('quiz-progress-percent');
    const progressBar = document.getElementById('quiz-progress-bar');
    const headerProgress = document.getElementById('quiz-header-progress');

    if (progressText) progressText.textContent = `ĐÃ HOÀN THÀNH ${answeredCount}/${totalQ} CÂU`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (headerProgress) headerProgress.style.width = `${percent}%`;

    // 4. Cập nhật Ma trận câu hỏi vuốt ngang
    this.renderMatrixStrip();

    // 5. Cập nhật Thẻ Câu Hỏi
    this.renderQuestionCard(currentQ);

    // 6. Cập nhật Bottom Action Bar
    this.renderActionBar(currentQ);
  }

  /**
   * Render ma trận câu hỏi vuốt ngang
   */
  renderMatrixStrip() {
    const strip = document.getElementById('quiz-matrix-strip');
    if (!strip || !this.state.activeQuiz) return;

    const questions = this.state.activeQuiz.questions;
    const currentIndex = this.state.currentQuestionIndex;

    strip.innerHTML = questions.map((q, idx) => {
      const isCurrent = idx === currentIndex;
      const isAnswered = !!this.state.answers[q.id];
      const isFlagged = !!this.state.flagged[q.id];
      const numStr = (idx + 1).toString().padStart(2, '0');

      let btnClass = 'flex-shrink-0 w-9 h-9 rounded-xl font-mono-metric text-mono-metric font-semibold flex items-center justify-center transition-all active:scale-95 relative ';

      if (isCurrent) {
        btnClass += 'ring-2 ring-primary-container ring-offset-2 bg-primary text-on-primary shadow-md ';
      } else if (isAnswered) {
        btnClass += 'bg-primary-container text-on-primary shadow-[0_2px_6px_rgba(0,82,255,0.3)] ';
      } else {
        btnClass += 'bg-surface-container text-on-surface hover:bg-surface-container-high ';
      }

      let flagBadge = '';
      if (isFlagged) {
        flagBadge = `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#f97316] text-white flex items-center justify-center shadow-sm">
          <span class="material-symbols-outlined text-[9px]" style="font-variation-settings: 'FILL' 1;">flag</span>
        </span>`;
      }

      return `<button type="button" class="${btnClass}" onclick="window.quizApp.goToQuestion(${idx})">
        ${numStr}
        ${flagBadge}
      </button>`;
    }).join('');

    // Tự động cuộn đến nút đang chọn
    const activeBtn = strip.children[currentIndex];
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  /**
   * Render thẻ câu hỏi và các phương án A, B, C, D
   */
  renderQuestionCard(q) {
    const questionNum = document.getElementById('question-number-pill');
    const questionText = document.getElementById('question-content-text');
    const optionsList = document.getElementById('options-container');
    const explanationBox = document.getElementById('question-explanation-card');

    if (questionNum) questionNum.textContent = `CÂU ${q.displayNumber || (this.state.currentQuestionIndex + 1)}`;
    if (questionText) questionText.textContent = q.text || '';

    const userAnswer = this.state.answers[q.id];
    const isPracticeMode = this.state.mode === 'practice';
    const hasAnswered = !!userAnswer;

    if (optionsList) {
      optionsList.innerHTML = (q.options || []).map((opt) => {
        const isSelected = userAnswer === opt.key;
        const isCorrect = q.correctAnswer === opt.key;

        let cardClass = 'option-tile p-4 rounded-[20px] bg-white border-2 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] shadow-sm ';
        let letterBadgeClass = 'w-9 h-9 rounded-full flex items-center justify-center font-mono-metric font-semibold text-[15px] shrink-0 ';
        let trailingIcon = '';

        if (isPracticeMode && hasAnswered) {
          // Chế độ Luyện tập: Hiện ngay kết quả đúng / sai
          if (isCorrect) {
            cardClass += 'border-tertiary bg-[#F0FDF4] shadow-[0_4px_16px_rgba(16,185,129,0.15)] ';
            letterBadgeClass += 'bg-tertiary text-white ';
            trailingIcon = `<span class="material-symbols-outlined text-tertiary text-[24px]">check_circle</span>`;
          } else if (isSelected) {
            cardClass += 'border-error bg-[#FEF2F2] shadow-[0_4px_16px_rgba(220,38,38,0.12)] ';
            letterBadgeClass += 'bg-error text-white ';
            trailingIcon = `<span class="material-symbols-outlined text-error text-[24px]">cancel</span>`;
          } else {
            cardClass += 'border-slate-100 opacity-60 ';
            letterBadgeClass += 'bg-surface-container text-on-surface-variant ';
          }
        } else {
          // Chế độ Thi thử (hoặc Luyện tập khi chưa chọn)
          if (isSelected) {
            cardClass += 'border-primary-container bg-primary-container/5 ring-1 ring-primary-container shadow-[0_4px_16px_rgba(0,82,255,0.12)] ';
            letterBadgeClass += 'bg-primary-container text-white ';
            trailingIcon = `<span class="material-symbols-outlined text-primary-container text-[24px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>`;
          } else {
            cardClass += 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 ';
            letterBadgeClass += 'bg-surface-container text-on-surface-variant ';
          }
        }

        return `
          <div class="${cardClass}" onclick="window.quizApp.selectAnswer('${q.id}', '${opt.key}')">
            <div class="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
              <div class="${letterBadgeClass}">
                ${opt.key}
              </div>
              <span class="font-body-md text-on-surface text-[15px] leading-snug">
                ${opt.text}
              </span>
            </div>
            ${trailingIcon}
          </div>
        `;
      }).join('');
    }

    // Hiển thị giải thích ở chế độ Luyện tập sau khi đã chọn đáp án
    if (explanationBox) {
      if (isPracticeMode && hasAnswered) {
        explanationBox.classList.remove('hidden');
        const expContent = document.getElementById('explanation-text-content');
        if (expContent) {
          expContent.textContent = q.explanation || `Đáp án đúng là ${q.correctAnswer}. (Chưa có chú thích chi tiết cho câu này)`;
        }
      } else {
        explanationBox.classList.add('hidden');
      }
    }
  }

  /**
   * Render thanh điều hướng dưới đáy khi làm bài
   */
  renderActionBar(q) {
    const flagBtn = document.getElementById('btn-quiz-flag');
    const prevBtn = document.getElementById('btn-quiz-prev');
    const nextBtn = document.getElementById('btn-quiz-next');
    const submitBtn = document.getElementById('btn-quiz-submit');

    const isFlagged = !!this.state.flagged[q.id];
    if (flagBtn) {
      if (isFlagged) {
        flagBtn.className = 'w-12 h-12 rounded-2xl bg-[#ffedd5] text-[#ea580c] border border-[#fdba74] flex items-center justify-center transition-all';
        flagBtn.innerHTML = `<span class="material-symbols-outlined text-[24px]" style="font-variation-settings: 'FILL' 1;">flag</span>`;
      } else {
        flagBtn.className = 'w-12 h-12 rounded-2xl bg-surface-container text-on-surface-variant border border-outline-variant/30 flex items-center justify-center hover:bg-surface-container-high transition-all';
        flagBtn.innerHTML = `<span class="material-symbols-outlined text-[24px]">flag</span>`;
      }
    }

    const isFirst = this.state.currentQuestionIndex === 0;
    const isLast = this.state.currentQuestionIndex === this.state.activeQuiz.questions.length - 1;

    if (prevBtn) {
      prevBtn.disabled = isFirst;
      prevBtn.classList.toggle('opacity-40', isFirst);
    }

    if (nextBtn && submitBtn) {
      if (isLast) {
        nextBtn.classList.add('hidden');
        submitBtn.classList.remove('hidden');
      } else {
        nextBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
      }
    }
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
              <span>${opt.text}</span>
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
            ${d.text}
          </p>
          <div class="flex flex-col gap-2 mt-1">
            ${optionsHtml}
          </div>
          ${d.explanation ? `
            <div class="mt-2 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100/80 text-xs text-slate-700 leading-relaxed">
              <strong class="text-accent font-semibold flex items-center gap-1 mb-1">
                <span class="material-symbols-outlined text-[16px]">info</span> Lời giải chi tiết:
              </strong>
              ${d.explanation}
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
        <div class="p-4 rounded-[20px] bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex items-center justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-11 h-11 rounded-2xl bg-primary-container/10 text-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div class="flex flex-col min-w-0">
              <h4 class="font-title-md text-[15px] font-semibold text-on-surface truncate leading-tight mb-0.5">
                ${q.title}
              </h4>
              <div class="flex items-center gap-2 font-caption text-xs text-on-surface-variant">
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
          <div class="flex items-center justify-between">
            <span class="font-mono-metric text-xs font-bold text-error">CÂU SAI #${idx + 1}</span>
            <span class="font-caption text-xs text-outline">${m.quizTitle}</span>
          </div>
          <p class="font-body-md text-on-surface text-[14px] font-medium leading-relaxed">
            ${m.text}
          </p>
          <div class="p-3 rounded-xl bg-surface-container-low text-xs flex flex-col gap-1">
            <div class="text-error font-medium">Bạn đã chọn: ${m.userAnswer || 'Chưa chọn'}</div>
            <div class="text-tertiary font-medium">Đáp án đúng: ${m.correctAnswer}</div>
            ${m.explanation ? `<div class="text-slate-600 mt-1 italic">${m.explanation}</div>` : ''}
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
