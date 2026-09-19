/**
 * Azota Quiz Master - Application Entry Point & Glue Code
 * Kết nối Parser, State Manager, History Database và UI Router
 */

// Đề thi mẫu chuẩn bị sẵn để người dùng test ngay không cần tải file
const DEFAULT_SAMPLE_QUIZ = {
  id: 'sample_quiz_azota_01',
  title: 'Đề Thi Thử Tốt Nghiệp THPT - Tổng Hợp Kiến Thức',
  totalQuestions: 6,
  createdAt: new Date().toISOString(),
  questions: [
    {
      id: 1,
      number: 1,
      displayNumber: 1,
      text: 'Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là thành phố nào sau đây?',
      options: [
        { key: 'A', text: 'Thành phố Hồ Chí Minh' },
        { key: 'B', text: 'Hà Nội' },
        { key: 'C', text: 'Đà Nẵng' },
        { key: 'D', text: 'Hải Phòng' }
      ],
      correctAnswer: 'B',
      explanation: 'Hà Nội là thủ đô của nước CHXHCN Việt Nam từ năm 1976 đến nay, là trung tâm chính trị, văn hóa và kinh tế quan trọng.'
    },
    {
      id: 2,
      number: 2,
      displayNumber: 2,
      text: 'Hành tinh nào nằm gần Mặt Trời nhất trong Hệ Mặt Trời của chúng ta?',
      options: [
        { key: 'A', text: 'Sao Kim (Venus)' },
        { key: 'B', text: 'Sao Thủy (Mercury)' },
        { key: 'C', text: 'Sao Hỏa (Mars)' },
        { key: 'D', text: 'Trái Đất (Earth)' }
      ],
      correctAnswer: 'B',
      explanation: 'Sao Thủy (Mercury) là hành tinh gần Mặt Trời nhất trong Hệ Mặt Trời, với khoảng cách trung bình khoảng 58 triệu km.'
    },
    {
      id: 3,
      number: 3,
      displayNumber: 3,
      text: 'Chiến thắng Điện Biên Phủ "lừng lẫy năm châu, chấn động địa cầu" diễn ra vào năm nào?',
      options: [
        { key: 'A', text: 'Năm 1945' },
        { key: 'B', text: 'Năm 1954' },
        { key: 'C', text: 'Năm 1975' },
        { key: 'D', text: 'Năm 1968' }
      ],
      correctAnswer: 'B',
      explanation: 'Chiến dịch Điện Biên Phủ toàn thắng vào ngày 7 tháng 5 năm 1954, kết thúc 9 năm kháng chiến chống thực dân Pháp.'
    },
    {
      id: 4,
      number: 4,
      displayNumber: 4,
      text: 'Khí nào sau đây chiếm tỉ lệ phần trăm thể tích lớn nhất trong bầu khí quyển của Trái Đất?',
      options: [
        { key: 'A', text: 'Khí Ô-xy (O₂)' },
        { key: 'B', text: 'Khí Ni-tơ (N₂)' },
        { key: 'C', text: 'Khí Cacbonic (CO₂)' },
        { key: 'D', text: 'Khí Argon (Ar)' }
      ],
      correctAnswer: 'B',
      explanation: 'Khí Ni-tơ chiếm khoảng 78.08% thể tích không khí Trái Đất, kế tiếp là Ô-xy chiếm khoảng 20.95%.'
    },
    {
      id: 5,
      number: 5,
      displayNumber: 5,
      text: 'Dãy núi nào được mệnh danh là "nóc nhà của thế giới" với đỉnh Everest hùng vĩ?',
      options: [
        { key: 'A', text: 'Dãy Andes' },
        { key: 'B', text: 'Dãy Alps' },
        { key: 'C', text: 'Dãy Himalaya' },
        { key: 'D', text: 'Dãy Rocky' }
      ],
      correctAnswer: 'C',
      explanation: 'Dãy Himalaya nằm ở châu Á, có đỉnh Everest cao 8.848m so với mực nước biển, là đỉnh núi cao nhất hành tinh.'
    },
    {
      id: 6,
      number: 6,
      displayNumber: 6,
      text: 'Trong bảng tuần hoàn hóa học, nguyên tố có ký hiệu "Au" là nguyên tố nào?',
      options: [
        { key: 'A', text: 'Bạc (Silver)' },
        { key: 'B', text: 'Đồng (Copper)' },
        { key: 'C', text: 'Vàng (Gold)' },
        { key: 'D', text: 'Nhôm (Aluminium)' }
      ],
      correctAnswer: 'C',
      explanation: 'Au bắt nguồn từ tiếng Latin "Aurum", có nghĩa là Vàng trong bảng tuần hoàn các nguyên tố hóa học.'
    }
  ]
};

