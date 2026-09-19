/**
 * Azota Quiz Master - Automated Test Suite
 * Kiểm tra logic QuizParser, QuizStateManager, và Chấm điểm
 */

const QuizParser = require('../js/parser.js');
const QuizStateManager = require('../js/quiz-state.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

console.log('====================================================');
console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG (AZOTA QUIZ APP)');
console.log('====================================================\n');

// ---------------------------------------------------------
// 1. TEST QUIZ PARSER: BẢNG ĐÁP ÁN CUỐI (ƯU TIÊN 1)
// ---------------------------------------------------------
console.log('📦 1. Kiểm tra QuizParser - Bảng đáp án cuối file (Priority 1):');

const sampleTextWithTable = `
Câu 1: Thủ đô của Việt Nam là gì?
A. TP.HCM
B. Hà Nội
C. Đà Nẵng
D. Cần Thơ

Câu 2: 1 + 1 bằng mấy?
A. 1
B. 2
C. 3
D. 4

BẢNG ĐÁP ÁN:
1.B 2.B
`;

try {
  const parsed1 = QuizParser.parseContent(sampleTextWithTable, '', 'Đề Test 1');
  assert(parsed1.questions.length === 2, 'Nhận diện đúng 2 câu hỏi');
  assert(parsed1.questions[0].correctAnswer === 'B', 'Câu 1 có đáp án đúng là B từ bảng cuối');
  assert(parsed1.questions[1].correctAnswer === 'B', 'Câu 2 có đáp án đúng là B từ bảng cuối');
  assert(parsed1.questions[0].answerSource === 'bảng đáp án cuối', 'Nguồn đáp án đúng là "bảng đáp án cuối"');
} catch (e) {
  assert(false, 'Lỗi ngoại lệ parse bảng cuối: ' + e.message);
}

// ---------------------------------------------------------
// 2. TEST QUIZ PARSER: DÒNG ĐÁP ÁN INLINE (ƯU TIÊN 2)
// ---------------------------------------------------------
console.log('\n📦 2. Kiểm tra QuizParser - Dòng đáp án trực tiếp (Priority 2):');

const sampleTextWithInline = `
Câu 1: Mặt trời mọc ở hướng nào?
A. Hướng Đông
B. Hướng Tây
C. Hướng Nam
D. Hướng Bắc
Đáp án đúng: A
Lời giải: Mặt trời luôn mọc ở hướng Đông do Trái Đất tự quay từ Tây sang Đông.

Câu 2: Nước sôi ở bao nhiêu độ C ở áp suất chuẩn?
A. 50
B. 80
C. 100
D. 120
Đáp án: C
`;

try {
  const parsed2 = QuizParser.parseContent(sampleTextWithInline, '', 'Đề Test 2');
  assert(parsed2.questions.length === 2, 'Nhận diện đúng 2 câu hỏi inline');
  assert(parsed2.questions[0].correctAnswer === 'A', 'Câu 1 có đáp án đúng là A');
  assert(parsed2.questions[1].correctAnswer === 'C', 'Câu 2 có đáp án đúng là C');
  assert(parsed2.questions[0].explanation.includes('Mặt trời luôn mọc'), 'Trích xuất đúng lời giải thích câu 1');
} catch (e) {
  assert(false, 'Lỗi ngoại lệ parse inline: ' + e.message);
}

// ---------------------------------------------------------
// 3. TEST QUIZ PARSER: ĐỊNH DẠNG IN ĐẬM / GẠCH CHÂN (ƯU TIÊN 3)
// ---------------------------------------------------------
console.log('\n📦 3. Kiểm tra QuizParser - In đậm trong HTML (Priority 3):');

const rawTextNoAns = `
Câu 1: Màu pha giữa đỏ và vàng là gì?
A. Màu xanh
B. Màu cam
C. Màu tím
D. Màu nâu
`;

const rawHtmlBold = `
<p>Câu 1: Màu pha giữa đỏ và vàng là gì?</p>
<p>A. Màu xanh</p>
<p><strong>B. Màu cam</strong></p>
<p>C. Màu tím</p>
<p>D. Màu nâu</p>
`;

try {
  const parsed3 = QuizParser.parseContent(rawTextNoAns, rawHtmlBold, 'Đề Test 3');
  assert(parsed3.questions.length === 1, 'Nhận diện đúng 1 câu hỏi');
  assert(parsed3.questions[0].correctAnswer === 'B', 'Nhận diện đúng đáp án B in đậm từ HTML');
  assert(parsed3.questions[0].answerSource === 'định dạng in đậm/gạch chân', 'Nguồn là định dạng in đậm');
} catch (e) {
  assert(false, 'Lỗi ngoại lệ parse in đậm: ' + e.message);
}

// ---------------------------------------------------------
// 4. TEST QUIZ PARSER: NHIỀU ĐÁP ÁN TRÊN 1 DÒNG
// ---------------------------------------------------------
console.log('\n📦 4. Kiểm tra QuizParser - Nhiều phương án trên cùng 1 dòng:');

const multiOptLine = `
Câu 1: Chọn số chẵn:
A. 1    B. 2    C. 3    D. 5
Đáp án: B
`;

try {
  const parsed4 = QuizParser.parseContent(multiOptLine, '', 'Đề Test 4');
  assert(parsed4.questions[0].options.length === 4, 'Tách đúng 4 phương án trên cùng 1 dòng');
  assert(parsed4.questions[0].options[0].key === 'A' && parsed4.questions[0].options[0].text === '1', 'Phương án A đúng');
  assert(parsed4.questions[0].options[1].key === 'B' && parsed4.questions[0].options[1].text === '2', 'Phương án B đúng');
  assert(parsed4.questions[0].correctAnswer === 'B', 'Đáp án đúng là B');
} catch (e) {
  assert(false, 'Lỗi ngoại lệ parse multi-options: ' + e.message);
}

// ---------------------------------------------------------
// 5. TEST QUIZ STATE MANAGER: TÍNH ĐIỂM & ĐẢO ĐỀ
// ---------------------------------------------------------
console.log('\n📦 5. Kiểm tra QuizStateManager - Chấm điểm thang 10 & Đảo đề:');

const mockQuizData = {
  id: 'test_quiz_calc',
  title: 'Bài Test Chấm Điểm',
  questions: [
    { id: 1, number: 1, text: 'Q1', options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }], correctAnswer: 'A' },
    { id: 2, number: 2, text: 'Q2', options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }], correctAnswer: 'B' },
    { id: 3, number: 3, text: 'Q3', options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }], correctAnswer: 'A' },
    { id: 4, number: 4, text: 'Q4', options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }], correctAnswer: 'B' }
  ]
};

