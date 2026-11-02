/**
 * diagnostic/js-diag/diag-reading.js
 * BỘ MÁY READING ĐA NĂNG (HYBRID 2 TRONG 1):
 * HỖ TRỢ CẢ HAI DẠNG:
 * 1. ĐỀ CAMBRIDGE THI THẬT (GROUPS, TEMPLATES, MATRIX, TFNG, MCQ)
 * 2. ĐỀ CHẨN ĐOÁN TEST 1 NỀN TẢNG (TWO-TIER CHỐNG ĐOÁN MÒ 2 TẦNG)
 */

export class DiagReadingEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'readingQuestionsMount';
    this.onStateChange = options.onStateChange || null;

    this.testData = null;
    this.formatType = "CAM_STANDARD"; // 'CAM_STANDARD' hoặc 'TWO_TIER'
    this.title = "";
    this.passageHtml = "";
    this.passageText = "";
    this.groups = [];
    this.questions = {};
    this.twoTierQuestions = [];
    this.expectedAnswers = {};

    this.userAnswers = {};
    this.metrics = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐỀ THI VÀ TỰ ĐỘNG PHÁT HIỆN ĐỊNH DẠNG
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải file ${jsonUrl}`);
      const data = await res.json();

      this.testData = data;
      this.title = data.title || "IELTS Reading Diagnostic";
      this.userAnswers = {};
      this.metrics = {};
      this.isReviewMode = false;

      // KIỂM TRA ĐỊNH DẠNG: TWO-TIER (TEST 1 NỀN TẢNG) HAY CAMBRIDGE THI THẬT
      if (data.formatType === "TWO_TIER" || (Array.isArray(data.questions) && data.questions[0]?.tier1Options)) {
        this.formatType = "TWO_TIER";
        this.passageText = data.passageText || "";
        this.twoTierQuestions = data.questions || [];
      } else {
        this.formatType = "CAM_STANDARD";
        this.passageHtml = data.passageHtml || data.passageText || "";
        this.groups = data.groups || [];
        this.questions = data.questions || {};

        this.expectedAnswers = data.answers || {};
        if (Object.keys(this.expectedAnswers).length === 0 && this.questions) {
          Object.entries(this.questions).forEach(([qid, q]) => {
            if (q.finalAnswer) this.expectedAnswers[qid] = q.finalAnswer;
          });
        }
      }

      return true;
    } catch (err) {
      console.error("[DiagReadingEngine] Lỗi nạp JSON:", err);
      const mount = document.getElementById(this.containerId);
      if (mount) {
        mount.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">⚠️ Không thể nạp đề Reading: ${err.message}</div>`;
      }
      return false;
    }
  }

  // =========================================================================
  // 2. RENDER GIAO DIỆN CHÍNH
  // =========================================================================
  render() {
    const mount = document.getElementById(this.containerId);
    if (!mount || !this.testData) return;

    if (this.formatType === "TWO_TIER") {
      this.renderTwoTierUI(mount);
    } else {
      this.renderCambridgeUI(mount);
    }
    this.restoreUserInputsUI();
  }

  // =========================================================================
  // 3. GIAO DIỆN CHO TEST 1 NỀN TẢNG (TWO-TIER CHỐNG ĐOÁN MÒ BUNG TO TRÀN VIỀN)
  // =========================================================================
  renderTwoTierUI(mount) {
    const now = Date.now();
    let qHtml = '';

    this.twoTierQuestions.forEach((q, idx) => {
      this.initQuestionMetric(q.id, now);
      const snippet = q.passageSnippet ? `
        <div style="background:#FFFDF7; border:1px solid #CBD5E1; border-left:4px solid #8B1518; padding:10px 14px; border-radius:10px; font-size:13.5px; line-height:1.6; color:#334155; margin-bottom:10px; font-style:italic;">
          "${q.passageSnippet}"
        </div>
      ` : '';

      qHtml += `
        <div class="q-item-box" id="box_${q.id}" style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:16px; padding:18px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:900; color:#8B1518; text-transform:uppercase;">
              CÂU ${idx + 1} (${q.level || 'A2'}) — ${q.type || 'Xác thực thông tin'}
            </span>
            <span id="badge_status_${q.id}" style="display:none; font-size:11.5px; font-weight:800; padding:2px 8px; border-radius:6px;"></span>
          </div>

          ${snippet}

          <b style="font-size:14.5px; color:#1E293B; display:block; margin-bottom:10px; line-height:1.5;">
            ${q.statement || q.questionText}
          </b>

          <!-- TẦNG 1 -->
          <div style="font-size:12px; font-weight:900; color:#0284C7; margin-bottom:4px; text-transform:uppercase;">
            Tầng 1: Lựa chọn của em
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${(q.tier1Options || []).map(opt => {
              const optLetter = opt.charAt(0);
              return `
                <label class="option-label" style="flex:1; min-width:140px; margin-top:0;" onclick="window.diagReadingEngine.onSelectTier1('${q.id}', '${optLetter}')">
                  <input type="radio" name="t1_${q.id}" value="${optLetter}">
                  <span>${opt}</span>
                </label>
              `;
            }).join('')}
          </div>

          <!-- TẦNG 2 -->
          <div id="tier2_box_${q.id}" style="display:none; margin-top:12px; padding:14px; background:#FFFBEB; border:2px dashed #F59E0B; border-radius:12px;">
            <div style="font-size:12px; font-weight:900; color:#92400E; margin-bottom:8px; text-transform:uppercase;">
              🔍 Tầng 2: Chọn câu trích dẫn làm căn cứ cho lựa chọn của em:
            </div>
            <div id="tier2_options_${q.id}" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <div id="review_feedback_${q.id}" style="display:none; margin-top:10px; padding:10px 14px; border-radius:10px; font-size:13px; line-height:1.5;"></div>
        </div>
      `;
    });

    mount.innerHTML = `
      <div style="display:grid; grid-template-columns: 42% 58%; gap:20px; height:calc(100vh - 215px);">
        <!-- CỘT TRÁI: BÀI ĐỌC TỔNG THỂ -->
        <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-left:6px solid #8B1518; border-radius:18px; padding:22px 24px; overflow-y:auto; line-height:1.8; font-size:15px; color:#1E293B;">
          <h3 style="margin:0 0 12px 0; color:#8B1518; font-size:18px;">📖 ${this.testData.passageTitle || 'READING PASSAGE'}</h3>
          <div style="white-space:pre-wrap;">${this.passageText || 'Xem các trích đoạn trực tiếp ở từng câu hỏi bên phải.'}</div>
        </div>
        <!-- CỘT PHẢI: CÂU HỎI 2 TẦNG CHỐNG ĐOÁN MÒ -->
        <div style="overflow-y:auto; padding-right:6px;">
          ${qHtml}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 4. GIAO DIỆN CHO ĐỀ CAMBRIDGE THI THẬT
  // =========================================================================
  renderCambridgeUI(mount) {
    const now = Date.now();
    let qContentHtml = '';

    this.groups.forEach((g, gIdx) => {
      const gType = (g.type || '').toLowerCase();
      const gMeta = ((g.title || '') + ' ' + (g.instructions || '')).toLowerCase();
      const isTFNG = gType.includes('tfng') || gMeta.includes('true/false/not given');
      const isYNNG = gType.includes('ynng') || gMeta.includes('yes/no/not given');
      const isMatchingInfo = gType.includes('matching_info') || gMeta.includes('which section') || gMeta.includes('contains the following');

      let inner = '';

      if (g.template) {
        let tmpl = g.template;
        (g.questionIds || []).forEach(qId => {
          this.initQuestionMetric(qId, now);
          const q = (this.questions || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          const width = q.inputWidth || "120px";
          const inputEl = `
            <input type="text" class="diag-input" id="inp_diag_read_${qId}" style="width:${width}; display:inline-block; vertical-align:middle; padding:5px 8px; text-align:center; font-weight:800; color:#8B1518; margin:0 4px;" placeholder="[${num}]" oninput="window.diagReadingEngine.onInputAnswer('${qId}', this.value)">
          `;
          tmpl = tmpl.replace(new RegExp(`{{${qId}}}`, 'g'), inputEl);
        });
        inner = `
          <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:12px; padding:18px; font-size:14.5px; line-height:1.85;">
            ${(g.noteTitle || g.summaryTitle) ? `<b style="font-size:15px; color:#8B1518; display:block; margin-bottom:8px;">${g.noteTitle || g.summaryTitle}</b>` : ''}
            ${tmpl}
          </div>
        `;
      } else if (isMatchingInfo) {
        let paras = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        if (g.questionIds && g.questionIds.length > 0) {
          const firstQ = (this.questions || {})[g.questionIds[0]];
          if (firstQ && Array.isArray(firstQ.options) && firstQ.options.length > 0) {
            paras = firstQ.options.map(o => String(o).charAt(0).toUpperCase());
          }
        }
        inner = `
          <div style="overflow-x:auto; background:#FFFFFF; border:1.5px solid #E8E2D8; border-radius:12px; margin:10px 0;">
            <table style="width:100%; border-collapse:collapse; font-size:13.5px;">
              <thead>
                <tr style="background:#FAF7F2;">
                  <th style="padding:10px 12px; text-align:left;">Câu hỏi</th>
                  ${paras.map(p => `<th style="padding:10px 6px; text-align:center;">${p}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${(g.questionIds || []).map(qId => {
                  this.initQuestionMetric(qId, now);
                  const q = (this.questions || {})[qId] || {};
                  return `
                    <tr style="border-top:1px solid #E8E2D8;">
                      <td style="padding:10px 12px; font-weight:700;">Câu ${q.num || qId}. ${q.text || ''}</td>
                      ${paras.map(p => `
                        <td style="text-align:center; padding:6px;">
                          <input type="radio" name="rad_diag_read_${qId}" value="${p}" onchange="window.diagReadingEngine.onInputAnswer('${qId}', '${p}')">
                        </td>
                      `).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        inner = (g.questionIds || []).map(qId => {
          this.initQuestionMetric(qId, now);
          const q = (this.questions || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          let opts = '';

          if (isTFNG) {
            opts = ['TRUE', 'FALSE', 'NOT GIVEN'].map(ch => `
              <label class="option-label" style="display:inline-flex; width:auto; padding:7px 16px; margin-right:6px;" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${ch}')">
                <input type="radio" name="rad_diag_read_${qId}" value="${ch}">
                <span>${ch}</span>
              </label>
            `).join('');
          } else if (isYNNG) {
            opts = ['YES', 'NO', 'NOT GIVEN'].map(ch => `
              <label class="option-label" style="display:inline-flex; width:auto; padding:7px 16px; margin-right:6px;" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${ch}')">
                <input type="radio" name="rad_diag_read_${qId}" value="${ch}">
                <span>${ch}</span>
              </label>
            `).join('');
          } else if (q.options && Array.isArray(q.options)) {
            opts = q.options.map(opt => `
              <label class="option-label" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${opt.charAt(0)}')">
                <input type="radio" name="rad_diag_read_${qId}" value="${opt.charAt(0)}">
                <span>${opt}</span>
              </label>
            `).join('');
          } else {
            opts = `<input type="text" class="diag-input" id="inp_diag_read_${qId}" placeholder="Điền đáp án..." oninput="window.diagReadingEngine.onInputAnswer('${qId}', this.value)">`;
          }

          return `
            <div class="q-item-box" style="margin-bottom:12px; background:#FFFFFF;">
              <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:6px;">
                Câu ${num}. ${q.text || ''}
              </b>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">${opts}</div>
            </div>
          `;
        }).join('');
      }

      qContentHtml += `
        <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:14px; padding:16px; margin-bottom:16px;">
          <b style="font-size:15.5px; color:#8B1518; display:block; margin-bottom:4px;">${g.title}</b>
          ${g.instructions ? `<div style="font-size:13px; color:#64748B; margin-bottom:12px;">${g.instructions}</div>` : ''}
          ${inner}
        </div>
      `;
    });

    mount.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; height:calc(100vh - 215px);">
        <!-- CỘT TRÁI: BÀI ĐỌC -->
        <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-left:6px solid #8B1518; border-radius:18px; padding:24px 26px; overflow-y:auto; line-height:1.8; font-size:15px; color:#1E293B;">
          <h3 style="margin:0 0 12px 0; color:#8B1518; font-size:18px;">${this.title || 'READING PASSAGE'}</h3>
          <div>${this.passageHtml}</div>
        </div>
        <!-- CỘT PHẢI: CÂU HỎI -->
        <div style="overflow-y:auto; padding-right:6px;">
          ${qContentHtml}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 5. TƯƠNG TÁC NGƯỜI DÙNG & LƯU ĐÁP ÁN
  // =========================================================================
  onSelectTier1(qId, selectedLetter) {
    if (!this.userAnswers[qId]) this.userAnswers[qId] = {};
    this.userAnswers[qId].t1Val = selectedLetter;

    const q = this.twoTierQuestions.find(item => item.id === qId);
    if (!q || !q.tier2Options) return;

    const tier2Container = document.getElementById(`tier2_box_${qId}`);
    const tier2Mount = document.getElementById(`tier2_options_${qId}`);
    if (!tier2Container || !tier2Mount) return;

    const options = q.tier2Options[selectedLetter] || [];
    tier2Mount.innerHTML = options.map(opt => `
      <label class="option-label" style="background:#FFFFFF; border:1.5px solid #FCD34D; border-radius:8px; padding:8px 12px; margin-top:4px;" onclick="window.diagReadingEngine.onSelectTier2('${qId}', '${opt.code}')">
        <input type="radio" name="t2_${qId}" value="${opt.code}">
        <span style="font-size:13px; color:#1E293B;">${opt.text}</span>
      </label>
    `).join('');

    tier2Container.style.display = 'block';
  }

  onSelectTier2(qId, selectedCode) {
    if (!this.userAnswers[qId]) this.userAnswers[qId] = {};
    this.userAnswers[qId].t2Val = selectedCode;
  }

  onInputAnswer(qId, val) {
    this.userAnswers[qId] = String(val).trim();
  }

  initQuestionMetric(qId, timestamp) {
    if (!this.metrics[qId]) {
      this.metrics[qId] = { renderTime: timestamp };
    }
  }

  // =========================================================================
  // 6. CHẤM ĐIỂM TOÀN DIỆN
  // =========================================================================
  evaluate() {
    let score = 0;
    const details = [];
    const wrongList = [];

    // CHẤM TWO-TIER (TEST 1)
    if (this.formatType === "TWO_TIER") {
      const total = this.twoTierQuestions.length;
      this.twoTierQuestions.forEach((q, idx) => {
        const u = this.userAnswers[q.id] || {};
        const t1 = (u.t1Val || "").toUpperCase().trim();
        const t2 = (u.t2Val || "").toUpperCase().trim();

        const isT1 = t1 === (q.correctTier1 || "").toUpperCase().trim();
        const isT2 = t2 === (q.correctTier2 || "").toUpperCase().trim();
        const isCorrect = isT1 && isT2;

        if (isCorrect) score++;

        const d = {
          questionNum: idx + 1,
          questionId: q.id,
          userTier1: t1 || "Trống",
          userTier2: t2 || "Trống",
          expectedTier1: q.correctTier1,
          expectedTier2: q.correctTier2,
          isCorrect: isCorrect,
          behaviorTag: isCorrect ? "Hiểu bản chất" : (isT1 ? "Đoán mò / Sai căn cứ" : "Sai đáp án")
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

    // CHẤM CAMBRIDGE (TEST 2, TEST 3)
    const qKeys = Object.keys(this.expectedAnswers);
    const total = qKeys.length;

    qKeys.forEach((qId, idx) => {
      const q = this.questions[qId] || {};
      const expected = this.expectedAnswers[qId];
      const userVal = (this.userAnswers[qId] || '').trim();

      const isCorrect = this.checkMatch(userVal, expected);
      if (isCorrect) score++;

      const expStr = Array.isArray(expected) ? expected.join(' / ') : String(expected);
      const d = {
        questionNum: q.num || idx + 1,
        questionId: qId,
        userAnswer: userVal || "(Bỏ trống)",
        expectedAnswer: expStr,
        isCorrect: isCorrect
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

  checkMatch(u, exp) {
    if (!u) return false;
    let s = u.toLowerCase().trim();
    if (s === 't') s = 'true';
    if (s === 'f') s = 'false';
    if (s === 'ng') s = 'not given';
    if (s === 'y') s = 'yes';
    if (s === 'n') s = 'no';

    if (Array.isArray(exp)) {
      return exp.some(e => String(e).toLowerCase().trim() === s || String(e).toLowerCase().trim() === u.toLowerCase().trim());
    }
    const e = String(exp).toLowerCase().trim();
    return s === e || u.toLowerCase().trim() === e;
  }

  // =========================================================================
  // 7. REVIEW MODE & KHÔI PHỤC DỮ LIỆU
  // =========================================================================
  renderReviewMode(evalResult) {
    this.isReviewMode = true;
    (evalResult.details || []).forEach(d => {
      const badge = document.getElementById(`badge_status_${d.questionId}`);
      const fb = document.getElementById(`review_feedback_${d.questionId}`);
      const box = document.getElementById(`box_${d.questionId}`);

      if (box) box.style.borderColor = d.isCorrect ? '#22C55E' : '#EF4444';
      if (badge) {
        badge.style.display = 'inline-block';
        badge.style.background = d.isCorrect ? '#DCFCE7' : '#FEE2E2';
        badge.style.color = d.isCorrect ? '#166534' : '#991B1B';
        badge.innerText = d.isCorrect ? '✓ ĐÚNG' : '✗ SAI';
      }
      if (fb) {
        fb.style.display = 'block';
        fb.style.background = d.isCorrect ? '#F0FDF4' : '#FEF2F2';
        fb.innerHTML = `Đ/A chuẩn: <b>${d.expectedTier1 || d.expectedAnswer}</b> (${d.behaviorTag || ''})`;
      }
    });
  }

  restoreUserInputsUI() {
    Object.entries(this.userAnswers).forEach(([qid, val]) => {
      if (typeof val === 'object') {
        if (val.t1Val) {
          const r = document.querySelector(`input[name="t1_${qid}"][value="${val.t1Val}"]`);
          if (r) { r.checked = true; this.onSelectTier1(qid, val.t1Val); }
        }
        if (val.t2Val) {
          const r2 = document.querySelector(`input[name="t2_${qid}"][value="${val.t2Val}"]`);
          if (r2) r2.checked = true;
        }
      } else {
        const inp = document.getElementById(`inp_diag_read_${qid}`);
        if (inp) inp.value = val;
        const rad = document.querySelector(`input[name="rad_diag_read_${qid}"][value="${val}"]`);
        if (rad) rad.checked = true;
      }
    });
  }
}

export const diagReadingEngine = new DiagReadingEngine();
window.diagReadingEngine = diagReadingEngine;