class App {
  constructor() {
    this.state = new QuizStateManager();
    this.db = new HistoryDatabase();
    this.router = new UIRouter(this.state, this.db);

    this.selectedMode = 'practice';
    this.selectedTimeLimit = 30;
    this.shuffleQuestions = false;
    this.shuffleOptions = false;

    this.loadedQuizData = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupTimerCallbacks();
    this.checkResumeSession();

    // Kiểm tra cập nhật phiên bản mới sau 2 giây (không chặn UI)
    setTimeout(() => {
      this.updater = new AppUpdater();
      this.updater.checkForUpdates();
    }, 2000);
  }

  // =========================================================================
  // GẮN SỰ KIỆN GIAO DIỆN
  // =========================================================================

  bindEvents() {
    // 1. Bottom Navigation Tabs
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.router.switchTab(tab);
      });
    });

    // 2. Chọn chế độ thi (Luyện tập vs Thi thử)
    const modePractice = document.getElementById('mode-practice');
    const modeExam = document.getElementById('mode-exam');

    if (modePractice && modeExam) {
      modePractice.addEventListener('click', () => this.setMode('practice'));
      modeExam.addEventListener('click', () => this.setMode('exam'));
    }

    // 3. Chọn thời gian thi
    document.querySelectorAll('.time-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.time-pill').forEach(p => {
          p.className = 'time-pill py-2 text-center rounded-xl font-caption text-caption text-on-surface-variant font-medium transition-all';
        });
        pill.className = 'time-pill py-2 text-center rounded-xl bg-surface-container-lowest text-primary-container font-caption text-caption font-semibold shadow-sm transition-all';
        this.selectedTimeLimit = parseInt(pill.getAttribute('data-minutes') || '30', 10);
      });
    });

    // 4. Công tắc đảo câu hỏi và đáp án
    const switchShuffleQ = document.getElementById('switch-shuffle-questions');
    const switchShuffleOpt = document.getElementById('switch-shuffle-options');

    if (switchShuffleQ) {
      switchShuffleQ.addEventListener('click', () => {
        this.shuffleQuestions = this.toggleSwitchUI(switchShuffleQ);
      });
    }

    if (switchShuffleOpt) {
      switchShuffleOpt.addEventListener('click', () => {
        this.shuffleOptions = this.toggleSwitchUI(switchShuffleOpt);
      });
    }

    // 5. Nút Thử Đề Mẫu
    const btnSample = document.getElementById('btn-sample-quiz');
    if (btnSample) {
      btnSample.addEventListener('click', () => {
        this.loadedQuizData = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_QUIZ));
        this.showToast(`Đã nạp "${this.loadedQuizData.title}" (${this.loadedQuizData.totalQuestions} câu)`);
        this.updateReadyBanner();
      });
    }

    // 6. Xử lý File Input & Dropzone
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');
    const btnBrowse = document.getElementById('btn-browse-file');

    if (btnBrowse) {
      btnBrowse.addEventListener('click', () => this.triggerFilePicker());
    }
    if (dropzone) {
      dropzone.addEventListener('click', (e) => {
        if (e.target !== btnBrowse) this.triggerFilePicker();
      });
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-primary-container', 'bg-blue-50/50');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-primary-container', 'bg-blue-50/50');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-primary-container', 'bg-blue-50/50');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileSelected(e.target.files[0]);
        }
      });
    }

    // 7. Nút Bắt Đầu Làm Bài
    const btnStart = document.getElementById('btn-start-quiz');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.startQuiz());
    }

    // 8. Điều khiển trong phòng thi dạng cuộn dọc
    const btnSubmit = document.getElementById('btn-quiz-submit');
    const btnBack = document.getElementById('btn-quiz-back');
    const btnShuffle = document.getElementById('btn-quiz-shuffle');
    const btnMatrixToggle = document.getElementById('btn-quiz-matrix-toggle');
    const btnMatrixClose = document.getElementById('btn-question-matrix-close');
    const matrixBackdrop = document.getElementById('btn-question-matrix-backdrop');
    const questionStream = document.getElementById('quiz-question-stream');
    const matrixGrid = document.getElementById('question-matrix-grid');

    if (btnSubmit) btnSubmit.addEventListener('click', () => this.confirmSubmitQuiz());

    if (btnBack) btnBack.addEventListener('click', () => this.confirmExitQuiz());

    if (btnMatrixToggle) btnMatrixToggle.addEventListener('click', () => this.router.openQuestionMatrix());
    if (btnMatrixClose) btnMatrixClose.addEventListener('click', () => this.router.closeQuestionMatrix());
    if (matrixBackdrop) matrixBackdrop.addEventListener('click', () => this.router.closeQuestionMatrix());

    if (questionStream) {
      questionStream.addEventListener('click', (event) => {
        const card = event.target.closest('[data-question-index]');
        if (!card) return;

        const index = Number(card.dataset.questionIndex);
        if (!Number.isInteger(index)) return;

        const flagButton = event.target.closest('[data-quiz-action="toggle-flag"]');
        if (flagButton) {
          this.toggleQuestionFlag(index);
          return;
        }

        const optionButton = event.target.closest('[data-option-key]');
        if (optionButton) this.selectAnswerAtIndex(index, optionButton.dataset.optionKey);
      });
    }

    if (matrixGrid) {
      matrixGrid.addEventListener('click', (event) => {
        const matrixButton = event.target.closest('[data-matrix-index]');
        if (!matrixButton) return;
        this.goToQuestion(Number(matrixButton.dataset.matrixIndex));
      });
    }

    if (btnShuffle) btnShuffle.addEventListener('click', () => {
      this.restartCurrentQuiz({
        shuffleQuestions: true,
        shuffleOptions: true,
        confirmMessage: 'Đảo đề sẽ xóa toàn bộ đáp án và cờ đã đánh dấu để bắt đầu lại. Bạn có muốn tiếp tục?'
      });
    });

    // 9. Nút trên màn hình kết quả
    const btnRetake = document.getElementById('btn-result-retake');
    const btnShuffleRetake = document.getElementById('btn-result-shuffle-retake');
    const btnHome = document.getElementById('btn-result-home');
    const btnReviewFilterAll = document.getElementById('filter-review-all');
    const btnReviewFilterWrong = document.getElementById('filter-review-wrong');
    const btnReviewFilterFlagged = document.getElementById('filter-review-flagged');

    if (btnRetake) btnRetake.addEventListener('click', () => this.restartCurrentQuiz());

    if (btnShuffleRetake) btnShuffleRetake.addEventListener('click', () => {
      this.restartCurrentQuiz({ shuffleQuestions: true, shuffleOptions: true });
    });

    if (btnHome) btnHome.addEventListener('click', () => {
      this.router.switchTab('study');
    });

    if (btnReviewFilterAll && btnReviewFilterWrong && btnReviewFilterFlagged) {
      const updateFilterBtns = (activeBtn) => {
        [btnReviewFilterAll, btnReviewFilterWrong, btnReviewFilterFlagged].forEach(b => {
          b.className = 'px-3.5 py-1.5 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant transition-all';
        });
        activeBtn.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary-container text-on-primary shadow-sm transition-all';
      };

      btnReviewFilterAll.addEventListener('click', () => {
        this.router.reviewFilter = 'all';
        updateFilterBtns(btnReviewFilterAll);
        if (this.lastResult) this.router.renderReviewList(this.lastResult.details);
      });

      btnReviewFilterWrong.addEventListener('click', () => {
        this.router.reviewFilter = 'wrong';
        updateFilterBtns(btnReviewFilterWrong);
        if (this.lastResult) this.router.renderReviewList(this.lastResult.details);
      });

      btnReviewFilterFlagged.addEventListener('click', () => {
        this.router.reviewFilter = 'flagged';
        updateFilterBtns(btnReviewFilterFlagged);
        if (this.lastResult) this.router.renderReviewList(this.lastResult.details);
      });
    }

    // 10. Nút Luyện lại câu sai ở Tab Mistakes
    const btnPracticeMistakes = document.getElementById('btn-practice-mistakes');
    if (btnPracticeMistakes) {
      btnPracticeMistakes.addEventListener('click', async () => {
        try {
          const mistakeQuiz = await this.db.createMistakePracticeQuiz(20);
          this.loadedQuizData = mistakeQuiz;
          this.selectedMode = 'practice'; // Mặc định luyện tập cho câu sai
          this.startQuiz();
        } catch (e) {
          alert(e.message);
        }
      });
    }

    // 11. Phím tắt bàn phím
    this.setupKeyboardShortcuts();
  }

  // =========================================================================
  // XỬ LÝ CHỌN FILE (HỖ TRỢ WEB VÀ CAPACITOR NATIVE)
  // =========================================================================

  async triggerFilePicker() {
    // Kiểm tra nếu chạy trong môi trường Capacitor Android Native có plugin FilePicker
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FilePicker) {
      try {
        const result = await window.Capacitor.Plugins.FilePicker.pickFiles({
          types: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
          multiple: false,
          readData: true
        });

        if (result && result.files && result.files.length > 0) {
          const fileInfo = result.files[0];
          // Chuyển base64 sang ArrayBuffer
          const binaryString = atob(fileInfo.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await this.parseArrayBuffer(bytes.buffer, fileInfo.name);
          return;
        }
      } catch (err) {
        console.warn('Lỗi gọi Capacitor FilePicker native, chuyển sang fallback input thông thường:', err);
      }
    }

    // Fallback chuẩn HTML5 cho trình duyệt và WebView
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  async handleFileSelected(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Vui lòng chọn file Word định dạng .docx (Word 2007 trở lên)');
      return;
    }

    this.showLoading('Đang phân tích đề thi từ file Word...');

    try {
      const quizData = await QuizParser.parseDocxFile(file, file.name);
      this.loadedQuizData = quizData;
      this.hideLoading();
      this.showToast(`Đã nhận diện ${quizData.totalQuestions} câu hỏi từ "${file.name}"`);
      this.updateReadyBanner();
    } catch (err) {
      this.hideLoading();
      alert('Lỗi phân tích file: ' + err.message);
    }
  }

  async parseArrayBuffer(arrayBuffer, fileName) {
    this.showLoading('Đang phân tích file...');
    try {
      const quizData = await QuizParser.parseDocxFile(arrayBuffer, fileName);
      this.loadedQuizData = quizData;
      this.hideLoading();
      this.showToast(`Đã nhận diện ${quizData.totalQuestions} câu hỏi từ "${fileName}"`);
      this.updateReadyBanner();
    } catch (err) {
      this.hideLoading();
      alert('Lỗi phân tích file: ' + err.message);
    }
  }

  // =========================================================================
  // BẮT ĐẦU & ĐIỀU KHIỂN BÀI THI
  // =========================================================================

  startQuiz() {
    if (!this.loadedQuizData) {
      // Nếu chưa nạp file nào, tự động dùng đề mẫu
      this.loadedQuizData = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_QUIZ));
    }

    const options = {
      timeLimit: this.selectedTimeLimit,
      shuffleQuestions: this.shuffleQuestions,
      shuffleOptions: this.shuffleOptions
    };

    this.state.initQuiz(this.loadedQuizData, options, this.selectedMode);
    this.router.switchView('quiz');
    this.router.renderQuizScreen();
  }

  restartCurrentQuiz({ shuffleQuestions, shuffleOptions, confirmMessage } = {}) {
    if (!this.state.originalQuiz) return;

    if (confirmMessage && !window.confirm(confirmMessage)) return;

    const restarted = this.state.restartQuiz({
      timeLimit: this.state.timeLimit,
      shuffleQuestions: typeof shuffleQuestions === 'boolean'
        ? shuffleQuestions
        : this.state.options.shuffleQuestions,
      shuffleOptions: typeof shuffleOptions === 'boolean'
        ? shuffleOptions
        : this.state.options.shuffleOptions
    });

    if (!restarted) return;

    this.loadedQuizData = this.state.originalQuiz;
    this.router.switchView('quiz');
    this.router.renderQuizScreen();
    this.showToast(shuffleQuestions || shuffleOptions ? 'Đã đảo đề và bắt đầu lại từ câu 1' : 'Đã làm lại đề từ câu 1');
  }

  selectAnswer(qId, key) {
    const index = this.state.activeQuiz?.questions.findIndex(question => String(question.id) === String(qId));
    if (index >= 0) this.selectAnswerAtIndex(index, key);
  }

  selectAnswerAtIndex(index, key) {
    const question = this.state.activeQuiz?.questions[index];
    if (!question) return;

    this.state.goToQuestion(index);
    this.state.selectAnswer(question.id, key);
    this.router.updateQuestionCard(index);
  }

  toggleQuestionFlag(index) {
    const question = this.state.activeQuiz?.questions[index];
    if (!question) return;

    this.state.goToQuestion(index);
    this.state.toggleFlag(question.id);
    this.router.updateQuestionCard(index);
  }

  goToQuestion(idx) {
    if (!Number.isInteger(idx)) return;
    this.state.goToQuestion(idx);
    this.router.refreshQuizStatus();
    this.router.closeQuestionMatrix();
    requestAnimationFrame(() => this.router.scrollToQuestion(idx));
  }

  confirmSubmitQuiz() {
    const total = this.state.activeQuiz.questions.length;
    const answered = Object.keys(this.state.answers).length;
    const unanswered = total - answered;

    let msg = 'Bạn có chắc chắn muốn nộp bài?';
    if (unanswered > 0) {
      msg = `Bạn còn ${unanswered} câu chưa làm. Bạn có chắc chắn muốn nộp bài sớm không?`;
    }

    if (confirm(msg)) {
      this.submitQuiz();
    }
  }

  async submitQuiz() {
    const result = this.state.finishQuiz();
    this.lastResult = result;

    // Lưu vào Kho Đề và Hộp Câu Sai
    await this.db.saveQuiz(this.state.originalQuiz, result);
    await this.db.saveMistakes(result.title, result.details);

    // Kích hoạt pháo hoa ăn mừng nếu điểm cao (>= 8.0)
    if (result.score >= 8.0 && typeof confetti === 'function') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }

    this.router.switchView('result');
    this.router.renderResultScreen(result);
  }

  confirmExitQuiz() {
    if (confirm('Bạn có muốn tạm dừng và lưu lại bài thi để làm sau?')) {
      this.state.stopTimer();
      this.state.saveSession();
      this.router.switchTab('study');
    }
  }

  // =========================================================================
  // XỬ LÝ KHÔI PHỤC PHIÊN LÀM BÀI (SESSION RESUME)
  // =========================================================================

  checkResumeSession() {
    const saved = QuizStateManager.loadSavedSession();
    if (saved && !saved.isFinished && saved.activeQuiz) {
      const banner = document.getElementById('resume-session-banner');
      if (banner) {
        banner.classList.remove('hidden');
        const resumeBtn = document.getElementById('btn-resume-session');
        const discardBtn = document.getElementById('btn-discard-session');

        if (resumeBtn) {
          resumeBtn.onclick = () => {
            banner.classList.add('hidden');
            this.state.restoreSession(saved);
            this.router.switchView('quiz');
            this.router.renderQuizScreen();
          };
        }

        if (discardBtn) {
          discardBtn.onclick = () => {
            banner.classList.add('hidden');
            this.state.clearSession();
          };
        }
      }
    }
  }

  // =========================================================================
  // KHO ĐỀ & HỘP CÂU SAI
  // =========================================================================

  async loadQuizFromData(quizId) {
    const quizzes = await this.db.getAllQuizzes();
    const found = quizzes.find(q => q.id === quizId);
    if (found && found.quizData) {
      this.loadedQuizData = found.quizData;
      this.router.switchTab('study');
      this.updateReadyBanner();
      this.showToast(`Đã nạp đề: ${found.title}`);
    }
  }

  async deleteQuiz(quizId) {
    if (confirm('Bạn có chắc chắn muốn xóa đề thi này khỏi kho đề?')) {
      await this.db.deleteQuiz(quizId);
      this.router.loadLibraryTab();
      this.showToast('Đã xóa đề thi');
    }
  }

  async resolveMistake(mistakeId) {
    await this.db.deleteMistake(mistakeId);
    this.router.loadMistakesTab();
    this.showToast('Đã đánh dấu thuộc câu này!');
  }

  // =========================================================================
  // TIMER & UI HELPERS
  // =========================================================================

  setupTimerCallbacks() {
    const timerText = document.getElementById('quiz-timer-text');
    const timerPill = document.getElementById('quiz-timer-container');

    this.state.onTimerTick = (secondsLeft, isWarning) => {
      if (timerText) {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      if (timerPill) {
        if (isWarning) {
          timerPill.className = 'px-2.5 py-1 rounded-full bg-red-100 border border-red-300 text-error flex items-center gap-1.5 shadow-sm animate-pulse';
        } else {
          timerPill.className = 'px-2.5 py-1 rounded-full bg-surface-container/80 flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';
        }
      }
    };

    this.state.onTimerExpired = () => {
      alert('Hết giờ làm bài! Hệ thống sẽ tự động nộp bài thi của bạn.');
      this.submitQuiz();
    };
  }

  setMode(mode) {
    this.selectedMode = mode;
    const pCard = document.getElementById('mode-practice');
    const eCard = document.getElementById('mode-exam');

    if (mode === 'practice') {
      pCard.classList.add('ring-2', 'ring-primary-container', 'shadow-[0_8px_24px_rgba(0,82,255,0.08)]');
      pCard.querySelector('.mode-radio-icon').className = 'mode-radio-icon w-5 h-5 rounded-full bg-primary-container flex items-center justify-center text-on-primary shrink-0 mt-0.5';
      eCard.classList.remove('ring-2', 'ring-primary-container', 'shadow-[0_8px_24px_rgba(0,82,255,0.08)]');
      eCard.querySelector('.mode-radio-icon').className = 'mode-radio-icon w-5 h-5 rounded-full bg-surface-container flex items-center justify-center text-transparent shrink-0 mt-0.5';
    } else {
      eCard.classList.add('ring-2', 'ring-primary-container', 'shadow-[0_8px_24px_rgba(0,82,255,0.08)]');
      eCard.querySelector('.mode-radio-icon').className = 'mode-radio-icon w-5 h-5 rounded-full bg-primary-container flex items-center justify-center text-on-primary shrink-0 mt-0.5';
      pCard.classList.remove('ring-2', 'ring-primary-container', 'shadow-[0_8px_24px_rgba(0,82,255,0.08)]');
      pCard.querySelector('.mode-radio-icon').className = 'mode-radio-icon w-5 h-5 rounded-full bg-surface-container flex items-center justify-center text-transparent shrink-0 mt-0.5';
    }
  }

  toggleSwitchUI(btn) {
    const isOff = btn.getAttribute('data-state') === 'off';
    const thumb = btn.firstElementChild;
    if (isOff) {
      btn.setAttribute('data-state', 'on');
      btn.classList.remove('bg-surface-container-highest');
      btn.classList.add('bg-primary-container');
      thumb.classList.remove('translate-x-0');
      thumb.classList.add('translate-x-5');
      return true;
    } else {
      btn.setAttribute('data-state', 'off');
      btn.classList.remove('bg-primary-container');
      btn.classList.add('bg-surface-container-highest');
      thumb.classList.remove('translate-x-5');
      thumb.classList.add('translate-x-0');
      return false;
    }
  }

  updateReadyBanner() {
    const banner = document.getElementById('ready-quiz-banner');
    const titleEl = document.getElementById('ready-quiz-title');
    const countEl = document.getElementById('ready-quiz-count');

    if (banner && this.loadedQuizData) {
      banner.classList.remove('hidden');
      if (titleEl) titleEl.textContent = this.loadedQuizData.title;
      if (countEl) countEl.textContent = `${this.loadedQuizData.totalQuestions} câu hỏi đã sẵn sàng`;
    }
  }

  setupTouchGestures() {
    let startX = 0;
    let startY = 0;
    const card = document.getElementById('active-question-swipe-zone');

    if (card) {
      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }, { passive: true });

      card.addEventListener('touchend', (e) => {
        const diffX = e.changedTouches[0].clientX - startX;
        const diffY = e.changedTouches[0].clientY - startY;

        // Vuốt ngang tối thiểu 50px và không phải cuộn dọc
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
          if (diffX < 0) {
            // Vuốt sang trái -> Câu tiếp theo
            this.state.nextQuestion();
            this.router.renderQuizScreen();
          } else {
            // Vuốt sang phải -> Câu trước
            this.state.prevQuestion();
            this.router.renderQuizScreen();
          }
        }
      }, { passive: true });
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (this.router.currentView !== 'quiz') return;

      if (e.key === 'Escape') {
        this.router.closeQuestionMatrix();
      } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const q = this.state.activeQuiz.questions[this.state.currentQuestionIndex];
        if (!q) return;

        let key = e.key.toUpperCase();
        if (key === '1') key = 'A';
        if (key === '2') key = 'B';
        if (key === '3') key = 'C';
        if (key === '4') key = 'D';

        this.selectAnswer(q.id, key);
      }
    });
  }

  showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'fixed top-20 inset-x-4 max-w-sm mx-auto z-50 p-3.5 rounded-2xl bg-[#0F172A]/90 text-white text-xs font-medium backdrop-blur-lg shadow-xl text-center transition-all opacity-0 pointer-events-none transform -translate-y-2';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-2');
    }, 3000);
  }

  showLoading(text) {
    let loader = document.getElementById('app-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'app-loader';
      loader.className = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4';
      loader.innerHTML = `
        <div class="p-6 rounded-[24px] bg-white text-slate-900 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center">
          <div class="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p id="app-loader-text" class="font-body-md text-sm font-semibold">${text}</p>
        </div>
      `;
      document.body.appendChild(loader);
    } else {
      document.getElementById('app-loader-text').textContent = text;
      loader.classList.remove('hidden');
    }
  }

  hideLoading() {
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.add('hidden');
  }
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.quizApp = new App();
});
