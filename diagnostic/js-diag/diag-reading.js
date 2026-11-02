/**
 * diagnostic/js-diag/diag-reading.js
 * BỘ MÁY ĐIỀU KHIỂN READING KHẢO THÍ CHUẨN XÁC 100%
 * TƯƠNG THÍCH TRỰC TIẾP VỚI CẤU TRÚC JSON CAMBRIDGE (GROUPS, TEMPLATES, MATRIX, TFNG, MCQ)
 * KHÔNG CẦN CHỈNH SỬA DỮ LIỆU JSON
 */

export class DiagReadingEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'readingQuestionsMount';
    this.onStateChange = options.onStateChange || null;

    this.testData = null;
    this.title = "";
    this.passageHtml = "";
    this.groups = [];
    this.questions = {};
    this.expectedAnswers = {};

    // Lưu câu trả lời của học sinh { q1: "mining", q8: "TRUE", ... }
    this.userAnswers = {};

    // Telemetry đo phản xạ
    this.metrics = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐỀ THI TỪ FILE JSON NGUYÊN BẢN (KHÔNG CẦN RECODE)
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải file ${jsonUrl}`);
      const data = await res.json();

      this.testData = data;
      this.title = data.title || "IELTS Reading Test";
      this.passageHtml = data.passageHtml || "";
      this.groups = data.groups || [];
      this.questions = data.questions || {};

      // Trích xuất toàn bộ đáp án chuẩn từ root object 'answers' hoặc 'finalAnswer' trong questions
      this.expectedAnswers = data.answers || {};
      if (Object.keys(this.expectedAnswers).length === 0 && this.questions) {
        Object.entries(this.questions).forEach(([qid, q]) => {
          if (q.finalAnswer) this.expectedAnswers[qid] = q.finalAnswer;
        });
      }

      this.userAnswers = {};
      this.metrics = {};
      this.isReviewMode = false;

      return true;
    } catch (err) {
      console.error("[DiagReadingEngine] Lỗi nạp JSON:", err);
      const mount = document.getElementById(this.containerId);
      if (mount) {
        mount.innerHTML = `
          <div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">
            ⚠️ Không thể nạp đề thi Reading: <code>${err.message}</code><br>
            <span style="font-size:12px; color:#64748B;">Hãy đảm bảo file JSON đã được đặt đúng trong thư mục diagnostic/data-diag/reading/</span>
          </div>
        `;
      }
      return false;
    }
  }

  // =========================================================================
  // 2. RENDER GIAO DIỆN CHUẨN THI MÁY (BÀI ĐỌC TRÁI - CÂU HỎI PHẢI)
  // =========================================================================
  render() {
    const mount = document.getElementById(this.containerId);
    if (!mount || !this.testData) return;

    const now = Date.now();
    let questionsHtml = '';

    // Render từng nhóm câu hỏi
    this.groups.forEach((group, gIdx) => {
      questionsHtml += this.renderGroup(group, gIdx, now);
    });

    // Bố cục Split-Screen 2 cột có thanh cuộn riêng
    mount.innerHTML = `
      <style>
        .diag-reading-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          height: calc(100vh - 220px);
          min-height: 580px;
        }
        @media (max-width: 900px) {
          .diag-reading-split { grid-template-columns: 1fr; height: auto; }
        }
        .diag-passage-panel {
          background: #FFFFFF;
          border: 2px solid #E8E2D8;
          border-left: 6px solid #8B1518;
          border-radius: 18px;
          padding: 22px 24px;
          overflow-y: auto;
          line-height: 1.75;
          font-size: 14.5px;
          color: #1E293B;
          box-shadow: 0 4px 14px rgba(0,0,0,0.02);
        }
        .diag-passage-panel h2, .diag-passage-panel h3 {
          color: #8B1518;
          margin-top: 0;
        }
        .diag-questions-panel {
          background: #FFFFFF;
          border: 2px solid #E8E2D8;
          border-radius: 18px;
          padding: 20px 22px;
          overflow-y: auto;
          box-shadow: 0 4px 14px rgba(0,0,0,0.02);
        }
        .diag-group-card {
          background: #FAF7F2;
          border: 1.5px solid #E8E2D8;
          border-radius: 16px;
          padding: 16px 18px;
          margin-bottom: 20px;
        }
        .diag-group-title {
          font-size: 15px;
          font-weight: 900;
          color: #8B1518;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .diag-group-instr {
          font-size: 13px;
          color: #64748B;
          margin-bottom: 14px;
          line-height: 1.5;
        }
        .diag-fill-input {
          font-family: inherit;
          font-size: 14px;
          font-weight: 800;
          color: #8B1518;
          background: #FFFFFF;
          border: 2px solid #CBD5E1;
          border-bottom: 3.5px solid #94A3B8;
          border-radius: 8px;
          padding: 4px 10px;
          text-align: center;
          outline: none;
          margin: 0 4px;
          display: inline-block;
          vertical-align: middle;
          transition: border-color 0.15s ease;
        }
        .diag-fill-input:focus {
          border-color: #8B1518;
          background: #FFFDF5;
        }
        .diag-matrix-wrap {
          overflow-x: auto;
          border: 1.5px solid #E8E2D8;
          border-radius: 12px;
          background: #FFFFFF;
          margin: 12px 0;
        }
        .diag-matrix-tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .diag-matrix-tbl th {
          background: #FAF7F2;
          padding: 8px 10px;
          font-weight: 900;
          border-bottom: 1.5px solid #E8E2D8;
          border-right: 1px solid #E8E2D8;
          text-align: center;
        }
        .diag-matrix-tbl td {
          padding: 8px 10px;
          border-bottom: 1px solid #E8E2D8;
          border-right: 1px solid #E8E2D8;
        }
        .diag-matrix-tbl tr:hover { background: #FDFBF7; }
        .diag-matrix-tbl input[type="radio"] {
          accent-color: #8B1518;
          cursor: pointer;
          transform: scale(1.15);
        }
        .diag-pill-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: #FFFFFF;
          border: 1.5px solid #CBD5E1;
          border-bottom: 3px solid #94A3B8;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
          user-select: none;
          transition: all 0.1s ease;
        }
        .diag-pill-label:hover { border-color: #8B1518; background: #FFF5F5; }
        .diag-pill-label.active {
          background: #8B1518;
          color: #FFFFFF;
          border-color: #5E0C0E;
        }
        .diag-choice-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 12px;
          background: #FFFFFF;
          border: 1.5px solid #CBD5E1;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13.5px;
          margin-bottom: 6px;
          transition: all 0.1s ease;
        }
        .diag-choice-box:hover { border-color: #0284C7; background: #F0F9FF; }
        .diag-q-item {
          background: #FFFFFF;
          border: 1.5px solid #E8E2D8;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
      </style>

      <div class="diag-reading-split">
        <!-- CỘT BÀI ĐỌC (BÊN TRÁI) -->
        <div class="diag-passage-panel" id="diagReadingPassageView">
          ${this.passageHtml || '<div style="color:#64748B;">Không tìm thấy nội dung bài đọc.</div>'}
        </div>

        <!-- CỘT CÂU HỎI (BÊN PHẢI) -->
        <div class="diag-questions-panel" id="diagReadingQuestionsView">
          ${questionsHtml}
        </div>
      </div>
    `;

    this.restoreUserInputsUI();
  }

  // =========================================================================
  // 3. XỬ LÝ RENDER ĐA DẠNG CÁC NHÓM CÂU HỎI CAMBRIDGE
  // =========================================================================
  renderGroup(group, gIdx, now) {
    const gType = (group.type || '').toLowerCase();
    const gMeta = ((group.title || '') + ' ' + (group.instructions || '')).toLowerCase();

    const isTFNG = gType.includes('tfng') || gMeta.includes('true/false/not given');
    const isYNNG = gType.includes('ynng') || gMeta.includes('yes/no/not given');
    const isMatchingInfo = gType.includes('matching_info') || gMeta.includes('which section') || gMeta.includes('contains the following');

    let bodyHtml = '';

    // 1. DẠNG ĐIỀN TỪ (TEMPLATE CÓ CHỨA {{q1}}, {{q2}}...)
    if (group.template) {
      let content = group.template;
      (group.questionIds || []).forEach(qId => {
        this.initQuestionMetric(qId, now);
        const q = this.questions[qId] || {};
        const width = q.inputWidth || "120px";
        const num = q.num || qId.replace('q', '');

        const inputHtml = `
          <input type="text"
            class="diag-fill-input"
            id="diag_input_${qId}"
            data-qid="${qId}"
            style="width:${width};"
            placeholder="[${num}]"
            autocomplete="off"
            oninput="window.diagReadingEngine.onInputAnswer('${qId}', this.value)"
          />
          <span id="diag_badge_${qId}" style="display:none; font-size:12px; margin-left:2px;"></span>
        `;
        content = content.replace(new RegExp(`{{${qId}}}`, 'g'), inputHtml);
      });

      bodyHtml = `
        <div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:12px; padding:16px 18px; line-height:1.8; font-size:14px;">
          ${(group.noteTitle || group.summaryTitle) ? `<b style="font-size:15px; color:#1E293B; display:block; margin-bottom:10px;">${group.noteTitle || group.summaryTitle}</b>` : ''}
          ${content}
        </div>
      `;

    // 2. DẠNG BẢNG MA TRẬN NỐI ĐOẠN MATCHING INFORMATION (A - G)
    } else if (isMatchingInfo) {
      let paras = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      // Lấy danh sách đoạn văn từ câu hỏi đầu tiên nếu có
      if (group.questionIds && group.questionIds.length > 0) {
        const firstQ = this.questions[group.questionIds[0]];
        if (firstQ && Array.isArray(firstQ.options) && firstQ.options.length > 0) {
          paras = firstQ.options.map(o => String(o).charAt(0).toUpperCase());
        }
      }

      bodyHtml = `
        <div class="diag-matrix-wrap">
          <table class="diag-matrix-tbl">
            <thead>
              <tr>
                <th style="text-align:left; min-width:180px;">Câu hỏi</th>
                ${paras.map(p => `<th>${p}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${(group.questionIds || []).map(qId => {
                this.initQuestionMetric(qId, now);
                const q = this.questions[qId] || {};
                const num = q.num || qId.replace('q', '');
                return `
                  <tr id="diag_row_${qId}">
                    <td>
                      <b>Câu ${num}.</b> ${q.text || ''}
                      <span id="diag_badge_${qId}" style="display:none; font-size:11px; margin-left:4px; font-weight:800;"></span>
                    </td>
                    ${paras.map(p => `
                      <td style="text-align:center;">
                        <input type="radio" name="diag_rad_${qId}" value="${p}" onchange="window.diagReadingEngine.onInputAnswer('${qId}', '${p}')">
                      </td>
                    `).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

    // 3. DẠNG TRẮC NGHIỆM / TFNG / YNNG / NỐI TÊN
    } else {
      bodyHtml = (group.questionIds || []).map(qId => {
        this.initQuestionMetric(qId, now);
        const q = this.questions[qId] || {};
        const num = q.num || qId.replace('q', '');

        let optionsArea = '';

        if (isTFNG) {
          optionsArea = this.renderPills(qId, ['TRUE', 'FALSE', 'NOT GIVEN']);
        } else if (isYNNG) {
          optionsArea = this.renderPills(qId, ['YES', 'NO', 'NOT GIVEN']);
        } else if (q.options && Array.isArray(q.options)) {
          optionsArea = `
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
              ${q.options.map(opt => {
                const optLetter = opt.charAt(0);
                return `
                  <label class="diag-choice-box" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${optLetter}')">
                    <input type="radio" name="diag_rad_${qId}" value="${optLetter}" style="margin-top:2px; accent-color:#8B1518;">
                    <span style="font-weight:900; color:#8B1518; background:#FDEDEE; padding:1px 6px; border-radius:5px;">${optLetter}</span>
                    <span style="flex:1;">${opt.substring(opt.indexOf('.') + 1).trim() || opt}</span>
                  </label>
                `;
              }).join('')}
            </div>
          `;
        } else {
          optionsArea = `
            <input type="text"
              class="diag-fill-input"
              id="diag_input_${qId}"
              data-qid="${qId}"
              style="width:200px; text-align:left; padding:8px 12px; margin-top:6px;"
              placeholder="Điền đáp án..."
              autocomplete="off"
              oninput="window.diagReadingEngine.onInputAnswer('${qId}', this.value)"
            />
          `;
        }

        return `
          <div class="diag-q-item" id="diag_qbox_${qId}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <b style="font-size:14px; color:#1E293B; line-height:1.5;">
                Câu ${num}. ${q.text || ''}
              </b>
              <span id="diag_badge_${qId}" style="display:none; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:800;"></span>
            </div>
            ${optionsArea}
            <div id="diag_exp_${qId}" style="display:none; margin-top:8px; padding:8px 10px; background:#FFFDF0; border-left:3px solid #EAB308; border-radius:6px; font-size:12.5px; line-height:1.5;"></div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="diag-group-card">
        <div class="diag-group-title">
          <i class="fa-solid fa-layer-group"></i> ${group.title || `Nhóm ${gIdx + 1}`}
        </div>
        ${group.instructions ? `<div class="diag-group-instr">${group.instructions}</div>` : ''}
        ${bodyHtml}
      </div>
    `;
  }

  renderPills(qId, choices) {
    return `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
        ${choices.map(c => `
          <label class="diag-pill-label" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${c}')">
            <input type="radio" name="diag_rad_${qId}" value="${c}" style="display:none;">
            <span>${c}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  // =========================================================================
  // 4. LƯU TRỮ TRẠNG THÁI & ĐO TELEMETRY
  // =========================================================================
  initQuestionMetric(qId, timestamp) {
    if (!this.metrics[qId]) {
      this.metrics[qId] = {
        renderTime: timestamp,
        firstInteractionTime: null,
        ttfiMs: null,
        hesitationCount: 0,
        interactionHistory: []
      };
    }
  }

  onInputAnswer(qId, val) {
    if (this.isReviewMode) return;
    const cleanVal = String(val).trim();
    this.userAnswers[qId] = cleanVal;

    // Cập nhật giao diện radio pills active
    const radios = document.querySelectorAll(`input[name="diag_rad_${qId}"]`);
    radios.forEach(r => {
      const isMatch = r.value.toUpperCase() === cleanVal.toUpperCase();
      r.checked = isMatch;
      const parentLabel = r.closest('.diag-pill-label');
      if (parentLabel) parentLabel.classList.toggle('active', isMatch);
    });

    // Đo tốc độ phản xạ
    const now = Date.now();
    const m = this.metrics[qId];
    if (m) {
      if (!m.firstInteractionTime) {
        m.firstInteractionTime = now;
        m.ttfiMs = now - m.renderTime;
      }
      m.interactionHistory.push({ value: cleanVal, time: now });
    }

    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getSnapshot());
    }
  }

  // =========================================================================
  // 5. BỘ CHẤM ĐIỂM CHUẨN XÁC TUYỆT ĐỐI (EVALUATOR)
  // =========================================================================
  evaluate() {
    let score = 0;
    const qKeys = Object.keys(this.expectedAnswers);
    const total = qKeys.length;
    const details = [];
    const wrongList = [];

    qKeys.forEach((qId, idx) => {
      const q = this.questions[qId] || {};
      const num = q.num || idx + 1;
      const expected = this.expectedAnswers[qId];
      const userVal = (this.userAnswers[qId] || '').trim();

      // Chuẩn hóa so sánh
      const isCorrect = this.checkIsMatch(userVal, expected);
      if (isCorrect) score++;

      const expStr = Array.isArray(expected) ? expected.join(' / ') : String(expected);

      const d = {
        questionNum: num,
        questionId: qId,
        userAnswer: userVal || "(Bỏ trống)",
        expectedAnswer: expStr,
        isCorrect: isCorrect,
        explanation: (q.explanation && q.explanation.steps) ? q.explanation.steps.join(' ') : ''
      };

      details.push(d);
      if (!isCorrect) wrongList.push(d);
    });

    return {
      title: this.title,
      score: score,
      total: total,
      scorePercent: Math.round((score / (total || 1)) * 100),
      details: details,
      wrongList: wrongList,
      answersSnapshot: this.userAnswers
    };
  }

  checkIsMatch(userVal, expected) {
    if (!userVal) return false;
    const u = userVal.toLowerCase().replace(/\s+/g, ' ').trim();

    // Chuẩn hóa viết tắt T / F / NG
    let normUser = u;
    if (u === 't') normUser = 'true';
    if (u === 'f') normUser = 'false';
    if (u === 'ng') normUser = 'not given';
    if (u === 'y') normUser = 'yes';
    if (u === 'n') normUser = 'no';

    if (Array.isArray(expected)) {
      return expected.some(exp => {
        const e = String(exp).toLowerCase().replace(/\s+/g, ' ').trim();
        return normUser === e || u === e;
      });
    } else {
      const e = String(expected).toLowerCase().replace(/\s+/g, ' ').trim();
      return normUser === e || u === e;
    }
  }

  // =========================================================================
  // 6. CHẾ ĐỘ XEM LẠI REVIEW MODE (TÔ MÀU ĐÚNG / SAI & HIỆN LỜI GIẢI)
  // =========================================================================
  renderReviewMode(evalResult) {
    this.isReviewMode = true;
    const details = evalResult?.details || [];

    details.forEach(d => {
      const qId = d.questionId;
      const inp = document.getElementById(`diag_input_${qId}`);
      const badge = document.getElementById(`diag_badge_${qId}`);
      const row = document.getElementById(`diag_row_${qId}`);
      const qbox = document.getElementById(`diag_qbox_${qId}`);
      const expBox = document.getElementById(`diag_exp_${qId}`);

      if (inp) {
        inp.disabled = true;
        inp.style.background = d.isCorrect ? '#DCFCE7' : '#FEE2E2';
        inp.style.borderColor = d.isCorrect ? '#16A34A' : '#DC2626';
        inp.style.color = d.isCorrect ? '#166534' : '#991B1B';
      }

      if (badge) {
        badge.style.display = 'inline-block';
        badge.style.background = d.isCorrect ? '#DCFCE7' : '#FEE2E2';
        badge.style.color = d.isCorrect ? '#166534' : '#991B1B';
        badge.innerText = d.isCorrect ? '✓ Đúng' : `✗ Sai (Đ/A: ${d.expectedAnswer})`;
      }

      if (row) {
        row.style.background = d.isCorrect ? '#F0FDF4' : '#FEF2F2';
      }

      if (qbox) {
        qbox.style.border = `1.5px solid ${d.isCorrect ? '#86EFAC' : '#FCA5A5'}`;
        qbox.style.background = d.isCorrect ? '#F0FDF4' : '#FFF5F5';
      }

      if (expBox && d.explanation) {
        expBox.style.display = 'block';
        expBox.innerHTML = `<b>💡 Lời giải chi tiết:</b> ${d.explanation}`;
      }

      // Vô hiệu hóa radios
      const radios = document.querySelectorAll(`input[name="diag_rad_${qId}"]`);
      radios.forEach(r => r.disabled = true);
    });
  }

  restoreUserInputsUI() {
    Object.entries(this.userAnswers).forEach(([qId, val]) => {
      const inp = document.getElementById(`diag_input_${qId}`);
      if (inp) inp.value = val;

      const radios = document.querySelectorAll(`input[name="diag_rad_${qId}"]`);
      radios.forEach(r => {
        if (r.value.toUpperCase() === String(val).toUpperCase()) {
          r.checked = true;
          const label = r.closest('.diag-pill-label');
          if (label) label.classList.add('active');
        }
      });
    });
  }

  getSnapshot() {
    return {
      title: this.title,
      userAnswers: this.userAnswers,
      metrics: this.metrics
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.userAnswers = snapshot.userAnswers || {};
    this.metrics = snapshot.metrics || {};
    this.restoreUserInputsUI();
  }
}

// Khởi tạo instance và xuất toàn cục
export const diagReadingEngine = new DiagReadingEngine();
window.diagReadingEngine = diagReadingEngine;
