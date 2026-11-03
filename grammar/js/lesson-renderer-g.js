/**
 * grammar/js/lesson-renderer-g.js
 * BỘ RENDER BÀI HỌC, MỤC LỤC NHẢY NHANH, CHẤM ĐIỂM TỪNG PHẦN & TỰ ĐỘNG LƯU
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 * - Cô lập phạm vi đọc dữ liệu DOM theo từng Card nhóm (Chống trùng ID câu hỏi 100%)
 * - Hỗ trợ câu hỏi có nhiều chỗ trống [blank] tự động tạo đủ ô input
 * - Khôi phục và tự động lưu trạng thái làm bài hoàn hảo vào LocalStorage
 */

import { ExerciseEngine } from './exercise-engine-g.js';
import { grammarState } from './state-g.js';

export class LessonRenderer {
  constructor(containerElement, theoryData, exerciseData, topicId = 'present-simple') {
    this.container = containerElement;
    this.theoryData = theoryData;
    this.exerciseData = exerciseData;
    this.topicId = topicId;
    this.totalQuestions = 0;
    this.groupResults = {}; // Lưu kết quả chấm của từng phần
  }

  renderAll() {
    this.renderHero();
    this.renderTabs();
    this.renderTheory();
    this.renderTheoryRecall(); // TAB 2: KHẢO LÝ THUYẾT TỰ LUẬN
    this.renderExercises();
    this.renderBottomBar();

    // Khôi phục bài làm đã lưu trước đó của học sinh
    this.restoreSavedInputs();
  }

  renderHero() {
    const hero = document.createElement('div');
    hero.className = 'hero-box-g';
    hero.innerHTML = `
      <h1>${this.theoryData.tense_name}</h1>
      <p>Học lý thuyết ➔ Khảo tự luận thuộc lòng ➔ Làm bài tập áp dụng thực tế</p>
    `;
    this.container.appendChild(hero);
  }

  renderTabs() {
    const nav = document.createElement('div');
    nav.className = 'tab-nav-g';
    nav.innerHTML = `
      <button type="button" class="tab-btn-g active" id="btnTabTheory">📖 1. Lý Thuyết</button>
      <button type="button" class="tab-btn-g" id="btnTabRecall" style="background:#fffbeb; border-color:#fef08a; color:#854d0e;">📝 2. Khảo Lý Thuyết (Tự Luận)</button>
      <button type="button" class="tab-btn-g" id="btnTabExercise">✍️ 3. Bài Tập Áp Dụng</button>
    `;
    this.container.appendChild(nav);

    nav.querySelector('#btnTabTheory').onclick = () => this.switchTab('theory');
    nav.querySelector('#btnTabRecall').onclick = () => this.switchTab('recall');
    nav.querySelector('#btnTabExercise').onclick = () => this.switchTab('exercise');
  }

  switchTab(tab) {
    const theoryBox = document.getElementById('tabTheoryContent');
    const recallBox = document.getElementById('tabRecallContent');
    const exerciseBox = document.getElementById('tabExerciseContent');
    const btnT = document.getElementById('btnTabTheory');
    const btnR = document.getElementById('btnTabRecall');
    const btnE = document.getElementById('btnTabExercise');
    const bottomBar = document.getElementById('stickyBottomBar');

    theoryBox.style.display = 'none';
    if (recallBox) recallBox.style.display = 'none';
    exerciseBox.style.display = 'none';
    btnT.classList.remove('active');
    btnR.classList.remove('active');
    btnE.classList.remove('active');
    if (bottomBar) bottomBar.style.display = 'none';

    if (tab === 'theory') {
      theoryBox.style.display = 'block';
      btnT.classList.add('active');
    } else if (tab === 'recall') {
      if (recallBox) recallBox.style.display = 'block';
      btnR.classList.add('active');
    } else {
      exerciseBox.style.display = 'block';
      btnE.classList.add('active');
      if (bottomBar) bottomBar.style.display = 'flex';
    }
  }

