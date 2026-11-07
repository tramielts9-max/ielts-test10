/**
 * diagnostic/js-diag/diag-speaking.js
 * BỘ ĐIỀU KHIỂN SPEAKING KHẢO THÍ CHUYÊN BIỆT (MODULE TÁCH RIÊNG)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 * - HỖ TRỢ CẢ DIAGNOSTIC TEST 1, 2, 3 LẪN FULL MOCK TEST (CAMBRIDGE 3 PARTS)
 * - THU ÂM VÀ CHUYỂN GIỌNG NÓI THÀNH VĂN BẢN (WEB SPEECH API)
 * - PHÒNG NGỰ BỎ TRỐNG BÀI: 0 TỪ ➔ TRẢ THẲNG BAND 0.0 KHÔNG GỌI AI
 * - ĐÁNH GIÁ ĐỦ 4 TIÊU CHÍ (FC, LR, GRA, PR) THEO RUBRIC BAND DESCRIPTORS
 */

import { diagAIService } from './diag-ai.js';

export class DiagSpeakingEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'section_speaking';
    this.testId = "test_01";
    this.isFullTest = false;
    this.speechRecognition = null;
    this.isRecording = false;
    this.activeRecordingTarget = null;
    this.isReviewMode = false;

    // Dữ liệu câu trả lời của học sinh { part1: '', part2: '', part3: '' }
    this.userAnswers = {
      part1: '',
      part2: '',
      part3: ''
    };
  }

  // =========================================================================
  // 1. KHỞI TẠO VÀ RENDER GIAO DIỆN
  // =========================================================================
  init(isFullTest = false, testId = 'test_01') {
    this.isFullTest = isFullTest;
    this.testId = testId;
    this.initSpeechRecognition();
  }

  render(containerId) {
    if (containerId) this.containerId = containerId;
    const mount = document.getElementById(this.containerId);
    if (!mount) return;

    if (this.isFullTest) {
      this.renderFullTestSpeakingUI(mount);
    } else {
      this.renderDiagnosticSpeakingUI(mount);
    }

    this.restoreUserTranscripts();
  }

  // Tiện ích đếm từ phòng ngự
  countWords(str) {
    if (!str || typeof str !== 'string') return 0;
    const cleaned = str.replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  // GIAO DIỆN TEST 1, 2, 3 (2 CÂU HỎI PHẢN XẠ)
  renderDiagnosticSpeakingUI(mount) {
    mount.innerHTML = `
      <div style="border-bottom: 2px solid #F4EFEB; padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #D97706; font-size: 18px; font-weight: 900;">
          <i class="fa-solid fa-microphone"></i> PHẦN 5: PHẢN XẠ NÓI TIẾNG ANH (SPEAKING)
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #64748B;">
          Bấm micro và trả lời trực tiếp bằng tiếng Anh. Toàn bộ transcript câu trả lời sẽ được AI chấm điểm chi tiết theo 4 tiêu chí.
        </p>
      </div>

      <div class="q-item-box" style="background:#FAF7F2; border:2px solid #E8E2D8; border-radius:16px; padding:18px; margin-bottom:18px;">
        <div style="font-size:14.5px; font-weight:900; color:#92400E; margin-bottom:10px;" id="diagSpkQ1Text">
          Câu hỏi 1: "Do you work or are you a student? What do you like most about your studies or career?"
        </div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
          <button type="button" id="btnRecDiagSpk1" onclick="window.diagSpeakingEngine.toggleSpeech('diag_spk_1', 'btnRecDiagSpk1', 'statusRec1')" class="btn-3d btn-3d-red" style="padding:10px 18px; font-size:13px;">
            <i class="fa-solid fa-microphone"></i> Bấm để nói tiếng Anh
          </button>
          <span id="statusRec1" style="font-size:12.5px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
        </div>
        <textarea id="diag_spk_1" class="diag-textarea" style="height:85px;" placeholder="Bản ký âm câu trả lời sẽ xuất hiện tại đây..." oninput="window.diagSpeakingEngine.recordText('part1', this.value, 'statusRec1')"></textarea>
      </div>

      <div class="q-item-box" style="background:#FAF7F2; border:2px solid #E8E2D8; border-radius:16px; padding:18px;">
        <div style="font-size:14.5px; font-weight:900; color:#92400E; margin-bottom:10px;" id="diagSpkQ2Text">
          Câu hỏi 2: "How often do you use English in your daily life or studies?"
        </div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
          <button type="button" id="btnRecDiagSpk2" onclick="window.diagSpeakingEngine.toggleSpeech('diag_spk_2', 'btnRecDiagSpk2', 'statusRec2')" class="btn-3d btn-3d-red" style="padding:10px 18px; font-size:13px;">
            <i class="fa-solid fa-microphone"></i> Bấm để nói tiếng Anh
          </button>
          <span id="statusRec2" style="font-size:12.5px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
        </div>
        <textarea id="diag_spk_2" class="diag-textarea" style="height:85px;" placeholder="Bản ký âm câu trả lời sẽ xuất hiện tại đây..." oninput="window.diagSpeakingEngine.recordText('part2', this.value, 'statusRec2')"></textarea>
      </div>

      <div id="inlineSpeakingAiMount"></div>
    `;
  }

  // GIAO DIỆN FULL TEST (ĐỦ 3 PARTS CAMBRIDGE)
  renderFullTestSpeakingUI(mount) {
    mount.innerHTML = `
      <div class="q-item-box" style="margin-bottom:18px; background:#FAF7F2; border:2px solid #E8E2D8; border-radius:16px; padding:18px;">
        <b style="font-size:14.5px; color:#92400E; display:block; margin-bottom:6px;">🎤 Part 1: Giao tiếp đời sống</b>
        <p style="font-size:13px; color:#475569; margin:0 0 10px 0;">"Let's talk about your hometown. What do you like most about living there?"</p>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
          <button type="button" class="btn-3d btn-3d-red" id="btnRecFtSpk1" style="padding:8px 16px; font-size:13px;" onclick="window.diagSpeakingEngine.toggleSpeech('ft_spk_part1', 'btnRecFtSpk1', 'statusFtRec1')">
            <i class="fa-solid fa-microphone"></i> Bấm để trả lời Part 1
          </button>
          <span id="statusFtRec1" style="font-size:12.5px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
        </div>
        <textarea id="ft_spk_part1" class="diag-textarea" style="height:75px;" placeholder="Transcript Part 1..." oninput="window.diagSpeakingEngine.recordText('part1', this.value, 'statusFtRec1')"></textarea>
      </div>

      <div class="q-item-box" style="margin-bottom:18px; background:#FAF7F2; border:2px solid #FCD34D; border-radius:16px; padding:18px;">
        <b style="font-size:14.5px; color:#B45309; display:block; margin-bottom:6px;">🎤 Part 2: Thuyết trình Cue Card</b>
        <p style="font-size:13px; color:#475569; margin:0 0 10px 0;">"Describe an important decision you made in your life. You should say: what it was, why you made it, and explain how it affected you."</p>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
          <button type="button" class="btn-3d btn-3d-red" id="btnRecFtSpk2" style="padding:8px 16px; font-size:13px;" onclick="window.diagSpeakingEngine.toggleSpeech('ft_spk_part2', 'btnRecFtSpk2', 'statusFtRec2')">
            <i class="fa-solid fa-microphone"></i> Bấm để nói Part 2 (Nói 2 phút)
          </button>
          <span id="statusFtRec2" style="font-size:12.5px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
        </div>
        <textarea id="ft_spk_part2" class="diag-textarea" style="height:95px;" placeholder="Transcript Part 2..." oninput="window.diagSpeakingEngine.recordText('part2', this.value, 'statusFtRec2')"></textarea>
      </div>

      <div class="q-item-box" style="background:#FAF7F2; border:2px solid #E8E2D8; border-radius:16px; padding:18px;">
        <b style="font-size:14.5px; color:#92400E; display:block; margin-bottom:6px;">🎤 Part 3: Phản biện chuyên sâu</b>
        <p style="font-size:13px; color:#475569; margin:0 0 10px 0;">"Do you think artificial intelligence will reduce human decision-making capacity in the future?"</p>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
          <button type="button" class="btn-3d btn-3d-red" id="btnRecFtSpk3" style="padding:8px 16px; font-size:13px;" onclick="window.diagSpeakingEngine.toggleSpeech('ft_spk_part3', 'btnRecFtSpk3', 'statusFtRec3')">
            <i class="fa-solid fa-microphone"></i> Bấm để trả lời Part 3
          </button>
          <span id="statusFtRec3" style="font-size:12.5px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
        </div>
        <textarea id="ft_spk_part3" class="diag-textarea" style="height:75px;" placeholder="Transcript Part 3..." oninput="window.diagSpeakingEngine.recordText('part3', this.value, 'statusFtRec3')"></textarea>
      </div>

      <div id="inlineSpeakingAiMount"></div>
    `;
  }

  // =========================================================================
  // 2. NHẬN DIỆN GIỌNG NÓI WEB SPEECH API
  // =========================================================================
  initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) return;

    this.speechRecognition = new window.SpeechRecognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'en-US';
  }

  toggleSpeech(targetAreaId, btnId, statusId = '') {
    if (!this.speechRecognition) {
      alert("⚠️ Trình duyệt của em chưa hỗ trợ Web Speech. Em hãy gõ trực tiếp câu trả lời vào ô nhé!");
      return;
    }

    const btn = document.getElementById(btnId);
    const area = document.getElementById(targetAreaId);
    const statusEl = statusId ? document.getElementById(statusId) : null;

    if (!this.isRecording) {
      try {
        this.speechRecognition.start();
        this.isRecording = true;
        this.activeRecordingTarget = targetAreaId;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-stop"></i> Đang nghe... Bấm dừng`;
        if (statusEl) {
          statusEl.style.color = "#DC2626";
          statusEl.innerText = "● Đang ghi âm giọng nói...";
        }

        this.speechRecognition.onresult = (e) => {
          let str = '';
          for (let i = 0; i < e.results.length; ++i) str += e.results[i][0].transcript + ' ';
          if (area) {
            area.value = str.trim();
            const words = this.countWords(str.trim());
            if (targetAreaId.includes('1')) this.userAnswers.part1 = str.trim();
            if (targetAreaId.includes('2')) this.userAnswers.part2 = str.trim();
            if (targetAreaId.includes('3')) this.userAnswers.part3 = str.trim();

            if (statusEl) {
              statusEl.style.color = "#059669";
              statusEl.innerText = `✓ Đã ghi nhận: ${words} từ`;
            }
          }
        };

        this.speechRecognition.onerror = () => {
          this.isRecording = false;
          if (btn) btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Bấm để nói lại`;
        };
      } catch(e) {}
    } else {
      try {
        this.speechRecognition.stop();
        this.isRecording = false;
        this.activeRecordingTarget = null;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Bấm để nói tiếp`;
        if (statusEl && area) {
          const words = this.countWords(area.value);
          statusEl.style.color = words > 0 ? "#059669" : "#64748B";
          statusEl.innerText = words > 0 ? `✓ Hoàn thành: ${words} từ` : "Chưa ghi âm";
        }
      } catch(e) {}
    }
  }

  recordText(partKey, val, statusId = '') {
    this.userAnswers[partKey] = String(val).trim();
    if (statusId) {
      const statusEl = document.getElementById(statusId);
      const words = this.countWords(val);
      if (statusEl) {
        statusEl.style.color = words > 0 ? "#059669" : "#64748B";
        statusEl.innerText = words > 0 ? `✓ Đã nhập: ${words} từ` : "Chưa ghi âm (0 từ)";
      }
    }
  }

  restoreUserTranscripts() {
    ['diag_spk_1', 'ft_spk_part1'].forEach(id => {
      const el = document.getElementById(id);
      if (el && this.userAnswers.part1) el.value = this.userAnswers.part1;
    });
    ['diag_spk_2', 'ft_spk_part2'].forEach(id => {
      const el = document.getElementById(id);
      if (el && this.userAnswers.part2) el.value = this.userAnswers.part2;
    });
    ['ft_spk_part3'].forEach(id => {
      const el = document.getElementById(id);
      if (el && this.userAnswers.part3) el.value = this.userAnswers.part3;
    });
  }

  getSubmissionData() {
    return {
      part1: this.userAnswers.part1 || document.getElementById('diag_spk_1')?.value || document.getElementById('ft_spk_part1')?.value || '',
      part2: this.userAnswers.part2 || document.getElementById('diag_spk_2')?.value || document.getElementById('ft_spk_part2')?.value || '',
      part3: this.userAnswers.part3 || document.getElementById('ft_spk_part3')?.value || ''
    };
  }

  // =========================================================================
  // 3. AI CHẤM ĐIỂM TRỰC TIẾP TRÊN GIAO DIỆN (CHUẨN 4 TIÊU CHÍ RUBRIC)
  // =========================================================================
  async evaluateAndRenderInlineAI() {
    const data = this.getSubmissionData();
    const mount = document.getElementById('inlineSpeakingAiMount');
    if (!mount) return { overallBand: "0.0" };

    const totalWords = this.countWords(`${data.part1} ${data.part2} ${data.part3}`);

    // PHÒNG NGỰ: NẾU THÍ SINH HOÀN TOÀN BỎ TRỐNG ➔ TRẢ THẲNG BAND 0.0 KHÔNG GỌI AI
    if (totalWords === 0) {
      mount.innerHTML = `
        <div style="background:#FEF2F2; border:2.5px solid #EF4444; border-radius:18px; padding:20px; margin-top:24px;">
          <h4 style="color:#991B1B; margin:0 0 6px 0; font-size:16px; font-weight:900;">
            🎤 PHIẾU CHẤM ĐIỂM SPEAKING: BAND 0.0
          </h4>
          <p style="margin:0; font-size:13.5px; color:#7F1D1D; font-weight:700;">
            Thí sinh không tham gia trả lời bài thi nói (Does not attend / Does not complete the test).
          </p>
        </div>
      `;
      return { overallBand: "0.0" };
    }

    const questions = this.isFullTest ? [
      "Let's talk about your hometown.",
      "Describe an important decision you made in your life.",
      "Do you think artificial intelligence will reduce human decision-making capacity?"
    ] : [
      "Do you work or are you a student? What do you like most about your studies or career?",
      "How often do you use English in your daily life or studies?"
    ];

    const transcripts = this.isFullTest ? [data.part1, data.part2, data.part3] : [data.part1, data.part2];

    mount.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #D97706; border-radius:18px; padding:22px; margin-top:24px; box-shadow:0 8px 24px rgba(217, 119, 6, 0.12);">
        <h4 style="color:#B45309; margin:0 0 10px 0; font-size:18px; font-weight:900;">
          🎤 PHIẾU CHẤM ĐIỂM SPEAKING TRỰC TIẾP TỪ AI GEMINI (CHUẨN RUBRIC)
        </h4>
        <div id="speakingAiEvaluationStream">
          ⏳ <b>AI Gemini đang đọc bản ký âm, đối chiếu 4 tiêu chí Fluency, Lexical, Grammar, Pronunciation...</b>
        </div>
      </div>
    `;

    const streamBox = document.getElementById('speakingAiEvaluationStream');

    try {
      const result = await diagAIService.evaluateSpeakingDiagnostic(questions, transcripts);

      streamBox.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin:14px 0 16px 0;">
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">FLUENCY (FC)</div>
            <b style="font-size:18px; color:#D97706;">Band ${result.fc || result.overallBand}</b>
          </div>
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">VOCABULARY (LR)</div>
            <b style="font-size:18px; color:#D97706;">Band ${result.lr || result.overallBand}</b>
          </div>
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">GRAMMAR (GRA)</div>
            <b style="font-size:18px; color:#D97706;">Band ${result.gra || result.overallBand}</b>
          </div>
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">PRONUNCIATION (PR)</div>
            <b style="font-size:18px; color:#D97706;">Band ${result.pr || result.overallBand}</b>
          </div>
        </div>

        <div style="background:#FEF3C7; border:1.5px solid #FCD34D; border-radius:12px; padding:14px; margin-bottom:14px;">
          <div style="font-size:13px; font-weight:900; color:#92400E; text-transform:uppercase;">🏆 TỔNG ĐIỂM SPEAKING: BAND ${result.overallBand}</div>
          <div style="font-size:13.5px; line-height:1.6; color:#78350F; margin-top:4px;">${result.rubricSummary || ''}</div>
        </div>

        ${result.critique ? `
          <div style="margin-bottom:12px; font-size:13.5px; line-height:1.6; color:#1E293B;">
            <b>🔍 Nhận xét chi tiết:</b> ${result.critique}
          </div>
        ` : ''}

        ${result.improvedAnswer ? `
          <div style="background:#F0FDF4; border:1.5px solid #86EFAC; border-radius:12px; padding:12px 14px; font-size:13px; line-height:1.6; color:#166534;">
            <b>💡 Gợi ý câu trả lời nâng cấp (Band 7.5+):</b><br>
            "${result.improvedAnswer}"
          </div>
        ` : ''}
      `;

      return result;
    } catch (e) {
      streamBox.innerHTML = `<span style="color:#DC2626;">❌ Không thể kết nối AI: ${e.message}</span>`;
      return { overallBand: "0.0" };
    }
  }

  // =========================================================================
  // 4. REVIEW MODE: KHÓA CHỈNH SỬA
  // =========================================================================
  renderReviewMode() {
    this.isReviewMode = true;
    document.querySelectorAll('#section_speaking textarea, #ftSpeakingMount textarea').forEach(tx => {
      tx.disabled = true;
      tx.style.backgroundColor = '#F8FAFC';
    });
    document.querySelectorAll('#section_speaking button, #ftSpeakingMount button').forEach(btn => {
      if (!btn.id.includes('Tab')) btn.disabled = true;
    });
  }
}

export const diagSpeakingEngine = new DiagSpeakingEngine();
window.diagSpeakingEngine = diagSpeakingEngine;
