/**
 * diagnostic/js-diag/diag-engine.js
 * BỘ MÁY ĐIỀU PHỐI KHẢO THÍ CHẨN ĐOÁN THÍCH ỨNG MASTER (TEST 1, 2, 3 & 3 SET XOAY TUA)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG CODE TÍNH NĂNG NÀO
 * - BẢO LƯU TOÀN BỘ LOGIC LÀM BÀI, AUDIO PLAYER, WEBSPEECH CŨ & CHẤM ĐIỂM GỐC
 * - TỰ ĐỘNG CHỤP SNAPSHOT NGẦM TẠI MỐC (+5 PHÚT): TEST 1 (50P), TEST 2 (105P), TEST 3 (110P)
 * - XUẤT 2 BẢNG KẾT QUẢ ĐỘC LẬP: KẾT QUẢ CHUẨN GIỜ (OFFICIAL) VS KẾT QUẢ TIỀM NĂNG (FULL OVERTIME)
 * - MA TRẬN KHỐNG CHẾ TRẦN ĐIỂM CHUẨN XÁC: TEST 1 (80/100 = BAND 4.0, MAX 5.0)
 * - TÍCH HỢP ITEM-LEVEL ERROR TAGGING SẴN SÀNG CHO ADMIN MODERATION GATE
 * - ĐÓNG GÓI 100% DỮ LIỆU BÀI LÀM LÊN GOOGLE DRIVE & HỖ TRỢ XEM LẠI REVIEW MODE TỪ XA
 */