  renderTheory() {
    const box = document.createElement('div');
    box.id = 'tabTheoryContent';

    let html = '';

    if (this.theoryData.word_symbols && this.theoryData.word_symbols.length > 0) {
      html += `
        <div class="theory-card-g">
          <h3>📌 KÝ HIỆU CÁC LOẠI TỪ CƠ BẢN</h3>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background:#f1f5f9; text-align:left;">
                <th style="padding:8px; border:1px solid #e2e8f0;">Ký hiệu</th>
                <th style="padding:8px; border:1px solid #e2e8f0;">Loại từ</th>
                <th style="padding:8px; border:1px solid #e2e8f0;">Định nghĩa</th>
                <th style="padding:8px; border:1px solid #e2e8f0;">Ví dụ</th>
              </tr>
            </thead>
            <tbody>
              ${this.theoryData.word_symbols.map(s => `
                <tr>
                  <td style="padding:8px; border:1px solid #e2e8f0;"><b>${s.symbol}</b></td>
                  <td style="padding:8px; border:1px solid #e2e8f0;">${s.meaning}</td>
                  <td style="padding:8px; border:1px solid #e2e8f0;">${s.definition}</td>
                  <td style="padding:8px; border:1px solid #e2e8f0; color:#0f766e;"><i>${s.example}</i></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    this.theoryData.sections.forEach(sec => {
      html += `
        <div class="theory-card-g">
          <h3>${sec.title}</h3>
          
          ${sec.formulas ? `
            <div class="formula-box-g">
              <div><b>Khẳng định:</b> ${sec.formulas.affirmative}</div>
              <div><b>Phủ định:</b> ${sec.formulas.negative}</div>
              <div><b>Nghi vấn:</b> ${sec.formulas.interrogative}</div>
            </div>
          ` : ''}

          ${sec.rules ? `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; margin: 12px 0;">
              ${sec.rules.map(r => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; font-size:13.5px;">
                  ${r}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${sec.subject_rules ? `
            <ul>
              ${sec.subject_rules.map(r => `<li>${r}</li>`).join('')}
            </ul>
          ` : ''}

          ${sec.spelling_rules ? `
            <h4 style="margin: 12px 0 6px 0; color:#0f766e;">Quy tắc chính tả:</h4>
            <ul>
              ${sec.spelling_rules.map(sp => `
                <li><b>${sp.condition}:</b> ${sp.rule} ➔ <i>(${sp.examples})</i></li>
              `).join('')}
            </ul>
          ` : ''}

          ${sec.usages ? `
            <ul>
              ${sec.usages.map(u => `<li><b>${u.name}:</b> ${u.desc} ➔ <i>(${u.example})</i></li>`).join('')}
            </ul>
          ` : ''}

          ${sec.markers ? `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px; margin-top:10px;">
              ${sec.markers.map(m => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; font-size:13px;">
                  <b>${m.word}</b>: ${m.vn} <span style="color:#0d9488; font-weight:bold;">(${m.percent})</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${sec.note ? `<p style="font-size:13.5px; color:#64748b; font-style:italic; margin-top:10px;">💡 ${sec.note}</p>` : ''}
        </div>
      `;
    });

    box.innerHTML = html;
    this.container.appendChild(box);
  }

  // =========================================================================
  // TAB 2: KHẢO LÝ THUYẾT TỰ LUẬN & AI GEMINI CHẤM (GIỮ NGUYÊN GỐC 100%)
  // =========================================================================
  renderTheoryRecall() {
    const box = document.createElement('div');
    box.id = 'tabRecallContent';
    box.style.display = 'none';

    const promptData = this.theoryData.essay_prompt || {
      instruction: "Học sinh tự nhớ lại và trình bày toàn bộ lý thuyết vào phần bài làm.",
      questions: []
    };

    let questionsHtml = '';
    if (promptData.questions && promptData.questions.length > 0) {
      questionsHtml = `
        <div style="background:#ffffff; border:1.5px solid #fed7aa; border-radius:8px; padding:16px; margin: 15px 0;">
          <h4 style="margin:0 0 10px 0; color:#9a3412;">📋 NỘI DUNG ĐỀ KIỂM TRA BẮT BUỘC TRÌNH BÀY:</h4>
          <ol style="margin:0; padding-left:20px; line-height:1.7; font-size:14.5px; color:#1e293b;">
            ${promptData.questions.map(q => `<li style="margin-bottom:8px;">${q}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    box.innerHTML = `
      <div class="theory-card-g" style="background:#fefce8; border: 1.5px solid #fef08a; padding: 22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="color:#854d0e; margin:0 0 6px 0;">📝 ĐỀ KIỂM TRA TỰ LUẬN KHẢO LÝ THUYẾT: ${this.theoryData.tense_name}</h3>
            <p style="font-size:13.5px; color:#713f12; margin:0;">
              ${promptData.instruction}
            </p>
          </div>
          <span style="background:#f59e0b; color:white; font-size:11px; font-weight:800; padding:4px 10px; border-radius:12px;">
            AI CHẤM TRỰC TIẾP
          </span>
        </div>
        ${questionsHtml}
      </div>

      <div class="theory-card-g" style="background:#ffffff; margin-top:16px;">
        <label style="font-weight:700; font-size:14.5px; display:block; margin-bottom:8px; color:#0f172a;">
          ✍️ Nhập bài làm tự luận của Em vào đây (Trình bày chi tiết từng mục A, B, C, D...):
        </label>
        <textarea id="aiRecallInput" rows="15" style="width:100%; box-sizing:border-box; padding:14px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:14.5px; line-height:1.6; font-family:inherit; outline:none;" placeholder="Em hãy gõ bài làm tự luận theo đúng các mục ở đề bài phía trên:
A. Công thức (Form):
- To be:
- Động từ thường:

B. Cách dùng (Uses) & Ví dụ:
- Cách dùng 1: ... (Ví dụ tiếng Anh: ... - Dịch nghĩa: ...)
- Cách dùng 2: ... (Ví dụ tiếng Anh: ... - Dịch nghĩa: ...)

C. Dấu hiệu nhận biết (Signal Words):
..."></textarea>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; flex-wrap:wrap; gap:10px;">
          <div id="aiGradingStatus" style="font-size:13.5px; font-weight:600; color:#d97706;"></div>
          <button type="button" class="btn-submit-g" id="btnSubmitToAI" style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding:12px 28px; font-size:14.5px; box-shadow:0 4px 12px rgba(217, 119, 6, 0.25);">
            🤖 GỬI BÀI CHO AI CHẤM ĐIỂM
          </button>
        </div>
      </div>

      <div id="aiReportContainer" class="theory-card-g" style="display:none; background:#ffffff; border:2px solid #0d9488; margin-top:20px; padding:24px;">
        <div id="aiReportMarkdown" style="line-height:1.7; font-size:14.5px; color:#1e293b;"></div>
      </div>
    `;

    this.container.appendChild(box);
    box.querySelector('#btnSubmitToAI').onclick = () => this.handleCallAIGrading();
  }

  async handleCallAIGrading() {
    const text = document.getElementById('aiRecallInput').value.trim();
    if (!text || text.length < 20) {
      alert("⚠️ Em hãy viết đầy đủ bài tự luận theo các mục đề bài trước khi gửi Anh chấm nhé!");
      return;
    }

    const btn = document.getElementById('btnSubmitToAI');
    const status = document.getElementById('aiGradingStatus');
    const reportBox = document.getElementById('aiReportContainer');
    const reportMd = document.getElementById('aiReportMarkdown');

    btn.disabled = true;
    reportBox.style.display = 'block';
    reportMd.innerHTML = '';
    status.innerHTML = "⏳ Anh đang đọc bài tự luận, soi xét công thức, câu ví dụ và chấm điểm cho Em...";

    reportBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    let fullMarkdown = '';

    try {
      const { gradeTheoryEssayWithAI } = await import('./ai-grader-g.js');

      await gradeTheoryEssayWithAI(
        this.theoryData.tense_name,
        this.theoryData.sections,
        text,
        (chunk) => {
          fullMarkdown += chunk;
          if (window.marked) {
            reportMd.innerHTML = window.marked.parse(fullMarkdown);
          } else {
            reportMd.innerText = fullMarkdown;
          }
        }
      );

      status.innerHTML = "✅ Anh đã chấm xong bài tự luận cho Em! Em xem chi tiết bảng điểm bên dưới nhé.";
      btn.disabled = false;
      btn.innerText = "CHẤM LẠI BÀI KHÁC";
    } catch (err) {
      console.error(err);
      status.innerHTML = "❌ Lỗi: " + err.message;
      btn.disabled = false;
      btn.innerText = "THỬ LẠI";
    }
  }

  // =========================================================================
  // TAB 3: BÀI TẬP ÁP DỤNG (MỤC LỤC NHẢY NHANH + CHẤM ĐIỂM CÔ LẬP DOM)
  // =========================================================================
  renderExercises() {
    const box = document.createElement('div');
    box.id = 'tabExerciseContent';
    box.style.display = 'none';

    let html = '';
    this.totalQuestions = 0;

    // 1. DỰNG MỤC LỤC NHẢY NHANH (TOC BAR)
    const tocButtonsHtml = this.exerciseData.exercise_groups.map((group, idx) => {
      return `
        <button type="button" class="toc-pill-btn" id="toc_btn_${idx}" onclick="window.jumpToExerciseGroup(${idx})">
          <span>#${idx + 1}</span>
          <span style="font-size:12px; opacity:0.85;">(${group.questions.length}c)</span>
        </button>
      `;
    }).join('');

    html += `
      <div class="grammar-toc-card">
        <div class="grammar-toc-header">
          <span class="grammar-toc-title">
            📑 MỤC LỤC BÀI TẬP (BẤM ĐỂ NHẢY TỚI BÀI):
          </span>
          <span id="tocDoneCounter" style="font-size:13px; font-weight:800; background:#DCFCE7; color:#166534; padding:3px 10px; border-radius:10px;">
            0/${this.exerciseData.exercise_groups.length} phần xong
          </span>
        </div>
        <div class="grammar-toc-list">
          ${tocButtonsHtml}
        </div>
      </div>
    `;

    // 2. DỰNG TỪNG NHÓM BÀI TẬP
    this.exerciseData.exercise_groups.forEach((group, gIdx) => {
      html += `
        <div class="section-card-g" id="group_card_${gIdx}" data-gidx="${gIdx}">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <h3 class="section-title-g">
              <span style="background:var(--primary-color,#8B1518); color:white; padding:2px 8px; border-radius:8px; font-size:14px;">Bài #${gIdx + 1}</span>
              ${group.group_title}
            </h3>
            <span id="group_badge_${gIdx}" style="font-size:12.5px; font-weight:800; color:var(--text-muted);">Chưa nộp</span>
          </div>

          <div class="section-instruction-g">${group.instruction}</div>
      `;

      group.questions.forEach((q, qIdx) => {
        this.totalQuestions++;
        let questionHtml = '';

        if (q.type === 'blank') {
          // Xử lý thông minh: Nếu có nhiều chỗ trống [blank] trong cùng 1 câu
          const parts = q.prompt.split('[blank]');
          if (parts.length > 2) {
            questionHtml = parts.reduce((acc, part, pIdx) => {
              if (pIdx === parts.length - 1) return acc + `<span>${part}</span>`;
              return acc + `<span>${part}</span><input type="text" class="input-blank-g" data-qid="${q.id}" data-bidx="${pIdx}" data-gidx="${gIdx}" autocomplete="off" placeholder="...">`;
            }, '');
          } else {
            questionHtml = `
              <span>${parts[0]}</span>
              <input type="text" class="input-blank-g" data-qid="${q.id}" data-bidx="0" data-gidx="${gIdx}" autocomplete="off" placeholder="Điền từ...">
              <span>${parts[1] || ''}</span>
            `;
          }
        } else if (q.type === 'choice') {
          questionHtml = `
            <div style="width: 100%;">
              <div style="margin-bottom:8px;">${q.prompt}</div>
              ${q.options.map((opt, oIdx) => `
                <label class="choice-label-g">
                  <input type="radio" name="g_${gIdx}_${q.id}" value="${oIdx}" data-qid="${q.id}" data-gidx="${gIdx}"> ${opt}
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'rewrite') {
          questionHtml = `
            <div style="width: 100%;">
              <div style="margin-bottom: 6px; color:#475569;">${q.prompt}</div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>${q.targetStart || ''}</span>
                <input type="text" class="input-blank-g" style="flex:1;" data-qid="${q.id}" data-bidx="0" data-gidx="${gIdx}" placeholder="...">
              </div>
            </div>
          `;
        }

        html += `
          <div class="q-row-g" id="row_g_${gIdx}_${q.id}">
            <div class="q-text-g">
              <span style="color:var(--primary-color);">#${qIdx + 1}.</span>
              ${questionHtml}
            </div>
            <div class="feedback-box-g" id="fb_g_${gIdx}_${q.id}"></div>
          </div>
        `;
      });

      // Cụm nút Chấm điểm & Làm lại của từng phần
      html += `
          <div class="group-action-footer-g">
            <button type="button" class="btn-group-action btn-reset-part" onclick="window.lessonRendererInstance.resetGroup(${gIdx})">
              🔄 Làm lại phần này
            </button>
            <button type="button" class="btn-group-action btn-grade-part" onclick="window.lessonRendererInstance.gradeGroup(${gIdx})">
              ✓ Chấm điểm phần này &rarr;
            </button>
          </div>
        </div>
      `;
    });

    box.innerHTML = html;
    this.container.appendChild(box);

    window.jumpToExerciseGroup = (idx) => {
      const card = document.getElementById(`group_card_${idx}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    window.lessonRendererInstance = this;

    // Tự động lắng nghe thay đổi để lưu bài tức thì chống mất bài
    box.addEventListener('input', () => this.autoSaveCurrentInputs());
    box.addEventListener('change', () => this.autoSaveCurrentInputs());
  }

  // =========================================================================
  // CHẤM ĐIỂM CHO RIÊNG 1 NHÓM BÀI TẬP (GROUP) - CÔ LẬP TRUY VẤN THEO CARD
  // =========================================================================
  gradeGroup(gIdx) {
    const group = this.exerciseData.exercise_groups[gIdx];
    const card = document.getElementById(`group_card_${gIdx}`);
    if (!group || !card) return;

    let groupCorrect = 0;
    const totalInGroup = group.questions.length;

    group.questions.forEach(q => {
      let userVal = '';

      if (q.type === 'blank' || q.type === 'rewrite') {
        // Thu thập toàn bộ ô input thuộc câu hỏi này trong card hiện tại
        const inputs = Array.from(card.querySelectorAll(`input[data-qid="${q.id}"]`));
        if (inputs.length > 1) {
          // Trường hợp nhiều ô trống trong một câu
          userVal = inputs.map(inp => inp.value.trim());
        } else if (inputs.length === 1) {
          userVal = inputs[0].value.trim();
        }
      } else if (q.type === 'choice') {
        const checked = card.querySelector(`input[data-qid="${q.id}"]:checked`);
        userVal = checked ? checked.value : '-1';
      }

      const result = ExerciseEngine.gradeQuestion(q, userVal);
      const row = document.getElementById(`row_g_${gIdx}_${q.id}`);
      const fb = document.getElementById(`fb_g_${gIdx}_${q.id}`);

      if (fb && row) {
        fb.classList.add('show');
        if (result.isCorrect) {
          groupCorrect++;
          row.className = 'q-row-g is-correct';
          fb.className = 'feedback-box-g show correct';
          fb.innerHTML = `✅ <b>Chính xác!</b> ${q.explanation || ''}`;
        } else {
          row.className = 'q-row-g is-wrong';
          fb.className = 'feedback-box-g show wrong';
          fb.innerHTML = `❌ <b>Chưa đúng!</b> Đáp án: <b>${result.correctDisplay}</b>. <br>💡 <i>${q.explanation || ''}</i>`;
        }
      }
    });

    // Cập nhật trạng thái nhóm đã làm
    this.groupResults[gIdx] = {
      correct: groupCorrect,
      total: totalInGroup,
      completed: true
    };

    const badge = document.getElementById(`group_badge_${gIdx}`);
    if (badge) {
      badge.innerHTML = `<b style="color:#166534; background:#DCFCE7; padding:4px 10px; border-radius:8px; border:1px solid #86EFAC;">✓ Đúng ${groupCorrect}/${totalInGroup} câu</b>`;
    }

    const tocBtn = document.getElementById(`toc_btn_${gIdx}`);
    if (tocBtn) {
      tocBtn.classList.add('is-completed');
      tocBtn.innerHTML = `<span>✓ #${gIdx + 1}</span>`;
    }

    this.autoSaveCurrentInputs();
    this.updateTocCounter();

    // KIỂM TRA ĐIỀU KIỆN HOÀN THÀNH: ĐÃ LÀM TỚI BÀI CUỐI CÙNG HOẶC ĐỦ TẤT CẢ CÁC BÀI
    const totalGroups = this.exerciseData.exercise_groups.length;
    const isFinalGroupGraded = !!this.groupResults[totalGroups - 1]?.completed;
    const completedGroupsCount = Object.values(this.groupResults).filter(g => g.completed).length;

    if (isFinalGroupGraded && completedGroupsCount === totalGroups) {
      let totalCorrectAll = 0;
      Object.values(this.groupResults).forEach(g => totalCorrectAll += g.correct);

      grammarState.recordCompletedToMainHistory(
        this.topicId,
        this.theoryData.tense_name,
        totalCorrectAll,
        this.totalQuestions
      );

      alert(`🎉 Chúc mừng Em đã hoàn thành toàn bộ ${totalGroups} phần bài tập của chuyên đề ${this.theoryData.tense_name}! Điểm số đã được tự động lưu lên Lịch sử Trang chủ.`);
    }
  }

  // =========================================================================
  // LÀM LẠI CHO RIÊNG 1 NHÓM BÀI TẬP (RESET GROUP)
  // =========================================================================
  resetGroup(gIdx) {
    const group = this.exerciseData.exercise_groups[gIdx];
    const card = document.getElementById(`group_card_${gIdx}`);
    if (!group || !card) return;

    if (!confirm(`Em có chắc muốn xóa đáp án để làm lại Bài #${gIdx + 1} không?`)) return;

    group.questions.forEach(q => {
      const row = document.getElementById(`row_g_${gIdx}_${q.id}`);
      const fb = document.getElementById(`fb_g_${gIdx}_${q.id}`);
      if (row) row.className = 'q-row-g';
      if (fb) {
        fb.className = 'feedback-box-g';
        fb.innerHTML = '';
      }

      // Xóa giá trị các ô input trong card của nhóm này
      card.querySelectorAll(`input[data-qid="${q.id}"]`).forEach(inp => {
        if (inp.type === 'radio') {
          inp.checked = false;
        } else {
          inp.value = '';
        }
      });
    });

    delete this.groupResults[gIdx];

    const badge = document.getElementById(`group_badge_${gIdx}`);
    if (badge) badge.innerHTML = `<span style="color:var(--text-muted);">Chưa nộp</span>`;

    const tocBtn = document.getElementById(`toc_btn_${gIdx}`);
    if (tocBtn) {
      tocBtn.classList.remove('is-completed');
      tocBtn.innerHTML = `<span>#${gIdx + 1}</span> <span style="font-size:12px; opacity:0.85;">(${group.questions.length}c)</span>`;
    }

    this.autoSaveCurrentInputs();
    this.updateTocCounter();
  }

  updateTocCounter() {
    const totalGroups = this.exerciseData.exercise_groups.length;
    const completedCount = Object.values(this.groupResults).filter(g => g.completed).length;
    const counter = document.getElementById('tocDoneCounter');
    if (counter) {
      counter.innerText = `${completedCount}/${totalGroups} phần xong`;
    }
  }

  // =========================================================================
  // TỰ ĐỘNG LƯU VÀ KHÔI PHỤC BÀI LÀM VÀO LOCALSTORAGE
  // =========================================================================
  autoSaveCurrentInputs() {
    const inputsData = {};
    const radiosData = {};

    document.querySelectorAll('#tabExerciseContent input.input-blank-g').forEach(inp => {
      const qid = inp.getAttribute('data-qid');
      const gidx = inp.getAttribute('data-gidx');
      const bidx = inp.getAttribute('data-bidx') || '0';
      if (qid && gidx) {
        const key = `${gidx}_${qid}_${bidx}`;
        inputsData[key] = inp.value;
      }
    });

    document.querySelectorAll('#tabExerciseContent input[type="radio"]:checked').forEach(rb => {
      const qid = rb.getAttribute('data-qid');
      const gidx = rb.getAttribute('data-gidx');
      if (qid && gidx) {
        const key = `${gidx}_${qid}`;
        radiosData[key] = rb.value;
      }
    });

    grammarState.saveTopicDetailState(this.topicId, {
      inputs: inputsData,
      radios: radiosData,
      groupResults: this.groupResults
    });
  }

  restoreSavedInputs() {
    const saved = grammarState.getTopicDetailState(this.topicId);
    if (!saved) return;

    if (saved.inputs) {
      Object.entries(saved.inputs).forEach(([key, val]) => {
        const [gidx, qid, bidx] = key.split('_');
        const el = document.querySelector(`input.input-blank-g[data-gidx="${gidx}"][data-qid="${qid}"][data-bidx="${bidx}"]`);
        if (el) el.value = val;
      });
    }

    if (saved.radios) {
      Object.entries(saved.radios).forEach(([key, val]) => {
        const [gidx, qid] = key.split('_');
        const el = document.querySelector(`input[type="radio"][data-gidx="${gidx}"][data-qid="${qid}"][value="${val}"]`);
        if (el) el.checked = true;
      });
    }

    if (saved.groupResults) {
      this.groupResults = saved.groupResults;
      Object.entries(this.groupResults).forEach(([gIdxStr, res]) => {
        const gIdx = parseInt(gIdxStr, 10);
        if (res.completed) {
          const badge = document.getElementById(`group_badge_${gIdx}`);
          if (badge) {
            badge.innerHTML = `<b style="color:#166534; background:#DCFCE7; padding:4px 10px; border-radius:8px; border:1px solid #86EFAC;">✓ Đúng ${res.correct}/${res.total} câu</b>`;
          }
          const tocBtn = document.getElementById(`toc_btn_${gIdx}`);
          if (tocBtn) {
            tocBtn.classList.add('is-completed');
            tocBtn.innerHTML = `<span>✓ #${gIdx + 1}</span>`;
          }
        }
      });
      this.updateTocCounter();
    }
  }

  renderBottomBar() {
    const bar = document.createElement('div');
    bar.id = 'stickyBottomBar';
    bar.className = 'sticky-submit-bar';
    bar.style.display = 'none';
    bar.innerHTML = `
      <div>
        <b style="font-size:15px;" id="scoreSummaryLabel">Tổng bài tập: ${this.totalQuestions} câu</b>
        <div style="font-size:12.5px; color:#64748b;">Em có thể bấm chấm điểm từng phần ở trên hoặc bấm nút bên phải để chấm toàn bộ bài.</div>
      </div>
      <button type="button" class="btn-submit-g" id="btnGradeQuiz">Chấm Toàn Bộ & Xem Tổng Điểm</button>
    `;
    document.body.appendChild(bar);

    bar.querySelector('#btnGradeQuiz').onclick = () => this.gradeAll();
  }

  gradeAll() {
    this.exerciseData.exercise_groups.forEach((group, gIdx) => {
      this.gradeGroup(gIdx);
    });

    let totalCorrectAll = 0;
    Object.values(this.groupResults).forEach(g => totalCorrectAll += g.correct);

    const percent = Math.round((totalCorrectAll / this.totalQuestions) * 100);
    const scoreLabel = document.getElementById('scoreSummaryLabel');
    scoreLabel.innerHTML = `🎉 Tổng điểm của bạn: <span style="color:#0d9488; font-size:17px; font-weight:800;">${totalCorrectAll} / ${this.totalQuestions} (${percent}%)</span>`;

    window.scrollTo({ top: document.getElementById('tabExerciseContent').offsetTop - 30, behavior: 'smooth' });
  }
}