const state = new QuizStateManager();
state.initQuiz(mockQuizData, { timeLimit: 15, shuffleQuestions: false, shuffleOptions: false }, 'exam');

// Trả lời 3/4 câu đúng: Q1=A(đúng), Q2=B(đúng), Q3=B(sai), Q4 không trả lời(bỏ qua)
state.selectAnswer(1, 'A');
state.selectAnswer(2, 'B');
state.selectAnswer(3, 'B');

const scoreResult = state.calculateScore();
assert(scoreResult.correctCount === 2, 'Số câu đúng là 2');
assert(scoreResult.incorrectCount === 1, 'Số câu sai là 1');
assert(scoreResult.skippedCount === 1, 'Số câu bỏ qua là 1');
assert(scoreResult.score === 5.0, 'Điểm số 2/4 câu đúng = 5.0/10');
assert(scoreResult.percentage === 50, 'Tỷ lệ hoàn thành đúng là 50%');

// Test Đảo Đáp Án (Shuffle Options) đảm bảo không mất đáp án đúng
const stateShuffle = new QuizStateManager();
stateShuffle.initQuiz(mockQuizData, { shuffleQuestions: true, shuffleOptions: true }, 'practice');

let allCorrectMapped = true;
stateShuffle.activeQuiz.questions.forEach(shuffledQ => {
  const originalQ = mockQuizData.questions.find(q => q.id === shuffledQ.id);
  const correctOptInShuffled = shuffledQ.options.find(o => o.key === shuffledQ.correctAnswer);
  const correctOptInOriginal = originalQ.options.find(o => o.key === originalQ.correctAnswer);

  if (correctOptInShuffled.text !== correctOptInOriginal.text) {
    allCorrectMapped = false;
  }
});
assert(allCorrectMapped, 'Sau khi đảo phương án ngẫu nhiên, đáp án đúng vẫn trỏ chính xác về nội dung đúng');

// Test thời gian không giới hạn và đảo đề làm lại từ đề gốc
const unlimitedState = new QuizStateManager();
unlimitedState.initQuiz(mockQuizData, { timeLimit: 0, shuffleQuestions: false, shuffleOptions: false }, 'exam');
assert(unlimitedState.timeLimit === 0, 'Chế độ không giới hạn giữ thời gian là 0 phút');
assert(unlimitedState.timerInterval === null, 'Chế độ không giới hạn không khởi tạo bộ đếm ngược');

unlimitedState.selectAnswer(1, 'A');
unlimitedState.toggleFlag(1);
unlimitedState.goToQuestion(2);
const restarted = unlimitedState.restartQuiz({ shuffleQuestions: true, shuffleOptions: true });
assert(restarted === true, 'Có thể đảo đề và làm lại từ đề gốc');
assert(unlimitedState.currentQuestionIndex === 0, 'Đảo đề làm lại quay về câu đầu tiên');
assert(Object.keys(unlimitedState.answers).length === 0, 'Đảo đề làm lại xóa đáp án cũ');
assert(Object.keys(unlimitedState.flagged).length === 0, 'Đảo đề làm lại xóa cờ đã đánh dấu');
assert(unlimitedState.timeLimit === 0 && unlimitedState.timerInterval === null, 'Đảo đề giữ chế độ không giới hạn');

let restartedAnswersMapped = true;
unlimitedState.activeQuiz.questions.forEach(shuffledQ => {
  const originalQ = mockQuizData.questions.find(q => q.id === shuffledQ.id);
  const shuffledCorrect = shuffledQ.options.find(o => o.key === shuffledQ.correctAnswer);
  const originalCorrect = originalQ.options.find(o => o.key === originalQ.correctAnswer);
  if (!shuffledCorrect || shuffledCorrect.text !== originalCorrect.text) {
    restartedAnswersMapped = false;
  }
});
assert(restartedAnswersMapped, 'Đảo đề làm lại vẫn giữ đúng nội dung đáp án chuẩn');

state.stopTimer();
stateShuffle.stopTimer();
unlimitedState.stopTimer();

console.log('\n====================================================');
console.log(`🎉 KẾT QUẢ TEST: ${passedTests}/${totalTests} KIỂM THỬ THÀNH CÔNG!`);
console.log('====================================================\n');
