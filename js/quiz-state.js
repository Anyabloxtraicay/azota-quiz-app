/**
 * Azota Quiz Master - Quiz State Manager
 * Quản lý trạng thái bài thi, đếm giờ, chấm điểm, đảo đề và session recovery
 */

const STORAGE_SESSION_KEY = 'azota_quiz_active_session_v2';

class QuizStateManager {
  constructor() {
    this.originalQuiz = null;
    this.activeQuiz = null;
    this.mode = 'practice'; // 'practice' | 'exam'
    this.currentQuestionIndex = 0;
    this.answers = {};      // { [questionId]: 'A' | 'B' | 'C' | 'D' }
    this.flagged = {};      // { [questionId]: boolean }
    this.timeLeft = 0;      // Giây còn lại
    this.timeLimit = 30;    // Phút
    this.startedAt = null;
    this.finishedAt = null;
    this.isFinished = false;

    this.options = {
      timeLimit: 30,
      shuffleQuestions: false,
      shuffleOptions: false
    };

    this.timerInterval = null;
    this.onTimerTick = null;       // (secondsLeft, isWarning) => void
    this.onTimerExpired = null;    // () => void
    this.onStateChange = null;     // (state) => void
  }

  /**
   * Khởi tạo bài thi mới từ dữ liệu đã parse
   * @param {Object} quizData 
   * @param {Object} options 
   * @param {string} mode 
   */
  initQuiz(quizData, options = {}, mode = 'practice') {
    this.stopTimer();

    this.originalQuiz = JSON.parse(JSON.stringify(quizData));
    this.mode = mode || 'practice';
    this.options = {
      timeLimit: options.timeLimit || 30,
      shuffleQuestions: !!options.shuffleQuestions,
      shuffleOptions: !!options.shuffleOptions
    };

    this.timeLimit = this.options.timeLimit;
    this.timeLeft = this.timeLimit * 60;
    this.currentQuestionIndex = 0;
    this.answers = {};
    this.flagged = {};
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;
    this.isFinished = false;

    // Chuẩn bị active quiz (áp dụng xáo câu / xáo phương án nếu được bật)
    this.activeQuiz = this.createActiveQuiz(this.originalQuiz, this.options);

    this.saveSession();
    this.emitChange();

    if (this.mode === 'exam') {
      this.startTimer();
    }
  }

  /**
   * Tạo bản sao đề thi và xáo trộn (nếu cấu hình)
   */
  createActiveQuiz(quiz, { shuffleQuestions, shuffleOptions }) {
    const clone = JSON.parse(JSON.stringify(quiz));

    if (shuffleQuestions) {
      this.shuffleArray(clone.questions);
      // Gán lại số thứ tự hiển thị displayIndex
      clone.questions.forEach((q, idx) => {
        q.displayNumber = idx + 1;
      });
    } else {
      clone.questions.forEach((q, idx) => {
        q.displayNumber = q.number || (idx + 1);
      });
    }

    if (shuffleOptions) {
      clone.questions.forEach(q => {
        if (q.options && q.options.length > 1) {
          // Lưu key ban đầu của phương án đúng
          const correctKey = q.correctAnswer;
          const correctOpt = q.options.find(o => o.key === correctKey);

          this.shuffleArray(q.options);

          // Gán lại key chuẩn A, B, C, D theo thứ tự mới
          const keys = ['A', 'B', 'C', 'D', 'E', 'F'];
          q.options.forEach((opt, idx) => {
            opt.oldKey = opt.key;
            opt.key = keys[idx] || String.fromCharCode(65 + idx);
          });

          // Cập nhật lại đáp án đúng sang key mới
          if (correctOpt) {
            q.correctAnswer = correctOpt.key;
          }
        }
      });
    }

    return clone;
  }

