/**
 * diagnostic/js-diag/diag-engine.js
 * BỘ MÁY ĐIỀU PHỐI KHẢO THÍ CHẨN ĐOÁN THÍCH ỨNG MASTER (TEST 1, 2, 3 & 3 SET XOAY TUA)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ TÍNH NĂNG NÀO
 * - ĐIỀU PHỐI ĐỒNG BỘ CẢ 4 BỘ MÁY: GRAMMAR, LISTENING, READING, WRITING
 * - TÍCH HỢP AI GEMINI CHẤM WRITING & SPEAKING
 * - BẢNG BÁO CÁO DASHBOARD MỔ XẺ TỪNG CÂU SAI VÀ LỖ HỔNG KIẾN THỨC
 * - CHẾ ĐỘ XEM LẠI REVIEW MODE TỪ LỊCH SỬ VÀ ĐỒNG BỘ CLOUD GOOGLE SHEETS
 */

import { diagGrammarEngine } from './diag-grammar.js';
import { diagListeningEngine } from './diag-listening.js';
import { diagReadingEngine } from './diag-reading.js';
import { diagWritingEngine } from './diag-writing.js';

// =========================================================================
// 1. MÃ HÓA CÁC API KEY BẢO MẬT
// =========================================================================
const _READING_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 74, 111, 118, 45, 99, 119, 83,
  107, 75, 75, 119, 84, 75, 87, 97, 87, 105, 119, 116, 52, 84, 75, 121,
  112, 48, 90, 51, 65, 107, 65, 65, 119, 79, 116, 81, 115, 87, 50, 80,
  88, 104, 52, 110, 65
];
function getReadingKey() { return _READING_SEEDS.map(c => String.fromCharCode(c)).join(''); }

const _WRITING_PREFIX = "AQ.Ab8RN6KGTRGy";
const _WRITING_SUFFIX = "SZoGpqs3vT-ikWDLUSWjloCCVlzZhAQque_34w";
function getWritingKey() { return `${_WRITING_PREFIX}${_WRITING_SUFFIX}`; }

const _SPEAKING_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 116, 80, 107, 51, 45, 50,
  75, 103, 117, 114, 119, 117, 116, 65, 115, 55, 95, 118, 82, 66,
  121, 81, 110, 113, 67, 48, 77, 86, 55, 52, 66, 119, 107, 82, 107,
  80, 110, 74, 89, 70, 90, 49, 119
];
function getSpeakingKey() { return _SPEAKING_SEEDS.map(c => String.fromCharCode(c)).join(''); }

const CLOUD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNErQQFdciAQM0k9KUrACtpX7rxKkopjChYAC2Ubwj5MGzFOeekDEGs8C1n7P9cNR6vg/exec";

// =========================================================================
// 2. METADATA VÀ CẤU HÌNH BÀI THI
// =========================================================================
const DIAGNOSTIC_META = {
  test_01: { title: "TEST 1: KHẢO SÁT NỀN TẢNG (45 PHÚT)", targetBand: "0 - 5.0" },
  test_02: { title: "TEST 2: KHẢO THÍ CHUẨN HÓA (100 PHÚT)", targetBand: "5.0 - 6.5" },
  test_03: { title: "TEST 3: THỬ THÁCH ĐỈNH CAO (105 PHÚT)", targetBand: "6.5 - 7.5+" }
};

// =========================================================================
// 3. ĐỘNG CƠ ĐIỀU PHỐI KHẢO THÍ MASTER
// =========================================================================
class DiagnosticEngineMaster {
  constructor() {
    this.currentSkill = "grammar";
    this.testId = "test_01";
    this.setNum = 1;

    this.timerSeconds = 0;
    this.timerInterval = null;

    this.speechRecognition = null;
    this.isRecording = false;
    this.isReviewMode = false;
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.testId = urlParams.get('testId') || 'test_01';
    
    const rawSet = parseInt(urlParams.get('set') || urlParams.get('ver'), 10);
    this.setNum = (!isNaN(rawSet) && rawSet >= 1 && rawSet <= 3) ? rawSet : 1;

    const meta = DIAGNOSTIC_META[this.testId] || DIAGNOSTIC_META.test_01;
    const titleEl = document.getElementById('currentTestTitle');
    if (titleEl) {
      titleEl.innerText = `${meta.title} • Set ${this.setNum}`;
    }

    // 1. Nạp Ngữ pháp
    await this.initGrammarFromJson();

    // 2. Nạp Listening (cho tất cả các test, không bị chặn)
    await this.initListeningFromJson();

    // 3. Nạp Reading
    await this.initReadingFromJson();

    // 4. Nạp Writing
    await this.initWritingFromJson();

    // 5. Khởi tạo Speaking, Mic & Timer
    this.initSpeechRecognition();
    this.startTimer();

    // 6. Khôi phục Review Mode nếu có attemptId trên URL
    const attemptId = urlParams.get('attemptId');
    if (attemptId) {
      this.restoreReviewMode(attemptId);
    }
  }

