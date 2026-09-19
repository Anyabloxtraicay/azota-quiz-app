/**
 * Azota Quiz Master - History & Mistakes Database
 * Quản lý Kho Đề Của Tôi & Hộp Câu Sai bằng IndexedDB (có Fallback tự động sang localStorage)
 */

const DB_NAME = 'azota_quiz_database_v2';
const DB_VERSION = 1;
const STORE_QUIZZES = 'quizzes';
const STORE_MISTAKES = 'mistakes';

const FALLBACK_QUIZZES_KEY = 'azota_fallback_quizzes_v2';
const FALLBACK_MISTAKES_KEY = 'azota_fallback_mistakes_v2';

class HistoryDatabase {
  constructor() {
    this.db = null;
    this.useFallback = false;
    this.isReadyPromise = this.init();
  }

  /**
   * Khởi tạo IndexedDB với cơ chế tự động Fallback
   */
  async init() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB không khả dụng. Chuyển sang dùng localStorage fallback.');
      this.useFallback = true;
      return true;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_QUIZZES)) {
            const quizStore = db.createObjectStore(STORE_QUIZZES, { keyPath: 'id' });
            quizStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_MISTAKES)) {
            const mistakeStore = db.createObjectStore(STORE_MISTAKES, { keyPath: 'id' });
            mistakeStore.createIndex('addedAt', 'addedAt', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.useFallback = false;
          resolve(true);
        };

        request.onerror = (event) => {
          console.warn('Lỗi mở IndexedDB, tự động kích hoạt localStorage Fallback:', event.target.error);
          this.useFallback = true;
          resolve(true);
        };
      } catch (err) {
        console.warn('Ngoại lệ khi mở IndexedDB, chuyển sang localStorage Fallback:', err);
        this.useFallback = true;
        resolve(true);
      }
    });
  }

  // =========================================================================
  // KHO ĐỀ CỦA TÔI (QUIZZES)
  // =========================================================================

  /**
   * Lưu hoặc cập nhật đề thi vào Kho Đề
   * @param {Object} quizData 
   * @param {Object} [result] 
   */
  async saveQuiz(quizData, result = null) {
    await this.isReadyPromise;

    const quizRecord = {
      id: quizData.id || ('quiz_' + Date.now()),
      title: quizData.title || 'Đề thi trắc nghiệm',
      totalQuestions: quizData.questions ? quizData.questions.length : 0,
      createdAt: quizData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAttempt: result ? {
        score: result.score,
        correctCount: result.correctCount,
        totalQuestions: result.totalQuestions,
        submittedAt: result.submittedAt,
        mode: result.mode
      } : null,
      quizData: quizData
    };

    if (this.useFallback) {
      const list = this._getFallbackList(FALLBACK_QUIZZES_KEY);
      const idx = list.findIndex(q => q.id === quizRecord.id);
      if (idx >= 0) {
        // Giữ lại điểm cao nhất nếu có
        if (list[idx].highScore !== undefined) {
          quizRecord.highScore = Math.max(list[idx].highScore, result ? result.score : 0);
        } else {
          quizRecord.highScore = result ? result.score : 0;
        }
        list[idx] = quizRecord;
      } else {
        quizRecord.highScore = result ? result.score : 0;
        list.unshift(quizRecord);
      }
      this._saveFallbackList(FALLBACK_QUIZZES_KEY, list);
      return quizRecord;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_QUIZZES], 'readwrite');
      const store = tx.objectStore(STORE_QUIZZES);

      const getReq = store.get(quizRecord.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          quizRecord.highScore = Math.max(existing.highScore || 0, result ? result.score : 0);
          quizRecord.attemptCount = (existing.attemptCount || 0) + (result ? 1 : 0);
        } else {
          quizRecord.highScore = result ? result.score : 0;
          quizRecord.attemptCount = result ? 1 : 0;
        }
        store.put(quizRecord);
      };

      tx.oncomplete = () => resolve(quizRecord);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Lấy toàn bộ danh sách Kho Đề
   */
  async getAllQuizzes() {
    await this.isReadyPromise;

    if (this.useFallback) {
      const list = this._getFallbackList(FALLBACK_QUIZZES_KEY);
      return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_QUIZZES], 'readonly');
      const store = tx.objectStore(STORE_QUIZZES);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        resolve(list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Xóa một đề khỏi Kho Đề
   */
  async deleteQuiz(quizId) {
    await this.isReadyPromise;

    if (this.useFallback) {
      let list = this._getFallbackList(FALLBACK_QUIZZES_KEY);
      list = list.filter(q => q.id !== quizId);
      this._saveFallbackList(FALLBACK_QUIZZES_KEY, list);
      return true;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_QUIZZES], 'readwrite');
      const store = tx.objectStore(STORE_QUIZZES);
      store.delete(quizId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  // =========================================================================
  // HỘP CÂU SAI (MISTAKE NOTEBOOK)
  // =========================================================================

  /**
   * Tự động lưu các câu làm sai sau khi nộp bài
   * @param {string} quizTitle 
   * @param {Array} details Danh sách chi tiết câu hỏi từ calculateScore()
   */
  async saveMistakes(quizTitle, details) {
    if (!details || !Array.isArray(details)) return;
    await this.isReadyPromise;

    const wrongItems = details.filter(item => !item.isCorrect && !item.isSkipped);
    if (wrongItems.length === 0) return;

    for (const item of wrongItems) {
      // Dùng hash đơn giản từ text câu hỏi để nhận diện trùng lặp
      const mistakeId = 'mistake_' + this._hashString(item.text);
      const record = {
        id: mistakeId,
        quizTitle: quizTitle || 'Đề trắc nghiệm',
        text: item.text,
        options: item.options,
        userAnswer: item.userAnswer,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation || '',
        addedAt: new Date().toISOString()
      };

      if (this.useFallback) {
        const list = this._getFallbackList(FALLBACK_MISTAKES_KEY);
        const idx = list.findIndex(m => m.id === mistakeId);
        if (idx >= 0) {
          list[idx] = record;
        } else {
          list.unshift(record);
        }
        this._saveFallbackList(FALLBACK_MISTAKES_KEY, list);
      } else {
        try {
          const tx = this.db.transaction([STORE_MISTAKES], 'readwrite');
          const store = tx.objectStore(STORE_MISTAKES);
          store.put(record);
        } catch (e) {}
      }
    }
  }

  /**
   * Lấy toàn bộ danh sách Hộp Câu Sai
   */
  async getAllMistakes() {
    await this.isReadyPromise;

    if (this.useFallback) {
      const list = this._getFallbackList(FALLBACK_MISTAKES_KEY);
      return list.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_MISTAKES], 'readonly');
      const store = tx.objectStore(STORE_MISTAKES);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        resolve(list.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)));
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Xóa một câu hỏi khỏi Hộp Câu Sai (khi đã học thuộc)
   */
  async deleteMistake(mistakeId) {
    await this.isReadyPromise;

    if (this.useFallback) {
      let list = this._getFallbackList(FALLBACK_MISTAKES_KEY);
      list = list.filter(m => m.id !== mistakeId);
      this._saveFallbackList(FALLBACK_MISTAKES_KEY, list);
      return true;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_MISTAKES], 'readwrite');
      const store = tx.objectStore(STORE_MISTAKES);
      store.delete(mistakeId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  /**
   * Xóa toàn bộ Hộp Câu Sai
   */
  async clearAllMistakes() {
    await this.isReadyPromise;

    if (this.useFallback) {
      this._saveFallbackList(FALLBACK_MISTAKES_KEY, []);
      return true;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_MISTAKES], 'readwrite');
      const store = tx.objectStore(STORE_MISTAKES);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  /**
   * Tạo đề thi ôn tập từ danh sách các câu làm sai
   * @param {number} [limit=20] 
   * @returns {Promise<Object>}
   */
  async createMistakePracticeQuiz(limit = 20) {
    const mistakes = await this.getAllMistakes();
    if (mistakes.length === 0) {
      throw new Error('Hộp Câu Sai hiện đang trống! Hãy làm đề và các câu bạn làm sai sẽ tự động xuất hiện ở đây.');
    }

    const selected = mistakes.slice(0, limit);
    const questions = selected.map((m, idx) => ({
      id: idx + 1,
      number: idx + 1,
      text: m.text,
      options: m.options,
      correctAnswer: m.correctAnswer,
      explanation: m.explanation,
      displayNumber: idx + 1
    }));

    return {
      id: 'quiz_mistakes_' + Date.now(),
      title: `Ôn Tập ${questions.length} Câu Sai`,
      totalQuestions: questions.length,
      questions: questions,
      createdAt: new Date().toISOString()
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  _getFallbackList(key) {
    if (typeof localStorage === 'undefined') return [];
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  _saveFallbackList(key, list) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
  }

  _hashString(str) {
    let hash = 0;
    if (!str) return '0';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

// Hỗ trợ cả môi trường Browser và Node.js
if (typeof window !== 'undefined') {
  window.HistoryDatabase = HistoryDatabase;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryDatabase;
}
