/**
 * diagnostic/js-diag/diag-writing.js
 * BỘ ĐIỀU KHIỂN WRITING KHẢO THÍ CHUYÊN BIỆT (TEST 1, TEST 2, TEST 3)
 * BẢN FULL ĐẦY ĐỦ 100% - BẢO TOÀN TẤT CẢ TÍNH NĂNG GỐC + TÍCH HỢP CHUẨN RUBRIC AI
 * - RENDER BIỂU ĐỒ TASK 1, BRAINSTORM TIẾNG VIỆT, TỪ KHÓA, PEEL BODY
 * - ĐẾM TỪ REALTIME, LIGHTBOX PHÓNG TO ẢNH BIỂU ĐỒ
 * - CHẤM ĐIỂM CHUẨN 4 TIÊU CHÍ (TA/TR, CC, LR, GRA) TỪ 0.0 ĐẾN 9.0 QUA DIAG-AI.JS
 * - REVIEW MODE TRỰC TIẾP TRÊN GIAO DIỆN (INLINE AI GRADING)
 */

import { diagAIService } from './diag-ai.js';

export class DiagWritingEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'writingMountContainer';
    this.testMeta = {};
    this.data = null;
    this.userAnswers = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐỀ WRITING TỪ FILE JSON RIÊNG BIỆT
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    try {
      const res = await fetch(jsonUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải ${jsonUrl}`);
      this.data = await res.json();

      this.testMeta = {
        testId: this.data.testId || "test_01",
        set: this.data.set || 1,
        level: this.data.level || "Nền tảng"
      };

      this.userAnswers = {};
      return true;
    } catch (err) {
      console.warn("[DiagWritingEngine] Không thể nạp JSON Writing ngoài:", err);
      return false;
    }
  }

  // =========================================================================
  // 2. RENDER GIAO DIỆN BÀI THI WRITING RA MÀN HÌNH
  // =========================================================================
  render() {
    const mount = document.getElementById(this.containerId) || document.getElementById('section_writing');
    if (!mount || !this.data) return;

    const t1 = this.data.task1;
    const t2 = this.data.task2;
    const isTest3 = this.testMeta.testId === 'test_03';

    let html = `
      <div style="border-bottom: 2px solid #F4EFEB; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h3 style="margin: 0; color: #2563EB; font-size: 18px; font-weight: 900;">
            <i class="fa-solid fa-pen-nib"></i> PHẦN 4: KHẢO SÁT NĂNG LỰC VIẾT (WRITING)
          </h3>
          <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #64748B;">
            Cấp độ: <b>${this.data.level}</b> • Thực hiện đầy đủ các chặng tư duy và viết câu tiếng Anh. AI sẽ chấm trực tiếp theo đúng 4 tiêu chí IELTS.
          </p>
        </div>
        <span style="font-size: 12px; font-weight: 900; background: #DBEAFE; color: #1E40AF; padding: 4px 12px; border-radius: 12px; border: 1px solid #BFDBFE;">
          Đề Set ${this.testMeta.set}
        </span>
      </div>

      <!-- KHUNG BÀI LÀM TASK 1 -->
      ${this.renderTask1Card(t1, isTest3)}

      <!-- KHUNG BÀI LÀM TASK 2 -->
      ${this.renderTask2Card(t2, isTest3)}

      <!-- KHUNG HIỂN THỊ PHIẾU CHẤM AI TRỰC TIẾP -->
      <div id="inlineWritingAiMount"></div>

      <!-- POPUP LIGHTBOX PHÓNG TO ẢNH BIỂU ĐỒ TASK 1 -->
      <div id="diagImageModal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:9999; align-items:center; justify-content:center; padding:20px;" onclick="window.diagWritingEngine.closeImageModal()">
        <div style="position:relative; max-width:900px; max-height:90vh; background:#FFFFFF; border-radius:18px; padding:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
          <button type="button" onclick="window.diagWritingEngine.closeImageModal()" style="position:absolute; top:10px; right:12px; background:#EF4444; color:white; border:none; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer;">✕</button>
          <img id="modalChartImg" src="" alt="Biểu đồ phóng to" style="max-width:100%; max-height:80vh; border-radius:10px; display:block; margin:0 auto;">
        </div>
      </div>
    `;

    mount.innerHTML = html;
    this.restoreUserInputs();
  }

  // =========================================================================
  // 3. RENDER TASK 1 (ẢNH, BRAINSTORM TIẾNG VIỆT, VIẾT TIẾNG ANH)
  // =========================================================================
  renderTask1Card(t1, isTest3) {
    if (!t1) return '';

    return `
      <div class="q-item-box" style="margin-bottom:24px; border:2.5px solid #BFDBFE; background:#F8FAFC;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <b style="font-size:16px; color:#1E40AF; text-transform:uppercase;">
            📊 ${t1.title} (${t1.type})
          </b>
          <button type="button" class="btn-3d btn-3d-white" style="padding:6px 12px; font-size:12px;" onclick="window.diagWritingEngine.openImageModal('${t1.imageUrl}')">
            🔍 Bấm để phóng to biểu đồ
          </button>
        </div>

        <div style="display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap; align-items:flex-start;">
          <div style="flex:1; min-width:260px; max-width:380px; background:#FFFFFF; border:2px solid #CBD5E1; border-radius:14px; padding:10px; text-align:center; cursor:pointer;" onclick="window.diagWritingEngine.openImageModal('${t1.imageUrl}')">
            <img src="${t1.imageUrl}" alt="Biểu đồ Task 1" style="max-width:100%; height:auto; border-radius:8px; display:block; margin:0 auto;">
            <div style="font-size:11px; font-weight:800; color:#64748B; margin-top:6px;">(Bấm vào hình để phóng to toàn màn hình)</div>
          </div>
          <div style="flex:1.5; min-width:280px; font-size:14px; line-height:1.6; color:#334155;">
            <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-left:4px solid #1E40AF; border-radius:12px; padding:12px 14px; margin-bottom:10px;">
              <b>Đề bài gốc:</b> "${t1.promptEn}"
            </div>
            ${t1.instructions ? `<div style="font-size:13px; font-weight:700; color:#1E40AF; margin-bottom:8px;">📌 <b>Yêu cầu:</b> ${t1.instructions}</div>` : ''}
            
            ${isTest3 ? `
              <div style="background:#EFF6FF; border:1.5px solid #BAE6FD; border-radius:12px; padding:10px 14px; font-size:12.5px; line-height:1.6;">
                <b style="color:#0369A1; display:block; margin-bottom:4px;">🎯 Chiến thuật phân chia 2 đoạn Body:</b>
                <div>• <b>Body 1:</b> ${t1.dataGroupingStrategy?.body1Focus || ''}</div>
                <div>• <b>Body 2:</b> ${t1.dataGroupingStrategy?.body2Focus || ''}</div>
              </div>
            ` : ''}
          </div>
        </div>

        ${t1.stage1 ? `
          <div style="background:#FFFFFF; border:2px solid #E2E8F0; border-radius:14px; padding:16px; margin-bottom:18px;">
            <div style="font-size:14px; font-weight:900; color:#059669; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-brain"></i> ${t1.stage1.title}
            </div>
            <p style="font-size:12.5px; font-weight:700; color:#64748B; margin:0 0 12px 0;">${t1.stage1.guide}</p>

            ${(t1.stage1.questions || []).map(q => `
              <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:10px; padding:12px; margin-bottom:10px;">
                <b style="font-size:13.5px; color:#1E293B; display:block; margin-bottom:4px;">${q.label}</b>
                <div style="font-size:12px; color:#78350F; background:#FEF3C7; padding:6px 10px; border-radius:6px; margin-bottom:8px; white-space:pre-line;">
                  <i>Ví dụ mẫu:</i>\n${q.example}
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  ${(q.fields || []).map(f => `
                    <input type="text" 
                           id="${q.id}_${f.key}" 
                           class="diag-input" 
                           style="padding:8px 12px; font-size:13px;" 
                           placeholder="${f.placeholder}" 
                           oninput="window.diagWritingEngine.recordInput('${q.id}_${f.key}', this.value)">
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="background:#FFFFFF; border:2px solid #BFDBFE; border-radius:14px; padding:16px;">
          <div style="font-size:14px; font-weight:900; color:#1E40AF; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-pen"></i> ${isTest3 ? 'Viết 2 Đoạn Thân Bài (Body 1 & Body 2)' : (t1.stage2?.title || 'Viết Câu Overview Tiếng Anh')}
          </div>

          ${t1.stage2?.viSentence ? `
            <div style="background:#EFF6FF; border:1.5px solid #BAE6FD; border-radius:10px; padding:10px 14px; font-size:13px; color:#1E40AF; margin-bottom:10px;">
              <b>Gợi ý câu tóm tắt tiếng Việt:</b><br>${t1.stage2.viSentence}
            </div>
          ` : ''}

          ${t1.stage2?.keywords ? `
            <div style="background:#EFF6FF; border:1.5px solid #BAE6FD; border-radius:10px; padding:10px 14px; font-size:13px; color:#1E40AF; margin-bottom:10px;">
              <b>Các cụm từ khóa định hướng:</b>
              <ul style="margin:4px 0 0 0; padding-left:20px;">
                ${t1.stage2.keywords.map(kw => `<li>${kw}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${(t1.stage2?.academicVocabSuggestions || t1.band7Formulas) ? `
            <div style="background:#F0FDF4; border:1.5px solid #86EFAC; border-radius:10px; padding:8px 12px; font-size:12.5px; color:#166534; margin-bottom:12px;">
              <b>💡 Cấu trúc / Từ vựng ăn điểm:</b>
              <div style="margin-top:3px; line-height:1.5;">
                ${(t1.stage2?.academicVocabSuggestions || t1.band7Formulas || []).map(v => `• ${v}`).join('<br>')}
              </div>
            </div>
          ` : ''}

          ${isTest3 ? `
            ${(t1.sections || []).map(sec => `
              <div style="margin-bottom:12px;">
                <label style="font-size:13px; font-weight:800; color:#1E293B; display:block; margin-bottom:4px;">${sec.title}:</label>
                <textarea id="${sec.id}" 
                          class="diag-textarea" 
                          style="height:90px;" 
                          placeholder="${sec.placeholder}" 
                          oninput="window.diagWritingEngine.handleTextareaInput('${sec.id}', 'count_${sec.id}')"></textarea>
                <div style="text-align:right; font-size:12px; font-weight:800; color:#64748B; margin-top:2px;" id="count_${sec.id}">0 từ</div>
              </div>
            `).join('')}
          ` : `
            <label style="font-size:13px; font-weight:800; color:#1E293B; display:block; margin-bottom:4px;">
              ✍️ Bản viết tiếng Anh của em (Không đưa số liệu chi tiết):
            </label>
            <textarea id="diag_wt1_input" 
                      class="diag-textarea" 
                      style="height:80px;" 
                      placeholder="${t1.stage2?.placeholder || 'Viết 1 câu Overview hoàn chỉnh bằng tiếng Anh tại đây...'}" 
                      oninput="window.diagWritingEngine.handleTextareaInput('diag_wt1_input', 'wt1WordCount')"></textarea>
            <div style="text-align:right; font-size:12px; font-weight:800; color:#64748B; margin-top:4px;" id="wt1WordCount">0 từ</div>
          `}
        </div>

      </div>
    `;
  }

  // =========================================================================
  // 4. RENDER TASK 2 (BRAINSTORM Ý & VIẾT PEEL TIẾNG ANH)
  // =========================================================================
  renderTask2Card(t2, isTest3) {
    if (!t2) return '';

    return `
      <div class="q-item-box" style="border:2.5px solid #DDD6FE; background:#FAF5FF;">
        
        <b style="font-size:16px; color:#7C3AED; text-transform:uppercase; display:block; margin-bottom:10px;">
          📝 ${t2.title}
        </b>

        <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-left:4px solid #7C3AED; border-radius:12px; padding:12px 14px; margin-bottom:16px; font-size:14px; line-height:1.6; color:#334155;">
          <b>Đề bài Task 2:</b> "${t2.promptEn}"<br>
          <i style="color:#64748B;">${t2.promptVi || ''}</i>
          ${t2.instructions ? `<div style="font-size:13px; font-weight:700; color:#6D28D9; margin-top:6px;">📌 <b>Yêu cầu:</b> ${t2.instructions}</div>` : ''}
        </div>

        ${t2.stage1 ? `
          <div style="background:#FFFFFF; border:2px solid #E2E8F0; border-radius:14px; padding:16px; margin-bottom:18px;">
            <div style="font-size:14px; font-weight:900; color:#059669; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-lightbulb"></i> ${t2.stage1.title}
            </div>
            <p style="font-size:12.5px; font-weight:700; color:#64748B; margin:0 0 10px 0;">${t2.stage1.guide}</p>

            ${(t2.stage1.questions || []).map(q => `
              <div style="margin-bottom:10px;">
                <label style="font-size:13px; font-weight:800; color:#1E293B; display:block; margin-bottom:4px;">${q.label}</label>
                <input type="text" 
                       id="${q.id}" 
                       class="diag-input" 
                       style="padding:8px 12px; font-size:13px;" 
                       placeholder="${q.placeholder}" 
                       oninput="window.diagWritingEngine.recordInput('${q.id}', this.value)">
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${isTest3 && t2.peelFramework ? `
          <div style="background:#FFFFFF; border:2px solid #DDD6FE; border-radius:14px; padding:16px; margin-bottom:18px;">
            <div style="font-size:14px; font-weight:900; color:#6D28D9; margin-bottom:8px;">
              🎯 Dàn ý Luận điểm chuẩn PEEL:
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px; font-size:12.5px; line-height:1.55;">
              <div style="background:#F5F3FF; border:1px solid #C4B5FD; padding:10px 12px; border-radius:10px;">
                <b style="color:#6D28D9; display:block; margin-bottom:4px;">📌 Đoạn 1: ${t2.peelFramework.body1?.theme}</b>
                <div>• <b>Point:</b> ${t2.peelFramework.body1?.p_point}</div>
                <div>• <b>Explain:</b> ${t2.peelFramework.body1?.e_explanation}</div>
                <div>• <b>Example:</b> ${t2.peelFramework.body1?.e_example}</div>
                <div>• <b>Link:</b> ${t2.peelFramework.body1?.l_link}</div>
              </div>
              <div style="background:#F5F3FF; border:1px solid #C4B5FD; padding:10px 12px; border-radius:10px;">
                <b style="color:#6D28D9; display:block; margin-bottom:4px;">📌 Đoạn 2: ${t2.peelFramework.body2?.theme}</b>
                <div>• <b>Point:</b> ${t2.peelFramework.body2?.p_point}</div>
                <div>• <b>Explain:</b> ${t2.peelFramework.body2?.e_explanation}</div>
                <div>• <b>Example:</b> ${t2.peelFramework.body2?.e_example}</div>
                <div>• <b>Link:</b> ${t2.peelFramework.body2?.l_link}</div>
              </div>
            </div>
          </div>
        ` : ''}

        <div style="background:#FFFFFF; border:2px solid #DDD6FE; border-radius:14px; padding:16px;">
          <div style="font-size:14px; font-weight:900; color:#7C3AED; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-pen-fancy"></i> ${isTest3 ? 'Viết 2 Đoạn Thân Bài PEEL Hoàn Chỉnh' : (t2.stage2?.title || 'Viết Câu Tiếng Anh Cho 2 Đoạn')}
          </div>

          ${(t2.stage2?.sections || t2.sections || []).map((sec, idx) => `
            <div style="background:#FAF5FF; border:1.5px solid #E9D5FF; border-radius:12px; padding:14px; margin-bottom:14px;">
              <b style="font-size:13.5px; color:#6D28D9; display:block; margin-bottom:6px;">
                ${sec.sectionTitle || sec.title || `Đoạn ${idx + 1}`}
              </b>

              ${sec.hints ? `
                <div style="background:#FFFFFF; border:1px solid #CBD5E1; padding:8px 12px; border-radius:8px; font-size:12.5px; color:#334155; margin-bottom:8px; line-height:1.5;">
                  ${sec.hints.map(h => `• ${h}`).join('<br>')}
                </div>
              ` : ''}

              ${sec.keywordPrompts ? `
                <div style="background:#FFFFFF; border:1px solid #CBD5E1; padding:8px 12px; border-radius:8px; font-size:12.5px; color:#334155; margin-bottom:8px; line-height:1.5;">
                  ${sec.keywordPrompts.map(kp => `• ${kp}`).join('<br>')}
                </div>
              ` : ''}

              <textarea id="${sec.id || `diag_wt2_part_${idx + 1}`}" 
                        class="diag-textarea" 
                        style="height:85px;" 
                        placeholder="${sec.placeholder || 'Viết tiếng Anh tại đây...'}" 
                        oninput="window.diagWritingEngine.handleTextareaInput('${sec.id || `diag_wt2_part_${idx + 1}`}', 'count_wt2_${idx + 1}')"></textarea>
              <div style="text-align:right; font-size:12px; font-weight:800; color:#64748B; margin-top:2px;" id="count_wt2_${idx + 1}">0 từ</div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  // =========================================================================
  // 5. CÁC HÀM XỬ LÝ SỰ KIỆN: ĐẾM TỪ, LƯU TRỮ VÀ PHÓNG TO ẢNH
  // =========================================================================
  handleTextareaInput(textareaId, counterId) {
    if (this.isReviewMode) return;
    const el = document.getElementById(textareaId);
    if (!el) return;

    const val = el.value.trim();
    this.userAnswers[textareaId] = el.value;

    const words = val.length === 0 ? 0 : val.split(/\s+/).filter(Boolean).length;
    const counterEl = document.getElementById(counterId);
    if (counterEl) {
      counterEl.innerText = `${words} từ`;
    }
  }

  recordInput(fieldId, value) {
    if (this.isReviewMode) return;
    this.userAnswers[fieldId] = value;
  }

  restoreUserInputs() {
    Object.entries(this.userAnswers).forEach(([fieldId, val]) => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.value = val;
        const counterMatch = document.getElementById(`count_${fieldId}`);
        if (counterMatch) {
          const words = val.trim().length === 0 ? 0 : val.trim().split(/\s+/).filter(Boolean).length;
          counterMatch.innerText = `${words} từ`;
        }
      }
    });
  }

  openImageModal(imgSrc) {
    const modal = document.getElementById('diagImageModal');
    const img = document.getElementById('modalChartImg');
    if (modal && img) {
      img.src = imgSrc;
      modal.style.display = 'flex';
    }
  }

  closeImageModal() {
    const modal = document.getElementById('diagImageModal');
    if (modal) modal.style.display = 'none';
  }

  getWritingSubmissionData() {
    let task1Text = '';
    let task2Text = '';

    if (document.getElementById('diag_wt1_input')) {
      task1Text = document.getElementById('diag_wt1_input').value.trim();
    } else {
      const b1 = document.getElementById('wt1_body1')?.value.trim() || '';
      const b2 = document.getElementById('wt1_body2')?.value.trim() || '';
      task1Text = `Body 1: ${b1}\n\nBody 2: ${b2}`.trim();
    }

    const wt2Inputs = document.querySelectorAll('textarea[id^="diag_wt2_"], textarea[id^="wt2_body"]');
    if (wt2Inputs.length > 0) {
      task2Text = Array.from(wt2Inputs).map(el => el.value.trim()).filter(Boolean).join('\n\n');
    }

    return {
      task1Text,
      task2Text,
      answersSnapshot: this.userAnswers
    };
  }

  // =========================================================================
  // 6. AI CHẤM ĐIỂM TRỰC TIẾP TRÊN GIAO DIỆN (INLINE AI GRADING THEO RUBRIC)
  // =========================================================================
  async evaluateAndRenderInlineAI() {
    const sub = this.getWritingSubmissionData();
    const mount = document.getElementById('inlineWritingAiMount');
    if (!mount) return { overallBand: "0.0" };

    mount.innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #2563EB; border-radius:18px; padding:22px; margin-top:24px; box-shadow:0 8px 24px rgba(37, 99, 235, 0.12);">
        <h4 style="color:#1E40AF; margin:0 0 10px 0; font-size:18px; font-weight:900;">
          🤖 PHIẾU CHẤM ĐIỂM WRITING TRỰC TIẾP TỪ AI GEMINI (CHUẨN 4 TIÊU CHÍ RUBRIC)
        </h4>
        <div id="writingAiEvaluationStream">
          ⏳ <b>AI Gemini đang đọc toàn bộ bài viết, đối soát 4 tiêu chí Task Response, Coherence, Lexical, Grammar...</b>
        </div>
      </div>
    `;

    const streamBox = document.getElementById('writingAiEvaluationStream');

    try {
      const p1 = this.data?.task1?.promptEn || "Writing Task 1";
      const p2 = this.data?.task2?.promptEn || "Writing Task 2";
      const fullText = `TASK 1:\n${sub.task1Text || '(Chưa làm)'}\n\nTASK 2:\n${sub.task2Text || '(Chưa làm)'}`;

      const result = await diagAIService.evaluateWritingDiagnostic("Full Writing", `${p1} & ${p2}`, fullText);

      streamBox.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin:14px 0 16px 0;">
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">TASK RESPONSE</div>
            <b style="font-size:18px; color:#2563EB;">Band ${result.ta_tr || result.overallBand}</b>
          </div>
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">COHERENCE (CC)</div>
            <b style="font-size:18px; color:#2563EB;">Band ${result.cc || result.overallBand}</b>
          </div>
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">VOCABULARY (LR)</div>
            <b style="font-size:18px; color:#2563EB;">Band ${result.lr || result.overallBand}</b>
          </div>
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:10px; border-radius:10px; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">GRAMMAR (GRA)</div>
            <b style="font-size:18px; color:#2563EB;">Band ${result.gra || result.overallBand}</b>
          </div>
        </div>

        <div style="background:#DBEAFE; border:1.5px solid #93C5FD; border-radius:12px; padding:14px; margin-bottom:14px;">
          <div style="font-size:13px; font-weight:900; color:#1E40AF; text-transform:uppercase;">🏆 TỔNG ĐIỂM WRITING: BAND ${result.overallBand}</div>
          <div style="font-size:13.5px; line-height:1.6; color:#1E3A8A; margin-top:4px;">${result.rubricSummary || ''}</div>
        </div>

        ${result.keyMistakes && result.keyMistakes.length > 0 ? `
          <div style="margin-bottom:12px; font-size:13.5px; line-height:1.6; color:#1E293B;">
            <b>🔍 Các lỗi sai cần sửa gấp:</b>
            <div style="margin-top:4px;">${result.keyMistakes.map(m => `• ${m}`).join('<br>')}</div>
          </div>
        ` : ''}

        ${result.band8Upgrade ? `
          <div style="background:#F0FDF4; border:1.5px solid #86EFAC; border-radius:12px; padding:12px 14px; font-size:13px; line-height:1.6; color:#166534;">
            <b>💡 Đoạn văn nâng cấp mẫu (Band 8.0):</b><br>
            "${result.band8Upgrade}"
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
  // 7. REVIEW MODE: KHÔI PHỤC VÀ KHÓA CHỈNH SỬA
  // =========================================================================
  renderReviewMode(savedData) {
    this.isReviewMode = true;
    this.userAnswers = savedData.answersSnapshot || savedData || {};
    this.restoreUserInputs();

    document.querySelectorAll('#section_writing input, #section_writing textarea').forEach(el => {
      el.disabled = true;
      el.style.backgroundColor = '#F8FAFC';
    });
  }
}

export const diagWritingEngine = new DiagWritingEngine();
window.diagWritingEngine = diagWritingEngine;