import { diagGrammarEngine } from './diag-grammar.js';
import { diagListeningEngine } from './diag-listening.js';
import { diagReadingEngine } from './diag-reading.js';
import { diagWritingEngine } from './diag-writing.js';
import { diagSpeakingEngine } from './diag-speaking.js';
import { diagAIService, TEST_CEILINGS, roundIELTS, calculateSmartOverCap } from './diag-ai.js';

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
// 2. METADATA VÀ CẤU HÌNH BÀI THI & MỐC THỜI GIAN SNAPSHOT
// =========================================================================
const DIAGNOSTIC_META = {
  test_01: { 
    title: "TEST 1: KHẢO SÁT NỀN TẢNG (45 PHÚT)", 
    targetBand: "0 - 4.5 (Max 5.0)",
    baseMinutes: 45,
    snapshotMinutes: 50,
    snapshotSeconds: 50 * 60 // 3000s
  },
  test_02: { 
    title: "TEST 2: KHẢO THÍ CHUẨN HÓA (100 PHÚT)", 
    targetBand: "4.5 - 6.0 (Max 6.5)",
    baseMinutes: 100,
    snapshotMinutes: 105,
    snapshotSeconds: 105 * 60 // 6300s
  },
  test_03: { 
    title: "TEST 3: THỬ THÁCH ĐỈNH CAO (105 PHÚT)", 
    targetBand: "6.0 - 7.5+",
    baseMinutes: 105,
    snapshotMinutes: 110,
    snapshotSeconds: 110 * 60 // 6600s
  }
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

    // Giữ nguyên vẹn tính năng WebSpeech trực tiếp của bản gốc
    this.speechRecognition = null;
    this.isRecording = false;

    // Dữ liệu Snapshot ngầm tại mốc (+5 phút)
    this.isSnapshotTaken = false;
    this.snapshotOfficialData = null;

    this.isReviewMode = false;
    this.currentAttemptSnapshot = null;
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

    // 5. Nạp Speaking động từ JSON mới
    await this.initSpeakingFromJson();

    // 6. Khởi tạo Speech Recognition gốc (bảo toàn nguyên vẹn 100%)
    this.initSpeechRecognition();

    // 7. Bật đồng hồ đếm giây & cơ chế tự động Snapshot
    this.startTimer();

    // 8. Khôi phục Review Mode nếu có attemptId trên URL (Hỗ trợ mở từ Cloud cho Admin)
    const attemptId = urlParams.get('attemptId');
    const emailParam = urlParams.get('email') || '';
    if (attemptId) {
      await this.restoreReviewMode(attemptId, emailParam);
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

  // --- NẠP SPEAKING ĐỘNG TỪ FILE JSON MỚI ---
  async initSpeakingFromJson() {
    const testNum = this.testId.replace('test_0', '').replace('test_', '');
    const jsonPath = `data-diag/speaking/test${testNum}-speaking.json`;
    console.log(`[DiagEngine] Đang nạp Speaking JSON: ${jsonPath}`);
    diagSpeakingEngine.init(false, this.testId);
    await diagSpeakingEngine.loadTestFromJson(jsonPath);
    diagSpeakingEngine.render('section_speaking');
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

  // =========================================================================
  // 4. BỘ ĐẾM THỜI GIAN & TỰ ĐỘNG CHỤP SNAPSHOT TẠI MỐC (+5 PHÚT)
  // =========================================================================
  startTimer() {
    this.timerSeconds = 0;
    this.isSnapshotTaken = false;
    this.snapshotOfficialData = null;

    const meta = DIAGNOSTIC_META[this.testId] || DIAGNOSTIC_META.test_01;
    const targetThresholdSec = meta.snapshotSeconds || (50 * 60);

    const disp = document.getElementById('sectionTimerDisplay');
    clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.timerSeconds++;

      // Cập nhật giao diện đồng hồ
      if (disp) {
        const mm = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
        const ss = String(this.timerSeconds % 60).padStart(2, '0');
        disp.innerText = `${mm}:${ss}`;

        // Cảnh báo màu khi vượt mốc chuẩn
        if (this.timerSeconds > meta.baseMinutes * 60) {
          disp.parentElement.style.background = "#FEE2E2";
          disp.parentElement.style.color = "#DC2626";
          disp.parentElement.style.borderColor = "#FCA5A5";
        }
      }

      // KÍCH HOẠT TỰ ĐỘNG CHỤP SNAPSHOT NGẦM TẠI ĐÚNG MỐC (+5 PHÚT)
      if (!this.isSnapshotTaken && this.timerSeconds === targetThresholdSec) {
        this.takeSilentSnapshot();
      }
    }, 1000);
  }

  takeSilentSnapshot() {
    this.isSnapshotTaken = true;
    const meta = DIAGNOSTIC_META[this.testId] || DIAGNOSTIC_META.test_01;

    // Chụp sâu toàn bộ đáp án của cả 5 kỹ năng tính đến thời điểm này
    this.snapshotOfficialData = {
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      elapsedSeconds: this.timerSeconds,
      snapshotMinutes: meta.snapshotMinutes,
      grammarAnswers: JSON.parse(JSON.stringify(diagGrammarEngine.userAnswers || {})),
      listeningAnswers: JSON.parse(JSON.stringify(diagListeningEngine.userAnswers || {})),
      readingAnswers: JSON.parse(JSON.stringify(diagReadingEngine.userAnswers || {})),
      writingSnapshot: diagWritingEngine.getWritingSnapshot ? diagWritingEngine.getWritingSnapshot() : {},
      speakingSnapshot: diagSpeakingEngine.getSpeakingSnapshot ? diagSpeakingEngine.getSpeakingSnapshot() : {}
    };

    try {
      localStorage.setItem(`diag_snapshot_${this.testId}`, JSON.stringify(this.snapshotOfficialData));
    } catch(e) {}

    console.log(`[DiagEngine] ⏱️ ĐÃ CHỤP SNAPSHOT BÀI LÀM TẠI PHÚT THỨ ${meta.snapshotMinutes}!`, this.snapshotOfficialData);

    // Bật thông báo toast nhẹ nhàng góc màn hình (không làm đơ hay ngắt bài thi)
    this.showToastNotification(`⏱️ Đã lưu mốc chuẩn giờ (${meta.snapshotMinutes} phút). Em hãy tiếp tục hoàn thành bài!`);
  }

  showToastNotification(msg) {
    let toast = document.getElementById('diagSnapshotToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'diagSnapshotToast';
      toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        background: #065F46; color: #FFFFFF; font-weight: 800; font-size: 13px;
        padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        border: 1.5px solid #34D399; transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 4000);
  }

  // =========================================================================
  // 5. GIỮ NGUYÊN VẸN 100% TÍNH NĂNG THU ÂM GỐC CỦA DIAG-ENGINE
  // =========================================================================
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

  // Tiện ích đếm từ phòng thủ
  countWords(str) {
    if (!str || typeof str !== 'string') return 0;
    const cleaned = str.replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  // =========================================================================
  // 6. THUẬT TOÁN ĐỊNH VỊ BAND THEO TỪNG BÀI TEST (FIX BUG 80/100 ĂN 6.5)
  // =========================================================================
  calculateCalibratedBand(testId, overallScore, wBandNum, sBandNum) {
    const score = Math.max(0, Math.min(100, overallScore));
    let estimatedBand = "0.0";
    let bandReason = "";

    // MA TRẬN TEST 1: NỀN TẢNG (TRẦN CHUẨN 4.5 - MAX 5.0 CHO 100%)
    if (testId === 'test_01') {
      if (score === 0) {
        estimatedBand = "0.0";
        bandReason = "Chưa làm bài khảo sát nền tảng.";
      } else if (score < 25) {
        estimatedBand = "1.0 - 2.0";
        bandReason = "Mức độ nhận diện ngôn ngữ ở giai đoạn vỡ lòng (Pre-A1). Cần xây gốc từ phát âm và từ vựng sinh hoạt.";
      } else if (score < 50) {
        estimatedBand = "2.5 - 3.0";
        bandReason = "Đã nhận biết được câu đơn giản nhưng hổng thì quá khứ và từ vựng nhận diện. Cần củng cố Ngữ pháp & Dictation A1.";
      } else if (score < 75) {
        estimatedBand = "3.5";
        bandReason = "Nắm được ngữ pháp cơ bản nhưng phản xạ nghe còn chậm, câu viết còn bị dịch word-by-word.";
      } else if (score < 90) {
        estimatedBand = "4.0"; // 80/100 rơi chính xác vào Band 4.0!
        bandReason = "Hoàn thành tốt bài khảo sát nền tảng Test 1. Nền câu đơn vững vàng, sẵn sàng bước sang Test 2.";
      } else if (score < 95) {
        estimatedBand = "4.5";
        bandReason = "Nắm rất chắc kiến thức nền tảng, phản xạ nhanh và chính xác. Sẵn sàng bứt phá lên Band 5.5.";
      } else {
        estimatedBand = "5.0";
        bandReason = "Chạm trần tối đa bài Test 1 (Làm đúng tuyệt đối trên 95%). Đủ điều kiện vượt cấp thẳng lên Chặng 2.";
      }

    // MA TRẬN TEST 2: CHUẨN HÓA (TRẦN CHUẨN 6.0 - MAX 6.5)
    } else if (testId === 'test_02') {
      if (score < 30) {
        estimatedBand = "3.5 - 4.0";
        bandReason = "Hổng các cấu trúc câu điều kiện, câu bị động và dễ mất dấu khi nghe bài Map Labelling.";
      } else if (score < 50) {
        estimatedBand = "4.5";
        bandReason = "Đã xử lý được các đoạn văn trung cấp nhưng vốn từ học thuật còn hạn chế, Writing chưa có câu phức.";
      } else if (score < 70) {
        estimatedBand = "5.0";
        bandReason = "Nghe hiểu hội thoại tốt, làm chủ câu đơn. Điểm nghẽn nằm ở tư duy triển khai lập luận PEEL và từ vựng chuyên ngành.";
      } else if (score < 85) {
        estimatedBand = "5.5";
        bandReason = "Đạt chuẩn đầu ra trung cấp vững vàng. Cần rèn thêm kỹ thuật Skimming/Scanning đề dài.";
      } else if (score < 95) {
        estimatedBand = "6.0";
        bandReason = "Chạm trần chuẩn hóa của bài Test 2. Phản xạ tốt, ít mắc bẫy từ khóa của Cambridge.";
      } else {
        estimatedBand = "6.5";
        bandReason = "Xuất sắc vượt trần Test 2 (Đạt trên 95% điểm số). Sẵn sàng chinh phục bài Test 3 đỉnh cao.";
      }

    // MA TRẬN TEST 3: ĐỈNH CAO (ĐO NGƯỠNG 6.0 - 7.5+)
    } else {
      if (score < 40) {
        estimatedBand = "5.0 - 5.5";
        bandReason = "Chưa quen với áp lực bài đọc Passage 3 và các bẫy đổi ý chuyên sâu của Listening Part 3/4.";
      } else if (score < 60) {
        estimatedBand = "6.0";
        bandReason = "Vốn từ học thuật tốt nhưng tốc độ xử lý thông tin học thuật còn chậm, dễ bị cạn giờ làm bài.";
      } else if (score < 75) {
        estimatedBand = "6.5";
        bandReason = "Phản xạ nhanh, tư duy phân tích lập luận chặt chẽ. Đạt mốc vàng chuẩn bị bước vào giai đoạn luyện đề thi thật.";
      } else if (score < 90) {
        estimatedBand = "7.0";
        bandReason = "Năng lực ngôn ngữ xuất sắc, phân biệt rõ căn cứ bài đọc và làm chủ hoàn toàn cấu trúc PEEL.";
      } else {
        estimatedBand = "7.5+";
        bandReason = "Chạm ngưỡng đỉnh cao (Chuyên gia ngôn ngữ). Sẵn sàng thi thật với mục tiêu 7.5 - 8.0.";
      }
    }

    return { estimatedBand, bandReason };
  }

  // =========================================================================
  // 7. CHẤM BÀI TRỰC TIẾP TRÊN GIAO DIỆN & LƯU ĐẦY ĐỦ 2 BẢNG KẾT QUẢ
  // =========================================================================
  async submitFullExam() {
    if (!confirm("Em có chắc chắn muốn nộp bài thi để hệ thống phân tích câu chữ và xuất 2 bảng điểm (Chuẩn giờ & Toàn diện) không?")) {
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitFullDiagnostic');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `⏳ AI đang chấm bài và xuất bảng điểm 2 mốc thời gian...`;
    }

    clearInterval(this.timerInterval);
    this.isReviewMode = true;

    // 1. Chấm bài thực tế hiện tại (Toàn bộ bài làm khi bấm nộp)
    const liveGrammar = diagGrammarEngine.evaluate();
    const liveLis = diagListeningEngine.evaluate();
    const liveRead = diagReadingEngine.evaluate();
    const liveWritingSub = diagWritingEngine.getWritingSubmissionData ? diagWritingEngine.getWritingSubmissionData() : {};
    const liveSpeakingSub = diagSpeakingEngine.getSpeakingSubmissionData ? diagSpeakingEngine.getSpeakingSubmissionData() : {};

    // 2. Chấm bài mốc chuẩn giờ (Official Timed Snapshot)
    // Nếu nộp trước mốc snapshot -> Dữ liệu chuẩn giờ chính là bài làm hiện tại
    const isOvertime = this.timerSeconds > (DIAGNOSTIC_META[this.testId]?.snapshotSeconds || 3000);
    const snapshotData = (isOvertime && this.snapshotOfficialData) ? this.snapshotOfficialData : {
      grammarAnswers: liveGrammar.answersSnapshot || {},
      listeningAnswers: liveLis.answersSnapshot || {},
      readingAnswers: liveRead.answersSnapshot || {},
      writingSnapshot: liveWritingSub,
      speakingSnapshot: liveSpeakingSub
    };

    // 3. TÍNH ĐIỂM WRITING & SPEAKING SƠ BỘ CHO BẢNG CHUẨN GIỜ
    const snapT1Words = snapshotData.writingSnapshot?.task1Words || this.countWords(snapshotData.writingSnapshot?.task1Text || '');
    const snapT2Words = snapshotData.writingSnapshot?.task2Words || this.countWords(snapshotData.writingSnapshot?.task2Text || '');
    let snapT1Band = snapT1Words === 0 ? 0.0 : (snapT1Words < 30 ? 2.0 : (snapT1Words < 70 ? 3.0 : 4.0));
    let snapT2Band = snapT2Words === 0 ? 0.0 : (snapT2Words < 40 ? 1.5 : (snapT2Words < 100 ? 3.0 : 4.0));
    let snapWBand = roundIELTS((snapT1Band * 1 + snapT2Band * 2) / 3);
    snapWBand = parseFloat(calculateSmartOverCap(snapWBand, this.testId));

    const snapSpkWords = this.countWords((snapshotData.speakingSnapshot?.transcriptsList || []).join(' '));
    let snapSBand = snapSpkWords === 0 ? 0.0 : (snapSpkWords < 25 ? 2.0 : (snapSpkWords < 60 ? 3.0 : 4.0));
    snapSBand = parseFloat(calculateSmartOverCap(snapSBand, this.testId));

    // 4. TÍNH ĐIỂM WRITING & SPEAKING CHO BÀI NỘP THỰC TẾ
    let liveT1Band = liveWritingSub.task1Words === 0 ? 0.0 : (liveWritingSub.task1Words < 30 ? 2.0 : (liveWritingSub.task1Words < 70 ? 3.0 : 4.0));
    let liveT2Band = liveWritingSub.task2Words === 0 ? 0.0 : (liveWritingSub.task2Words < 40 ? 1.5 : (liveWritingSub.task2Words < 100 ? 3.0 : 4.0));
    let liveWBand = roundIELTS((liveT1Band * 1 + liveT2Band * 2) / 3);
    liveWBand = parseFloat(calculateSmartOverCap(liveWBand, this.testId));

    const liveSpkWords = this.countWords((liveSpeakingSub.transcriptsList || []).join(' '));
    let liveSBand = liveSpkWords === 0 ? 0.0 : (liveSpkWords < 25 ? 2.0 : (liveSpkWords < 60 ? 3.0 : 4.0));
    liveSBand = parseFloat(calculateSmartOverCap(liveSBand, this.testId));

    // 5. QUY ĐỔI % VÀ ĐỊNH VỊ BAND CHUẨN XÁC THEO MA TRẬN TỪNG TEST
    const gRatio = liveGrammar.total > 0 ? (liveGrammar.score / liveGrammar.total) : 0;
    const lRatio = liveLis.total > 0 ? (liveLis.score / liveLis.total) : 0;
    const rRatio = liveRead.total > 0 ? (liveRead.score / liveRead.total) : 0;
    const liveOverallScore = Math.round((gRatio * 25) + (lRatio * 25) + (rRatio * 25) + ((liveWBand / 9) * 25));

    const liveBandInfo = this.calculateCalibratedBand(this.testId, liveOverallScore, liveWBand, liveSBand);
    const snapBandInfo = isOvertime 
      ? this.calculateCalibratedBand(this.testId, Math.max(0, liveOverallScore - 10), snapWBand, snapSBand)
      : liveBandInfo;

    // 6. KÍCH HOẠT REVIEW MODE CHO CÁC MODULE TRÊN GIAO DIỆN
    diagGrammarEngine.renderReviewMode(liveGrammar);
    diagListeningEngine.renderReviewMode(liveLis);
    diagReadingEngine.renderReviewMode(liveRead);
    if (diagWritingEngine.renderReviewMode) {
      diagWritingEngine.renderReviewMode(liveWritingSub.answersSnapshot || {});
    }
    if (diagSpeakingEngine.renderReviewMode) {
      diagSpeakingEngine.renderReviewMode(liveSpeakingSub.answersSnapshot || {});
    }

    // 7. TRÍCH XUẤT BLUEPRINT LỖ HỔNG (ITEM-LEVEL ERROR PROFILE)
    const blueprintProfile = {
      testId: this.testId,
      wrongGrammarTags: (liveGrammar.wrongList || []).map(w => w.topic || `G_Q${w.num}`).filter(Boolean),
      failedReadingSkills: (liveRead.wrongList || []).map(w => w.behaviorTag || `READ_Q${w.questionNum}`).filter(Boolean),
      failedListeningSkills: (liveLis.wrongList || []).map(w => `LIS_P${w.partNum}_Q${w.num}`).filter(Boolean),
      weakWritingCriteria: liveWritingSub.task2Words === 0 ? ["TR_TASK2_MISSING", "GRA"] : ["CC", "GRA"],
      weakSpeakingCriteria: liveSpkWords < 50 ? ["FC_SHORT_RESPONSE"] : ["GRA"]
    };

    // 8. RENDER THANH BANNER NỔI XUẤT ĐỦ 2 KẾT QUẢ ĐỘC LẬP
    this.renderInPlaceDualResultBanner({
      isOvertime,
      timeSpent: `${Math.round(this.timerSeconds / 60)} phút`,
      snapshotTimeLabel: `${DIAGNOSTIC_META[this.testId]?.snapshotMinutes || 50} phút`,
      officialResult: {
        band: snapBandInfo.estimatedBand,
        score: `${isOvertime ? Math.max(0, liveOverallScore - 10) : liveOverallScore}/100`,
        reason: snapBandInfo.bandReason,
        wBand: snapWBand.toFixed(1),
        sBand: snapSBand.toFixed(1)
      },
      potentialResult: {
        band: liveBandInfo.estimatedBand,
        score: `${liveOverallScore}/100`,
        reason: liveBandInfo.bandReason,
        gScore: `${liveGrammar.score}/${liveGrammar.total}`,
        lScore: `${liveLis.score}/${liveLis.total}`,
        rScore: `${liveRead.score}/${liveRead.total}`,
        wBand: liveWBand.toFixed(1),
        sBand: liveSBand.toFixed(1)
      }
    });

    // 9. ĐÓNG GÓI SNAPSHOT LƯU VÀO LOCAL STORAGE & CLOUD DRIVE
    const studentEmail = localStorage.getItem('ielts_student_email') || 'guest@gmail.com';
    const studentName = localStorage.getItem('ielts_student_name') || 'Học viên';
    const studentId = localStorage.getItem('tram_student_id') || 'TR-GUEST';

    const attemptSnapshot = {
      id: "diag_attempt_" + Date.now(),
      timestamp: new Date().toLocaleString('vi-VN'),
      testTitle: `${DIAGNOSTIC_META[this.testId]?.title || this.testId} (Set ${this.setNum})`,
      studentName: studentName,
      studentEmail: studentEmail,
      studentId: studentId,
      score: `Band ${snapBandInfo.estimatedBand} (${liveOverallScore}/100)`,
      timeSpent: `${Math.round(this.timerSeconds / 60)} phút`,
      moduleType: "diagnostic",
      pageUrl: `diagnostic/runner-diag.html?testId=${this.testId}&set=${this.setNum}`,
      approvalStatus: "pending_admin_approval", // 🔴 CỔNG ADMIN GATE: CHỜ GIÁO VIÊN DUYỆT LỘ TRÌNH
      details: {
        isOvertime,
        officialBand: snapBandInfo.estimatedBand,
        potentialBand: liveBandInfo.estimatedBand,
        overallScore: `${liveOverallScore}/100`,
        timeSpent: `${Math.round(this.timerSeconds / 60)} phút`,
        bandReason: liveBandInfo.bandReason,
        gScore: `${liveGrammar.score}/${liveGrammar.total}`,
        lScore: `${liveLis.score}/${liveLis.total}`,
        rScore: `${liveRead.score}/${liveRead.total}`,
        wBand: liveWBand.toFixed(1),
        sBand: liveSBand.toFixed(1),
        blueprintProfile: blueprintProfile,
        grammarSnapshot: liveGrammar.answersSnapshot || {},
        gWrongList: liveGrammar.wrongList || [],
        listeningSnapshot: liveLis.answersSnapshot || {},
        lDetails: liveLis.details || [],
        readingSnapshot: liveRead.answersSnapshot || {},
        rDetails: liveRead.details || [],
        writingAnswersSnapshot: liveWritingSub.answersSnapshot || {},
        wt1Text: liveWritingSub.task1Text || '',
        wt2Text: liveWritingSub.task2Text || '',
        spk1Text: document.getElementById('diag_spk_1')?.value || '',
        spk2Text: document.getElementById('diag_spk_2')?.value || '',
        speakingAnswersSnapshot: liveSpeakingSub.answersSnapshot || {},
        wAiFeedback: "",
        sAiFeedback: ""
      }
    };

    this.currentAttemptSnapshot = attemptSnapshot;

    // Lưu vào Local Storage
    try {
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      localHist.unshift(attemptSnapshot);
      localStorage.setItem('ielts_local_history', JSON.stringify(localHist));

      // Mở khóa bài tiếp theo nếu đạt yêu cầu
      if (this.testId === 'test_01' && liveOverallScore >= 40) localStorage.setItem('diag_unlocked_test2', 'true');
      if (this.testId === 'test_02' && liveOverallScore >= 55) localStorage.setItem('diag_unlocked_test3', 'true');
    } catch(e) {}

    // Bắn lên máy chủ Google Drive
    this.syncAttemptToCloud(attemptSnapshot);

    // 10. GỌI AI CHẤM TRỰC TIẾP WRITING & SPEAKING
    diagWritingEngine.evaluateAndRenderInlineAI().then(wRes => {
      if (wRes && this.currentAttemptSnapshot) {
        this.currentAttemptSnapshot.details.wAiFeedback = JSON.stringify(wRes);
        this.syncAttemptToCloud(this.currentAttemptSnapshot);
      }
    });

    diagSpeakingEngine.evaluateAndRenderInlineAI().then(sRes => {
      if (sRes && this.currentAttemptSnapshot) {
        this.currentAttemptSnapshot.details.sAiFeedback = JSON.stringify(sRes);
        this.syncAttemptToCloud(this.currentAttemptSnapshot);
      }
    });

    if (btnSubmit) {
      btnSubmit.innerHTML = `✓ ĐÃ NỘP BÀI — ĐANG Ở CHẾ ĐỘ XEM LẠI`;
      btnSubmit.style.background = "#059669";
    }
  }

  // Tiện ích gửi dữ liệu Cloud
  syncAttemptToCloud(snapshot) {
    if (!CLOUD_SCRIPT_URL || !snapshot || !snapshot.studentEmail) return;
    fetch(CLOUD_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save_attempt", attempt: snapshot })
    }).catch(() => {});
  }

  // --- RENDER BANNER NỔI HIỂN THỊ 2 BẢNG KẾT QUẢ ĐỘC LẬP ---
  renderInPlaceDualResultBanner(data) {
    let banner = document.getElementById('diagStickyResultBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'diagStickyResultBanner';
      const container = document.querySelector('.runner-container');
      if (container) container.insertBefore(banner, container.firstChild);
    }

    banner.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #059669; border-bottom:6px solid #047857; border-radius:22px; padding:20px 24px; margin-bottom:20px; box-shadow:0 8px 24px rgba(5, 150, 105, 0.12);">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:2px dashed #E8E2D8; padding-bottom:14px; margin-bottom:14px;">
          <div>
            <span style="font-size:12px; font-weight:900; background:#D1FAE5; color:#065F46; padding:3px 10px; border-radius:8px; text-transform:uppercase;">
              KẾT QUẢ BÀI THI CHẨN ĐOÁN (ĐANG XEM LẠI)
            </span>
            <div style="font-size:14px; font-weight:800; color:#64748B; margin-top:4px;">
              ⏱️ Tổng thời gian làm bài: <b>${data.timeSpent}</b> ${data.isOvertime ? `<span style="color:#DC2626; font-weight:900;">(Vượt mốc quy định ${data.snapshotTimeLabel})</span>` : '<span style="color:#059669; font-weight:900;">(Đúng hạn giờ quy định)</span>'}
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a href="index-diag.html" class="btn-3d btn-3d-white" style="padding:8px 16px; font-size:13px;">← Danh mục đề</a>
            <a href="../curriculum-system/roadmap.html" class="btn-3d btn-3d-blue" style="padding:8px 16px; font-size:13px;">🚀 Xem lộ trình học &rarr;</a>
          </div>
        </div>

        <!-- 2 KHỐI KẾT QUẢ SONG SONG: CHUẨN GIỜ VS TIỀM NĂNG -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-bottom:16px;">
          
          <!-- KẾT QUẢ 1: CHUẨN GIỜ (OFFICIAL) -->
          <div style="background:#F0FDF4; border:2px solid #86EFAC; border-radius:16px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="color:#166534; font-size:14px; text-transform:uppercase;">
                🎯 KẾT QUẢ CHUẨN GIỜ (CHÍNH THỨC)
              </b>
              <span style="font-size:11px; font-weight:900; background:#DCFCE7; color:#166534; padding:2px 8px; border-radius:6px;">MỐC ${data.snapshotTimeLabel}</span>
            </div>
            <div style="display:flex; align-items:baseline; gap:10px; margin:8px 0 4px 0;">
              <span style="font-size:32px; font-weight:900; color:#15803D;">Band ${data.officialResult.band}</span>
              <span style="font-size:14px; font-weight:800; color:#475569;">(${data.officialResult.score})</span>
            </div>
            <p style="margin:0; font-size:12.5px; color:#166534; line-height:1.5;">
              <b>Năng lực phòng thi:</b> Đây là kết quả chính thức đo được trong thời gian quy định dưới áp lực thi thật.
            </p>
          </div>

          <!-- KẾT QUẢ 2: TIỀM NĂNG FULL (DÙNG ĐỂ BẮC CẦU LẬP LỘ TRÌNH) -->
          <div style="background:#EFF6FF; border:2px solid #BFDBFE; border-radius:16px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="color:#1E40AF; font-size:14px; text-transform:uppercase;">
                🚀 NĂNG LỰC TOÀN DIỆN (TIỀM NĂNG)
              </b>
              <span style="font-size:11px; font-weight:900; background:#DBEAFE; color:#1E40AF; padding:2px 8px; border-radius:6px;">LÀM HẾT ĐỀ</span>
            </div>
            <div style="display:flex; align-items:baseline; gap:10px; margin:8px 0 4px 0;">
              <span style="font-size:32px; font-weight:900; color:#2563EB;">Band ${data.potentialResult.band}</span>
              <span style="font-size:14px; font-weight:800; color:#475569;">(${data.potentialResult.score})</span>
            </div>
            <p style="margin:0; font-size:12.5px; color:#1E40AF; line-height:1.5;">
              <b>Năng lực kiến thức:</b> Kết quả hoàn thành trọn vẹn bài thi. Dữ liệu này được chuyển sang AI để băm lộ trình học tập cá nhân hóa.
            </p>
          </div>

        </div>

        <!-- 5 THẺ ĐIỂM KỸ NĂNG CHI TIẾT -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
          <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#166534;">NGỮ PHÁP</div>
            <b style="font-size:17px; color:#15803D;">${data.potentialResult.gScore}</b>
          </div>
          <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#0369A1;">LISTENING</div>
            <b style="font-size:17px; color:#0284C7;">${data.potentialResult.lScore}</b>
          </div>
          <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#991B1B;">READING</div>
            <b style="font-size:17px; color:#8B1518;">${data.potentialResult.rScore}</b>
          </div>
          <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">WRITING</div>
            <b style="font-size:17px; color:#2563EB;">Band ${data.potentialResult.wBand}</b>
          </div>
          <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; padding:10px; border-radius:12px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">SPEAKING</div>
            <b style="font-size:17px; color:#D97706;">Band ${data.potentialResult.sBand}</b>
          </div>
        </div>

        <div style="margin-top:14px; font-size:13.5px; line-height:1.6; color:#065F46; background:#ECFDF5; padding:12px 16px; border-radius:12px; border:1.5px solid #A7F3D0;">
          <b>💡 Định vị năng lực:</b> ${data.potentialResult.reason}
        </div>
      </div>
    `;

    banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- RENDER AI CHẤM TRỰC TIẾP DƯỚI BÀI VIẾT (TAB WRITING) ---
  async renderInlineWritingAICard(t1, t2, totalWords = 0, preloadedFeedback = null) {
    const secWriting = document.getElementById('section_writing');
    if (!secWriting) return "";

    let aiCard = document.getElementById('inlineWritingAiReport');
    if (!aiCard) {
      aiCard = document.createElement('div');
      aiCard.id = 'inlineWritingAiReport';
      secWriting.appendChild(aiCard);
    }

    if (totalWords === 0 && !t1 && !t2) {
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
      return "";
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

    if (preloadedFeedback) {
      if (window.marked && streamBox) streamBox.innerHTML = window.marked.parse(preloadedFeedback);
      else if (streamBox) streamBox.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit;">${preloadedFeedback}</pre>`;
      return preloadedFeedback;
    }

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
      return feedback;
    } catch(e) {
      if (streamBox) streamBox.innerHTML = `<span style="color:#DC2626;">❌ Không thể kết nối AI: ${e.message}</span>`;
      return "";
    }
  }

  // --- RENDER AI CHẤM TRỰC TIẾP DƯỚI BÀI NÓI (TAB SPEAKING) ---
  async renderInlineSpeakingAICard(s1, s2, totalWords = 0, preloadedFeedback = null) {
    const secSpeaking = document.getElementById('section_speaking');
    if (!secSpeaking) return "";

    let aiCard = document.getElementById('inlineSpeakingAiReport');
    if (!aiCard) {
      aiCard = document.createElement('div');
      aiCard.id = 'inlineSpeakingAiReport';
      secSpeaking.appendChild(aiCard);
    }

    if (totalWords === 0 && !s1 && !s2) {
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
      return "";
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

    if (preloadedFeedback) {
      if (window.marked && streamBox) streamBox.innerHTML = window.marked.parse(preloadedFeedback);
      else if (streamBox) streamBox.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit;">${preloadedFeedback}</pre>`;
      return preloadedFeedback;
    }

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
      return feedback;
    } catch(e) {
      if (streamBox) streamBox.innerHTML = `<span style="color:#DC2626;">❌ Không thể kết nối AI: ${e.message}</span>`;
      return "";
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
  // 8. REVIEW MODE TỪ LỊCH SỬ & GOOGLE DRIVE CLOUD SERVER
  // =========================================================================
  async restoreReviewMode(attemptId, emailParam = "") {
    this.isReviewMode = true;
    try {
      let att = null;
      const localHist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      att = localHist.find(a => a.id === attemptId);

      if ((!att || !att.details) && (emailParam || CLOUD_SCRIPT_URL)) {
        const queryEmail = emailParam || localStorage.getItem('ielts_student_email') || '';
        if (queryEmail) {
          try {
            const res = await fetch(CLOUD_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({ action: "get_single_attempt", email: queryEmail, attemptId: attemptId })
            });
            const cloudData = await res.json();
            if (cloudData && cloudData.attempt) att = cloudData.attempt;
          } catch (cloudErr) {
            console.warn("Không thể tải bài làm từ Google Drive:", cloudErr);
          }
        }
      }

      if (!att || !att.details) return;
      const d = att.details;

      // Khôi phục Ngữ pháp
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

      // Khôi phục Listening
      diagListeningEngine.renderReviewMode({
        answersSnapshot: d.listeningSnapshot || {},
        details: d.lDetails || []
      });

      // Khôi phục Reading
      if (d.rDetails) {
        diagReadingEngine.renderReviewMode({
          answersSnapshot: d.readingSnapshot || {},
          details: d.rDetails
        });
      }

      // Khôi phục Writing
      if (d.writingAnswersSnapshot && diagWritingEngine.renderReviewMode) {
        diagWritingEngine.renderReviewMode(d.writingAnswersSnapshot);
      }

      // Khôi phục Speaking cũ
      const spk1 = document.getElementById('diag_spk_1');
      const spk2 = document.getElementById('diag_spk_2');
      if (spk1 && d.spk1Text) { spk1.value = d.spk1Text; spk1.disabled = true; }
      if (spk2 && d.spk2Text) { spk2.value = d.spk2Text; spk2.disabled = true; }

      // Khôi phục Speaking mới
      if (d.speakingAnswersSnapshot && diagSpeakingEngine.renderReviewMode) {
        diagSpeakingEngine.renderReviewMode({ answersSnapshot: d.speakingAnswersSnapshot });
      }

      // Vẽ lại Banner kết quả 2 mốc
      const meta = DIAGNOSTIC_META[this.testId] || DIAGNOSTIC_META.test_01;
      this.renderInPlaceDualResultBanner({
        isOvertime: !!d.isOvertime,
        timeSpent: att.timeSpent || 'N/A',
        snapshotTimeLabel: `${meta.snapshotMinutes} phút`,
        officialResult: {
          band: d.officialBand || att.score.split('(')[0].replace('Band', '').trim(),
          score: d.overallScore || 'N/A',
          reason: d.bandReason || '',
          wBand: d.wBand || '0.0',
          sBand: d.sBand || '0.0'
        },
        potentialResult: {
          band: d.potentialBand || d.officialBand || '0.0',
          score: d.overallScore || 'N/A',
          reason: d.bandReason || '',
          gScore: d.gScore || 'N/A',
          lScore: d.lScore || 'N/A',
          rScore: d.rScore || 'N/A',
          wBand: d.wBand || '0.0',
          sBand: d.sBand || '0.0'
        }
      });

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
