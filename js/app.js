/** Azota Xanh SM - App glue (paste, history, confirm, notes/tags, search) */
const DEFAULT_SAMPLE_QUIZ={id:'sample_quiz_azota_01',title:'Đề Thi Thử THPT - Tổng Hợp',totalQuestions:6,createdAt:new Date().toISOString(),questions:[
{id:1,number:1,displayNumber:1,text:'Thủ đô của Việt Nam là?',options:[{key:'A',text:'TP.HCM'},{key:'B',text:'Hà Nội'},{key:'C',text:'Đà Nẵng'},{key:'D',text:'Hải Phòng'}],correctAnswer:'B',explanation:'Hà Nội là thủ đô từ 1976.'},
{id:2,number:2,displayNumber:2,text:'Hành tinh gần Mặt Trời nhất?',options:[{key:'A',text:'Sao Kim'},{key:'B',text:'Sao Thủy'},{key:'C',text:'Sao Hỏa'},{key:'D',text:'Trái Đất'}],correctAnswer:'B',explanation:'Sao Thủy gần nhất.'},
{id:3,number:3,displayNumber:3,text:'Chiến thắng Điện Biên Phủ năm nào?',options:[{key:'A',text:'1945'},{key:'B',text:'1954'},{key:'C',text:'1975'},{key:'D',text:'1968'}],correctAnswer:'B',explanation:'7/5/1954.'},
{id:4,number:4,displayNumber:4,text:'Khí chiếm tỉ lệ lớn nhất trong khí quyển?',options:[{key:'A',text:'O2'},{key:'B',text:'N2'},{key:'C',text:'CO2'},{key:'D',text:'Ar'}],correctAnswer:'B',explanation:'N2 ~78%.'},
{id:5,number:5,displayNumber:5,text:'Dãy núi có đỉnh Everest?',options:[{key:'A',text:'Andes'},{key:'B',text:'Alps'},{key:'C',text:'Himalaya'},{key:'D',text:'Rocky'}],correctAnswer:'C',explanation:'Himalaya.'},
{id:6,number:6,displayNumber:6,text:'Ký hiệu Au là nguyên tố nào?',options:[{key:'A',text:'Bạc'},{key:'B',text:'Đồng'},{key:'C',text:'Vàng'},{key:'D',text:'Nhôm'}],correctAnswer:'C',explanation:'Au = Aurum = Vàng.'}
]};
class App{
 constructor(){this.state=new QuizStateManager();this.db=new HistoryDatabase();this.router=new UIRouter(this.state,this.db);this.selectedMode='practice';this.selectedTimeLimit=30;this.shuffleQuestions=false;this.shuffleOptions=false;this.loadedQuizData=null;this.noteTargetId=null;this.notes=this.loadNotes();this.init()}
 async init(){this.bindEvents();this.setupTimerCallbacks();this.checkResumeSession();setTimeout(()=>{try{this.updater=new AppUpdater();this.updater.checkForUpdates()}catch(e){}},2000)}
 loadNotes(){try{return JSON.parse(localStorage.getItem('azota_notes_v2')||'{}')}catch(e){return {}}}
 saveNotes(){localStorage.setItem('azota_notes_v2',JSON.stringify(this.notes))}
 openNoteModal(qid){this.noteTargetId=qid;const cur=this.notes[qid]||{tag:'',text:''};document.getElementById('note-tag-input').value=cur.tag;document.getElementById('note-text-input').value=cur.text;document.getElementById('modal-note').classList.remove('hidden')}
 closeNoteModal(){document.getElementById('modal-note').classList.add('hidden');this.noteTargetId=null}
 saveNote(){if(!this.noteTargetId) return;const tag=document.getElementById('note-tag-input').value.trim();const text=document.getElementById('note-text-input').value.trim();if(!tag&&!text) delete this.notes[this.noteTargetId]; else this.notes[this.noteTargetId]={tag,text};this.saveNotes();this.closeNoteModal();this.router.loadMistakesTab&&this.router.loadMistakesTab();if(this.lastResult) this.router.renderReviewList(this.lastResult.details);this.showToast('Đã lưu ghi chú')}
 bindEvents(){
  document.querySelectorAll('.bottom-nav-item').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.getAttribute('data-tab');if(tab) this.router.switchTab(tab)}));
  document.getElementById('xsm-fab')?.addEventListener('click',()=>this.openPaste());
  document.getElementById('mode-practice')?.addEventListener('click',()=>this.setMode('practice'));
  document.getElementById('mode-exam')?.addEventListener('click',()=>this.setMode('exam'));
  document.querySelectorAll('.time-pill').forEach(pill=>pill.addEventListener('click',()=>{
    document.querySelectorAll('.time-pill').forEach(p=>{p.className='time-pill py-2 rounded-xl text-xs font-semibold bg-transparent text-[#6B7B8A]'});pill.className='time-pill py-2 rounded-xl bg-white shadow text-[#0ABDCB] font-bold';this.selectedTimeLimit=parseInt(pill.getAttribute('data-minutes')||'30',10)
  }));
  const sq=document.getElementById('switch-shuffle-questions'), so=document.getElementById('switch-shuffle-options');
  sq&&sq.addEventListener('click',()=>this.shuffleQuestions=this.toggleSwitchUI(sq));
  so&&so.addEventListener('click',()=>this.shuffleOptions=this.toggleSwitchUI(so));
  document.getElementById('btn-sample-quiz')?.addEventListener('click',()=>{this.loadedQuizData=JSON.parse(JSON.stringify(DEFAULT_SAMPLE_QUIZ));this.showToast(`Đã nạp "${this.loadedQuizData.title}" (${this.loadedQuizData.totalQuestions} câu)`);this.updateReadyBanner()});
  // file
  const fileInput=document.getElementById('file-input'), dropzone=document.getElementById('dropzone'), btnBrowse=document.getElementById('btn-browse-file');
  btnBrowse&&btnBrowse.addEventListener('click',()=>this.triggerFilePicker());
  dropzone&&dropzone.addEventListener('click',e=>{if(e.target!==btnBrowse) this.triggerFilePicker()});
  dropzone&&dropzone.addEventListener('dragover',e=>{e.preventDefault();dropzone.classList.add('border-[#00C2CC]','bg-[#00C2CC]/10')});
  dropzone&&dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('border-[#00C2CC]','bg-[#00C2CC]/10'));
  dropzone&&dropzone.addEventListener('drop',e=>{e.preventDefault();dropzone.classList.remove('border-[#00C2CC]','bg-[#00C2CC]/10');if(e.dataTransfer.files&&e.dataTransfer.files[0])this.handleFileSelected(e.dataTransfer.files[0])});
  fileInput&&fileInput.addEventListener('change',e=>{if(e.target.files&&e.target.files[0])this.handleFileSelected(e.target.files[0])});
  document.getElementById('btn-start-quiz')?.addEventListener('click',()=>this.startQuiz());
  // quiz controls
  document.getElementById('btn-quiz-submit')?.addEventListener('click',()=>this.confirmSubmitQuiz());
  document.getElementById('btn-quiz-back')?.addEventListener('click',()=>this.confirmExitQuiz());
  document.getElementById('btn-quiz-matrix-toggle')?.addEventListener('click',()=>this.router.openQuestionMatrix());
  document.getElementById('btn-question-matrix-close')?.addEventListener('click',()=>this.router.closeQuestionMatrix());
  document.getElementById('btn-question-matrix-backdrop')?.addEventListener('click',()=>this.router.closeQuestionMatrix());
  document.getElementById('btn-quiz-shuffle')?.addEventListener('click',()=>this.restartCurrentQuiz({shuffleQuestions:true,shuffleOptions:true,confirmMessage:'Đảo đề sẽ xóa đáp án và cờ. Tiếp tục?'}));
  document.getElementById('quiz-question-stream')?.addEventListener('click',e=>{
    const card=e.target.closest('[data-question-index]'); if(!card) return; const idx=Number(card.dataset.questionIndex);
    if(e.target.closest('[data-quiz-action="toggle-flag"]')){this.toggleQuestionFlag(idx);return}
    if(e.target.closest('[data-quiz-action="open-note"]')){const q=this.state.activeQuiz.questions[idx];this.openNoteModal(String(q.id));return}
    const opt=e.target.closest('[data-option-key]'); if(opt) this.selectAnswerAtIndex(idx,opt.dataset.optionKey);
  });
  document.getElementById('question-matrix-grid')?.addEventListener('click',e=>{const b=e.target.closest('[data-matrix-index]'); if(b) this.goToQuestion(Number(b.dataset.matrixIndex))});
  document.getElementById('btn-result-retake')?.addEventListener('click',()=>this.restartCurrentQuiz());
  document.getElementById('btn-result-shuffle-retake')?.addEventListener('click',()=>this.restartCurrentQuiz({shuffleQuestions:true,shuffleOptions:true}));
  document.getElementById('btn-result-home')?.addEventListener('click',()=>this.router.switchTab('study'));
  const fAll=document.getElementById('filter-review-all'), fWrong=document.getElementById('filter-review-wrong'), fFlag=document.getElementById('filter-review-flagged');
  if(fAll&&fWrong&&fFlag){const upd=(a)=>{[fAll,fWrong,fFlag].forEach(b=>b.className='px-3 py-1.5 rounded-full text-xs font-medium bg-white');a.className='px-3 py-1.5 rounded-full text-xs font-bold bg-[#00C2CC] text-white'};
    fAll.addEventListener('click',()=>{this.router.reviewFilter='all';upd(fAll);this.lastResult&&this.router.renderReviewList(this.lastResult.details)});
    fWrong.addEventListener('click',()=>{this.router.reviewFilter='wrong';upd(fWrong);this.lastResult&&this.router.renderReviewList(this.lastResult.details)});
    fFlag.addEventListener('click',()=>{this.router.reviewFilter='flagged';upd(fFlag);this.lastResult&&this.router.renderReviewList(this.lastResult.details)});
  }
  document.getElementById('btn-practice-mistakes')?.addEventListener('click',async()=>{try{const mq=await this.db.createMistakePracticeQuiz(20);this.loadedQuizData=mq;this.selectedMode='practice';this.startQuiz()}catch(e){alert(e.message)}});
  // search
  const doSearch=(inputId, fn)=>{const el=document.getElementById(inputId); if(!el) return; el.addEventListener('input',()=>fn(el.value));};
  doSearch('xsm-search-input',v=>{this.filterHome(v)});
  document.getElementById('btn-quick-search')?.addEventListener('click',()=>document.getElementById('xsm-search-input')?.focus());
  document.getElementById('library-search')?.addEventListener('input',e=>this.router.filterLibrary&&this.router.filterLibrary(e.target.value));
  document.getElementById('btn-library-search')?.addEventListener('click',()=>{const v=document.getElementById('library-search').value; this.router.filterLibrary&&this.router.filterLibrary(v)});
  document.getElementById('mistakes-search')?.addEventListener('input',e=>this.router.filterMistakes&&this.router.filterMistakes(e.target.value,this.notes));
  document.getElementById('btn-mistakes-search')?.addEventListener('click',()=>{const v=document.getElementById('mistakes-search').value; this.router.filterMistakes&&this.router.filterMistakes(v,this.notes)});
  // paste
  document.getElementById('btn-open-paste')?.addEventListener('click',()=>this.openPaste());
  document.getElementById('btn-paste-backdrop')?.addEventListener('click',()=>this.closePaste());
  document.getElementById('btn-close-paste')?.addEventListener('click',()=>this.closePaste());
  document.getElementById('btn-cancel-paste')?.addEventListener('click',()=>this.closePaste());
  document.getElementById('btn-confirm-paste')?.addEventListener('click',()=>this.confirmPaste());
  // history
  document.getElementById('btn-open-history')?.addEventListener('click',()=>this.openHistory());
  document.getElementById('btn-history-backdrop')?.addEventListener('click',()=>this.closeHistory());
  document.getElementById('btn-close-history')?.addEventListener('click',()=>this.closeHistory());
  // confirm submit
  document.getElementById('btn-modal-backdrop')?.addEventListener('click',()=>this.closeConfirm());
  document.getElementById('btn-modal-cancel-submit')?.addEventListener('click',()=>this.closeConfirm());
  document.getElementById('btn-modal-confirm-submit')?.addEventListener('click',()=>{this.closeConfirm();this.submitQuiz()});
  // note
  document.getElementById('btn-note-backdrop')?.addEventListener('click',()=>this.closeNoteModal());
  document.getElementById('btn-cancel-note')?.addEventListener('click',()=>this.closeNoteModal());
  document.getElementById('btn-save-note')?.addEventListener('click',()=>this.saveNote());
  this.setupKeyboardShortcuts();
 }
 filterHome(keyword){
  const v=(keyword||'').toLowerCase().trim();
  // filter library preview is in router; for home we filter dropzone hint? just filter library tab content if visible
  if(!v){ this.router.filterLibrary&&this.router.filterLibrary(''); return; }
  // if on library/mistakes, delegate
  if(this.router.currentTab==='library') this.router.filterLibrary(v);
  else if(this.router.currentTab==='mistakes') this.router.filterMistakes(v,this.notes);
  else this.router.filterLibrary(v);
 }
 openPaste(){document.getElementById('modal-paste')?.classList.remove('hidden'); setTimeout(()=>document.getElementById('paste-textarea')?.focus(),50)}
 closePaste(){document.getElementById('modal-paste')?.classList.add('hidden')}
 async confirmPaste(){
  const raw=document.getElementById('paste-textarea')?.value.trim(); if(!raw){alert('Dán nội dung đề vào trước nhé');return}
  try{this.showLoading('Đang tạo đề từ văn bản...'); const quiz=await QuizParser.parseText(raw, 'Đề dán '+new Date().toLocaleDateString('vi-VN')); this.loadedQuizData=quiz; this.hideLoading(); this.closePaste(); this.updateReadyBanner(); this.showToast(`Đã tạo đề ${quiz.totalQuestions} câu từ văn bản`);}catch(e){this.hideLoading();alert('Lỗi: '+e.message)}
 }
 async openHistory(){document.getElementById('modal-history')?.classList.remove('hidden'); const list=document.getElementById('history-list'); if(!list) return; list.innerHTML='<p class="text-xs text-[#6B7B8A]">Đang tải...</p>'; try{const quizzes=await this.db.getAllQuizzes(); const hist=await this.db.getAllHistory?.()||[]; if(!quizzes.length&&!hist.length){list.innerHTML='<p class="text-sm text-[#6B7B8A] text-center py-8">Chưa có lịch sử</p>';return} list.innerHTML=quizzes.slice(0,20).map(q=>`<div class="p-3 rounded-2xl bg-[#F2F7F8] flex items-center justify-between gap-2"><div class="min-w-0"><div class="font-bold text-sm truncate">${this.esc(q.title)}</div><div class="text-xs text-[#6B7B8A]">${q.totalQuestions||'?'} câu • ${new Date(q.updatedAt||q.createdAt).toLocaleDateString('vi-VN')}</div></div><button data-hid="${q.id}" class="btn-load-hist h-8 px-3 rounded-full bg-[#00C2CC] text-white text-xs font-bold">Nạp</button></div>`).join(''); list.querySelectorAll('.btn-load-hist').forEach(b=>b.addEventListener('click',async()=>{const id=b.getAttribute('data-hid'); const found=quizzes.find(x=>x.id===id); if(found&&found.quizData){this.loadedQuizData=found.quizData; this.closeHistory(); this.updateReadyBanner(); this.showToast('Đã nạp đề');}}));}catch(e){list.innerHTML='<p class="text-xs text-red-500">'+e.message+'</p>'}}
 closeHistory(){document.getElementById('modal-history')?.classList.add('hidden')}
 confirmSubmitQuiz(){const total=this.state.activeQuiz.questions.length, answered=Object.keys(this.state.answers).length, un=total-answered; const msg= un>0? `Bạn còn ${un} câu chưa làm (${answered}/${total}). Vẫn nộp?` : `Đã làm ${answered}/${total} câu. Nộp bài?`; document.getElementById('modal-submit-warning-text').textContent=msg; document.getElementById('modal-confirm-submit').classList.remove('hidden')}
 closeConfirm(){document.getElementById('modal-confirm-submit').classList.add('hidden')}
 async triggerFilePicker(){if(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.FilePicker){try{const r=await window.Capacitor.Plugins.FilePicker.pickFiles({types:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],multiple:false,readData:true}); if(r&&r.files&&r.files[0]){const f=r.files[0];const bin=atob(f.data);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);await this.parseArrayBuffer(bytes.buffer,f.name);return}}catch(e){console.warn(e)}} document.getElementById('file-input')?.click()}
 async handleFileSelected(file){if(!file) return; if(!file.name.toLowerCase().endsWith('.docx')){alert('Chỉ nhận .docx');return} this.showLoading('Đang phân tích...'); try{const quiz=await QuizParser.parseDocxFile(file,file.name);this.loadedQuizData=quiz;this.hideLoading();this.showToast(`Đã nhận ${quiz.totalQuestions} câu từ "${file.name}"`);this.updateReadyBanner()}catch(e){this.hideLoading();alert('Lỗi: '+e.message)}}
 async parseArrayBuffer(buf,name){this.showLoading('Đang phân tích...'); try{const quiz=await QuizParser.parseDocxFile(buf,name);this.loadedQuizData=quiz;this.hideLoading();this.showToast(`Đã nhận ${quiz.totalQuestions} câu`);this.updateReadyBanner()}catch(e){this.hideLoading();alert('Lỗi: '+e.message)}}
 startQuiz(){if(!this.loadedQuizData) this.loadedQuizData=JSON.parse(JSON.stringify(DEFAULT_SAMPLE_QUIZ));this.state.initQuiz(this.loadedQuizData,{timeLimit:this.selectedTimeLimit,shuffleQuestions:this.shuffleQuestions,shuffleOptions:this.shuffleOptions},this.selectedMode);this.router.switchView('quiz');this.router.renderQuizScreen()}
 restartCurrentQuiz(o={}){if(!this.state.originalQuiz) return; if(o.confirmMessage&&!confirm(o.confirmMessage)) return; const ok=this.state.restartQuiz({timeLimit:this.state.timeLimit,shuffleQuestions:typeof o.shuffleQuestions==='boolean'?o.shuffleQuestions:this.state.options.shuffleQuestions,shuffleOptions:typeof o.shuffleOptions==='boolean'?o.shuffleOptions:this.state.options.shuffleOptions}); if(!ok) return; this.loadedQuizData=this.state.originalQuiz; this.router.switchView('quiz'); this.router.renderQuizScreen(); this.showToast(o.shuffleQuestions||o.shuffleOptions?'Đã đảo đề':'Đã làm lại')}
 selectAnswerAtIndex(i,k){const q=this.state.activeQuiz.questions[i]; if(!q) return; this.state.goToQuestion(i); this.state.selectAnswer(q.id,k); this.router.updateQuestionCard(i)}
 toggleQuestionFlag(i){const q=this.state.activeQuiz.questions[i]; if(!q) return; this.state.goToQuestion(i); this.state.toggleFlag(q.id); this.router.updateQuestionCard(i)}
 goToQuestion(idx){if(!Number.isInteger(idx)) return; this.state.goToQuestion(idx); this.router.refreshQuizStatus(); this.router.closeQuestionMatrix(); requestAnimationFrame(()=>this.router.scrollToQuestion(idx))}
 async submitQuiz(){const result=this.state.finishQuiz(); this.lastResult=result; await this.db.saveQuiz(this.state.originalQuiz,result); await this.db.saveMistakes(result.title,result.details); if(result.score>=8&&typeof confetti==='function') confetti({particleCount:120,spread:80,origin:{y:0.6}}); this.router.switchView('result'); this.router.renderResultScreen(result)}
 confirmExitQuiz(){if(confirm('Tạm dừng và lưu để làm sau?')){this.state.stopTimer(); this.state.saveSession(); this.router.switchTab('study')}}
 checkResumeSession(){const s=QuizStateManager.loadSavedSession(); if(s&&!s.isFinished&&s.activeQuiz){const b=document.getElementById('resume-session-banner'); if(b){b.classList.remove('hidden'); document.getElementById('btn-resume-session').onclick=()=>{b.classList.add('hidden');this.state.restoreSession(s);this.router.switchView('quiz');this.router.renderQuizScreen()}; document.getElementById('btn-discard-session').onclick=()=>{b.classList.add('hidden');this.state.clearSession()}}}}
 setupTimerCallbacks(){const t=document.getElementById('quiz-timer-text'), c=document.getElementById('quiz-timer-container'); this.state.onTimerTick=(sec,warn)=>{if(t){if(this.state.timeLimit===0) t.textContent='∞'; else {const m=Math.floor(sec/60), s=sec%60; t.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}} if(c){c.className= warn? 'px-3 py-1 rounded-full bg-red-100 border border-red-300 text-red-600 flex items-center gap-1.5 animate-pulse' : 'px-3 py-1 rounded-full bg-white border flex items-center gap-1.5 shadow-sm'}}; this.state.onTimerExpired=()=>{alert('Hết giờ! Tự nộp bài.');this.submitQuiz()}}
 setMode(m){this.selectedMode=m; const p=document.getElementById('mode-practice'), e=document.getElementById('mode-exam'); if(m==='practice'){p.classList.add('ring-2','ring-[#00C2CC]'); e.classList.remove('ring-2','ring-[#00C2CC]')}else{e.classList.add('ring-2','ring-[#00C2CC]'); p.classList.remove('ring-2','ring-[#00C2CC]')}}
 toggleSwitchUI(btn){const off=btn.getAttribute('data-state')==='off', thumb=btn.firstElementChild; if(off){btn.setAttribute('data-state','on');btn.classList.remove('bg-[#E2E8F0]');btn.classList.add('bg-[#00C2CC]');thumb.classList.remove('translate-x-0');thumb.classList.add('translate-x-5');return true}else{btn.setAttribute('data-state','off');btn.classList.remove('bg-[#00C2CC]');btn.classList.add('bg-[#E2E8F0]');thumb.classList.remove('translate-x-5');thumb.classList.add('translate-x-0');return false}}
 updateReadyBanner(){const b=document.getElementById('ready-quiz-banner'), t=document.getElementById('ready-quiz-title'), c=document.getElementById('ready-quiz-count'); if(b&&this.loadedQuizData){b.classList.remove('hidden'); if(t) t.textContent=this.loadedQuizData.title; if(c) c.textContent=`${this.loadedQuizData.totalQuestions} câu đã sẵn sàng`}}
 setupKeyboardShortcuts(){window.addEventListener('keydown',e=>{if(this.router.currentView!=='quiz') return; if(e.key==='Escape') this.router.closeQuestionMatrix(); if(['1','2','3','4','a','b','c','d','A','B','C','D'].includes(e.key)){const q=this.state.activeQuiz.questions[this.state.currentQuestionIndex]; if(!q) return; let k=e.key.toUpperCase(); if(k==='1')k='A';if(k==='2')k='B';if(k==='3')k='C';if(k==='4')k='D'; this.state.selectAnswer(q.id,k); this.router.updateQuestionCard(this.state.currentQuestionIndex)}})}
 esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
 showToast(m){let t=document.getElementById('app-toast'); if(!t){t=document.createElement('div');t.id='app-toast';t.className='fixed top-20 inset-x-4 max-w-sm mx-auto z-50 p-3.5 rounded-2xl bg-[#0F2F3E]/90 text-white text-xs font-medium backdrop-blur shadow-xl text-center transition-all opacity-0 pointer-events-none -translate-y-2';document.body.appendChild(t)} t.textContent=m; t.classList.remove('opacity-0','pointer-events-none','-translate-y-2');t.classList.add('opacity-100');setTimeout(()=>{t.classList.add('opacity-0','pointer-events-none','-translate-y-2');t.classList.remove('opacity-100')},2800)}
 showLoading(txt){let l=document.getElementById('app-loader'); if(!l){l=document.createElement('div');l.id='app-loader';l.className='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4';l.innerHTML=`<div class="p-6 rounded-[24px] bg-white shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center"><div class="w-10 h-10 border-3 border-[#00C2CC] border-t-transparent rounded-full animate-spin"></div><p id="app-loader-text" class="text-sm font-semibold">${txt}</p></div>`;document.body.appendChild(l)}else{document.getElementById('app-loader-text').textContent=txt; l.classList.remove('hidden')}}
 hideLoading(){document.getElementById('app-loader')?.classList.add('hidden')}
}
document.addEventListener('DOMContentLoaded',()=>{window.quizApp=new App()});
