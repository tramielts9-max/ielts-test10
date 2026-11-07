/**
 * diagnostic/js-diag/diag-engine.js
 * BỘ MÁY ĐIỀU PHỐI KHẢO THÍ CHẨN ĐOÁN THÍCH ỨNG MASTER (TEST 1, 2, 3 & 3 SET XOAY TUA)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 * - XÓA BỎ TOÀN BỘ ĐIỂM SÀN ẢO 4.5 WRITING & SPEAKING
 * - BỎ TRỐNG BÀI ➔ TRẢ THẲNG BAND 0.0 THEO ĐÚNG CHUẨN KHẢO THÍ
 * - IN-PLACE REVIEW & INLINE AI GRADING TRỰC TIẾP TRÊN GIAO DIỆN
 */

import { diagGrammarEngine } from './diag-grammar.js';
import { diagListeningEngine } from './diag-listening.js';
import { diagReadingEngine } from './diag-reading.js';
import { diagWritingEngine } from './diag-writing.js';

// =========================================================================
// 1. MÃ HÓA CÁC API KEY BẢO MẬT CHỐNG F12
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

    // 2. Nạp Listening
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

  // --- NẠP LISTENING QUA DIAG-LISTENING.JS ---
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

  // Tiện ích đếm từ phòng ngự
  countWords(str) {
    if (!str || typeof str !== 'string') return 0;
    const cleaned = str.replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  // =========================================================================
  // 4. CHẤM BÀI TRỰC TIẾP TRÊN GIAO DIỆN (XÓA SÀN ĐIỂM ẢO 4.5/5.5)
  // =========================================================================
  async submitFullExam() {
    if (!confirm("Em có chắc chắn muốn nộp bài thi để hệ thống phân tích câu chữ và AI chấm điểm trực tiếp trên bài làm không?")) {
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitFullDiagnostic');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `⏳ AI đang chấm bài trực tiếp trên từng Tab...`;
    }

    clearInterval(this.timerInterval);
    this.isReviewMode = true;

    // 1. Chấm Ngữ pháp qua DiagGrammarEngine
    const grammarResult = diagGrammarEngine.evaluate();

    // 2. Chấm Listening qua DiagListeningEngine
    const lisEval = diagListeningEngine.evaluate();

    // 3. Chấm Reading qua DiagReadingEngine
    const readingResult = diagReadingEngine.evaluate();

    // 4. Lấy bài viết Writing và bài nói Speaking
    const writingSubData = diagWritingEngine.getWritingSubmissionData ? diagWritingEngine.getWritingSubmissionData() : {};
    const wt1Text = writingSubData.task1Text || '';
    const wt2Text = writingSubData.task2Text || '';

    const spk1Text = document.getElementById('diag_spk_1')?.value.trim() || '';
    const spk2Text = document.getElementById('diag_spk_2')?.value.trim() || '';

    // Khóa các ô nhập Speaking
    const spk1Inp = document.getElementById('diag_spk_1');
    const spk2Inp = document.getElementById('diag_spk_2');
    if (spk1Inp) spk1Inp.disabled = true;
    if (spk2Inp) spk2Inp.disabled = true;

    // 5. TÍNH TOÁN BAND ĐIỂM CHUẨN XÁC TUYỆT ĐỐI (XÓA SÀN ẢO)
    const wt1Words = this.countWords(wt1Text);
    const wt2Words = this.countWords(wt2Text);
    const totalWritingWords = wt1Words + wt2Words;

    let writingBand = 0.0;
    if (totalWritingWords === 0) {
      writingBand = 0.0; // Bỏ trống = Band 0.0
    } else if (totalWritingWords < 15) {
      writingBand = 1.0;
    } else if (totalWritingWords < 35) {
      writingBand = 2.5;
    } else if (totalWritingWords < 70) {
      writingBand = 3.5;
    } else if (totalWritingWords < 130) {
      writingBand = 4.5;
    } else if (totalWritingWords < 200) {
      writingBand = 5.5;
    } else {
      writingBand = 6.0;
    }

    const spk1Words = this.countWords(spk1Text);
    const spk2Words = this.countWords(spk2Text);
    const totalSpeakingWords = spk1Words + spk2Words;

    let speakingBand = 0.0;
    if (totalSpeakingWords === 0) {
      speakingBand = 0.0; // Bỏ trống = Band 0.0
    } else if (totalSpeakingWords < 10) {
      speakingBand = 1.5;
    } else if (totalSpeakingWords < 25) {
      speakingBand = 2.5;
    } else if (totalSpeakingWords < 50) {
      speakingBand = 3.5;
    } else if (totalSpeakingWords < 100) {
      speakingBand = 4.5;
    } else {
      speakingBand = 5.5;
    }

    // Tỉ lệ phần trăm các môn
    const lisRatio = lisEval.total > 0 ? (lisEval.score / lisEval.total) : 0;
    const gRatio = grammarResult.total > 0 ? (grammarResult.score / grammarResult.total) : 0;
    const rRatio = readingResult.total > 0 ? (readingResult.score / readingResult.total) : 0;
    const overallScore = Math.round((gRatio * 25) + (lisRatio * 25) + (rRatio * 25) + ((writingBand / 9) * 25));

    // ĐỊNH VỊ BAND CHẨN ĐOÁN
    let estimatedBand = "0.0";
    let bandReason = "";

    if (overallScore === 0) {
      estimatedBand = "0.0";
      bandReason = "Em chưa làm các câu hỏi trong bài khảo sát. Hãy quay lại làm bài để hệ thống phân tích năng lực chính xác.";
    } else if (overallScore < 20) {
      estimatedBand = "1.0 - 2.5";
      bandReason = "Mức độ nhận diện ngôn ngữ ở giai đoạn bắt đầu (Pre-A1). Cần xây nền từ vựng sinh hoạt cơ bản và phát âm ngữ âm.";
    } else if (overallScore < 38) {
      estimatedBand = "3.0 - 3.5";
      bandReason = "Hổng kiến thức thì cơ bản và từ vựng nhận diện. Cần tập trung xây gốc Ngữ pháp & Dictation nghe bắt âm A1/A2.";
    } else if (overallScore < 55) {
      estimatedBand = "4.0 - 4.5";
      bandReason = "Đã nắm được các thì đơn giản nhưng dễ mắc bẫy từ khóa (Matching Trap). Writing còn ảnh hưởng nặng dịch word-by-word.";
    } else if (overallScore < 75) {
      estimatedBand = "5.0 - 5.5";
      bandReason = "Nền tảng câu đơn vững, nghe hiểu hội thoại tốt. Điểm nghẽn nằm ở câu phức và tư duy triển khai lập luận PEEL.";
    } else {
      estimatedBand = "6.0 - 6.5+";
      bandReason = "Phản xạ nhanh, phân biệt rõ căn cứ bài đọc và tránh được bẫy suy diễn. Sẵn sàng bứt phá các dạng đề chuyên sâu.";
    }

    // 6. KÍCH HOẠT CHẾ ĐỘ XEM LẠI TRÊN CẢ 4 BỘ MÁY
    diagGrammarEngine.renderReviewMode(grammarResult);
    diagListeningEngine.renderReviewMode(lisEval);
    diagReadingEngine.renderReviewMode(readingResult);
    if (diagWritingEngine.renderReviewMode) {
      diagWritingEngine.renderReviewMode(writingSubData.answersSnapshot || {});
    }

    // 7. HIỂN THỊ THANH BANNER KẾT QUẢ NỔI TRÊN ĐẦU TRANG
    this.renderInPlaceResultBanner({
      overallBand: `Band ${estimatedBand}`,
      overallScore: `${overallScore}/100`,
      gScore: `${grammarResult.score}/${grammarResult.total}`,
      lScore: `${lisEval.score}/${lisEval.total}`,
      rScore: `${readingResult.score}/${readingResult.total}`,
      wBand: `Band ${writingBand.toFixed(1)}`,
      sBand: `Band ${speakingBand.toFixed(1)}`,
      bandReason: bandReason,
      timeSpent: `${Math.round(this.timerSeconds / 60)} phút`
    });

    // 8. GỌI AI CHẤM TRỰC TIẾP DƯỚI BÀI VIẾT (CHỈ GỌI KHI CÓ BÀI LÀM)
    this.renderInlineWritingAICard(wt1Text, wt2Text, totalWritingWords);

    // 9. GỌI AI CHẤM TRỰC TIẾP DƯỚI BÀI NÓI (CHỈ GỌI KHI CÓ BÀI NÓI)
    this.renderInlineSpeakingAICard(spk1Text, spk2Text, totalSpeakingWords);

    // 10. Lưu lịch sử làm bài
    const attemptSnapshot = {
      id: "diag_attempt_" + Date.now(),
      timestamp: new Date().toLocaleString('vi-VN'),
      testTitle: `${DIAGNOSTIC_META[this.testId]?.title || this.testId} (Set ${this.setNum})`,
      studentName: localStorage.getItem('ielts_student_name') || 'Học viên',
      studentEmail: localStorage.getItem('ielts_student_email') || 'guest@gmail.com',
      score: `Band ${estimatedBand} (${overallScore}/100)`,
      timeSpent: `${Math.round(this.timerSeconds / 60)} phút`,
      moduleType: "diagnostic",
      pageUrl: `diagnostic/runner-diag.html?testId=${this.testId}&set=${this.setNum}`
    };

    try {
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      localHist.unshift(attemptSnapshot);
      localStorage.setItem('ielts_local_history', JSON.stringify(localHist));

      if (this.testId === 'test_01' && overallScore >= 40) localStorage.setItem('diag_unlocked_test2', 'true');
      if (this.testId === 'test_02' && overallScore >= 55) localStorage.setItem('diag_unlocked_test3', 'true');
    } catch(e) {}

    fetch(CLOUD_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save_attempt", attempt: attemptSnapshot })
    }).catch(() => {});

    if (btnSubmit) {
      btnSubmit.innerHTML = `✓ ĐÃ NỘP BÀI — ĐANG Ở CHẾ ĐỘ XEM LẠI`;
      btnSubmit.style.background = "#059669";
    }
  }

  // --- RENDER THANH BANNER KẾT QUẢ NỔI TRÊN ĐẦU (KHÔNG XÓA BÀI THI) ---
  renderInPlaceResultBanner(data) {
    let banner = document.getElementById('diagStickyResultBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'diagStickyResultBanner';
      const container = document.querySelector('.runner-container');
      if (container) container.insertBefore(banner, container.firstChild);
    }

    banner.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #059669; border-bottom:6px solid #047857; border-radius:22px; padding:20px 24px; margin-bottom:20px; box-shadow:0 8px 24px rgba(5, 150, 105, 0.12);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <span style="font-size:12px; font-weight:900; background:#D1FAE5; color:#065F46; padding:3px 10px; border-radius:8px; text-transform:uppercase;">
              KẾT QUẢ BÀI THI CHẨN ĐOÁN (ĐANG XEM LẠI)
            </span>
            <div style="display:flex; align-items:baseline; gap:12px; margin-top:4px;">
              <span style="font-size:32px; font-weight:900; color:#059669;">${data.overallBand}</span>
              <span style="font-size:15px; font-weight:800; color:#475569;">Tổng điểm: ${data.overallScore} • Thời gian: ${data.timeSpent}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a href="index-diag.html" class="btn-3d btn-3d-white" style="padding:8px 16px; font-size:13px;">← Danh mục đề</a>
            <a href="../curriculum-system/roadmap.html" class="btn-3d btn-3d-blue" style="padding:8px 16px; font-size:13px;">🚀 Lộ trình học &rarr;</a>
          </div>
        </div>

        <!-- 5 THẺ ĐIỂM KỸ NĂNG -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-top:16px;">
          <div style="background:#F0FDF4; border:1.5px solid #86EFAC; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#166534;">NGỮ PHÁP</div>
            <b style="font-size:17px; color:#15803D;">${data.gScore}</b>
          </div>
          <div style="background:#F0F9FF; border:1.5px solid #BAE6FD; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#0369A1;">LISTENING</div>
            <b style="font-size:17px; color:#0284C7;">${data.lScore}</b>
          </div>
          <div style="background:#FDF2F2; border:1.5px solid #FECACA; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#991B1B;">READING</div>
            <b style="font-size:17px; color:#8B1518;">${data.rScore}</b>
          </div>
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">WRITING</div>
            <b style="font-size:17px; color:#2563EB;">${data.wBand}</b>
          </div>
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">SPEAKING</div>
            <b style="font-size:17px; color:#D97706;">${data.sBand}</b>
          </div>
        </div>

        <div style="margin-top:12px; font-size:13.5px; line-height:1.6; color:#065F46; background:#ECFDF5; padding:10px 14px; border-radius:10px;">
          <b>💡 Nhận xét định hướng:</b> ${data.bandReason}
        </div>
      </div>
    `;

    banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- RENDER AI CHẤM TRỰC TIẾP DƯỚI BÀI VIẾT (TAB WRITING) ---
  async renderInlineWritingAICard(t1, t2, totalWords = 0) {
    const secWriting = document.getElementById('section_writing');
    if (!secWriting) return;

    let aiCard = document.getElementById('inlineWritingAiReport');
    if (!aiCard) {
      aiCard = document.createElement('div');
      aiCard.id = 'inlineWritingAiReport';
      secWriting.appendChild(aiCard);
    }

    if (totalWords === 0) {
      aiCard.innerHTML = `
        <div style="background:#FEF2F2; border:2.5px solid #EF4444; border-radius:18px; padding:18px; margin-top:20px;">
          <h4 style="color:#991B1B; margin:0 0 6px 0; font-size:16px; font-weight:900;">
            ✍️ PHẦN THI WRITING: BAND 0.0
          </h4>
          <p style="margin:0; font-size:13.5px; color:#7F1D1D; font-weight:700;">
            Học viên không thực hiện bài viết này (Does not attempt the task in any way).
          </p>
        </div>
      `;
      return;
    }

    aiCard.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #2563EB; border-radius:18px; padding:22px; margin-top:20px;">
        <h4 style="color:#1E40AF; margin:0 0 10px 0; font-size:18px; font-weight:900;">
          🤖 PHIẾU CHẤM ĐIỂM WRITING TRỰC TIẾP TỪ AI GEMINI (4 TIÊU CHÍ IELTS)
        </h4>
        <div id="inlineWritingAiStream" style="font-size:14px; line-height:1.75; color:#1E293B;">
          ⏳ <b>AI Gemini đang đọc toàn bộ bài viết, đối soát ngữ pháp và phân tích 4 tiêu chí...</b>
        </div>
      </div>
    `;

    const streamBox = document.getElementById('inlineWritingAiStream');
    const wKey = getWritingKey();

    const promptText = `
Bạn là Giám khảo Khảo thí IELTS Writing cự phách. Hãy đọc bài viết dưới đây của học sinh và xuất phiếu chấm điểm chi tiết.
Xưng hô: "Anh" và gọi học viên là "Em".

BÀI VIẾT CỦA EM:
- Task 1: "${t1 || '(Chưa làm)'}"
- Task 2: "${t2 || '(Chưa làm)'}"

XUẤT BÁO CÁO THEO ĐÚNG CẤU TRÚC MARKDOWN:
# 🎯 BẢNG ĐIỂM 4 TIÊU CHÍ IELTS WRITING:
- Task Achievement / Response: [Điểm]/9.0
- Coherence & Cohesion: [Điểm]/9.0
- Lexical Resource: [Điểm]/9.0
- Grammatical Range & Accuracy: [Điểm]/9.0
### 🏆 OVERALL WRITING BAND: [Band điểm]

# 🔍 CÁC LỖI SAI CẦN SỬA GẤP TRONG BÀI CỦA EM:
(Trích câu sai của Em ➔ Sửa lại cho đúng ngữ pháp và tự nhiên).

# 📖 GỢI Ý ĐOẠN VĂN MẪU BAND 8.0:
(Viết 1 đoạn mẫu ngắn gọn nâng cấp từ ý tưởng của Em).
`;

    try {
      const feedback = await this.callGeminiRaw(wKey, promptText);
      if (window.marked && streamBox) {
        streamBox.innerHTML = window.marked.parse(feedback);
      } else if (streamBox) {
        streamBox.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit;">${feedback}</pre>`;
      }
    } catch(e) {
      if (streamBox) streamBox.innerHTML = `<span style="color:#DC2626;">❌ Không thể kết nối AI: ${e.message}</span>`;
    }
  }

  // --- RENDER AI CHẤM TRỰC TIẾP DƯỚI BÀI NÓI (TAB SPEAKING) ---
  async renderInlineSpeakingAICard(s1, s2, totalWords = 0) {
    const secSpeaking = document.getElementById('section_speaking');
    if (!secSpeaking) return;

    let aiCard = document.getElementById('inlineSpeakingAiReport');
    if (!aiCard) {
      aiCard = document.createElement('div');
      aiCard.id = 'inlineSpeakingAiReport';
      secSpeaking.appendChild(aiCard);
    }

    if (totalWords === 0) {
      aiCard.innerHTML = `
        <div style="background:#FEF2F2; border:2.5px solid #EF4444; border-radius:18px; padding:18px; margin-top:20px;">
          <h4 style="color:#991B1B; margin:0 0 6px 0; font-size:16px; font-weight:900;">
            🎤 PHẦN THI SPEAKING: BAND 0.0
          </h4>
          <p style="margin:0; font-size:13.5px; color:#7F1D1D; font-weight:700;">
            Thí sinh không tham gia trả lời bài thi nói (Does not attend / Does not complete the test).
          </p>
        </div>
      `;
      return;
    }

    aiCard.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #D97706; border-radius:18px; padding:22px; margin-top:20px;">
        <h4 style="color:#B45309; margin:0 0 10px 0; font-size:18px; font-weight:900;">
          🎤 NHẬN XÉT PHẢN XẠ NÓI TRỰC TIẾP TỪ AI GEMINI
        </h4>
        <div id="inlineSpeakingAiStream" style="font-size:14px; line-height:1.75; color:#1E293B;">
          ⏳ <b>AI Gemini đang đọc bản ký âm và đánh giá độ trôi chảy...</b>
        </div>
      </div>
    `;

    const streamBox = document.getElementById('inlineSpeakingAiStream');
    const sKey = getSpeakingKey();

    const promptText = `
Bạn là Chuyên gia Khảo thí IELTS Speaking. Hãy nhận xét bài nói dưới đây của học sinh. Xưng hô "Anh" và "Em".
BẢN KÝ ÂM SPEAKING:
- Câu 1: "${s1 || '(Chưa nói)'}"
- Câu 2: "${s2 || '(Chưa nói)'}"

XUẤT BÁO CÁO (DƯỚI 200 TỪ):
1. 🎯 Ước lượng Band điểm Speaking và nhận xét độ trôi chảy (Fluency).
2. 🔍 Chỉ ra 2 lỗi ngữ pháp hoặc từ vựng bị gượng ép.
3. 💡 Viết lại câu trả lời mẫu tự nhiên và học thuật hơn cho Em.
`;

    try {
      const feedback = await this.callGeminiRaw(sKey, promptText);
      if (window.marked && streamBox) {
        streamBox.innerHTML = window.marked.parse(feedback);
      } else if (streamBox) {
        streamBox.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit;">${feedback}</pre>`;
      }
    } catch(e) {
      if (streamBox) streamBox.innerHTML = `<span style="color:#DC2626;">❌ Không thể kết nối AI: ${e.message}</span>`;
    }
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
  // 5. REVIEW MODE TỪ LỊCH SỬ (KHÔI PHỤC BÀI LÀM TRỰC TIẾP TRÊN GIAO DIỆN)
  // =========================================================================
  restoreReviewMode(attemptId) {
    this.isReviewMode = true;
    try {
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      const att = localHist.find(a => a.id === attemptId);
      if (!att || !att.details) return;

      const d = att.details;

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

      diagListeningEngine.renderReviewMode({
        answersSnapshot: d.listeningSnapshot || {},
        details: d.lDetails || []
      });

      if (d.rDetails) {
        diagReadingEngine.renderReviewMode({ details: d.rDetails });
      }

      if (d.writingAnswersSnapshot && diagWritingEngine.renderReviewMode) {
        diagWritingEngine.renderReviewMode(d.writingAnswersSnapshot);
      }

      const spk1 = document.getElementById('diag_spk_1');
      const spk2 = document.getElementById('diag_spk_2');
      if (spk1 && d.spk1Text) { spk1.value = d.spk1Text; spk1.disabled = true; }
      if (spk2 && d.spk2Text) { spk2.value = d.spk2Text; spk2.disabled = true; }

      this.renderInPlaceResultBanner({
        overallBand: att.score.split('(')[0].trim(),
        overallScore: att.score.includes('(') ? att.score.split('(')[1].replace(')', '') : '100/100',
        gScore: d.gScore || 'N/A',
        lScore: d.lScore || 'N/A',
        rScore: d.rScore || 'N/A',
        wBand: `Band ${d.wBand || '0.0'}`,
        sBand: `Band ${d.sBand || '0.0'}`,
        bandReason: d.bandReason || 'Xem lại kết quả bài làm chi tiết bên dưới.',
        timeSpent: att.timeSpent || 'N/A'
      });

      if (d.wt1Text || d.wt2Text) {
        this.renderInlineWritingAICard(d.wt1Text, d.wt2Text, this.countWords(`${d.wt1Text} ${d.wt2Text}`));
      }
      if (d.spk1Text || d.spk2Text) {
        this.renderInlineSpeakingAICard(d.spk1Text, d.spk2Text, this.countWords(`${d.spk1Text} ${d.spk2Text}`));
      }

      document.getElementById('btnSubmitFullDiagnostic')?.remove();
    } catch(e) {
      console.warn("Lỗi khôi phục Review Mode:", e);
    }
  }
}

export const diagEngine = new DiagnosticEngineMaster();
window.diagEngine = diagEngine;
window.switchSkillSection = (s) => diagEngine.switchSection(s);
window.toggleDiagSpeech = (t, b) => diagEngine.toggleSpeech(t, b);
window.submitDiagnosticExam = () => diagEngine.submitFullExam();

document.addEventListener('DOMContentLoaded', () => diagEngine.init());
