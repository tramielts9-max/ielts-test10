/**
 * diagnostic/js-diag/diag-reading.js
 * BỘ ĐIỀU KHIỂN READING THÍCH ỨNG THÔNG MINH CHO CẢ 3 TEST (TEST 1, TEST 2, TEST 3)
 * HỖ TRỢ CẢ TWO-TIER NỀN TẢNG LẪN CAMBRIDGE CHUẨN + THANH KÉO 3D DUOLINGO
 */

export class DiagReadingEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'readingQuestionsMount';
    this.onStateChange = options.onStateChange || null;

    this.testData = null;
    this.mode = "FLAT_CAM"; // 'TWO_TIER' | 'FLAT_CAM' | 'GROUPED_CAM'
    this.title = "";
    this.passageHtml = "";
    this.passageText = "";
    
    this.questionsList = [];
    this.groups = [];
    this.questionsMap = {};
    this.expectedAnswers = {};

    this.userAnswers = {};
    this.metrics = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP VÀ TỰ ĐỘNG NHẬN DIỆN FORMAT ĐỀ THI
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải file ${jsonUrl}`);
      const data = await res.json();

      this.testData = data;
      this.title = data.title || data.passageTitle || "Reading Diagnostic";
      this.passageText = data.passageText || "";
      this.passageHtml = data.passageHtml || data.passageText || "";

      this.userAnswers = {};
      this.metrics = {};
      this.isReviewMode = false;

      // 1. KIỂM TRA XEM CÓ PHẢI LÀ TWO-TIER (TEST 1)
      if (data.formatType === "TWO_TIER" || (Array.isArray(data.questions) && data.questions[0]?.tier1Options)) {
        this.mode = "TWO_TIER";
        this.questionsList = data.questions || [];
      
      // 2. KIỂM TRA XEM CÓ PHẢI LÀ GROUPED CAM (CÓ THẺ GROUPS)
      } else if (Array.isArray(data.groups) && data.groups.length > 0) {
        this.mode = "GROUPED_CAM";
        this.groups = data.groups;
        this.questionsMap = data.questions || {};
        this.expectedAnswers = data.answers || {};

      // 3. NẾU LÀ CAMBRIDGE ĐỜI CŨ / DẠNG MẢNG PHẲNG (TEST 2 & TEST 3 CỦA MÀY)
      } else {
        this.mode = "FLAT_CAM";
        this.questionsList = Array.isArray(data.questions) ? data.questions : Object.values(data.questions || {});
      }

      return true;
    } catch (err) {
      console.error("[DiagReadingEngine] Lỗi:", err);
      const mount = document.getElementById(this.containerId);
      if (mount) {
        mount.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">⚠️ Lỗi nạp Reading: ${err.message}</div>`;
      }
      return false;
    }
  }

  // =========================================================================
  // 2. RENDER GIAO DIỆN CHUẨN XÁC THEO TỪNG CHẾ ĐỘ
  // =========================================================================
  render() {
    const mount = document.getElementById(this.containerId);
    if (!mount || !this.testData) return;

    if (this.mode === "TWO_TIER") {
      this.renderTwoTierView(mount);
    } else if (this.mode === "FLAT_CAM") {
      this.renderFlatCamView(mount);
    } else {
      this.renderGroupedCamView(mount);
    }

    this.restoreUserInputsUI();
    this.initDraggableResizer('diagSplitWrap', 'diagLeftPane', 'diagResizerBar', 'diagRightPane');
  }

  // --- A. GIAO DIỆN TWO-TIER (DÀNH CHO TEST 1 NỀN TẢNG) ---
  renderTwoTierView(mount) {
    let qHtml = '';

    this.questionsList.forEach((q, idx) => {
      this.initQuestionMetric(q.id, Date.now());

      const snippet = q.passageSnippet ? `
        <div style="background:#FFFDF7; border:1px solid #CBD5E1; border-left:4px solid #8B1518; padding:10px 14px; border-radius:10px; font-size:13.5px; line-height:1.6; color:#334155; margin-bottom:10px; font-style:italic;">
          "${q.passageSnippet}"
        </div>
      ` : '';

      qHtml += `
        <div class="q-item-box" id="box_${q.id}" style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:16px; padding:18px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:900; color:#8B1518; text-transform:uppercase;">
              CÂU ${idx + 1} (${q.level || 'A2'}) — ${q.type || 'Khảo sát nền tảng'}
            </span>
            <span id="badge_status_${q.id}" style="display:none; font-size:11.5px; font-weight:800; padding:2px 8px; border-radius:6px;"></span>
          </div>

          ${snippet}

          <b style="font-size:14.5px; color:#1E293B; display:block; margin-bottom:10px; line-height:1.5;">
            ${q.statement || q.questionText || q.prompt}
          </b>

          <!-- TẦNG 1 -->
          <div style="font-size:12px; font-weight:900; color:#0284C7; margin-bottom:6px; text-transform:uppercase;">
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
              🔍 Tầng 2: Chọn câu trích dẫn chứng minh căn cứ:
            </div>
            <div id="tier2_options_${q.id}" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <div id="review_feedback_${q.id}" style="display:none; margin-top:10px; padding:10px 14px; border-radius:10px; font-size:13px; line-height:1.5;"></div>
        </div>
      `;
    });

    mount.innerHTML = `
      <div id="diagSplitWrap" style="display:flex; height:calc(100vh - 215px); position:relative; user-select:none;">
        <!-- CỘT TRÁI: HƯỚNG DẪN BÀI THI NỀN TẢNG -->
        <div id="diagLeftPane" style="width:45%; height:100%; overflow-y:auto; background:#FFFFFF; border:2px solid #E8E2D8; border-left:6px solid #8B1518; border-radius:18px; padding:24px 26px; box-sizing:border-box; line-height:1.8; font-size:15px; color:#1E293B;">
          <h3 style="margin:0 0 12px 0; color:#8B1518; font-size:18px;">📖 ${this.testData.passageTitle || 'BÀI ĐỌC KHẢO SÁT NỀN TẢNG'}</h3>
          <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:12px; padding:16px; margin-bottom:16px; font-size:14px; color:#475569;">
            <b>📌 Hướng dẫn cơ chế Two-Tier (Chống đoán mò):</b><br>
            • <b>Tầng 1:</b> Em chọn đáp án chính xác.<br>
            • <b>Tầng 2:</b> Hệ thống sẽ tự động mở ra 4 câu trích dẫn. Em phải chọn đúng câu chứa bằng chứng thì mới được tính điểm.
          </div>
          <div style="white-space:pre-wrap;">${this.passageText || 'Đọc kỹ từng đoạn trích dẫn đính kèm trực tiếp tại mỗi câu hỏi bên phải.'}</div>
        </div>

        <!-- THANH KÉO 3D DUOLINGO -->
        <div id="diagResizerBar" style="width:20px; cursor:col-resize; display:flex; align-items:center; justify-content:center; z-index:10; flex-shrink:0;">
          <div style="width:34px; height:60px; background:#FFFFFF; border:2.5px solid #E8E2D8; border-bottom:5px solid #D3CBC0; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#8B1518; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08); transition:transform 0.1s ease;">
            <i class="fa-solid fa-arrows-left-right"></i>
          </div>
        </div>

        <!-- CỘT PHẢI: CÂU HỎI -->
        <div id="diagRightPane" style="flex:1; height:100%; overflow-y:auto; padding-right:4px; box-sizing:border-box;">
          ${qHtml}
        </div>
      </div>
    `;
  }

  // --- B. GIAO DIỆN FLAT CAMBRIDGE (FIX LỖI TRẮNG BÓC Ở TEST 2 & TEST 3) ---
  renderFlatCamView(mount) {
    let qHtml = '';

    this.questionsList.forEach((q, idx) => {
      this.initQuestionMetric(q.id || `q_${idx + 1}`, Date.now());
      const qNum = q.num || idx + 1;
      const qId = q.id || `q_${qNum}`;
      const qText = q.questionText || q.statement || q.prompt || '';

      let answerAreaHtml = '';

      // 1. Trắc nghiệm A, B, C, D
      if (q.options && Array.isArray(q.options) && q.options.length > 0) {
        answerAreaHtml = `
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
            ${q.options.map(opt => {
              const letter = opt.charAt(0);
              return `
                <label class="option-label" onclick="window.diagReadingEngine.onSelectFlatChoice('${qId}', '${letter}')">
                  <input type="radio" name="flat_${qId}" value="${letter}">
                  <span style="font-weight:900; color:#8B1518; background:#FDEDEE; padding:2px 7px; border-radius:6px; margin-right:4px;">${letter}</span>
                  <span style="flex:1;">${opt.substring(opt.indexOf('.') + 1).trim() || opt}</span>
                </label>
              `;
            }).join('')}
          </div>
        `;
      // 2. Điền từ
      } else {
        answerAreaHtml = `
          <div style="margin-top:8px;">
            <input type="text" id="flat_inp_${qId}" class="diag-input" placeholder="Gõ câu trả lời của em tại đây..." oninput="window.diagReadingEngine.onInputFlatText('${qId}', this.value)" style="width:100%; padding:10px 14px; border:2px solid #CBD5E1; border-radius:10px; font-weight:700;">
          </div>
        `;
      }

      qHtml += `
        <div class="q-item-box" id="box_${qId}" style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:16px; padding:18px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:900; color:#8B1518; text-transform:uppercase;">
              CÂU ${qNum}: ${q.type || 'IELTS Question'}
            </span>
            <span id="badge_status_${qId}" style="display:none; font-size:11.5px; font-weight:800; padding:2px 8px; border-radius:6px;"></span>
          </div>

          <b style="font-size:14.5px; color:#1E293B; display:block; margin-bottom:8px; line-height:1.5;">
            ${qText}
          </b>

          ${answerAreaHtml}

          <!-- Ô ghi chú / bằng chứng câu chữ nếu có -->
          ${q.explanationRequired !== false ? `
            <div style="margin-top:12px; padding-top:10px; border-top:1px dashed #E2E8F0;">
              <input type="text" id="flat_exp_${qId}" class="diag-input" placeholder="Dẫn chứng câu chữ trong bài (hoặc từ khóa)..." oninput="window.diagReadingEngine.onInputFlatExp('${qId}', this.value)" style="padding:6px 10px; font-size:12.5px; background:#FAF7F2; border-color:#E2E8F0;">
            </div>
          ` : ''}

          <div id="review_feedback_${qId}" style="display:none; margin-top:10px; padding:10px 14px; border-radius:10px; font-size:13px; line-height:1.5;"></div>
        </div>
      `;
    });

    mount.innerHTML = `
      <div id="diagSplitWrap" style="display:flex; height:calc(100vh - 215px); position:relative; user-select:none;">
        <!-- CỘT TRÁI: TOÀN BỘ BÀI ĐỌC -->
        <div id="diagLeftPane" style="width:50%; height:100%; overflow-y:auto; background:#FFFFFF; border:2px solid #E8E2D8; border-left:6px solid #8B1518; border-radius:18px; padding:24px 26px; box-sizing:border-box; line-height:1.8; font-size:15px; color:#1E293B;">
          <h3 style="margin:0 0 12px 0; color:#8B1518; font-size:18px;">${this.title || 'READING PASSAGE'}</h3>
          <div style="line-height:1.85; font-size:15px;">${this.passageHtml || this.passageText}</div>
        </div>

        <!-- THANH KÉO 3D DUOLINGO -->
        <div id="diagResizerBar" style="width:20px; cursor:col-resize; display:flex; align-items:center; justify-content:center; z-index:10; flex-shrink:0;">
          <div style="width:34px; height:60px; background:#FFFFFF; border:2.5px solid #E8E2D8; border-bottom:5px solid #D3CBC0; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#8B1518; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08); transition:transform 0.1s ease;">
            <i class="fa-solid fa-arrows-left-right"></i>
          </div>
        </div>

        <!-- CỘT PHẢI: TOÀN BỘ CÂU HỎI -->
        <div id="diagRightPane" style="flex:1; height:100%; overflow-y:auto; padding-right:4px; box-sizing:border-box;">
          ${qHtml}
        </div>
      </div>
    `;
  }

  // --- C. GIAO DIỆN GROUPED CAMBRIDGE (CHO ĐỀ CÓ GROUPS) ---
  renderGroupedCamView(mount) {
    let qContentHtml = '';

    this.groups.forEach((g, gIdx) => {
      const gType = (g.type || '').toLowerCase();
      const isTFNG = gType.includes('tfng');
      const isYNNG = gType.includes('ynng');
      let inner = '';

      if (g.template) {
        let tmpl = g.template;
        (g.questionIds || []).forEach(qId => {
          const q = (this.questionsMap || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          const inputEl = `
            <input type="text" class="diag-input" id="inp_grp_${qId}" style="width:120px; display:inline-block; vertical-align:middle; padding:5px 8px; text-align:center; font-weight:800; color:#8B1518; margin:0 4px;" placeholder="[${num}]" oninput="window.diagReadingEngine.onInputAnswer('${qId}', this.value)">
          `;
          tmpl = tmpl.replace(new RegExp(`{{${qId}}}`, 'g'), inputEl);
        });
        inner = `<div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:12px; padding:18px; font-size:14.5px; line-height:1.85;">${tmpl}</div>`;
      } else {
        inner = (g.questionIds || []).map(qId => {
          const q = (this.questionsMap || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          let opts = '';

          if (isTFNG || isYNNG) {
            const list = isTFNG ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
            opts = list.map(ch => `
              <label class="option-label" style="display:inline-flex; width:auto; padding:7px 16px; margin-right:6px;" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${ch}')">
                <input type="radio" name="rad_grp_${qId}" value="${ch}">
                <span>${ch}</span>
              </label>
            `).join('');
          } else if (q.options && Array.isArray(q.options)) {
            opts = q.options.map(opt => `
              <label class="option-label" onclick="window.diagReadingEngine.onInputAnswer('${qId}', '${opt.charAt(0)}')">
                <input type="radio" name="rad_grp_${qId}" value="${opt.charAt(0)}">
                <span>${opt}</span>
              </label>
            `).join('');
          } else {
            opts = `<input type="text" class="diag-input" id="inp_grp_${qId}" placeholder="Điền đáp án..." oninput="window.diagReadingEngine.onInputAnswer('${qId}', this.value)">`;
          }

          return `
            <div class="q-item-box" style="margin-bottom:12px; background:#FFFFFF;">
              <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:6px;">Câu ${num}. ${q.text || ''}</b>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">${opts}</div>
            </div>
          `;
        }).join('');
      }

      qContentHtml += `
        <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:14px; padding:16px; margin-bottom:16px;">
          <b style="font-size:15.5px; color:#8B1518; display:block; margin-bottom:4px;">${g.title}</b>
          ${inner}
        </div>
      `;
    });

    mount.innerHTML = `
      <div id="diagSplitWrap" style="display:flex; height:calc(100vh - 215px); position:relative; user-select:none;">
        <div id="diagLeftPane" style="width:50%; height:100%; overflow-y:auto; background:#FFFFFF; border:2px solid #E8E2D8; border-left:6px solid #8B1518; border-radius:18px; padding:24px 26px; box-sizing:border-box; line-height:1.8; font-size:15px; color:#1E293B;">
          <h3 style="margin:0 0 12px 0; color:#8B1518; font-size:18px;">${this.title || 'READING PASSAGE'}</h3>
          <div>${this.passageHtml}</div>
        </div>
        <div id="diagResizerBar" style="width:20px; cursor:col-resize; display:flex; align-items:center; justify-content:center; z-index:10; flex-shrink:0;">
          <div style="width:34px; height:60px; background:#FFFFFF; border:2.5px solid #E8E2D8; border-bottom:5px solid #D3CBC0; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#8B1518; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <i class="fa-solid fa-arrows-left-right"></i>
          </div>
        </div>
        <div id="diagRightPane" style="flex:1; height:100%; overflow-y:auto; padding-right:4px; box-sizing:border-box;">
          ${qContentHtml}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 3. THANH KÉO CO GIÃN RESIZER 3D DUOLINGO
  // =========================================================================
  initDraggableResizer(wrapId, leftId, resizerId, rightId) {
    const wrap = document.getElementById(wrapId);
    const left = document.getElementById(leftId);
    const resizer = document.getElementById(resizerId);
    if (!wrap || !left || !resizer) return;

    let isDragging = false;
    const handle = resizer.querySelector('div');

    const onMouseDown = () => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      if (handle) {
        handle.style.transform = 'scale(0.92)';
        handle.style.borderBottomWidth = '2px';
        handle.style.background = '#FFF5F5';
      }
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const wrapRect = wrap.getBoundingClientRect();
      const pointerX = e.clientX || (e.touches && e.touches[0].clientX);
      if (!pointerX) return;

      const offset = pointerX - wrapRect.left;
      let pct = (offset / wrapRect.width) * 100;
      if (pct < 25) pct = 25;
      if (pct > 75) pct = 75;

      left.style.width = `${pct}%`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (handle) {
        handle.style.transform = 'scale(1)';
        handle.style.borderBottomWidth = '5px';
        handle.style.background = '#FFFFFF';
      }
    };

    resizer.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    resizer.addEventListener('touchstart', onMouseDown);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
  }

  // =========================================================================
  // 4. TIỆN ÍCH LƯU TRỮ VÀ XỬ LÝ SỰ KIỆN
  // =========================================================================
  onSelectTier1(qId, selectedLetter) {
    if (!this.userAnswers[qId]) this.userAnswers[qId] = {};
    this.userAnswers[qId].t1Val = selectedLetter;

    const q = this.questionsList.find(item => item.id === qId);
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

  onSelectFlatChoice(qId, letter) {
    if (!this.userAnswers[qId]) this.userAnswers[qId] = {};
    this.userAnswers[qId].answer = letter;
  }

  onInputFlatText(qId, text) {
    if (!this.userAnswers[qId]) this.userAnswers[qId] = {};
    this.userAnswers[qId].answer = text.trim();
  }

  onInputFlatExp(qId, text) {
    if (!this.userAnswers[qId]) this.userAnswers[qId] = {};
    this.userAnswers[qId].exp = text.trim();
  }

  onInputAnswer(qId, val) {
    this.userAnswers[qId] = String(val).trim();
  }

  initQuestionMetric(qId, timestamp) {
    if (!this.metrics[qId]) this.metrics[qId] = { renderTime: timestamp };
  }

  // =========================================================================
  // 5. BỘ CHẤM ĐIỂM CHUẨN XÁC THEO TỪNG THỂ LOẠI
  // =========================================================================
  evaluate() {
    let score = 0;
    const details = [];
    const wrongList = [];

    // Chấm Two-Tier
    if (this.mode === "TWO_TIER") {
      const total = this.questionsList.length;
      this.questionsList.forEach((q, idx) => {
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

    // Chấm Flat Cambridge (Test 2 & Test 3)
    if (this.mode === "FLAT_CAM") {
      const total = this.questionsList.length;
      this.questionsList.forEach((q, idx) => {
        const qNum = q.num || idx + 1;
        const qId = q.id || `q_${qNum}`;
        const u = (this.userAnswers[qId]?.answer || this.userAnswers[qId] || '').trim();
        const exp = q.correctAnswer || q.finalAnswer || '';
        const isCorrect = this.checkMatch(u, exp);
        if (isCorrect) score++;

        const expStr = Array.isArray(exp) ? exp.join(' / ') : String(exp);
        const d = {
          questionNum: qNum,
          questionId: qId,
          userAnswer: u || "(Bỏ trống)",
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

    // Chấm Grouped Cam
    const qKeys = Object.keys(this.expectedAnswers);
    const total = qKeys.length;
    qKeys.forEach((qId, idx) => {
      const q = this.questionsMap[qId] || {};
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
  // 6. KHÔI PHỤC VÀ REVIEW MODE
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
        fb.innerHTML = `Đ/A chuẩn: <b>${d.expectedTier1 || d.expectedAnswer}</b> ${d.behaviorTag ? `(${d.behaviorTag})` : ''}`;
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
        if (val.answer) {
          const r3 = document.querySelector(`input[name="flat_${qid}"][value="${val.answer}"]`);
          if (r3) r3.checked = true;
          const textInp = document.getElementById(`flat_inp_${qid}`);
          if (textInp) textInp.value = val.answer;
        }
      } else {
        const rad = document.querySelector(`input[name="flat_${qid}"][value="${val}"]`) || document.querySelector(`input[name="rad_grp_${qid}"][value="${val}"]`);
        if (rad) rad.checked = true;
        const textInp = document.getElementById(`flat_inp_${qid}`) || document.getElementById(`inp_grp_${qid}`);
        if (textInp) textInp.value = val;
      }
    });
  }
}

export const diagReadingEngine = new DiagReadingEngine();
window.diagReadingEngine = diagReadingEngine;