  /**
   * Thuật toán Fisher-Yates Shuffle
   */
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Bắt đầu đếm ngược thời gian (Chế độ thi thử)
   */
  startTimer() {
    this.stopTimer();
    if (this.timeLeft <= 0) return;

    const totalSeconds = this.timeLimit * 60;

    this.timerInterval = setInterval(() => {
      this.timeLeft--;

      const isWarning = (this.timeLeft / totalSeconds) <= 0.15; // Dưới 15% thời gian

      if (typeof this.onTimerTick === 'function') {
        this.onTimerTick(this.timeLeft, isWarning);
      }

      // Lưu định kỳ mỗi 5s
      if (this.timeLeft % 5 === 0) {
        this.saveSession();
      }

      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.timeLeft = 0;
        if (typeof this.onTimerExpired === 'function') {
          this.onTimerExpired();
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Chọn hoặc bỏ chọn đáp án cho câu hỏi
   * @param {string|number} qId 
   * @param {string} optionKey 
   */
  selectAnswer(qId, optionKey) {
    if (this.isFinished) return;

    if (this.answers[qId] === optionKey) {
      // Bỏ chọn nếu click lại (chỉ trong chế độ thi thử)
      if (this.mode === 'exam') {
        delete this.answers[qId];
      }
    } else {
      this.answers[qId] = optionKey;
    }

    this.saveSession();
    this.emitChange();
  }

  /**
   * Bật/tắt cờ đánh dấu câu hỏi cần xem lại
   * @param {string|number} qId 
   */
  toggleFlag(qId) {
    this.flagged[qId] = !this.flagged[qId];
    this.saveSession();
    this.emitChange();
  }

  /**
   * Điều hướng câu hỏi
   */
  goToQuestion(index) {
    if (!this.activeQuiz || !this.activeQuiz.questions) return;
    if (index >= 0 && index < this.activeQuiz.questions.length) {
      this.currentQuestionIndex = index;
      this.saveSession();
      this.emitChange();
    }
  }

  nextQuestion() {
    if (!this.activeQuiz) return;
    if (this.currentQuestionIndex < this.activeQuiz.questions.length - 1) {
      this.goToQuestion(this.currentQuestionIndex + 1);
    }
  }

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.goToQuestion(this.currentQuestionIndex - 1);
    }
  }

  /**
   * Chấm điểm và tổng kết kết quả bài thi
   * @returns {Object}
   */
  calculateScore() {
    if (!this.activeQuiz || !this.activeQuiz.questions) {
      return null;
    }

    const totalQuestions = this.activeQuiz.questions.length;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const details = this.activeQuiz.questions.map((q, idx) => {
      const userAns = this.answers[q.id] || null;
      const correctAns = q.correctAnswer || null;
      const isCorrect = !!(userAns && correctAns && userAns === correctAns);
      const isSkipped = !userAns;

      if (isSkipped) {
        skippedCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      return {
        id: q.id,
        number: q.displayNumber || (idx + 1),
        text: q.text,
        options: q.options,
        userAnswer: userAns,
        correctAnswer: correctAns,
        isCorrect: isCorrect,
        isSkipped: isSkipped,
        isFlagged: !!this.flagged[q.id],
        explanation: q.explanation || ''
      };
    });

    // Điểm theo thang điểm 10
    const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;
    const score = Math.round(rawScore * 10) / 10;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Thời gian làm bài
    const startMs = this.startedAt ? new Date(this.startedAt).getTime() : Date.now();
    const endMs = this.finishedAt ? new Date(this.finishedAt).getTime() : Date.now();
    const durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));

    return {
      quizId: this.activeQuiz.id,
      title: this.activeQuiz.title,
      score: score,
      correctCount: correctCount,
      incorrectCount: incorrectCount,
      skippedCount: skippedCount,
      totalQuestions: totalQuestions,
      percentage: percentage,
      durationSeconds: durationSeconds,
      mode: this.mode,
      submittedAt: new Date().toISOString(),
      details: details
    };
  }

  /**
   * Nộp bài hoàn tất
   */
  finishQuiz() {
    this.stopTimer();
    this.isFinished = true;
    this.finishedAt = new Date().toISOString();
    const result = this.calculateScore();
    this.clearSession();
    this.emitChange();
    return result;
  }

  /**
   * Lưu session vào localStorage để khôi phục khi reload
   */
  saveSession() {
    if (typeof localStorage === 'undefined' || !this.activeQuiz) return;
    try {
      const sessionData = {
        originalQuiz: this.originalQuiz,
        activeQuiz: this.activeQuiz,
        mode: this.mode,
        options: this.options,
        currentQuestionIndex: this.currentQuestionIndex,
        answers: this.answers,
        flagged: this.flagged,
        timeLeft: this.timeLeft,
        timeLimit: this.timeLimit,
        startedAt: this.startedAt,
        isFinished: this.isFinished,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Không thể lưu session vào localStorage:', e);
    }
  }

  /**
   * Kiểm tra có session trước đó không
   */
  static loadSavedSession() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      // Hết hạn sau 24h
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  /**
   * Khôi phục session
   */
  restoreSession(sessionData) {
    this.originalQuiz = sessionData.originalQuiz;
    this.activeQuiz = sessionData.activeQuiz;
    this.mode = sessionData.mode || 'practice';
    this.options = sessionData.options || { timeLimit: 30 };
    this.currentQuestionIndex = sessionData.currentQuestionIndex || 0;
    this.answers = sessionData.answers || {};
    this.flagged = sessionData.flagged || {};
    this.timeLeft = sessionData.timeLeft || 0;
    this.timeLimit = sessionData.timeLimit || 30;
    this.startedAt = sessionData.startedAt;
    this.isFinished = !!sessionData.isFinished;

    if (this.mode === 'exam' && !this.isFinished && this.timeLeft > 0) {
      this.startTimer();
    }
    this.emitChange();
  }

  clearSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {}
  }

  emitChange() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        currentQuestionIndex: this.currentQuestionIndex,
        answers: this.answers,
        flagged: this.flagged,
        isFinished: this.isFinished,
        mode: this.mode
      });
    }
  }
}

// Hỗ trợ cả môi trường Browser và Node.js
if (typeof window !== 'undefined') {
  window.QuizStateManager = QuizStateManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuizStateManager;
}