  // --- NẠP NGỮ PHÁP QUA DIAG-GRAMMAR.JS ---
  async initGrammarFromJson() {
    const testNum = this.testId.replace('test_0', '').replace('test_', '');
    const jsonPath = `data-diag/grammar/test${testNum}-grammar.json`;
    console.log(`[DiagEngine] Đang nạp Grammar JSON: ${jsonPath}`);
    const success = await diagGrammarEngine.loadTestFromJson(jsonPath);
    if (success) {
      diagGrammarEngine.render();
    }
  }

  // --- NẠP LISTENING QUA DIAG-LISTENING.JS (KHÔNG BỊ CHẶN TEST 1) ---
  async initListeningFromJson() {
    const testNum = this.testId.replace('test_0', '').replace('test_', '');
    const jsonPath = `data-diag/listening/test${testNum}-listening-s${this.setNum}.json`;
    console.log(`[DiagEngine] Đang nạp Listening JSON: ${jsonPath}`);
    const success = await diagListeningEngine.loadTestFromJson(jsonPath);
    if (success) {
      diagListeningEngine.render();
    }
  }

  // --- NẠP READING QUA DIAG-READING.JS ---
  async initReadingFromJson() {
    const testNum = this.testId.replace('test_0', '').replace('test_', '');
    const jsonPath = `data-diag/reading/test${testNum}-reading-s${this.setNum}.json`;
    console.log(`[DiagEngine] Đang nạp Reading JSON: ${jsonPath}`);
    const success = await diagReadingEngine.loadTestFromJson(jsonPath);
    if (success) {
      diagReadingEngine.render();
    }
  }

  // --- NẠP WRITING QUA DIAG-WRITING.JS ---
  async initWritingFromJson() {
    const testNum = this.testId.replace('test_0', '').replace('test_', '');
    const jsonPath = `data-diag/writing/test${testNum}-writing-s${this.setNum}.json`;
    console.log(`[DiagEngine] Đang nạp Writing JSON: ${jsonPath}`);
    const success = await diagWritingEngine.loadTestFromJson(jsonPath);
    if (success) {
      diagWritingEngine.render();
    }
  }

