/**
 * Azota Quiz Master - Parser Engine (Liquid Glass Edition)
 * Phân tích file Word (.docx) và chuỗi văn bản theo định dạng đề thi Việt Nam
 * 
 * Thứ tự ưu tiên xác định đáp án:
 * 1. Bảng đáp án cuối file (BẢNG ĐÁP ÁN: 1.A 2.B...)
 * 2. Dòng đáp án trực tiếp ("Đáp án: A", "Đáp án đúng: B")
 * 3. Định dạng in đậm / gạch chân trong HTML từ Mammoth.js
 */

class QuizParser {
  /**
   * Phân tích file Word (.docx) sử dụng Mammoth.js
   * @param {File|Blob|ArrayBuffer} fileOrBuffer 
   * @param {string} [fileName]
   * @returns {Promise<Object>}
   */
  static async parseDocxFile(fileOrBuffer, fileName = 'Đề thi trắc nghiệm') {
    const mammothLib = typeof window !== 'undefined' ? window.mammoth : (typeof mammoth !== 'undefined' ? mammoth : null);
    if (!mammothLib) {
      throw new Error('Thư viện Mammoth.js chưa được tải. Vui lòng kiểm tra kết nối mạng hoặc môi trường.');
    }

    let arrayBuffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer;
    } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new Error('Định dạng dữ liệu không hợp lệ. Cần truyền vào File, Blob hoặc ArrayBuffer.');
    }

    const [htmlResult, textResult] = await Promise.all([
      mammothLib.convertToHtml({ arrayBuffer }),
      mammothLib.extractRawText({ arrayBuffer })
    ]);

    const title = fileName ? fileName.replace(/\.[^/.]+$/, "") : 'Đề thi trắc nghiệm';
    return this.parseContent(textResult.value, htmlResult.value, title);
  }

  /**
   * Phân tích nội dung văn bản thuần & HTML trích xuất từ .docx
   * @param {string} rawText 
   * @param {string} [rawHtml=''] 
   * @param {string} [title='Đề thi trắc nghiệm'] 
   * @returns {Object}
   */
  static parseContent(rawText, rawHtml = '', title = 'Đề thi trắc nghiệm') {
    if (!rawText || !rawText.trim()) {
      throw new Error('Nội dung đề thi trống. Vui lòng kiểm tra lại file hoặc văn bản nhập.');
    }

    // 1. Ưu tiên 1: Tìm bảng đáp án ở cuối đề thi
    const endAnswerMap = this.extractEndAnswerTable(rawText);

    // 2. Tách câu hỏi
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const questions = [];

    // Header câu hỏi: "Câu 1:", "Câu 1.", "Câu 1 -", "Question 1:"
    const questionHeaderRegex = /^(?:Câu|Question|Bài)\s+(\d+)[\s.:-]/i;

    let currentQ = null;
    let currentOptionKey = null;
    let inExplanation = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Dừng tách câu hỏi nếu gặp dòng tiêu đề bảng đáp án cuối
      if (/^(?:BẢNG\s+ĐÁP\s+ÁN|BẢNG\s+TRẢ\s+LỜI|ĐÁP\s+ÁN\s+CHI\s+TIẾT|DANH\s+SÁCH\s+ĐÁP\s+ÁN)\s*[:.]?$/i.test(line) ||
          (/^ĐÁP\s+ÁN\s*[:.]?$/i.test(line))) {
        if (currentQ) {
          questions.push(currentQ);
          currentQ = null;
        }
        break;
      }

      // Kiểm tra tiêu đề câu hỏi mới
      const qMatch = line.match(questionHeaderRegex);
      if (qMatch) {
        if (currentQ) {
          questions.push(currentQ);
        }
        const qNum = parseInt(qMatch[1], 10);
        const qText = line.substring(qMatch[0].length).trim();

        currentQ = {
          id: qNum || (questions.length + 1),
          number: qNum || (questions.length + 1),
          text: qText,
          options: [],
          inlineAnswer: null,
          explanation: '',
          rawLines: [line]
        };
        currentOptionKey = null;
        inExplanation = false;
        continue;
      }

      if (!currentQ) continue;

      currentQ.rawLines.push(line);

      // Kiểm tra phương án: "A.", "B.", "C.", "D." hoặc "A)", "B)", "C)", "D)"
      const optMatch = line.match(/^([A-D])[.)]\s*(.*)$/i);
      if (optMatch) {
        currentOptionKey = optMatch[1].toUpperCase();
        inExplanation = false;

        // Xử lý trường hợp 1 dòng có nhiều phương án: "A. Hà Nội    B. Đà Nẵng    C. Cần Thơ    D. Huế"
        const inlineOpts = this.extractMultiOptionsInLine(line);
        if (inlineOpts.length > 1) {
          for (const opt of inlineOpts) {
            currentQ.options.push(opt);
          }
          currentOptionKey = null;
        } else {
          currentQ.options.push({
            key: currentOptionKey,
            text: optMatch[2].trim()
          });
        }
        continue;
      }

      // Kiểm tra dòng đáp án inline: "Đáp án: A", "Đáp án đúng: B"
      const ansMatch = line.match(/^(?:Đáp\s*án(?:\s*đúng)?|Answer)[:\s]+([A-D])\b/i);
      if (ansMatch) {
        currentQ.inlineAnswer = ansMatch[1].toUpperCase();
        continue;
      }

      // Kiểm tra lời giải thích: "Lời giải:", "Giải thích:", "Hướng dẫn giải:"
      const expMatch = line.match(/^(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn\s*giải|HDG)[:\s]*(.*)$/i);
      if (expMatch) {
        inExplanation = true;
        currentQ.explanation = expMatch[1].trim();
        continue;
      }

      // Nếu đang trong lời giải, ghép tiếp nội dung
      if (inExplanation) {
        currentQ.explanation += (currentQ.explanation ? ' ' : '') + line;
        continue;
      }

      // Nếu đang trong 1 phương án (nội dung xuống dòng)
      if (currentOptionKey && currentQ.options.length > 0) {
        const lastOpt = currentQ.options[currentQ.options.length - 1];
        if (lastOpt && lastOpt.key === currentOptionKey) {
          lastOpt.text += ' ' + line;
          continue;
        }
      }

      // Ngược lại, là phần tiếp theo của câu hỏi (câu hỏi nhiều dòng)
      if (currentQ.options.length === 0) {
        currentQ.text += (currentQ.text ? ' ' : '') + line;
      }
    }

    if (currentQ) {
      questions.push(currentQ);
    }

    if (questions.length === 0) {
      throw new Error('Không tìm thấy câu hỏi nào hợp lệ. Vui lòng đảm bảo các câu hỏi bắt đầu bằng "Câu 1:", "Câu 2:"... và các phương án bắt đầu bằng "A.", "B.", "C.", "D."');
    }

    // 3. Ưu tiên 3: Phân tích định dạng in đậm / gạch chân từ HTML
    const boldUnderlineAnswers = this.detectBoldUnderlineAnswersFromHtml(rawHtml);

    // 4. Áp dụng thứ tự ưu tiên xác định đáp án đúng cho từng câu
    questions.forEach((q) => {
      let finalAnswer = null;
      let source = '';

      if (endAnswerMap[q.number]) {
        finalAnswer = endAnswerMap[q.number];
        source = 'bảng đáp án cuối';
      } else if (q.inlineAnswer) {
        finalAnswer = q.inlineAnswer;
        source = 'dòng đáp án';
      } else if (boldUnderlineAnswers[q.number]) {
        finalAnswer = boldUnderlineAnswers[q.number];
        source = 'định dạng in đậm/gạch chân';
      }

      q.correctAnswer = finalAnswer;
      q.answerSource = source;

      if (!finalAnswer) {
        q.hasWarning = true;
        q.warningText = 'Chưa có đáp án';
      } else {
        q.hasWarning = false;
        q.warningText = '';
      }

      if (q.options.length === 0) {
        q.hasWarning = true;
        q.warningText = 'Thiếu phương án lựa chọn';
      }
    });

    return {
      id: 'quiz_' + Date.now(),
      title: title || 'Đề thi trắc nghiệm',
      totalQuestions: questions.length,
      questions: questions,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Tách trường hợp 1 dòng chứa nhiều phương án:
   * "A. Hà Nội    B. Đà Nẵng    C. Cần Thơ    D. Huế"
   */
  static extractMultiOptionsInLine(line) {
    const results = [];
    const regex = /([A-D])[.)]\s*([^A-D\n]+(?=[A-D][.)]|$))/gi;
    let match;
    while ((match = regex.exec(line)) !== null) {
      results.push({
        key: match[1].toUpperCase(),
        text: match[2].trim()
      });
    }
    return results;
  }

  /**
   * Trích xuất bảng đáp án ở cuối văn bản (Priority 1)
   */
  static extractEndAnswerTable(rawText) {
    const answerMap = {};
    const tableHeaderRegex = /(?:^|\n)\s*(?:BẢNG\s+ĐÁP\s+ÁN|BẢNG\s+TRẢ\s+LỜI|(?:DANH\s+SÁCH\s+)?ĐÁP\s+ÁN)\s*[:.]?\s*\n([\s\S]*)$/i;
    const match = rawText.match(tableHeaderRegex);
    if (!match) return answerMap;

    const tableContent = match[1];
    const pairRegex = /(?:^|[\s,;|])(\d+)[\s.:-]+([A-D])\b/gi;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(tableContent)) !== null) {
      const qNum = parseInt(pairMatch[1], 10);
      const opt = pairMatch[2].toUpperCase();
      answerMap[qNum] = opt;
    }

    return answerMap;
  }

  /**
   * Trích xuất đáp án được in đậm hoặc gạch chân từ HTML Mammoth (Priority 3)
   */
  static detectBoldUnderlineAnswersFromHtml(html) {
    const boldMap = {};
    if (!html) return boldMap;

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const paragraphs = doc.querySelectorAll('p, li, tr');

      let currentQNum = null;

      paragraphs.forEach(p => {
        const text = p.textContent.trim();
        const qMatch = text.match(/^(?:Câu|Question|Bài)\s+(\d+)[\s.:-]/i);
        if (qMatch) {
          currentQNum = parseInt(qMatch[1], 10);
          return;
        }

        if (!currentQNum) return;

        const optMatch = text.match(/^([A-D])[.)]/i);
        if (optMatch) {
          const optKey = optMatch[1].toUpperCase();
          const hasBoldOrUnderline = p.querySelector('strong, b, u');
          if (hasBoldOrUnderline) {
            const boldText = hasBoldOrUnderline.textContent.trim();
            if (boldText.startsWith(optKey) || boldText.length > 2) {
              if (!boldMap[currentQNum]) {
                boldMap[currentQNum] = optKey;
              }
            }
          }
        }
      });
    } else {
      // Fallback regex cho môi trường Node.js không có DOMParser
      const pMatches = html.match(/<(?:p|li|tr)[^>]*>([\s\S]*?)<\/(?:p|li|tr)>/gi) || [];
      let currentQNum = null;

      for (const p of pMatches) {
        const plainText = p.replace(/<[^>]+>/g, '').trim();
        const qMatch = plainText.match(/^(?:Câu|Question|Bài)\s+(\d+)[\s.:-]/i);
        if (qMatch) {
          currentQNum = parseInt(qMatch[1], 10);
          continue;
        }
        if (!currentQNum) continue;

        const optMatch = plainText.match(/^([A-D])[.)]/i);
        if (optMatch) {
          const optKey = optMatch[1].toUpperCase();
          if (/<(?:strong|b|u)\b[^>]*>([\s\S]*?)<\/(?:strong|b|u)>/i.test(p)) {
            if (!boldMap[currentQNum]) {
              boldMap[currentQNum] = optKey;
            }
          }
        }
      }
    }

    return boldMap;
  }
}

// Hỗ trợ cả môi trường Browser và Node.js
if (typeof window !== 'undefined') {
  window.QuizParser = QuizParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuizParser;
}
