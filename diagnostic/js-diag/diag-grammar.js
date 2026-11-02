/**
 * diagnostic/js-diag/diag-grammar.js
 * BỘ ĐIỀU KHIỂN NGỮ PHÁP 100 CÂU CHUYÊN SÂU (TEST 4)
 * HỖ TRỢ CHẤM NHANH QUA REGEX + NÚT CHẤM TỔNG BẰNG AI GEMINI STREAMING
 */

import { ExerciseEngine } from '../../grammar/js/exercise-engine-g.js';

const _AI_KEY_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 52, 95, 111, 68, 102, 97, 
  106, 111, 54, 107, 54, 106, 48, 118, 110, 83, 82, 87, 95, 87, 110, 
  122, 48, 65, 103, 117, 103, 72, 82, 48, 45, 97, 115, 45, 84, 95, 
  109, 86, 121, 116, 101, 83, 81
];
function getGeminiKey() {
  return _AI_KEY_SEEDS.map(c => String.fromCharCode(c)).join('');
}

export class DiagGrammarEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'grammarQuestionsMount';
    this.testMeta = {};
    this.parts = [];
    this.allQuestions = [];
    this.userAnswers = {};
    this.isReviewMode = false;
  }

  async loadTestFromJson(jsonUrl) {
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải ${jsonUrl}`);
      const data = await res.json();

      this.testMeta = {
        testId: data.testId || "test_04",
        title: data.title || "Đề Kiểm Tra Ngữ Pháp Chuyên Sâu (100 Câu)",
        timeMinutes: data.timeMinutes || 90,
        totalQuestions: data.totalQuestions || 100
      };

      this.parts = data.parts || [];
      this.allQuestions = [];
      this.parts.forEach(p => {
        (p.questions || []).forEach(q => this.allQuestions.push(q));
      });

      this.userAnswers = {};
      this.isReviewMode = false;
      return true;
    } catch (err) {
      console.warn("[DiagGrammarEngine] Lỗi:", err);
      const mount = document.getElementById(this.containerId);
      if (mount) {
        mount.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">⚠️ Lỗi nạp Ngữ pháp: ${err.message}</div>`;
      }
      return false;
    }
  }

  render() {
    const mount = document.getElementById(this.containerId);
    if (!mount || this.parts.length === 0) return;

    let html = `
      <div style="background:#ECFDF5; border:2px solid #A7F3D0; border-radius:16px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <b style="font-size:16px; color:#065F46;">📚 ${this.testMeta.title}</b>
          <div style="font-size:13px; color:#047857; margin-top:2px;">Tổng số câu: 100 câu • Thời gian đề xuất: 90 - 120 phút</div>
        </div>
        <button type="button" class="btn-3d btn-3d-blue" onclick="window.diagGrammarEngine.startAIGrading()" style="padding:10px 20px; font-size:13.5px; background:#059669; border-bottom-color:#047857;">
          🤖 CHẤM BÀI BẰNG AI GEMINI
        </button>
      </div>
    `;

    this.parts.forEach(part => {
      html += `
        <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:18px; padding:22px; margin-bottom:22px; box-shadow:0 4px 12px rgba(0,0,0,0.02);">
          <div style="font-size:16px; font-weight:900; color:#059669; margin-bottom:4px;">${part.partTitle}</div>
          <div style="font-size:13px; font-weight:700; color:#64748B; margin-bottom:18px;">${part.instruction}</div>
      `;

      (part.questions || []).forEach(q => {
        // A. Trắc nghiệm (Part 4)
        if (q.type === 'choice') {
          html += `
            <div class="q-item-box" id="gbox_${q.id}" style="margin-bottom:12px; background:#FAF7F2;">
              <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:8px;">Câu ${q.num}. ${q.prompt}</b>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:6px;">
                ${(q.options || []).map(opt => `
                  <label class="option-label" onclick="window.diagGrammarEngine.recordAnswer('${q.id}', '${opt.charAt(0)}')">
                    <input type="radio" name="rad_g_${q.id}" value="${opt.charAt(0)}">
                    <span>${opt}</span>
                  </label>
                `).join('')}
              </div>
              <div id="gfb_${q.id}" style="display:none; font-size:12.5px; font-weight:800; margin-top:8px; padding:6px 10px; border-radius:6px;"></div>
            </div>
          `;
        // B. Điền từ (Part 1, 2, 3) & Viết lại câu (Part 5)
        } else {
          const promptText = q.prompt ? q.prompt.replace('[blank]', '_______') : '';
          html += `
            <div class="q-item-box" id="gbox_${q.id}" style="margin-bottom:12px; background:#FAF7F2;">
              <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:6px;">Câu ${q.num}. ${promptText}</b>
              <div style="display:flex; align-items:center; gap:8px;">
                ${q.targetStart ? `<span style="font-weight:800; color:#059669; font-size:14px;">${q.targetStart}</span>` : ''}
                <input type="text" class="diag-input" id="inp_g_${q.id}" placeholder="Điền câu trả lời..." oninput="window.diagGrammarEngine.recordAnswer('${q.id}', this.value)" style="flex:1; margin-top:0;">
              </div>
              <div id="gfb_${q.id}" style="display:none; font-size:12.5px; font-weight:800; margin-top:8px; padding:6px 10px; border-radius:6px;"></div>
            </div>
          `;
        }
      });

      html += `</div>`;
    });

    // KHUNG BÁO CÁO KẾT QUẢ CHẤM CỦA AI
    html += `
      <div id="aiGrammarReportCard" style="display:none; background:#FFFFFF; border:3px solid #059669; border-radius:20px; padding:26px; margin-top:24px;">
        <h3 style="color:#059669; margin:0 0 10px 0; font-size:20px; font-weight:900;">🤖 BÁO CÁO PHÂN TÍCH CHUYÊN SÂU TỪ AI GEMINI</h3>
        <div id="aiGrammarStreamText" style="line-height:1.75; font-size:14.5px; color:#1E293B;"></div>
      </div>
    `;

    mount.innerHTML = html;
    this.restoreUserInputsUI();
  }

  recordAnswer(qId, val) {
    if (this.isReviewMode) return;
    this.userAnswers[qId] = String(val).trim();
  }

  restoreUserInputsUI() {
    Object.entries(this.userAnswers).forEach(([qId, val]) => {
      const inp = document.getElementById(`inp_g_${qId}`);
      if (inp) inp.value = val;
      const rad = document.querySelector(`input[name="rad_g_${qId}"][value="${val}"]`);
      if (rad) rad.checked = true;
    });
  }

  // =========================================================================
  // 3. CHẤM BÀI TRỰC TIẾP QUA BỘ SO KHỚP REGEX (INSTANT EVALUATE)
  // =========================================================================
  evaluate() {
    let score = 0;
    const total = this.allQuestions.length;
    const wrongList = [];
    const details = [];

    this.allQuestions.forEach((q, idx) => {
      const userVal = (this.userAnswers[q.id] || '').trim();
      let isCorrect = false;

      if (q.type === 'choice') {
        isCorrect = userVal.toUpperCase() === (q.answer || '').toUpperCase();
      } else {
        const answersList = q.answers || (q.answer ? [q.answer] : []);
        const cleanUser = ExerciseEngine.clean(userVal);
        const strippedUser = ExerciseEngine.clean(ExerciseEngine.stripTargetStart(userVal, q.targetStart || ""));

        for (const ans of answersList) {
          const cleanAns = ExerciseEngine.clean(ans);
          const strippedAns = ExerciseEngine.clean(ExerciseEngine.stripTargetStart(ans, q.targetStart || ""));
          if (cleanUser === cleanAns || strippedUser === strippedAns || cleanUser === strippedAns || strippedUser === cleanAns) {
            isCorrect = true;
            break;
          }
        }
      }

      if (isCorrect) score++;

      const expStr = q.type === 'choice' ? q.answer : (q.answers ? q.answers.join(' / ') : q.answer);
      const d = {
        num: q.num || idx + 1,
        questionId: q.id,
        userAnswer: userVal || "(Bỏ trống)",
        expectedAnswer: expStr,
        isCorrect: isCorrect,
        explanation: q.explanation || ""
      };

      details.push(d);
      if (!isCorrect) wrongList.push(d);
    });

    return {
      testId: this.testMeta.testId,
      title: this.testMeta.title,
      score,
      total,
      scorePercent: Math.round((score / (total || 1)) * 100),
      wrongList,
      details,
      answersSnapshot: this.userAnswers
    };
  }

  renderReviewMode(evalResult) {
    this.isReviewMode = true;
    this.userAnswers = evalResult.answersSnapshot || this.userAnswers;
    this.restoreUserInputsUI();

    (evalResult.details || []).forEach(d => {
      const box = document.getElementById(`gbox_${d.questionId}`);
      const fb = document.getElementById(`gfb_${d.questionId}`);
      const inp = document.getElementById(`inp_g_${d.questionId}`);

      if (box) {
        box.style.borderColor = d.isCorrect ? '#22C55E' : '#EF4444';
        box.style.background = d.isCorrect ? '#F0FDF4' : '#FEF2F2';
      }
      if (inp) {
        inp.disabled = true;
        inp.style.background = d.isCorrect ? '#DCFCE7' : '#FEE2E2';
      }
      if (fb) {
        fb.style.display = 'block';
        fb.style.background = d.isCorrect ? '#DCFCE7' : '#FEE2E2';
        fb.style.color = d.isCorrect ? '#166534' : '#991B1B';
        fb.innerHTML = `
          <div>${d.isCorrect ? '✓ ĐÚNG' : '✗ SAI'} — Đáp án chuẩn: <b>${d.expectedAnswer}</b></div>
          ${d.explanation ? `<div style="margin-top:3px; font-size:12px; font-weight:600;">💡 ${d.explanation}</div>` : ''}
        `;
      }

      box?.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
    });
  }

  // =========================================================================
  // 4. CHẤM BẰNG AI GEMINI TOÀN BỘ 100 CÂU & PHÂN TÍCH LỖ HỔNG
  // =========================================================================
  async startAIGrading() {
    const reportBox = document.getElementById('aiGrammarReportCard');
    const streamEl = document.getElementById('aiGrammarStreamText');
    if (!reportBox || !streamEl) return;

    reportBox.style.display = 'block';
    reportBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    streamEl.innerHTML = `⏳ <b>AI Gemini đang đọc toàn bộ 100 câu bài làm của Em, đối chiếu biến thể tự luận và phân tích trình độ ngữ pháp...</b>`;

    const apiKey = getGeminiKey();

    // Gom dữ liệu bài làm của học sinh
    const studentSubmission = this.allQuestions.map(q => {
      const ans = this.userAnswers[q.id] || "(Chưa làm)";
      return `Câu ${q.num}. [${q.type}] ${q.prompt || ''} ➔ Trả lời: "${ans}"`;
    }).join('\n');

    const promptText = `
Bạn là Trưởng ban Khảo thí Ngữ pháp tiếng Anh IELTS. Hãy chấm toàn diện bài thi 100 câu dưới đây của học sinh.
Xưng hô: "Anh" và gọi học viên là "Em".

QUY TẮC CHẤM:
1. Đọc từng câu trả lời của Em. Đối với các câu tự luận viết lại câu (Part 5) và thì (Part 1), hãy chấp nhận các cách đảo ngữ hoặc cấu trúc tương đương hợp lệ.
2. Xuất báo cáo theo định dạng Markdown rõ ràng:
   - # 🎯 BẢNG TỔNG KẾT ĐIỂM NGỮ PHÁP 100 CÂU:
     * Điểm Phần 1 (Chia thì /25)
     * Điểm Phần 2 (Cấu tạo từ /15)
     * Điểm Phần 3 (Giới từ, mạo từ /25)
     * Điểm Phần 4 (Trắc nghiệm /20)
     * Điểm Phần 5 (Viết lại câu /15)
     * 🏆 TỔNG ĐIỂM /100 — Ước tính Band ngữ pháp IELTS (ví dụ: Band 5.5, Band 6.5)
   - # 🔍 TOP LỖI SAI NGHIÊM TRỌNG CẦN SỬA GẤP:
     (Chỉ ra 5-8 câu sai tiêu biểu, trích câu Em viết, câu Anh sửa lại và lý do ngữ pháp).
   - # 💡 LỜI KHUYÊN & LỘ TRÌNH ÔN TẬP BỨT PHÁ:
     (Dặn dò ngắn gọn phương pháp khắc phục).

--- DỮ LIỆU BÀI LÀM CỦA HỌC VIÊN ---
${studentSubmission}
`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptText }] }] })
      });

      const data = await res.json();
      const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không nhận được phản hồi từ AI.";

      if (window.marked) {
        streamEl.innerHTML = window.marked.parse(outputText);
      } else {
        streamEl.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit;">${outputText}</pre>`;
      }

      // Đánh dấu tô màu đúng sai các câu trên giao diện
      const evalResult = this.evaluate();
      this.renderReviewMode(evalResult);

    } catch (e) {
      streamEl.innerHTML = `<span style="color:#DC2626;">❌ Lỗi kết nối AI: ${e.message}. Em vui lòng thử lại!</span>`;
    }
  }
}

export const diagGrammarEngine = new DiagGrammarEngine();
window.diagGrammarEngine = diagGrammarEngine;