  // --- CHUYỂN TAB VÀ TIMER ---
  switchSection(skillKey) {
    ['grammar', 'listening', 'reading', 'writing', 'speaking'].forEach(s => {
      const tab = document.getElementById(`tabNav_${s}`);
      const sec = document.getElementById(`section_${s}`);
      if (tab) tab.classList.toggle('active', s === skillKey);
      if (sec) sec.style.display = (s === skillKey) ? 'block' : 'none';
    });
    this.currentSkill = skillKey;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startTimer() {
    this.timerSeconds = 0;
    const disp = document.getElementById('sectionTimerDisplay');
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      if (disp) {
        const mm = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
        const ss = String(this.timerSeconds % 60).padStart(2, '0');
        disp.innerText = `${mm}:${ss}`;
      }
    }, 1000);
  }

  initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) return;
    this.speechRecognition = new window.SpeechRecognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'en-US';
  }

  toggleSpeech(targetAreaId, btnId) {
    if (!this.speechRecognition) {
      alert("⚠️ Trình duyệt chưa hỗ trợ Web Speech. Em hãy gõ trực tiếp câu trả lời vào ô nhé!");
      return;
    }
    const btn = document.getElementById(btnId);
    const area = document.getElementById(targetAreaId);

    if (!this.isRecording) {
      try {
        this.speechRecognition.start();
        this.isRecording = true;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-stop"></i> Đang nghe... Bấm dừng`;
        this.speechRecognition.onresult = (e) => {
          let str = '';
          for (let i = 0; i < e.results.length; ++i) str += e.results[i][0].transcript + ' ';
          if (area) area.value = str.trim();
        };
      } catch(e) {}
    } else {
      try {
        this.speechRecognition.stop();
        this.isRecording = false;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Bấm để nói tiếng Anh`;
      } catch(e) {}
    }
  }

  // =========================================================================
  // 4. CHẤM BÀI TOÀN DIỆN QUA CÁC ENGINE & TÍCH HỢP AI GEMINI
  // =========================================================================
  async submitFullExam() {
    if (!confirm("Em có chắc chắn muốn nộp bài thi để hệ thống phân tích phản xạ, đối soát câu chữ và chấm điểm AI không?")) {
      return;
    }

    const btn = document.getElementById('btnSubmitFullDiagnostic');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ AI đang chấm bài dịch Writing, Speaking & đối soát câu sai...`;
    }

    clearInterval(this.timerInterval);

    // 1. Chấm Ngữ pháp qua DiagGrammarEngine
    const grammarResult = diagGrammarEngine.evaluate();

    // 2. Chấm Listening qua DiagListeningEngine
    const lisEval = diagListeningEngine.evaluate();

    // 3. Chấm Reading qua DiagReadingEngine
    const readingResult = diagReadingEngine.evaluate();

    // 4. Lấy bài Writing và gọi AI Gemini chấm
    const writingSubData = diagWritingEngine.getWritingSubmissionData ? diagWritingEngine.getWritingSubmissionData() : {};
    const wt1Text = writingSubData.task1Text || '';
    const wt2Text = writingSubData.task2Text || '';

    const spk1Text = document.getElementById('diag_spk_1')?.value.trim() || '';
    const spk2Text = document.getElementById('diag_spk_2')?.value.trim() || '';

    let aiWritingFeedback = "Chưa có bài viết.";
    let aiSpeakingFeedback = "Chưa có bài nói.";
    let writingBand = 4.0;
    let speakingBand = 4.0;

    try {
      if (wt1Text || wt2Text) {
        const wKey = getWritingKey();
        const wPrompt = `Chấm nhanh bài viết đầu vào (Task 1: "${wt1Text}" | Task 2: "${wt2Text}"). Cho 1 câu sửa sạch lỗi và ước lượng Band. Trả lời dưới 100 từ.`;
        aiWritingFeedback = await this.callGeminiRaw(wKey, wPrompt);
        const m = aiWritingFeedback.match(/Band\s*([0-9.]+)/i);
        if (m) writingBand = parseFloat(m[1]);
      }

      if (spk1Text || spk2Text) {
        const sKey = getSpeakingKey();
        const sPrompt = `Chấm nhanh bài nói Speaking Part 1 ("${spk1Text} ${spk2Text}"). Đánh giá phản xạ và ước lượng Band điểm. Trả lời dưới 100 từ.`;
        aiSpeakingFeedback = await this.callGeminiRaw(sKey, sPrompt);
        const m = aiSpeakingFeedback.match(/Band\s*([0-9.]+)/i);
        if (m) speakingBand = parseFloat(m[1]);
      }
    } catch(e) {
      console.warn("Lỗi AI Writing/Speaking:", e);
    }

    // 5. Tính toán Band tổng
    const lisRatio = lisEval.total > 0 ? (lisEval.score / lisEval.total) : 0;
    const gRatio = grammarResult.total > 0 ? (grammarResult.score / grammarResult.total) : 0;
    const rRatio = readingResult.total > 0 ? (readingResult.score / readingResult.total) : 0;

    const overallScore = Math.round((gRatio * 25) + (lisRatio * 25) + (rRatio * 25) + ((writingBand / 9) * 25));
    
    let estimatedBand = "4.5";
    let bandReason = "";
    if (overallScore < 35) {
      estimatedBand = "3.0 - 3.5";
      bandReason = "Hổng kiến thức thì cơ bản và từ vựng nhận diện. Độ trễ phản xạ đọc hiểu cao, cần tập trung xây gốc Ngữ pháp & Dictation nghe bắt âm A1/A2.";
    } else if (overallScore < 55) {
      estimatedBand = "4.0 - 4.5";
      bandReason = "Đã nắm được các thì đơn giản nhưng dễ mắc bẫy từ khóa (Matching Trap). Writing còn ảnh hưởng nặng dịch word-by-word từ tiếng Việt.";
    } else if (overallScore < 75) {
      estimatedBand = "5.0 - 5.5";
      bandReason = "Nền tảng câu đơn vững, nghe hiểu hội thoại tốt. Điểm nghẽn nằm ở câu phức và tư duy triển khai mạch lập luận PEEL của Writing.";
    } else {
      estimatedBand = "6.0 - 6.5+";
      bandReason = "Phản xạ nhanh, phân biệt rõ căn cứ bài đọc và tránh được bẫy suy diễn. Sẵn sàng bứt phá các dạng đề Cambridge chuyên sâu.";
    }

    // 6. Lưu vĩnh viễn dữ liệu
    const user = {
      name: localStorage.getItem('ielts_student_name') || 'Học viên',
      email: (localStorage.getItem('ielts_student_email') || 'guest@gmail.com').toLowerCase().trim()
    };

    const attemptSnapshot = {
      id: "diag_attempt_" + Date.now(),
      timestamp: new Date().toLocaleString('vi-VN'),
      testTitle: `${DIAGNOSTIC_META[this.testId]?.title || this.testId} (Set ${this.setNum})`,
      studentName: user.name,
      studentEmail: user.email,
      score: `Band ${estimatedBand} (${overallScore}/100)`,
      timeSpent: `${Math.round(this.timerSeconds / 60)} phút`,
      moduleType: "diagnostic",
      pageUrl: `diagnostic/runner-diag.html?testId=${this.testId}&set=${this.setNum}`,
      details: {
        gScore: `${grammarResult.score}/${grammarResult.total}`,
        lScore: `${lisEval.score}/${lisEval.total}`,
        rScore: `${readingResult.score}/${readingResult.total}`,
        wBand: writingBand,
        sBand: speakingBand,
        gWrongList: grammarResult.wrongList,
        lWrongList: lisEval.wrongList,
        rDetails: readingResult.details,
        grammarSnapshot: grammarResult.answersSnapshot,
        listeningSnapshot: lisEval.answersSnapshot,
        writingAnswersSnapshot: writingSubData.answersSnapshot,
        wt1Text, wt2Text, spk1Text, spk2Text,
        aiWritingFeedback,
        aiSpeakingFeedback,
        bandReason
      }
    };

    try {
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      localHist.unshift(attemptSnapshot);
      localStorage.setItem('ielts_local_history', JSON.stringify(localHist));

      if (this.testId === 'test_01') localStorage.setItem('diag_unlocked_test2', 'true');
      if (this.testId === 'test_02') localStorage.setItem('diag_unlocked_test3', 'true');
    } catch(e) {}

    fetch(CLOUD_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
    }).catch(() => {});

    // 7. Hiển thị Dashboard phân tích chi tiết
    this.renderComprehensiveDashboard(attemptSnapshot);
  }

  async callGeminiRaw(apiKey, prompt) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    });
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "Đã ghi nhận bài làm.";
  }

  // =========================================================================
  // 5. RENDER BẢNG BÁO CÁO DASHBOARD PHÂN TÍCH LỖI SAI (KHÔI PHỤC 100%)
  // =========================================================================
  renderComprehensiveDashboard(attempt) {
    const d = attempt.details;
    let wrongQuestionsHtml = '';

    // A. Sai Ngữ pháp
    if (d.gWrongList && d.gWrongList.length > 0) {
      wrongQuestionsHtml += `
        <div style="margin-bottom:16px;">
          <b style="color:#DC2626; font-size:14px;"><i class="fa-solid fa-circle-xmark"></i> CÁC CÂU SAI PHẦN NGỮ PHÁP (${d.gWrongList.length} câu):</b>
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
            ${d.gWrongList.map(item => `
              <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:8px; font-size:13px;">
                <b>Câu ${item.num}:</b> ${item.q}<br>
                <span style="color:#991B1B;">• Em chọn: <b>${item.chosen}</b></span> ➔ <span style="color:#166534;">Đáp án chuẩn: <b>${item.expected}</b></span>
                ${item.explanation ? `<div style="margin-top:3px; font-size:12px; color:#475569;">💡 ${item.explanation}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // B. Sai Listening
    if (d.lWrongList && d.lWrongList.length > 0) {
      wrongQuestionsHtml += `
        <div style="margin-bottom:16px;">
          <b style="color:#DC2626; font-size:14px;"><i class="fa-solid fa-circle-xmark"></i> CÁC CÂU SAI PHẦN LISTENING (${d.lWrongList.length} câu):</b>
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
            ${d.lWrongList.map(item => `
              <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:8px; font-size:13px;">
                <b>${item.q}</b><br>
                <span style="color:#991B1B;">• Em chọn: <b>${item.chosen}</b></span> ➔ <span style="color:#166534;">Đáp án chuẩn: <b>${item.expected}</b></span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // C. Sai Reading
    const rWrongList = (d.rDetails || []).filter(item => !item.isCorrect);
    if (rWrongList.length > 0) {
      wrongQuestionsHtml += `
        <div style="margin-bottom:16px;">
          <b style="color:#DC2626; font-size:14px;"><i class="fa-solid fa-circle-xmark"></i> CÁC CÂU CHƯA ĐẠT CHUẨN READING (${rWrongList.length} câu):</b>
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
            ${rWrongList.map(item => `
              <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:8px; font-size:13px;">
                <b>Câu ${item.questionNum}:</b> ${item.behaviorTag || 'Sai'}<br>
                <span style="color:#991B1B;">• Lựa chọn của em: <b>${item.userTier1 || item.userAnswer}</b></span> ➔ <span style="color:#166534;">Đáp án chuẩn: <b>${item.expectedTier1 || item.expectedAnswer}</b></span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    document.querySelector('.runner-container').innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #E8E2D8; border-bottom:7px solid #D3CBC0; border-radius:24px; padding:32px 24px; max-width:820px; margin:30px auto;">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="font-size:40px; margin-bottom:8px;">🎯</div>
          <h2 style="color:#8B1518; margin:0 0 6px 0; font-size:24px; font-weight:900;">BÁO CÁO PHÂN TÍCH NĂNG LỰC ĐẦU VÀO</h2>
          <span style="font-size:13px; font-weight:800; color:#64748B;">Học viên: ${attempt.studentName} • ${attempt.timestamp}</span>
        </div>

        <div style="background:#FEF3C7; border:2px solid #FCD34D; border-left:6px solid #D97706; padding:18px 20px; border-radius:16px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <b style="font-size:14px; color:#92400E;">🎯 BAND ƯỚC LƯỢNG SƠ BỘ:</b>
            <span style="font-size:24px; font-weight:900; color:#B45309;">${attempt.score}</span>
          </div>
          <div style="margin-top:10px; font-size:14px; line-height:1.6; color:#78350F; font-weight:700;">
            <b>💡 Phân tích nguyên nhân:</b> ${d.bandReason}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:22px;">
          <div style="background:#F0FDF4; border:1.5px solid #86EFAC; padding:12px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#166534;">NGỮ PHÁP</div>
            <b style="font-size:18px; color:#15803D;">${d.gScore}</b>
          </div>
          <div style="background:#F0F9FF; border:1.5px solid #BAE6FD; padding:12px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#0369A1;">LISTENING</div>
            <b style="font-size:18px; color:#0284C7;">${d.lScore}</b>
          </div>
          <div style="background:#FDF2F2; border:1.5px solid #FECACA; padding:12px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#991B1B;">READING</div>
            <b style="font-size:18px; color:#8B1518;">${d.rScore}</b>
          </div>
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:12px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">WRITING</div>
            <b style="font-size:18px; color:#2563EB;">Band ${d.wBand}</b>
          </div>
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:12px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">SPEAKING</div>
            <b style="font-size:18px; color:#D97706;">Band ${d.sBand}</b>
          </div>
        </div>

        <div style="background:#FAF7F2; border:2px solid #E8E2D8; border-radius:18px; padding:18px; margin-bottom:22px;">
          <h4 style="margin:0 0 12px 0; color:#261F1D; font-size:15px; font-weight:900;">
            🔍 CHI TIẾT CÁC CÂU LÀM SAI ĐỂ CẢI THIỆN:
          </h4>
          ${wrongQuestionsHtml || '<div style="color:#166534; font-weight:bold;">🎉 Tuyệt vời! Em không làm sai câu trắc nghiệm nào.</div>'}
        </div>

        <div style="background:#F8FAFC; border:1.5px solid #CBD5E1; border-radius:16px; padding:16px; margin-bottom:24px; font-size:13.5px; line-height:1.6;">
          <b style="color:#1E293B; display:block; margin-bottom:6px;">🤖 Nhận xét tự luận từ AI:</b>
          <div><b>Writing:</b> ${d.aiWritingFeedback}</div>
          <div style="margin-top:8px;"><b>Speaking:</b> ${d.aiSpeakingFeedback}</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
          <button type="button" onclick="location.reload()" class="btn-3d btn-3d-red" style="width:100%; padding:15px; font-size:16px;">
            👁️ XEM LẠI BÀI THI & TRANSCRIPT &rarr;
          </button>
          <div style="display:flex; gap:10px; width:100%;">
            <a href="index-diag.html" class="btn-3d btn-3d-white" style="flex:1; text-align:center;">⬅ Danh sách bài Test</a>
            <a href="../curriculum-system/roadmap.html" class="btn-3d btn-3d-blue" style="flex:1; text-align:center;">🚀 Lộ trình học &rarr;</a>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 6. REVIEW MODE: KHÔI PHỤC VÀ TÔ MÀU ĐÚNG SAI QUA CÁC ENGINE
  // =========================================================================
  restoreReviewMode(attemptId) {
    this.isReviewMode = true;
    try {
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      const att = localHist.find(a => a.id === attemptId);
      if (!att || !att.details) return;

      const d = att.details;

      // 1. Tô màu Ngữ pháp qua DiagGrammarEngine
      if (d.grammarSnapshot) {
        diagGrammarEngine.renderReviewMode({
          answersSnapshot: d.grammarSnapshot,
          details: d.gWrongList ? d.gWrongList.map(w => ({
            questionId: `t${this.testId.replace('test_0','')}_g${String(w.num).padStart(2,'0')}`,
            userAnswer: w.chosen,
            expectedAnswer: w.expected,
            isCorrect: false,
            explanation: w.explanation
          })) : []
        });
      }

      // 2. Khôi phục bài nghe qua DiagListeningEngine
      diagListeningEngine.renderReviewMode({
        answersSnapshot: d.listeningSnapshot || {},
        details: d.lDetails || []
      });

      // 3. Tô màu Reading qua DiagReadingEngine
      if (d.rDetails) {
        diagReadingEngine.renderReviewMode({ details: d.rDetails });
      }

      // 4. Khôi phục Writing qua DiagWritingEngine
      if (d.writingAnswersSnapshot) {
        diagWritingEngine.renderReviewMode(d.writingAnswersSnapshot);
      }

      // 5. Khôi phục Speaking
      const spk1 = document.getElementById('diag_spk_1');
      const spk2 = document.getElementById('diag_spk_2');
      if (spk1 && d.spk1Text) { spk1.value = d.spk1Text; spk1.disabled = true; }
      if (spk2 && d.spk2Text) { spk2.value = d.spk2Text; spk2.disabled = true; }

      document.getElementById('btnSubmitFullDiagnostic')?.remove();
      alert(`📜 Đang ở chế độ XEM LẠI BÀI THI: ${att.testTitle} (${att.score})`);
    } catch(e) {
      console.warn("Lỗi khôi phục Review Mode:", e);
    }
  }
}

// Khởi tạo toàn cục
export const diagEngine = new DiagnosticEngineMaster();
window.diagEngine = diagEngine;
window.switchSkillSection = (s) => diagEngine.switchSection(s);
window.toggleDiagSpeech = (t, b) => diagEngine.toggleSpeech(t, b);
window.submitDiagnosticExam = () => diagEngine.submitFullExam();

document.addEventListener('DOMContentLoaded', () => diagEngine.init());
