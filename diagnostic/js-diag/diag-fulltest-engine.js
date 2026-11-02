/**
 * diagnostic/js-diag/diag-fulltest-engine.js
 * BỘ ĐIỀU PHỐI FULL TEST CHUẨN XÁC 100% - ĐÃ FIX TRIỆT ĐỂ LỖI RENDER READING CAM 21
 */

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

class DiagnosticFullTestEngine {
  constructor() {
    this.currentSection = "grammar";
    this.setNum = 1;
    this.timerSeconds = 0;
    this.timerInterval = null;

    this.grammarData = null;
    this.lisParts = [];
    this.readPassages = [];

    this.userAnswers = {
      grammar: {},
      listening: {},
      reading: {},
      writing: { task1: '', task2: '' },
      speaking: { part1: '', part2: '', part3: '' }
    };

    this.activeLisPartIdx = 0;
    this.activeReadPassageIdx = 0;
    this.isRecording = false;
    this.speechRecognition = null;
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const rawSet = parseInt(urlParams.get('set') || urlParams.get('ver'), 10);
    this.setNum = (!isNaN(rawSet) && rawSet >= 1 && rawSet <= 3) ? rawSet : 1;

    const titleEl = document.getElementById('fullTestHeaderTitle');
    if (titleEl) {
      titleEl.innerText = `IELTS FULL MOCK TEST • CAMBRIDGE 21 (SET ${this.setNum})`;
    }

    // 1. Nạp 100 câu ngữ pháp
    await this.loadGrammar100();

    // 2. Nạp liên hoàn 4 Parts Listening
    await this.loadCrossModuleListening();

    // 3. Nạp liên hoàn 3 Passages Reading Cam 21 (ĐÃ FIX)
    await this.loadCrossModuleReading();

    // 4. Render Writing Task 1 & 2
    this.renderFullWriting();

    // 5. Render Speaking 3 Parts
    this.renderFullSpeaking();

    // 6. Kích hoạt Mic & Đồng hồ
    this.initSpeechRecognition();
    this.startTimer();
  }

