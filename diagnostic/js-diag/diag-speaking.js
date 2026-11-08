/**
 * diagnostic/js-diag/diag-speaking.js
 * BỘ ĐIỀU KHIỂN SPEAKING KHẢO THÍ CHUYÊN BIỆT (MODULE TÁCH RIÊNG)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 * - NẠP ĐỘNG 100% CÂU HỎI TỪ CÁC FILE JSON (TEST 1, 2, 3 & FULL MOCK TEST)
 * - HỖ TRỢ ĐA DẠNG: 4-8 CÂU PART 1, CUE CARD THUYẾT TRÌNH PART 2, PHẢN BIỆN PART 3
 * - THU ÂM VÀ CHUYỂN GIỌNG NÓI THÀNH VĂN BẢN (WEB SPEECH API) CÓ ĐẾM TỪ REALTIME
 * - TÍCH HỢP ĐỒNG BỘ TRẦN ĐIỂM & CHIẾT KHẤU SMART OVER-CAP THEO TỪNG BÀI TEST
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

    // Dữ liệu đề thi nạp từ file JSON
    this.data = null;

    // Bộ nhớ lưu bản ký âm theo ID câu hỏi: { [qId]: 'transcript text' }
    this.userAnswers = {};
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐỀ THI TỪ FILE JSON RIÊNG BIỆT
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải ${jsonUrl}`);
      this.data = await res.json();
      this.testId = this.data.testId || this.testId;
      this.userAnswers = {};
      return true;
    } catch (err) {
      console.warn("[DiagSpeakingEngine] Lỗi nạp JSON Speaking, dùng bộ câu hỏi an toàn:", err);
      // Dữ liệu dự phòng phòng thủ chống màn hình trắng
      this.data = this.getFallbackData();
      return false;
    }
  }

  getFallbackData() {
    if (this.isFullTest) {
      return {
        testId: "fulltest_01",
        title: "IELTS Speaking Full Mock Test",
        parts: [
          {
            partNum: 1,
            title: "Part 1: Phỏng vấn giao tiếp",
            questions: [
              { id: "ft_spk_fb_1", num: 1, text: "Do you work or are you a student? What do you like most about it?" },
              { id: "ft_spk_fb_2", num: 2, text: "What is your typical daily morning routine?" }
            ]
          },
          {
            partNum: 2,
            title: "Part 2: Thuyết trình Cue Card",
            cueCard: {
              id: "ft_spk_fb_cue",
              prompt: "Describe an important decision you made in your life.",
              subPrompts: ["What it was", "Why you made it", "How difficult it was", "And how you felt about it"]
            }
          },
          {
            partNum: 3,
            title: "Part 3: Phản biện chuyên sâu",
            questions: [
              { id: "ft_spk_fb_3", num: 1, text: "How has artificial intelligence changed the way people make decisions today?" }
            ]
          }
        ]
      };
    }

    return {
      testId: this.testId,
      title: "Speaking Diagnostic",
      parts: [
        {
          partNum: 1,
          title: "Part 1: Phản xạ giao tiếp",
          questions: [
            { id: "diag_spk_fb_1", num: 1, text: "Do you work or are you a student? What do you like most about your studies or career?" },
            { id: "diag_spk_fb_2", num: 2, text: "How often do you use English in your daily life or studies?" },
            { id: "diag_spk_fb_3", num: 3, text: "What is your favorite way to relax after a stressful day?" },
            { id: "diag_spk_fb_4", num: 4, text: "Do you prefer studying alone or with a group of friends? Why?" }
          ]
        }
      ]
    };
  }

  // =========================================================================
  // 2. KHỞI TẠO VÀ RENDER GIAO DIỆN
  // =========================================================================
  init(isFullTest = false, testId = 'test_01') {
    this.isFullTest = isFullTest;
    this.testId = testId;
    this.initSpeechRecognition();
  }

  render(containerId) {
    if (containerId) this.containerId = containerId;
    const mount = document.getElementById(this.containerId) || document.getElementById('section_speaking') || document.getElementById('ftSpeakingMount');
    if (!mount) return;

    if (!this.data) {
      this.data = this.getFallbackData();
    }

    let html = `
      <div style="border-bottom: 2px solid #F4EFEB; padding-bottom: 12px; margin-bottom: 18px;">
        <h3 style="margin: 0; color: #D97706; font-size: 18px; font-weight: 900;">
          <i class="fa-solid fa-microphone"></i> ${this.data.title || 'PHẦN THI NÓI (SPEAKING)'}
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #64748B;">
          Bấm nút micro để trả lời lần lượt từng câu hỏi bằng tiếng Anh. Toàn bộ bản ký âm sẽ được AI chấm điểm chi tiết theo 4 tiêu chí.
        </p>
      </div>
    `;

    (this.data.parts || []).forEach(part => {
      html += `
        <div style="margin-bottom: 22px; background: #FFFFFF; border: 2px solid #E8E2D8; border-radius: 18px; padding: 18px 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1.5px dashed #E8E2D8; padding-bottom: 8px;">
            <b style="font-size: 15.5px; color: #92400E; text-transform: uppercase;">
              ${part.title}
            </b>
            ${part.instructions ? `<span style="font-size: 12px; color: #64748B; font-weight: 700;">${part.instructions}</span>` : ''}
          </div>
      `;

      // 1. RENDER CÂU HỎI TRỰC TIẾP PART 1 HOẶC PART 3
      if (Array.isArray(part.questions) && part.questions.length > 0) {
        part.questions.forEach((q, idx) => {
          const qId = q.id || `spk_q_${part.partNum}_${idx + 1}`;
          html += `
            <div class="q-item-box" id="box_${qId}" style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:14px; padding:16px; margin-bottom:14px;">
              <div style="font-size:14px; font-weight:900; color:#1E293B; margin-bottom:8px; line-height:1.5;">
                <span style="color:#D97706;">Câu ${q.num || idx + 1}:</span> "${q.text}"
              </div>

              <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
                <button type="button" 
                        id="btn_rec_${qId}" 
                        onclick="window.diagSpeakingEngine.toggleSpeech('${qId}', 'btn_rec_${qId}', 'status_${qId}')" 
                        class="btn-3d btn-3d-red" 
                        style="padding:8px 16px; font-size:12.5px;">
                  <i class="fa-solid fa-microphone"></i> Bấm để trả lời
                </button>
                <span id="status_${qId}" style="font-size:12px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
              </div>

              <textarea id="inp_${qId}" 
                        class="diag-textarea" 
                        style="height:70px; margin-top:4px;" 
                        placeholder="Bản ký âm câu trả lời sẽ xuất hiện tại đây (em cũng có thể tự gõ bổ sung nếu cần)..." 
                        oninput="window.diagSpeakingEngine.recordText('${qId}', this.value, 'status_${qId}')"></textarea>
            </div>
          `;
        });
      }

      // 2. RENDER HỘP CUE CARD PART 2 (NẾU CÓ)
      if (part.cueCard) {
        const cue = part.cueCard;
        const cueId = cue.id || `spk_cue_${part.partNum}`;
        html += `
          <div class="q-item-box" id="box_${cueId}" style="background:#FFFDF7; border:2.5px solid #FCD34D; border-radius:16px; padding:18px; margin-bottom:14px;">
            <div style="background:#FEF3C7; border:1px solid #FDE68A; border-radius:10px; padding:12px 14px; margin-bottom:12px;">
              <b style="font-size:15px; color:#B45309; display:block; margin-bottom:6px;">
                📌 CHỦ ĐỀ THUYẾT TRÌNH: "${cue.prompt}"
              </b>
              <div style="font-size:13px; color:#92400E; font-weight:700;">Em nên nói về:</div>
              <ul style="margin:4px 0 0 18px; padding:0; font-size:13px; color:#78350F; line-height:1.6;">
                ${(cue.subPrompts || []).map(sp => `<li>${sp}</li>`).join('')}
              </ul>
            </div>

            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
              <button type="button" 
                      id="btn_rec_${cueId}" 
                      onclick="window.diagSpeakingEngine.toggleSpeech('${cueId}', 'btn_rec_${cueId}', 'status_${cueId}')" 
                      class="btn-3d btn-3d-red" 
                      style="padding:10px 20px; font-size:13.5px;">
                <i class="fa-solid fa-microphone"></i> Bấm để nói Part 2 (Thuyết trình 2 phút)
              </button>
              <span id="status_${cueId}" style="font-size:12.5px; font-weight:800; color:#64748B;">Chưa ghi âm (0 từ)</span>
            </div>

            <textarea id="inp_${cueId}" 
                      class="diag-textarea" 
                      style="height:100px; margin-top:4px;" 
                      placeholder="Bản ký âm bài thuyết trình Part 2 sẽ xuất hiện tại đây..." 
                      oninput="window.diagSpeakingEngine.recordText('${cueId}', this.value, 'status_${cueId}')"></textarea>
          </div>
        `;
      }

      html += `</div>`;
    });

    html += `<div id="inlineSpeakingAiMount"></div>`;
    mount.innerHTML = html;
    this.restoreUserTranscripts();
  }

  // Tiện ích đếm từ phòng thủ
  countWords(str) {
    if (!str || typeof str !== 'string') return 0;
    const cleaned = str.replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  // =========================================================================
  // 3. NHẬN DIỆN GIỌNG NÓI WEB SPEECH API
  // =========================================================================
  initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) return;

    this.speechRecognition = new window.SpeechRecognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'en-US';
  }

  toggleSpeech(qId, btnId, statusId) {
    if (!this.speechRecognition) {
      alert("⚠️ Trình duyệt của em chưa hỗ trợ Web Speech API. Em hãy gõ trực tiếp câu trả lời vào ô nhé!");
      return;
    }

    const btn = document.getElementById(btnId);
    const area = document.getElementById(`inp_${qId}`);
    const statusEl = document.getElementById(statusId);

    if (!this.isRecording) {
      try {
        this.speechRecognition.start();
        this.isRecording = true;
        this.activeRecordingTarget = qId;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-stop"></i> Đang nghe... Bấm dừng`;
        if (statusEl) {
          statusEl.style.color = "#DC2626";
          statusEl.innerText = "● Đang thu âm giọng nói...";
        }

        this.speechRecognition.onresult = (e) => {
          let str = '';
          for (let i = 0; i < e.results.length; ++i) str += e.results[i][0].transcript + ' ';
          const fullText = str.trim();
          if (area) {
            area.value = fullText;
            this.userAnswers[qId] = fullText;
            const words = this.countWords(fullText);
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
      } catch (e) {}
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
      } catch (e) {}
    }
  }

  recordText(qId, val, statusId) {
    this.userAnswers[qId] = String(val).trim();
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      const words = this.countWords(val);
      statusEl.style.color = words > 0 ? "#059669" : "#64748B";
      statusEl.innerText = words > 0 ? `✓ Đã nhập: ${words} từ` : "Chưa ghi âm (0 từ)";
    }
  }

  restoreUserTranscripts() {
    Object.entries(this.userAnswers).forEach(([qId, val]) => {
      const el = document.getElementById(`inp_${qId}`);
      if (el) el.value = val;
      const statusEl = document.getElementById(`status_${qId}`);
      if (statusEl) {
        const words = this.countWords(val);
        statusEl.innerText = words > 0 ? `✓ Đã lưu: ${words} từ` : "Chưa ghi âm";
      }
    });
  }

  // Tiện ích lấy toàn bộ danh sách câu hỏi và transcript song song
  getSpeakingSubmissionData() {
    const questionsList = [];
    const transcriptsList = [];

    (this.data?.parts || []).forEach(part => {
      if (Array.isArray(part.questions)) {
        part.questions.forEach((q, idx) => {
          const qId = q.id || `spk_q_${part.partNum}_${idx + 1}`;
          const text = q.text || `Câu hỏi ${idx + 1}`;
          const trans = this.userAnswers[qId] || document.getElementById(`inp_${qId}`)?.value || '';
          questionsList.push(text);
          transcriptsList.push(trans.trim());
        });
      }
      if (part.cueCard) {
        const cue = part.cueCard;
        const cueId = cue.id || `spk_cue_${part.partNum}`;
        const cueText = `Part 2 Cue Card: ${cue.prompt}`;
        const trans = this.userAnswers[cueId] || document.getElementById(`inp_${cueId}`)?.value || '';
        questionsList.push(cueText);
        transcriptsList.push(trans.trim());
      }
    });

    return {
      questionsList,
      transcriptsList,
      answersSnapshot: { ...this.userAnswers }
    };
  }

  // Tiện ích phục vụ lưu snapshot ngầm cho Timer
  getSpeakingSnapshot() {
    return this.getSpeakingSubmissionData();
  }

  // =========================================================================
  // 4. AI CHẤM ĐIỂM TRỰC TIẾP TRÊN GIAO DIỆN (CHUẨN 4 TIÊU CHÍ RUBRIC)
  // =========================================================================
  async evaluateAndRenderInlineAI() {
    const sub = this.getSpeakingSubmissionData();
    const mount = document.getElementById('inlineSpeakingAiMount');
    if (!mount) return { overallBand: "0.0" };

    const combinedAll = sub.transcriptsList.join(' ').trim();
    const totalWords = this.countWords(combinedAll);

    // PHÒNG THỦ: NẾU BỎ TRỐNG HOÀN TOÀN TẤT CẢ CÂU ➔ BAND 0.0
    if (totalWords === 0) {
      mount.innerHTML = `
        <div style="background:#FEF2F2; border:2.5px solid #EF4444; border-radius:18px; padding:20px; margin-top:24px;">
          <h4 style="color:#991B1B; margin:0 0 6px 0; font-size:16px; font-weight:900;">
            🎤 PHIẾU CHẤM ĐIỂM SPEAKING: BAND 0.0
          </h4>
          <p style="margin:0; font-size:13.5px; color:#7F1D1D; font-weight:700;">
            Thí sinh không tham gia trả lời bài thi nói (Does not attend / Does not complete the test). Không có từ ngữ nào được ghi âm.
          </p>
        </div>
      `;
      return { overallBand: "0.0" };
    }

    mount.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #D97706; border-radius:18px; padding:22px; margin-top:24px; box-shadow:0 8px 24px rgba(217, 119, 6, 0.12);">
        <h4 style="color:#B45309; margin:0 0 10px 0; font-size:18px; font-weight:900;">
          🎤 PHIẾU CHẤM ĐIỂM SPEAKING TRỰC TIẾP TỪ AI GEMINI (CHUẨN RUBRIC)
        </h4>
        <div id="speakingAiEvaluationStream">
          ⏳ <b>AI Gemini đang đọc toàn bộ bản ký âm (${totalWords} từ) và đánh giá theo 4 tiêu chí Fluency, Lexical, Grammar, Pronunciation...</b>
        </div>
      </div>
    `;

    const streamBox = document.getElementById('speakingAiEvaluationStream');

    try {
      // Gọi hàm AI đã nâng cấp với trần điểm và Smart Over-Cap theo Test ID
      const result = await diagAIService.evaluateSpeakingDiagnostic(this.testId, sub.questionsList, sub.transcriptsList);

      streamBox.innerHTML = `
        <!-- 4 TIÊU CHÍ RUBRIC BAND DESCRIPTORS -->
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
          <div style="font-size:13px; font-weight:900; color:#92400E; text-transform:uppercase;">
            🏆 TỔNG ĐIỂM SPEAKING: BAND ${result.overallBand}
          </div>
          <div style="font-size:13.5px; line-height:1.6; color:#78350F; margin-top:4px;">
            ${result.rubricSummary || ''}
          </div>
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
  // 5. REVIEW MODE: KHÓA CHỈNH SỬA
  // =========================================================================
  renderReviewMode(savedData) {
    this.isReviewMode = true;
    if (savedData?.answersSnapshot) {
      this.userAnswers = savedData.answersSnapshot;
      this.restoreUserTranscripts();
    }
    document.querySelectorAll('#section_speaking textarea, #ftSpeakingMount textarea').forEach(tx => {
      tx.disabled = true;
      tx.style.backgroundColor = '#F8FAFC';
    });
    document.querySelectorAll('#section_speaking button, #ftSpeakingMount button').forEach(btn => {
      if (!btn.id.includes('Tab') && !btn.id.includes('Submit')) btn.disabled = true;
    });
  }
}

export const diagSpeakingEngine = new DiagSpeakingEngine();
window.diagSpeakingEngine = diagSpeakingEngine;
