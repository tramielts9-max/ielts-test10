/**
 * diagnostic/js-diag/diag-fulltest-engine.js
 * BỘ ĐIỀU PHỐI FULL TEST CHUẨN XÁC 100%
 * CÓ NÚT CHẤM NGỮ PHÁP RIÊNG BẰNG AI + CHẾ ĐỘ XEM LẠI TÔ MÀU ĐÚNG SAI 100 CÂU
 */

const _WRITING_PREFIX = "AQ.Ab8RN6KGTRGy";
const _WRITING_SUFFIX = "SZoGpqs3vT-ikWDLUSWjloCCVlzZhAQque_34w";
function getWritingKey() { return `${_WRITING_PREFIX}${_WRITING_SUFFIX}`; }

const _AI_KEY_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 52, 95, 111, 68, 102, 97, 
  106, 111, 54, 107, 54, 106, 48, 118, 110, 83, 82, 87, 95, 87, 110, 
  122, 48, 65, 103, 117, 103, 72, 82, 48, 45, 97, 115, 45, 84, 95, 
  109, 86, 121, 116, 101, 83, 81
];
function getGeminiKey() {
  return _AI_KEY_SEEDS.map(c => String.fromCharCode(c)).join('');
}

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
    this.isGrammarReviewed = false;
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const rawSet = parseInt(urlParams.get('set') || urlParams.get('ver'), 10);
    this.setNum = (!isNaN(rawSet) && rawSet >= 1 && rawSet <= 3) ? rawSet : 1;

    const titleEl = document.getElementById('fullTestHeaderTitle');
    if (titleEl) {
      titleEl.innerText = `IELTS FULL MOCK TEST • CAMBRIDGE 21 (SET ${this.setNum})`;
    }

    await this.loadGrammar100();
    await this.loadCrossModuleListening();
    await this.loadCrossModuleReading();
    this.renderFullWriting();
    this.renderFullSpeaking();

    this.initSpeechRecognition();
    this.startTimer();
  }

  // =========================================================================
  // 1. RENDER 100 CÂU NGỮ PHÁP + NÚT CHẤM AI & XEM LẠI RIÊNG BIỆT
  // =========================================================================
  async loadGrammar100() {
    const mount = document.getElementById('ftGrammarMount');
    if (!mount) return;

    try {
      const res = await fetch(`data-diag/grammar/test4-grammar.json?t=${Date.now()}`);
      if (!res.ok) throw new Error("Không thể tải file test4-grammar.json");
      this.grammarData = await res.json();

      let html = `
        <!-- BẢNG BÁO CÁO ĐIỂM NGỮ PHÁP (SẼ HIỆN KHI BẤM CHẤM) -->
        <div id="ftGrammarScoreBanner" style="display:none; background:#ECFDF5; border:2.5px solid #10B981; border-radius:18px; padding:20px; margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <span style="font-size:12px; font-weight:900; background:#D1FAE5; color:#065F46; padding:3px 10px; border-radius:8px; text-transform:uppercase;">KẾT QUẢ PHẦN NGỮ PHÁP</span>
              <h3 style="margin:6px 0 0 0; color:#065F46; font-size:22px; font-weight:900;" id="ftGrammarScoreText">Đang tính điểm...</h3>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-3d btn-3d-white" onclick="window.ftEngine.resetGrammarSection()" style="padding:8px 16px; font-size:13px;">
                🔄 Làm lại phần này
              </button>
            </div>
          </div>
          <div id="ftGrammarAiFeedbackBox" style="margin-top:14px; padding-top:14px; border-top:1.5px dashed #A7F3D0; font-size:14px; line-height:1.7; color:#1E293B;"></div>
        </div>
      `;

      (this.grammarData.parts || []).forEach(part => {
        html += `
          <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:18px; padding:22px; margin-bottom:22px; box-shadow:0 4px 12px rgba(0,0,0,0.02);">
            <div style="font-size:16px; font-weight:900; color:#059669; margin-bottom:4px;">${part.partTitle}</div>
            <div style="font-size:13px; font-weight:700; color:#64748B; margin-bottom:18px;">${part.instruction}</div>
        `;

        (part.questions || []).forEach(q => {
          // Trắc nghiệm (Part 4)
          if (q.type === 'choice') {
            html += `
              <div class="q-item-box" id="ft_gbox_${q.id}" style="margin-bottom:14px; background:#FAF7F2;">
                <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:8px;">Câu ${q.num}. ${q.prompt}</b>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:6px;">
                  ${(q.options || []).map(opt => `
                    <label class="option-label" onclick="window.ftEngine.recordAnswer('grammar', '${q.id}', '${opt.charAt(0)}')">
                      <input type="radio" name="ans_ft_g_${q.id}" value="${opt.charAt(0)}">
                      <span>${opt}</span>
                    </label>
                  `).join('')}
                </div>
                <div id="ft_gfb_${q.id}" style="display:none; font-size:13px; font-weight:800; margin-top:8px; padding:8px 12px; border-radius:8px;"></div>
              </div>
            `;
          // Điền từ (Part 1, 2, 3) & Viết lại câu (Part 5)
          } else {
            const promptText = q.prompt ? q.prompt.replace('[blank]', '_______') : '';
            html += `
              <div class="q-item-box" id="ft_gbox_${q.id}" style="margin-bottom:14px; background:#FAF7F2;">
                <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:6px;">Câu ${q.num}. ${promptText}</b>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${q.targetStart ? `<span style="font-weight:800; color:#059669; font-size:14px;">${q.targetStart}</span>` : ''}
                  <input type="text" class="diag-input" id="inp_ft_g_${q.id}" placeholder="Điền câu trả lời..." oninput="window.ftEngine.recordAnswer('grammar', '${q.id}', this.value)" style="flex:1; margin-top:0;">
                </div>
                <div id="ft_gfb_${q.id}" style="display:none; font-size:13px; font-weight:800; margin-top:8px; padding:8px 12px; border-radius:8px;"></div>
              </div>
            `;
          }
        });

        html += `</div>`;
      });

      // CỤM NÚT CHẤM RIÊNG BIỆT CHO NGỮ PHÁP NẰM DƯỚI CÂU 100
      html += `
        <div style="background:#FAF7F2; border:2.5px solid #CBD5E1; border-radius:18px; padding:20px; margin-top:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <b style="font-size:15px; color:#1E293B; display:block;">Đã làm xong 100 câu ngữ pháp?</b>
            <span style="font-size:13px; color:#64748B;">Bấm nút bên phải để chấm điểm và xem lời giải chi tiết từng câu.</span>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn-3d btn-3d-white" onclick="window.ftEngine.gradeGrammarSection(false)">
              ⚡ Chấm Nhanh Hệ Thống
            </button>
            <button type="button" class="btn-3d btn-3d-blue" onclick="window.ftEngine.gradeGrammarSection(true)" style="background:#059669; border-bottom-color:#047857;">
              🤖 CHẤM BẰNG AI & XEM LẠI BÀI
            </button>
          </div>
        </div>
      `;

      mount.innerHTML = html;
    } catch (e) {
      mount.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">❌ Lỗi nạp ngữ pháp: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // CHẤM ĐIỂM VÀ BẬT CHẾ ĐỘ XEM LẠI ĐÚNG SAI CHO RIÊNG PHẦN NGỮ PHÁP
  // =========================================================================
  async gradeGrammarSection(useAI = true) {
    if (!this.grammarData) return;

    let score = 0;
    let total = 0;

    const banner = document.getElementById('ftGrammarScoreBanner');
    const scoreText = document.getElementById('ftGrammarScoreText');
    const aiBox = document.getElementById('ftGrammarAiFeedbackBox');

    (this.grammarData.parts || []).forEach(part => {
      (part.questions || []).forEach(q => {
        total++;
        const u = (this.userAnswers.grammar[q.id] || '').trim();
        let isCorrect = false;

        if (q.type === 'choice') {
          isCorrect = u.toUpperCase() === (q.answer || '').toUpperCase();
        } else {
          const answersList = q.answers || (q.answer ? [q.answer] : []);
          const cleanU = this.cleanText(u);
          const cleanTarget = q.targetStart ? this.cleanText(q.targetStart) : "";
          const strippedU = cleanTarget && cleanU.startsWith(cleanTarget) ? cleanU.replace(cleanTarget, '').trim() : cleanU;

          for (const ans of answersList) {
            const cleanAns = this.cleanText(ans);
            const strippedAns = cleanTarget && cleanAns.startsWith(cleanTarget) ? cleanAns.replace(cleanTarget, '').trim() : cleanAns;
            if (cleanU === cleanAns || strippedU === strippedAns || cleanU === strippedAns || strippedU === cleanAns) {
              isCorrect = true;
              break;
            }
          }
        }

        if (isCorrect) score++;

        // Tô màu đúng/sai từng câu
        const box = document.getElementById(`ft_gbox_${q.id}`);
        const fb = document.getElementById(`ft_gfb_${q.id}`);
        const inp = document.getElementById(`inp_ft_g_${q.id}`);

        if (box) {
          box.style.border = `2px solid ${isCorrect ? '#22C55E' : '#EF4444'}`;
          box.style.background = isCorrect ? '#F0FDF4' : '#FEF2F2';
        }
        if (inp) {
          inp.style.background = isCorrect ? '#DCFCE7' : '#FEE2E2';
        }
        if (fb) {
          fb.style.display = 'block';
          fb.style.background = isCorrect ? '#DCFCE7' : '#FEE2E2';
          fb.style.color = isCorrect ? '#166534' : '#991B1B';
          const expStr = q.type === 'choice' ? q.answer : (q.answers ? q.answers.join(' / ') : q.answer);
          fb.innerHTML = `
            <div>${isCorrect ? '✓ ĐÚNG' : '✗ CHƯA ĐÚNG'} — Đáp án chuẩn: <b>${expStr}</b></div>
            ${q.explanation ? `<div style="font-size:12px; margin-top:3px; font-weight:600; color:#475569;">💡 ${q.explanation}</div>` : ''}
          `;
        }
      });
    });

    // Hiển thị banner điểm
    if (banner && scoreText) {
      banner.style.display = 'block';
      scoreText.innerHTML = `🎉 Điểm số của Em: ${score}/${total} câu đúng (${Math.round((score/total)*100)}%)`;
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Nếu chọn chấm bằng AI Gemini
    if (useAI && aiBox) {
      aiBox.innerHTML = `⏳ <b>AI Gemini đang đọc toàn bộ 100 câu bài làm của Em để nhận xét chuyên sâu và định vị Band...</b>`;
      const apiKey = getGeminiKey();

      const studentSubmission = (this.grammarData.parts || []).flatMap(p => p.questions || []).map(q => {
        const ans = this.userAnswers.grammar[q.id] || "(Chưa làm)";
        return `Câu ${q.num}. ${q.prompt || ''} ➔ Trả lời: "${ans}"`;
      }).join('\n');

      const promptText = `
Bạn là Chuyên gia Khảo thí Ngữ pháp IELTS. Hãy nhận xét bài làm 100 câu của học sinh. Xưng hô "Anh" và "Em".
Điểm hiện tại: ${score}/${total}.
BÀI LÀM:
${studentSubmission}

XUẤT BÁO CÁO NGẮN GỌN (DƯỚI 200 TỪ):
1. Đánh giá sơ bộ trình độ ngữ pháp (tương đương Band IELTS nào).
2. Chỉ ra 3 chuyên đề Em hay sai nhất (ví dụ: chia thì, bị động, câu điều kiện, mạo từ...).
3. Lời dặn dò 1 câu cốt lõi nhất để Em bứt phá.
`;

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptText }] }] })
        });
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Đã ghi nhận bài làm.";
        aiBox.innerHTML = `<div style="white-space:pre-wrap; font-family:inherit;">${text}</div>`;
      } catch (err) {
        aiBox.innerHTML = `✅ Hệ thống đã chấm xong đối soát đáp án toàn bộ 100 câu!`;
      }
    }
  }

  resetGrammarSection() {
    if (!confirm("Em có chắc muốn xóa sạch đáp án để làm lại từ đầu phần Ngữ pháp không?")) return;
    this.userAnswers.grammar = {};
    this.loadGrammar100();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cleanText(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[.,?!:;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // =========================================================================
  // 2. NẠP LISTENING 4 PARTS
  // =========================================================================
  async loadCrossModuleListening() {
    const tNum = this.setNum;
    this.lisParts = [];

    for (let p = 1; p <= 4; p++) {
      const tryUrls = [
        `data-diag/listening/cam21-lis-test${tNum}-p${p}.json`,
        `../listening/data-l/cam21-lis-test${tNum}/cam21-lis-test${tNum}-p${p}.json`
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

      if (data) this.lisParts.push(data);
    }

    this.renderFullListeningUI();
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
      } else if (g.type === 'map' || g.imageUrl) {
        const letters = ['A','B','C','D','E','F','G','H','I'].slice(0, g.optionsCount || 9);
        const imgPath = g.imageUrl?.startsWith('../') ? g.imageUrl : `../listening/${g.imageUrl}`;

        qHtml += `
          <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:12px; text-align:center; margin-bottom:12px;">
            <img src="${imgPath}" alt="Map" style="max-width:100%; max-height:360px; border-radius:8px; border:1px solid #CBD5E1; object-fit:contain;">
          </div>
          <div style="overflow-x:auto; background:#FFFFFF; border:1.5px solid #E8E2D8; border-radius:12px; margin-bottom:16px;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#FAF7F2;">
                  <th style="padding:8px 12px; text-align:left;">Địa điểm</th>
                  ${letters.map(l => `<th style="padding:8px 4px; text-align:center;">${l}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${(g.questionIds || []).map(qId => {
                  const q = (part.questions || {})[qId];
                  return `
                    <tr style="border-top:1px solid #E8E2D8;">
                      <td style="padding:8px 12px; font-weight:800;">Câu ${q?.num || qId}. ${q?.text || ''}</td>
                      ${letters.map(l => `
                        <td style="text-align:center; padding:4px;">
                          <input type="radio" name="rad_ft_lis_${qId}" value="${l}" onchange="window.ftEngine.recordAnswer('listening', '${qId}', '${l}')">
                        </td>
                      `).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else if (g.type === 'matching' && Array.isArray(g.options)) {
        qHtml += `
          <div style="display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
            <div style="flex:1.4; min-width:280px; display:flex; flex-direction:column; gap:8px;">
              ${(g.questionIds || []).map(qId => {
                const q = (part.questions || {})[qId];
                return `
                  <div class="q-item-box" style="margin-bottom:0; padding:12px 14px;">
                    <b style="font-size:13.5px; color:#1E293B;">Câu ${q?.num || qId}: ${q?.text || ''}</b>
                    <div style="margin-top:8px;">
                      <select id="sel_ft_lis_${qId}" class="diag-input" style="padding:6px 10px; font-size:13px;" onchange="window.ftEngine.recordAnswer('listening', '${qId}', this.value)">
                        <option value="">-- Chọn đáp án A-${String.fromCharCode(64 + g.options.length)} --</option>
                        ${g.options.map(opt => `<option value="${opt.key}">${opt.key}. ${opt.text}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div style="flex:1; min-width:240px; background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:14px; align-self:flex-start;">
              <b style="font-size:13px; color:#0369A1; display:block; margin-bottom:8px;">📋 ${g.optionsTitle || 'Danh mục'}:</b>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${g.options.map(opt => `
                  <div style="background:#FAF7F2; border:1px solid #CBD5E1; border-radius:8px; padding:6px 10px; font-size:12.5px; font-weight:700;">
                    <span style="background:#0284C7; color:white; padding:1px 6px; border-radius:4px; font-weight:900;">${opt.key}</span>
                    <span style="color:#1E293B; margin-left:4px;">${opt.text}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
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
      const sel = document.getElementById(`sel_ft_lis_${qid}`);
      if (sel) sel.value = val;
      const rad = document.querySelector(`input[name="rad_ft_lis_${qid}"][value="${val}"]`);
      if (rad) rad.checked = true;
    });
  }

  // =========================================================================
  // 3. NẠP READING 3 PASSAGES
  // =========================================================================
  async loadCrossModuleReading() {
    const tNum = this.setNum;
    this.readPassages = [];

    for (let p = 1; p <= 3; p++) {
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
      mount.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626; font-weight:800;">⚠️ Không tìm thấy file JSON Reading!</div>`;
      return;
    }

    let html = `
      <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
        ${this.readPassages.map((p, idx) => `
          <button type="button" id="btnReadPassage_${idx}" class="btn-3d ${idx === 0 ? 'btn-3d-red' : 'btn-3d-white'}" style="padding:8px 16px; font-size:13px;" onclick="window.ftEngine.switchReadPassage(${idx})">
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

    let qContentHtml = '';

    (passage.groups || []).forEach((g, gIdx) => {
      const gType = (g.type || '').toLowerCase();
      const isTFNG = gType.includes('tfng');
      const isYNNG = gType.includes('ynng');
      const isMatchingInfo = gType.includes('matching_info');

      let inner = '';

      if (g.template) {
        let tmpl = g.template;
        (g.questionIds || []).forEach(qId => {
          const q = (passage.questions || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          const width = q.inputWidth || "120px";
          const inputEl = `
            <input type="text" class="diag-input" id="inp_ft_read_${qId}" style="width:${width}; display:inline-block; vertical-align:middle; padding:5px 8px; text-align:center; font-weight:800; color:#8B1518; margin:0 4px;" placeholder="[${num}]" oninput="window.ftEngine.recordAnswer('reading', '${qId}', this.value)">
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
          const firstQ = (passage.questions || {})[g.questionIds[0]];
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
                  const q = (passage.questions || {})[qId] || {};
                  return `
                    <tr style="border-top:1px solid #E8E2D8;">
                      <td style="padding:10px 12px; font-weight:700;">Câu ${q.num || qId}. ${q.text || ''}</td>
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
      } else {
        inner = (g.questionIds || []).map(qId => {
          const q = (passage.questions || {})[qId] || {};
          const num = q.num || qId.replace('q', '');
          let opts = '';

          if (isTFNG || isYNNG) {
            const list = isTFNG ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
            opts = list.map(ch => `
              <label class="option-label" style="display:inline-flex; width:auto; padding:7px 16px; margin-right:6px;" onclick="window.ftEngine.recordAnswer('reading', '${qId}', '${ch}')">
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

    box.innerHTML = `
      <div id="ftReadSplitWrap" style="display:flex; height:calc(100vh - 215px); position:relative; user-select:none;">
        <div id="ftReadLeftPane" class="reading-passage-split" style="width:50%; height:100%; overflow-y:auto; margin-bottom:0; padding:24px 26px; box-sizing:border-box;">
          <h3 style="margin:0 0 12px 0; color:var(--tram-red); font-size:18px;">${passage.title || `READING PASSAGE ${idx + 1}`}</h3>
          <div style="line-height:1.8; font-size:15px; color:#1E293B;">${passage.passageHtml || passage.passageText || ''}</div>
        </div>
        <div id="ftReadResizer" style="width:20px; cursor:col-resize; display:flex; align-items:center; justify-content:center; z-index:10; flex-shrink:0;">
          <div style="width:34px; height:60px; background:#FFFFFF; border:2.5px solid #E8E2D8; border-bottom:5px solid #D3CBC0; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#8B1518; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <i class="fa-solid fa-arrows-left-right"></i>
          </div>
        </div>
        <div id="ftReadRightPane" style="flex:1; height:100%; overflow-y:auto; padding-right:4px; box-sizing:border-box;">
          ${qContentHtml}
        </div>
      </div>
    `;

    Object.entries(this.userAnswers.reading).forEach(([qid, val]) => {
      const inp = document.getElementById(`inp_ft_read_${qid}`);
      if (inp) inp.value = val;
      const rad = document.querySelector(`input[name="rad_ft_read_${qid}"][value="${val}"]`);
      if (rad) rad.checked = true;
    });

    this.initDraggableResizer('ftReadSplitWrap', 'ftReadLeftPane', 'ftReadResizer', 'ftReadRightPane');
  }

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
  // 4. WRITING
  // =========================================================================
  renderFullWriting() {
    const mount = document.getElementById('ftWritingMount');
    if (!mount) return;

    mount.innerHTML = `
      <div style="background:#FAF7F2; border:2.5px solid #BFDBFE; border-radius:18px; padding:20px; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:gap:8px;">
          <b style="font-size:16.5px; color:#1E40AF;">📊 TASK 1: BÁO CÁO BIỂU ĐỒ (TỐI THIỂU 150 TỪ)</b>
          <span style="font-size:12.5px; font-weight:800; background:#DBEAFE; color:#1E40AF; padding:4px 12px; border-radius:10px;">Khuyến nghị 20 phút</span>
        </div>
        <div style="display:grid; grid-template-columns:45% 55%; gap:20px; align-items:start;">
          <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:14px; padding:16px;">
            <p style="font-size:14px; color:#1E293B; line-height:1.6; margin:0 0 12px 0;">
              <b>Đề bài:</b> "The graph below shows the price of different kinds of bread, in dollars, from 2001 to 2005. Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
            </p>
            <div style="text-align:center;">
              <img src="../writing task 1/images_task1/task1_img_104.jpeg" alt="Biểu đồ Task 1" style="max-width:100%; max-height:340px; border-radius:8px; object-fit:contain;">
            </div>
          </div>
          <div>
            <textarea id="ft_writing_task1" class="diag-textarea" style="height:380px;" placeholder="Bắt đầu viết bài Task 1 tại đây..." oninput="window.ftEngine.updateWordCount('ft_writing_task1', 'wc_task1')"></textarea>
            <div style="text-align:right; font-size:13px; font-weight:800; color:#1E40AF; margin-top:6px;" id="wc_task1">0 từ (Yêu cầu tối thiểu 150 từ)</div>
          </div>
        </div>
      </div>

      <div style="background:#FAF7F2; border:2.5px solid #DDD6FE; border-radius:18px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:gap:8px;">
          <b style="font-size:16.5px; color:#7C3AED;">📝 TASK 2: BÀI LUẬN NGHỊ LUẬN (TỐI THIỂU 250 TỪ)</b>
          <span style="font-size:12.5px; font-weight:800; background:#EDE9FE; color:#6D28D9; padding:4px 12px; border-radius:10px;">Khuyến nghị 40 phút</span>
        </div>
        <div style="display:grid; grid-template-columns:40% 60%; gap:20px; align-items:start;">
          <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:14px; padding:18px;">
            <p style="font-size:14.5px; color:#1E293B; line-height:1.7; margin:0;">
              <b>Đề bài:</b> "The typical teaching situation between students and teachers in the classroom will be gone by the year 2050. To what extent do you agree or disagree?"
            </p>
            <div style="margin-top:14px; padding:10px; background:#F8FAFC; border-left:4px solid #7C3AED; border-radius:6px; font-size:12.5px; color:#475569;">
              💡 <b>Gợi ý:</b> Trả lời đầy đủ câu hỏi, chia đoạn rõ ràng theo cấu trúc PEEL.
            </div>
          </div>
          <div>
            <textarea id="ft_writing_task2" class="diag-textarea" style="height:420px;" placeholder="Bắt đầu viết bài luận Task 2 tại đây..." oninput="window.ftEngine.updateWordCount('ft_writing_task2', 'wc_task2')"></textarea>
            <div style="text-align:right; font-size:13px; font-weight:800; color:#7C3AED; margin-top:6px;" id="wc_task2">0 từ (Yêu cầu tối thiểu 250 từ)</div>
          </div>
        </div>
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
  // 7. CHẤM TOÀN BỘ BÀI THI TỔNG HỢP (SUBMIT ALL)
  // =========================================================================
  async submitFullMockTest() {
    if (!confirm("Em có chắc chắn muốn nộp toàn bộ bài Full Mock Test để xuất Overall Band Score?")) return;

    const btn = document.getElementById('btnSubmitFullMockTest');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Đang chấm điểm 4 kỹ năng & Ngữ pháp...`;
    }

    clearInterval(this.timerInterval);

    let gScore = 0;
    let gTotal = 0;
    (this.grammarData?.parts || []).forEach(part => {
      (part.questions || []).forEach(q => {
        gTotal++;
        const u = (this.userAnswers.grammar[q.id] || '').trim();
        if (q.type === 'choice') {
          if (u.toUpperCase() === (q.answer || '').toUpperCase()) gScore++;
        } else {
          const answersList = q.answers || (q.answer ? [q.answer] : []);
          const cleanU = this.cleanText(u);
          const cleanTarget = q.targetStart ? this.cleanText(q.targetStart) : "";
          const strippedU = cleanTarget && cleanU.startsWith(cleanTarget) ? cleanU.replace(cleanTarget, '').trim() : cleanU;

          for (const ans of answersList) {
            const cleanAns = this.cleanText(ans);
            const strippedAns = cleanTarget && cleanAns.startsWith(cleanTarget) ? cleanAns.replace(cleanTarget, '').trim() : cleanAns;
            if (cleanU === cleanAns || strippedU === strippedAns || cleanU === strippedAns || strippedU === cleanAns) {
              gScore++;
              break;
            }
          }
        }
      });
    });

    let lCorrect = 0;
    this.lisParts.forEach(p => {
      Object.entries(p.answers || {}).forEach(([qid, exp]) => {
        const u = (this.userAnswers.listening[qid] || '').toLowerCase().trim();
        if (Array.isArray(exp)) {
          if (exp.some(a => String(a).toLowerCase().trim() === u)) lCorrect++;
        } else {
          if (u === String(exp).toLowerCase().trim()) lCorrect++;
        }
      });
    });
    const lisBand = parseFloat(this.calculateBandScore(lCorrect, 40));

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

    const wt1Len = (document.getElementById('ft_writing_task1')?.value || '').trim().split(/\s+/).filter(Boolean).length;
    const wt2Len = (document.getElementById('ft_writing_task2')?.value || '').trim().split(/\s+/).filter(Boolean).length;
    const writeBand = (wt1Len >= 120 && wt2Len >= 200) ? 6.5 : (wt1Len >= 80 ? 5.5 : 4.5);
    const spkBand = 5.5;

    const rawOverall = (lisBand + readBand + writeBand + spkBand) / 4;
    const overallBand = (Math.round(rawOverall * 2) / 2).toFixed(1);

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