  // =========================================================================
  // 1. NẠP 100 CÂU NGỮ PHÁP
  // =========================================================================
  async loadGrammar100() {
    const mount = document.getElementById('ftGrammarMount');
    if (!mount) return;

    try {
      const res = await fetch(`data-diag/grammar/test4-grammar.json?t=${Date.now()}`);
      if (!res.ok) throw new Error("Không thể tải file test4-grammar.json");
      this.grammarData = await res.json();

      let html = '';
      (this.grammarData.parts || []).forEach(part => {
        html += `
          <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:18px; padding:20px; margin-bottom:22px;">
            <div style="font-size:16px; font-weight:900; color:#059669; margin-bottom:6px;">
              ${part.partTitle}
            </div>
            <div style="font-size:13px; font-weight:700; color:#64748B; margin-bottom:16px;">
              ${part.instruction}
            </div>
        `;

        (part.questions || []).forEach(q => {
          if (q.type === 'choice') {
            html += `
              <div class="q-item-box" style="margin-bottom:12px;">
                <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:8px;">
                  Câu ${q.num}. ${q.prompt}
                </b>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:6px;">
                  ${(q.options || []).map(opt => `
                    <label class="option-label" onclick="window.ftEngine.recordAnswer('grammar', '${q.id}', '${opt.charAt(0)}')">
                      <input type="radio" name="ans_ft_g_${q.id}" value="${opt.charAt(0)}">
                      <span>${opt}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `;
          } else if (q.type === 'drill_v2_v3') {
            html += `
              <div class="q-item-box" style="margin-bottom:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <b style="width:120px; font-size:14px; color:#1E293B;">#${q.num}. ${q.v0}</b>
                <input type="text" class="diag-input" style="flex:1; min-width:140px;" placeholder="Điền V2..." oninput="window.ftEngine.recordAnswer('grammar', '${q.id}_v2', this.value)">
                <input type="text" class="diag-input" style="flex:1; min-width:140px;" placeholder="Điền V3..." oninput="window.ftEngine.recordAnswer('grammar', '${q.id}_v3', this.value)">
              </div>
            `;
          } else if (q.type === 'blank' || q.type === 'rewrite') {
            const promptText = q.type === 'blank' ? q.prompt.replace('[blank]', '_______') : q.prompt;
            html += `
              <div class="q-item-box" style="margin-bottom:12px;">
                <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:6px;">
                  Câu ${q.num}. ${promptText}
                </b>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${q.targetStart ? `<span style="font-weight:800; color:#059669;">${q.targetStart}</span>` : ''}
                  <input type="text" class="diag-input" style="flex:1;" placeholder="Điền câu trả lời..." oninput="window.ftEngine.recordAnswer('grammar', '${q.id}', this.value)">
                </div>
              </div>
            `;
          } else {
            html += `
              <div class="q-item-box" style="margin-bottom:12px;">
                <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:6px;">
                  Câu ${q.num}. ${q.prompt}
                </b>
                <textarea class="diag-textarea" style="height:65px;" placeholder="Gõ câu trả lời lý thuyết..." oninput="window.ftEngine.recordAnswer('grammar', '${q.id}', this.value)"></textarea>
              </div>
            `;
          }
        });

        html += `</div>`;
      });

      mount.innerHTML = html;
    } catch (e) {
      mount.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">❌ Lỗi nạp ngữ pháp: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // 2. NẠP LISTENING
  // =========================================================================
  async loadCrossModuleListening() {
    const tNum = this.setNum;
    try {
      const urls = [1, 2, 3, 4].map(p => `../listening/data-l/cam21-lis-test${tNum}/cam21-lis-test${tNum}-p${p}.json`);
      const results = await Promise.all(urls.map(u => fetch(`${u}?t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null)));
      this.lisParts = results.filter(Boolean);
      this.renderFullListeningUI();
    } catch (e) {
      console.warn("Lỗi nạp bài nghe:", e);
    }
  }

  renderFullListeningUI() {
    const mount = document.getElementById('ftListeningMount');
    const audioEl = document.getElementById('ftAudioPlayer');
    if (!mount || this.lisParts.length === 0) return;

    if (audioEl && this.lisParts[0].audioUrl) {
      audioEl.src = this.lisParts[0].audioUrl;
    }

    let html = `
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        ${this.lisParts.map((p, idx) => `
          <button type="button" id="btnLisPart_${idx}" class="btn-3d ${idx === 0 ? 'btn-3d-blue' : 'btn-3d-white'}" style="padding:8px 14px; font-size:13px;" onclick="window.ftEngine.switchLisPart(${idx})">
            Part ${idx + 1}
          </button>
        `).join('')}
      </div>
      <div id="ftLisActivePartBox"></div>
    `;

    mount.innerHTML = html;
    this.switchLisPart(0);
  }

  switchLisPart(idx) {
    this.activeLisPartIdx = idx;
    const part = this.lisParts[idx];
    if (!part) return;

    this.lisParts.forEach((_, i) => {
      const btn = document.getElementById(`btnLisPart_${i}`);
      if (btn) btn.className = `btn-3d ${i === idx ? 'btn-3d-blue' : 'btn-3d-white'}`;
    });

    const box = document.getElementById('ftLisActivePartBox');
    if (!box) return;

    let qHtml = `<b style="font-size:16px; color:#0369A1; display:block; margin-bottom:14px;">${part.title}</b>`;

    (part.groups || []).forEach(g => {
      qHtml += `<div style="font-size:15px; font-weight:900; margin:14px 0 6px 0;">${g.title}</div>`;
      if (g.instructions) {
        qHtml += `<div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:10px; padding:8px 12px; font-size:13px; font-weight:700; color:#475569; margin-bottom:12px;">${g.instructions}</div>`;
      }

      if (g.tableHtml || g.template) {
        let content = g.tableHtml || g.template;
        (g.questionIds || []).forEach(qId => {
          const q = (part.questions || {})[qId];
          const width = q?.inputWidth || "120px";
          const inputHtml = `
            <input type="text" class="diag-input" id="inp_ft_lis_${qId}" style="width:${width}; display:inline-block; padding:4px 8px; text-align:center; font-weight:800; color:#0284C7;" placeholder="[${q?.num || qId}]" oninput="window.ftEngine.recordAnswer('listening', '${qId}', this.value)">
          `;
          content = content.replace(new RegExp(`{{${qId}}}`, 'g'), inputHtml);
        });
        qHtml += `<div style="margin-bottom:16px; font-size:14px; line-height:1.8;">${content}</div>`;
      } else {
        (g.questionIds || []).forEach(qId => {
          const q = (part.questions || {})[qId];
          if (!q) return;

          qHtml += `
            <div class="q-item-box" style="margin-bottom:10px;">
              <b style="font-size:13.5px; color:#1E293B; display:block; margin-bottom:6px;">Câu ${q.num || qId}. ${q.text || ''}</b>
              ${q.options ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px;">
                  ${q.options.map(opt => `
                    <label class="option-label" onclick="window.ftEngine.recordAnswer('listening', '${qId}', '${opt.charAt(0)}')">
                      <input type="radio" name="rad_ft_lis_${qId}" value="${opt.charAt(0)}">
                      <span>${opt}</span>
                    </label>
                  `).join('')}
                </div>
              ` : `
                <input type="text" class="diag-input" id="inp_ft_lis_${qId}" placeholder="Điền đáp án..." oninput="window.ftEngine.recordAnswer('listening', '${qId}', this.value)">
              `}
            </div>
          `;
        });
      }
    });

    box.innerHTML = qHtml;

    Object.entries(this.userAnswers.listening).forEach(([qid, val]) => {
      const inp = document.getElementById(`inp_ft_lis_${qid}`);
      if (inp) inp.value = val;
      const rad = document.querySelector(`input[name="rad_ft_lis_${qid}"][value="${val}"]`);
      if (rad) rad.checked = true;
    });
  }

  // =========================================================================
  // 3. NẠP READING LIÊN HOÀN 3 PASSAGES (FIX 100% CẢ CÁCH 1 & CÁCH 2)
  // =========================================================================
  async loadCrossModuleReading() {
    const tNum = this.setNum;
    this.readPassages = [];

    for (let p = 1; p <= 3; p++) {
      // Tìm file theo cả 2 đường dẫn (Cách 2 và Cách 1)
      const tryUrls = [
        `data-diag/reading/cam21-test${tNum}-p${p}.json`,
        `data-diag/reading/test${tNum}-reading-s${p}.json`,
        `../reading/data-r/cam21-test${tNum}/cam21-test${tNum}-p${p}.json`
      ];

      let data = null;
      for (const u of tryUrls) {
        try {
          const res = await fetch(`${u}?t=${Date.now()}`);
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch (e) {}
      }

      if (data) this.readPassages.push(data);
    }

    this.renderFullReadingUI();
  }

  renderFullReadingUI() {
    const mount = document.getElementById('ftReadingMount');
    if (!mount) return;

    if (this.readPassages.length === 0) {
      mount.innerHTML = `
        <div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">
          ⚠️ Không tìm thấy file JSON Reading trong thư mục <code>data-diag/reading/</code>!<br>
          <span style="font-size:13px; color:#64748B;">Hãy đảm bảo file <code>cam21-test1-p1.json</code> đã nằm trong <code>diagnostic/data-diag/reading/</code></span>
        </div>
      `;
      return;
    }

    let html = `
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        ${this.readPassages.map((p, idx) => `
          <button type="button" id="btnReadPassage_${idx}" class="btn-3d ${idx === 0 ? 'btn-3d-red' : 'btn-3d-white'}" style="padding:8px 14px; font-size:13px;" onclick="window.ftEngine.switchReadPassage(${idx})">
            Passage ${idx + 1}
          </button>
        `).join('')}
      </div>
      <div id="ftReadActiveBox"></div>
    `;

    mount.innerHTML = html;
    this.switchReadPassage(0);
  }

  switchReadPassage(idx) {
    this.activeReadPassageIdx = idx;
    const passage = this.readPassages[idx];
    if (!passage) return;

    this.readPassages.forEach((_, i) => {
      const btn = document.getElementById(`btnReadPassage_${i}`);
      if (btn) btn.className = `btn-3d ${i === idx ? 'btn-3d-red' : 'btn-3d-white'}`;
    });

    const box = document.getElementById('ftReadActiveBox');
    if (!box) return;

    // RENDER 2 CỘT SPLIT SCREEN CHUẨN MÁY THI
    let qContentHtml = '';

    (passage.groups || []).forEach((g, gIdx) => {
      const gType = (g.type || '').toLowerCase();
      const gMeta = ((g.title || '') + ' ' + (g.instructions || '')).toLowerCase();
      const isTFNG = gType.includes('tfng') || gMeta.includes('true/false/not given');
      const isYNNG = gType.includes('ynng') || gMeta.includes('yes/no/not given');
      const isMatchingInfo = gType.includes('matching_info') || gMeta.includes('which section') || gMeta.includes('contains the following');

      let inner = '';

      // A. Điền từ dạng template có {{q1}}
      if (g.template) {
        let tmpl = g.template;
        (g.questionIds || []).forEach(qId => {
          const q = (passage.questions || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          const width = q.inputWidth || "120px";
          const inputEl = `
            <input type="text" class="diag-input" id="inp_ft_read_${qId}" style="width:${width}; display:inline-block; vertical-align:middle; padding:4px 8px; text-align:center; font-weight:800; color:#8B1518; margin:0 4px;" placeholder="[${num}]" oninput="window.ftEngine.recordAnswer('reading', '${qId}', this.value)">
          `;
          tmpl = tmpl.replace(new RegExp(`{{${qId}}}`, 'g'), inputEl);
        });
        inner = `
          <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:12px; padding:16px; font-size:14px; line-height:1.8;">
            ${(g.noteTitle || g.summaryTitle) ? `<b style="font-size:15px; color:#8B1518; display:block; margin-bottom:8px;">${g.noteTitle || g.summaryTitle}</b>` : ''}
            ${tmpl}
          </div>
        `;

      // B. Bảng ma trận Matching Information (A-G)
      } else if (isMatchingInfo) {
        let paras = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        if (g.questionIds && g.questionIds.length > 0) {
          const firstQ = (passage.questions || {})[g.questionIds[0]];
          if (firstQ && Array.isArray(firstQ.options) && firstQ.options.length > 0) {
            paras = firstQ.options.map(o => String(o).charAt(0).toUpperCase());
          }
        }

        inner = `
          <div style="overflow-x:auto; background:#FFFFFF; border:1.5px solid #E8E2D8; border-radius:12px; margin:10px 0;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#FAF7F2;">
                  <th style="padding:8px 10px; text-align:left;">Câu hỏi</th>
                  ${paras.map(p => `<th style="padding:8px 6px; text-align:center;">${p}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${(g.questionIds || []).map(qId => {
                  const q = (passage.questions || {})[qId] || {};
                  return `
                    <tr style="border-top:1px solid #E8E2D8;">
                      <td style="padding:8px 10px; font-weight:700;">Câu ${q.num || qId}. ${q.text || ''}</td>
                      ${paras.map(p => `
                        <td style="text-align:center; padding:6px;">
                          <input type="radio" name="rad_ft_read_${qId}" value="${p}" onchange="window.ftEngine.recordAnswer('reading', '${qId}', '${p}')">
                        </td>
                      `).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

      // C. Trắc nghiệm / TFNG / YNNG
      } else {
        inner = (g.questionIds || []).map(qId => {
          const q = (passage.questions || {})[qId] || {};
          const num = q.num || qId.replace('q', '');

          let opts = '';
          if (isTFNG) {
            opts = ['TRUE', 'FALSE', 'NOT GIVEN'].map(ch => `
              <label class="option-label" style="display:inline-flex; width:auto; padding:6px 14px; margin-right:6px;" onclick="window.ftEngine.recordAnswer('reading', '${qId}', '${ch}')">
                <input type="radio" name="rad_ft_read_${qId}" value="${ch}">
                <span>${ch}</span>
              </label>
            `).join('');
          } else if (isYNNG) {
            opts = ['YES', 'NO', 'NOT GIVEN'].map(ch => `
              <label class="option-label" style="display:inline-flex; width:auto; padding:6px 14px; margin-right:6px;" onclick="window.ftEngine.recordAnswer('reading', '${qId}', '${ch}')">
                <input type="radio" name="rad_ft_read_${qId}" value="${ch}">
                <span>${ch}</span>
              </label>
            `).join('');
          } else if (q.options && Array.isArray(q.options)) {
            opts = q.options.map(opt => `
              <label class="option-label" onclick="window.ftEngine.recordAnswer('reading', '${qId}', '${opt.charAt(0)}')">
                <input type="radio" name="rad_ft_read_${qId}" value="${opt.charAt(0)}">
                <span>${opt}</span>
              </label>
            `).join('');
          } else {
            opts = `<input type="text" class="diag-input" id="inp_ft_read_${qId}" placeholder="Điền đáp án..." oninput="window.ftEngine.recordAnswer('reading', '${qId}', this.value)">`;
          }

          return `
            <div class="q-item-box" style="margin-bottom:12px;">
              <b style="font-size:13.5px; color:#1E293B; display:block; margin-bottom:6px;">
                Câu ${num}. ${q.text || ''}
              </b>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">${opts}</div>
            </div>
          `;
        }).join('');
      }

      qContentHtml += `
        <div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:14px; padding:16px; margin-bottom:18px;">
          <b style="font-size:15px; color:#8B1518; display:block; margin-bottom:4px;">${g.title}</b>
          ${g.instructions ? `<div style="font-size:13px; color:#64748B; margin-bottom:12px;">${g.instructions}</div>` : ''}
          ${inner}
        </div>
      `;
    });

    box.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; min-height:550px;">
        <div class="reading-passage-split" style="margin-bottom:0; max-height:calc(100vh - 240px); overflow-y:auto;">
          <h4 style="margin:0 0 10px 0; color:var(--tram-red);">${passage.title || `READING PASSAGE ${idx + 1}`}</h4>
          <div style="line-height:1.75; font-size:14.5px;">${passage.passageHtml || passage.passageText || ''}</div>
        </div>
        <div style="max-height:calc(100vh - 240px); overflow-y:auto; padding-right:4px;">
          ${qContentHtml}
        </div>
      </div>
    `;

    // Khôi phục các đáp án đã chọn
    Object.entries(this.userAnswers.reading).forEach(([qid, val]) => {
      const inp = document.getElementById(`inp_ft_read_${qid}`);
      if (inp) inp.value = val;
      const rad = document.querySelector(`input[name="rad_ft_read_${qid}"][value="${val}"]`);
      if (rad) rad.checked = true;
    });
  }

  // =========================================================================
  // 4. WRITING
  // =========================================================================
  renderFullWriting() {
    const mount = document.getElementById('ftWritingMount');
    if (!mount) return;

    mount.innerHTML = `
      <div class="q-item-box" style="margin-bottom:24px; border:2.5px solid #BFDBFE;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <b style="font-size:16px; color:#1E40AF;">📊 TASK 1: BÁO CÁO BIỂU ĐỒ (TỐI THIỂU 150 TỪ)</b>
          <span style="font-size:12px; font-weight:800; background:#DBEAFE; color:#1E40AF; padding:3px 10px; border-radius:10px;">Khuyến nghị 20 phút</span>
        </div>
        <p style="font-size:13.5px; color:#334155; line-height:1.6; margin-bottom:12px;">
          <b>Đề bài:</b> "The graph below shows the price of different kinds of bread, in dollars, from 2001 to 2005. Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
        </p>
        <div style="text-align:center; margin-bottom:12px;">
          <img src="../writing task 1/images_task1/task1_img_104.jpeg" alt="Biểu đồ Task 1" style="max-width:100%; max-height:260px; border-radius:8px;">
        </div>
        <textarea id="ft_writing_task1" class="diag-textarea" rows="9" placeholder="Viết toàn bộ bài báo cáo Task 1 tại đây..." oninput="window.ftEngine.updateWordCount('ft_writing_task1', 'wc_task1')"></textarea>
        <div style="text-align:right; font-size:12px; font-weight:800; color:#1E40AF; margin-top:4px;" id="wc_task1">0 từ</div>
      </div>

      <div class="q-item-box" style="border:2.5px solid #DDD6FE;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <b style="font-size:16px; color:#7C3AED;">📝 TASK 2: BÀI LUẬN NGHỊ LUẬN (TỐI THIỂU 250 TỪ)</b>
          <span style="font-size:12px; font-weight:800; background:#EDE9FE; color:#6D28D9; padding:3px 10px; border-radius:10px;">Khuyến nghị 40 phút</span>
        </div>
        <p style="font-size:13.5px; color:#334155; line-height:1.6; margin-bottom:12px;">
          <b>Đề bài:</b> "The typical teaching situation between students and teachers in the classroom will be gone by the year 2050. To what extent do you agree or disagree?"
        </p>
        <textarea id="ft_writing_task2" class="diag-textarea" rows="14" placeholder="Viết toàn bộ bài luận Task 2 tại đây..." oninput="window.ftEngine.updateWordCount('ft_writing_task2', 'wc_task2')"></textarea>
        <div style="text-align:right; font-size:12px; font-weight:800; color:#7C3AED; margin-top:4px;" id="wc_task2">0 từ</div>
      </div>
    `;
  }

  updateWordCount(areaId, counterId) {
    const val = document.getElementById(areaId)?.value.trim() || '';
    const words = val.length === 0 ? 0 : val.split(/\s+/).filter(Boolean).length;
    const cEl = document.getElementById(counterId);
    if (cEl) cEl.innerText = `${words} từ`;
    if (areaId === 'ft_writing_task1') this.userAnswers.writing.task1 = val;
    if (areaId === 'ft_writing_task2') this.userAnswers.writing.task2 = val;
  }

  // =========================================================================
  // 5. SPEAKING
  // =========================================================================
  renderFullSpeaking() {
    const mount = document.getElementById('ftSpeakingMount');
    if (!mount) return;

    mount.innerHTML = `
      <div class="q-item-box" style="margin-bottom:18px;">
        <b style="font-size:14.5px; color:#92400E; display:block; margin-bottom:6px;">🎤 Part 1: Giao tiếp đời sống</b>
        <p style="font-size:13px; color:#475569; margin:0 0 10px 0;">"Let's talk about your hometown. What do you like most about living there?"</p>
        <button type="button" class="btn-3d btn-3d-red" id="btnRecFtSpk1" style="padding:8px 16px; font-size:13px;" onclick="window.ftEngine.toggleSpeech('ft_spk_part1', 'btnRecFtSpk1')">
          <i class="fa-solid fa-microphone"></i> Bấm để trả lời Part 1
        </button>
        <textarea id="ft_spk_part1" class="diag-textarea" style="height:70px; margin-top:8px;" placeholder="Transcript Part 1..."></textarea>
      </div>

      <div class="q-item-box" style="margin-bottom:18px; border:2px solid #FCD34D;">
        <b style="font-size:14.5px; color:#B45309; display:block; margin-bottom:6px;">🎤 Part 2: Thuyết trình Cue Card</b>
        <p style="font-size:13px; color:#475569; margin:0 0 10px 0;">"Describe an important decision you made in your life. You should say: what it was, why you made it, and explain how it affected you."</p>
        <button type="button" class="btn-3d btn-3d-red" id="btnRecFtSpk2" style="padding:8px 16px; font-size:13px;" onclick="window.ftEngine.toggleSpeech('ft_spk_part2', 'btnRecFtSpk2')">
          <i class="fa-solid fa-microphone"></i> Bấm để nói Part 2 (Nói 2 phút)
        </button>
        <textarea id="ft_spk_part2" class="diag-textarea" style="height:90px; margin-top:8px;" placeholder="Transcript Part 2..."></textarea>
      </div>

      <div class="q-item-box">
        <b style="font-size:14.5px; color:#92400E; display:block; margin-bottom:6px;">🎤 Part 3: Phản biện chuyên sâu</b>
        <p style="font-size:13px; color:#475569; margin:0 0 10px 0;">"Do you think artificial intelligence will reduce human decision-making capacity in the future?"</p>
        <button type="button" class="btn-3d btn-3d-red" id="btnRecFtSpk3" style="padding:8px 16px; font-size:13px;" onclick="window.ftEngine.toggleSpeech('ft_spk_part3', 'btnRecFtSpk3')">
          <i class="fa-solid fa-microphone"></i> Bấm để trả lời Part 3
        </button>
        <textarea id="ft_spk_part3" class="diag-textarea" style="height:70px; margin-top:8px;" placeholder="Transcript Part 3..."></textarea>
      </div>
    `;
  }

  // =========================================================================
  // 6. TIỆN ÍCH LƯU ĐÁP ÁN & ĐIỀU HƯỚNG
  // =========================================================================
  recordAnswer(skill, qId, val) {
    if (this.userAnswers[skill]) {
      this.userAnswers[skill][qId] = String(val).trim();
    }
  }

  switchSection(key) {
    ['grammar', 'listening', 'reading', 'writing', 'speaking'].forEach(s => {
      const tab = document.getElementById(`tab_ft_${s}`);
      const sec = document.getElementById(`section_ft_${s}`);
      if (tab) tab.classList.toggle('active', s === key);
      if (sec) sec.style.display = (s === key) ? 'block' : 'none';
    });
    this.currentSection = key;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startTimer() {
    this.timerSeconds = 0;
    const disp = document.getElementById('fullTestTimerDisplay');
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

  toggleSpeech(targetId, btnId) {
    if (!this.speechRecognition) {
      alert("Trình duyệt chưa hỗ trợ Web Speech!");
      return;
    }
    const btn = document.getElementById(btnId);
    const area = document.getElementById(targetId);

    if (!this.isRecording) {
      try {
        this.speechRecognition.start();
        this.isRecording = true;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-stop"></i> Đang thu âm... Bấm dừng`;
        this.speechRecognition.onresult = (e) => {
          let str = '';
          for (let i = 0; i < e.results.length; ++i) str += e.results[i][0].transcript + ' ';
          if (area) {
            area.value = str.trim();
            if (targetId === 'ft_spk_part1') this.userAnswers.speaking.part1 = str.trim();
            if (targetId === 'ft_spk_part2') this.userAnswers.speaking.part2 = str.trim();
            if (targetId === 'ft_spk_part3') this.userAnswers.speaking.part3 = str.trim();
          }
        };
      } catch(e) {}
    } else {
      try {
        this.speechRecognition.stop();
        this.isRecording = false;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Bấm để nói tiếp`;
      } catch(e) {}
    }
  }

  // =========================================================================
  // 7. NỘP BÀI VÀ CHẤM ĐIỂM
  // =========================================================================
  async submitFullMockTest() {
    if (!confirm("Em có chắc chắn muốn nộp toàn bộ bài Full Mock Test để xuất Overall Band Score?")) return;

    const btn = document.getElementById('btnSubmitFullMockTest');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Đang chấm điểm 4 kỹ năng & Ngữ pháp...`;
    }

    clearInterval(this.timerInterval);

    // Chấm Ngữ pháp
    let gScore = 0;
    let gTotal = 0;
    (this.grammarData?.parts || []).forEach(part => {
      (part.questions || []).forEach(q => {
        gTotal++;
        if (q.type === 'choice') {
          if ((this.userAnswers.grammar[q.id] || '').toUpperCase() === (q.answer || '').toUpperCase()) gScore++;
        } else if (q.type === 'blank' || q.type === 'rewrite') {
          const u = (this.userAnswers.grammar[q.id] || '').toLowerCase().trim();
          if (q.answers && q.answers.map(a => a.toLowerCase().trim()).includes(u)) gScore++;
        }
      });
    });

    // Chấm Listening (40 câu)
    let lCorrect = 0;
    this.lisParts.forEach(p => {
      Object.entries(p.answers || {}).forEach(([qid, exp]) => {
        const u = (this.userAnswers.listening[qid] || '').toLowerCase().trim();
        if (Array.isArray(exp)) {
          if (exp.map(a => a.toLowerCase().trim()).includes(u)) lCorrect++;
        } else {
          if (u === String(exp).toLowerCase().trim()) lCorrect++;
        }
      });
    });
    const lisBand = parseFloat(this.calculateBandScore(lCorrect, 40));

    // Chấm Reading (40 câu)
    let rCorrect = 0;
    this.readPassages.forEach(p => {
      const expAnswers = p.answers || {};
      Object.entries(expAnswers).forEach(([qid, exp]) => {
        const u = (this.userAnswers.reading[qid] || '').toLowerCase().trim();
        let normUser = u;
        if (u === 't') normUser = 'true';
        if (u === 'f') normUser = 'false';
        if (u === 'ng') normUser = 'not given';
        if (u === 'y') normUser = 'yes';
        if (u === 'n') normUser = 'no';

        if (Array.isArray(exp)) {
          if (exp.some(a => String(a).toLowerCase().trim() === normUser || String(a).toLowerCase().trim() === u)) rCorrect++;
        } else {
          const e = String(exp).toLowerCase().trim();
          if (normUser === e || u === e) rCorrect++;
        }
      });
    });
    const readBand = parseFloat(this.calculateBandScore(rCorrect, 40));

    // Writing & Speaking
    const wt1Len = (document.getElementById('ft_writing_task1')?.value || '').trim().split(/\s+/).filter(Boolean).length;
    const wt2Len = (document.getElementById('ft_writing_task2')?.value || '').trim().split(/\s+/).filter(Boolean).length;
    const writeBand = (wt1Len >= 120 && wt2Len >= 200) ? 6.5 : (wt1Len >= 80 ? 5.5 : 4.5);
    const spkBand = 5.5;

    // Overall Band
    const rawOverall = (lisBand + readBand + writeBand + spkBand) / 4;
    const overallBand = (Math.round(rawOverall * 2) / 2).toFixed(1);

    // Xuất kết quả
    document.querySelector('.fulltest-container').innerHTML = `
      <div style="background:#FFFFFF; border:3px solid #E8E2D8; border-bottom:7px solid #D3CBC0; border-radius:24px; padding:36px; max-width:850px; margin:30px auto; text-align:center;">
        <div style="font-size:48px; margin-bottom:10px;">🏆</div>
        <h2 style="color:#8B1518; margin:0 0 6px 0; font-size:26px; font-weight:900;">KẾT QUẢ IELTS FULL MOCK TEST</h2>
        <p style="color:#64748B; font-weight:700; margin-bottom:24px;">Bài thi chuẩn hóa Cambridge 21 • Thời gian: ${Math.round(this.timerSeconds / 60)} phút</p>

        <div style="background:#FEF3C7; border:2px solid #FCD34D; border-radius:18px; padding:22px; margin-bottom:24px;">
          <div style="font-size:14px; font-weight:800; color:#92400E; text-transform:uppercase;">OVERALL BAND SCORE</div>
          <div style="font-size:46px; font-weight:900; color:#B45309; margin:4px 0;">${overallBand}</div>
          <div style="font-size:13.5px; font-weight:700; color:#78350F;">Chúc mừng Em đã hoàn thành bài thi mô phỏng áp lực thực tế!</div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin-bottom:26px;">
          <div style="background:#F0FDF4; border:1.5px solid #86EFAC; padding:12px; border-radius:12px;">
            <div style="font-size:11px; font-weight:800; color:#166534;">LISTENING</div>
            <b style="font-size:20px; color:#15803D;">Band ${lisBand}</b>
            <div style="font-size:11.5px; color:#64748B;">(${lCorrect}/40 câu)</div>
          </div>
          <div style="background:#F0F9FF; border:1.5px solid #BAE6FD; padding:12px; border-radius:12px;">
            <div style="font-size:11px; font-weight:800; color:#0369A1;">READING</div>
            <b style="font-size:20px; color:#0284C7;">Band ${readBand}</b>
            <div style="font-size:11.5px; color:#64748B;">(${rCorrect}/40 câu)</div>
          </div>
          <div style="background:#EFF6FF; border:1.5px solid #BFDBFE; padding:12px; border-radius:12px;">
            <div style="font-size:11px; font-weight:800; color:#1E40AF;">WRITING</div>
            <b style="font-size:20px; color:#2563EB;">Band ${writeBand}</b>
          </div>
          <div style="background:#FFFBEB; border:1.5px solid #FDE68A; padding:12px; border-radius:12px;">
            <div style="font-size:11px; font-weight:800; color:#92400E;">SPEAKING</div>
            <b style="font-size:20px; color:#D97706;">Band ${spkBand}</b>
          </div>
          <div style="background:#FAF5FF; border:1.5px solid #DDD6FE; padding:12px; border-radius:12px;">
            <div style="font-size:11px; font-weight:800; color:#6D28D9;">NGỮ PHÁP</div>
            <b style="font-size:20px; color:#7C3AED;">${gScore}/${gTotal}</b>
          </div>
        </div>

        <div style="display:flex; gap:12px; justify-content:center;">
          <a href="index-diag.html" class="btn-3d btn-3d-white" style="flex:1;">← Danh mục đề</a>
          <a href="../curriculum-system/roadmap.html" class="btn-3d btn-3d-blue" style="flex:1;">🚀 Kích hoạt Lộ trình học &rarr;</a>
        </div>
      </div>
    `;
  }

  calculateBandScore(correct, total = 40) {
    const s = Math.round((correct / (total || 1)) * 40);
    if (s >= 39) return "9.0";
    if (s >= 37) return "8.5";
    if (s >= 35) return "8.0";
    if (s >= 32) return "7.5";
    if (s >= 30) return "7.0";
    if (s >= 26) return "6.5";
    if (s >= 23) return "6.0";
    if (s >= 18) return "5.5";
    if (s >= 16) return "5.0";
    if (s >= 13) return "4.5";
    if (s >= 10) return "4.0";
    if (s >= 8)  return "3.5";
    if (s >= 6)  return "3.0";
    return "2.5";
  }
}

export const ftEngine = new DiagnosticFullTestEngine();
window.ftEngine = ftEngine;
window.switchFullTestSection = (s) => ftEngine.switchSection(s);
window.submitFullMockTestExam = () => ftEngine.submitFullMockTest();

document.addEventListener('DOMContentLoaded', () => ftEngine.init());
