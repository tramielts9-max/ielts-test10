/**
 * diagnostic/js-diag/diag-listening.js
 * BỘ ĐIỀU KHIỂN LISTENING THÍCH ỨNG 3 TRONG 1 (TEST 1, TEST 2, TEST 3 & 3 SET XOAY TUA)
 * TỰ ĐỘNG NẠP TRỰC TIẾP FILE P1, P2, P3, P4 TỪ DATA-DIAG/LISTENING/ HOẶC DATA-L/
 * TỰ TUA AUDIO THEO PART, HỖ TRỢ MAP, MATCHING, MCQ & REVIEW TRANSCRIPT 3D DUOLINGO
 */

export class DiagListeningEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'listeningQuestionsMount';
    this.audioElementId = options.audioElementId || 'diagAudioPlayer';
    this.audioLabelId = options.audioLabelId || 'currentAudioLabel';

    this.testId = "test_01";
    this.setNum = 1;
    this.parts = [];
    this.activePartIdx = 0;
    this.userAnswers = {};
    this.metrics = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐỀ THI LINH HOẠT THEO TỪNG TEST VÀ SET
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    const urlParams = new URLSearchParams(window.location.search);
    this.testId = urlParams.get('testId') || 'test_01';
    const rawSet = parseInt(urlParams.get('set') || urlParams.get('ver'), 10);
    this.setNum = (!isNaN(rawSet) && rawSet >= 1 && rawSet <= 3) ? rawSet : 1;

    this.parts = [];
    this.userAnswers = {};
    this.isReviewMode = false;

    // XÁC ĐỊNH CÁC PART CẦN NẠP THEO Ý ĐỒ SƯ PHẠM:
    // • Test 1: Khảo sát nền tảng -> Part 1
    // • Test 2: Nửa đầu đề thi Cam -> Part 1 & Part 2
    // • Test 3: Nửa sau đề thi Cam -> Part 3 & Part 4
    let partsToLoad = [1];
    if (this.testId === 'test_02') partsToLoad = [1, 2];
    if (this.testId === 'test_03') partsToLoad = [3, 4];

    for (const pNum of partsToLoad) {
      const tryUrls = [
        `data-diag/listening/cam21-lis-test${this.setNum}-p${pNum}.json`,
        `data-diag/listening/cam21-test${this.setNum}-p${pNum}.json`,
        `../listening/data-l/cam21-lis-test${this.setNum}/cam21-lis-test${this.setNum}-p${pNum}.json`,
        jsonUrl
      ];

      let partData = null;
      for (const u of tryUrls) {
        try {
          const res = await fetch(`${u}?t=${Date.now()}`);
          if (res.ok) {
            partData = await res.json();
            break;
          }
        } catch (e) {}
      }

      if (partData) {
        partData.partNum = pNum;
        this.parts.push(partData);
      }
    }

    return this.parts.length > 0;
  }

  // =========================================================================
  // 2. RENDER GIAO DIỆN PHÒNG THI NGHE TRÀN VIỀN
  // =========================================================================
  render() {
    const mount = document.getElementById(this.containerId);
    if (!mount || this.parts.length === 0) return;

    // Tự động gán link audio của Part đầu tiên
    const audioEl = document.getElementById(this.audioElementId);
    if (audioEl && this.parts[0].audioUrl) {
      audioEl.src = this.parts[0].audioUrl;
    }

    let tabsHtml = '';
    if (this.parts.length > 1) {
      tabsHtml = `
        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
          ${this.parts.map((p, idx) => `
            <button type="button" id="btnLisSubPart_${idx}" 
              class="btn-3d ${idx === 0 ? 'btn-3d-blue' : 'btn-3d-white'}" 
              style="padding:8px 16px; font-size:13px;"
              onclick="window.diagListeningEngine.switchPart(${idx})">
              Part ${p.partNum}
            </button>
          `).join('')}
        </div>
      `;
    }

    mount.innerHTML = `
      ${tabsHtml}
      <div id="activeLisQuestionsMount"></div>
    `;

    this.switchPart(0);
  }

  // =========================================================================
  // 3. CHUYỂN PART & TỰ ĐỘNG TUA AUDIO ĐẾN ĐÚNG ĐOẠN
  // =========================================================================
  switchPart(idx) {
    this.activePartIdx = idx;
    const part = this.parts[idx];
    if (!part) return;

    this.parts.forEach((_, i) => {
      const btn = document.getElementById(`btnLisSubPart_${i}`);
      if (btn) btn.className = `btn-3d ${i === idx ? 'btn-3d-blue' : 'btn-3d-white'}`;
    });

    const labelEl = document.getElementById(this.audioLabelId);
    if (labelEl) labelEl.innerText = part.title || `Listening Part ${part.partNum}`;

    // Tìm mốc thời gian bắt đầu của Part để tua audio
    const audioEl = document.getElementById(this.audioElementId);
    if (audioEl) {
      let startTime = 0;
      // Trích xuất từ câu hỏi đầu tiên
      const firstQKey = (part.groups?.[0]?.questionIds || [])[0];
      if (firstQKey && part.questions?.[firstQKey]?.time) {
        startTime = Math.max(0, part.questions[firstQKey].time - 25);
      }
      if (startTime > 0 && Math.abs(audioEl.currentTime - startTime) > 10) {
        audioEl.currentTime = startTime;
      }
    }

    const box = document.getElementById('activeLisQuestionsMount');
    if (!box) return;

    box.innerHTML = this.renderPartContentHtml(part);
    this.restoreUserInputsUI(part);
  }

  // =========================================================================
  // 4. RENDER CHI TIẾT CÂU HỎI (TABLE, MAP, MATCHING, MCQ)
  // =========================================================================
  renderPartContentHtml(part) {
    let html = `<b style="font-size:16px; color:#0369A1; display:block; margin-bottom:12px;">${part.title}</b>`;

    (part.groups || []).forEach(g => {
      html += `<div style="font-size:15px; font-weight:900; margin:16px 0 6px 0; color:#1E293B;">${g.title}</div>`;
      if (g.instructions) {
        html += `<div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:10px; padding:8px 12px; font-size:13px; font-weight:700; color:#475569; margin-bottom:12px;">${g.instructions}</div>`;
      }

      // A. DẠNG BẢNG (TABLE) HOẶC NOTES (TEMPLATE CÓ {{q1}})
      if (g.tableHtml || g.template) {
        let content = g.tableHtml || g.template;
        (g.questionIds || []).forEach(qId => {
          const q = (part.questions || {})[qId];
          const width = q?.inputWidth || "120px";
          const num = q?.num || qId.replace('q', '');
          const inputHtml = `
            <input type="text" class="diag-input" id="inp_diag_lis_${qId}" 
              style="width:${width}; display:inline-block; padding:4px 8px; text-align:center; font-weight:800; color:#0284C7; margin:0 3px;" 
              placeholder="[${num}]" 
              oninput="window.diagListeningEngine.recordAnswer('${qId}', this.value)">
          `;
          content = content.replace(new RegExp(`{{${qId}}}`, 'g'), inputHtml);
        });
        html += `<div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:12px; padding:16px; font-size:14px; line-height:1.85; margin-bottom:16px;">${content}</div>`;

      // B. DẠNG BẢN ĐỒ MAP LABELLING
      } else if (g.type === 'map' || g.imageUrl) {
        const letters = ['A','B','C','D','E','F','G','H','I'].slice(0, g.optionsCount || 9);
        const imgPath = g.imageUrl?.startsWith('../') ? g.imageUrl : `../listening/${g.imageUrl}`;

        html += `
          <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:12px; text-align:center; margin-bottom:12px;">
            <img src="${imgPath}" alt="Map" style="max-width:100%; max-height:360px; border-radius:8px; border:1px solid #CBD5E1; object-fit:contain;">
          </div>
          <div style="overflow-x:auto; background:#FFFFFF; border:1.5px solid #E8E2D8; border-radius:12px; margin-bottom:16px;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#FAF7F2;">
                  <th style="padding:10px 12px; text-align:left;">Địa điểm cần xác định</th>
                  ${letters.map(l => `<th style="padding:10px 4px; text-align:center;">${l}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${(g.questionIds || []).map(qId => {
                  const q = (part.questions || {})[qId];
                  return `
                    <tr style="border-top:1px solid #E8E2D8;" id="diag_row_lis_${qId}">
                      <td style="padding:10px 12px; font-weight:800;">Câu ${q?.num || qId}. ${q?.text || ''}</td>
                      ${letters.map(l => `
                        <td style="text-align:center; padding:6px;">
                          <input type="radio" name="rad_diag_lis_${qId}" value="${l}" onchange="window.diagListeningEngine.recordAnswer('${qId}', '${l}')">
                        </td>
                      `).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

      // C. DẠNG NỐI THÔNG TIN MATCHING
      } else if (g.type === 'matching' && Array.isArray(g.options)) {
        html += `
          <div style="display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
            <div style="flex:1.4; min-width:280px; display:flex; flex-direction:column; gap:8px;">
              ${(g.questionIds || []).map(qId => {
                const q = (part.questions || {})[qId];
                return `
                  <div class="q-item-box" id="diag_box_lis_${qId}" style="margin-bottom:0; padding:12px 14px;">
                    <b style="font-size:13.5px; color:#1E293B;">Câu ${q?.num || qId}: ${q?.text || ''}</b>
                    <div style="margin-top:8px;">
                      <select id="sel_diag_lis_${qId}" class="diag-input" style="padding:6px 10px; font-size:13px;" onchange="window.diagListeningEngine.recordAnswer('${qId}', this.value)">
                        <option value="">-- Chọn đáp án A-${String.fromCharCode(64 + g.options.length)} --</option>
                        ${g.options.map(opt => `<option value="${opt.key}">${opt.key}. ${opt.text}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <!-- Hộp danh mục lựa chọn -->
            <div style="flex:1; min-width:240px; background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:14px; align-self:flex-start;">
              <b style="font-size:13px; color:#0369A1; display:block; margin-bottom:8px;">📋 ${g.optionsTitle || 'Danh mục lựa chọn'}:</b>
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

      // D. DẠNG TRẮC NGHIỆM MCQ (KỂ CẢ CHOOSE TWO)
      } else {
        (g.questionIds || []).forEach(qId => {
          const q = (part.questions || {})[qId];
          if (!q) return;

          html += `
            <div class="q-item-box" id="diag_box_lis_${qId}" style="margin-bottom:12px;">
              <b style="font-size:14px; color:#1E293B; display:block; margin-bottom:8px;">Câu ${q.num || qId}. ${q.text || ''}</b>
              ${q.options && Array.isArray(q.options) ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:6px;">
                  ${q.options.map(opt => {
                    const l = opt.charAt(0);
                    return `
                      <label class="option-label" onclick="window.diagListeningEngine.recordAnswer('${qId}', '${l}')">
                        <input type="radio" name="rad_diag_lis_${qId}" value="${l}">
                        <span>${opt}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              ` : `
                <input type="text" class="diag-input" id="inp_diag_lis_${qId}" placeholder="Điền đáp án..." oninput="window.diagListeningEngine.recordAnswer('${qId}', this.value)">
              `}
            </div>
          `;
        });
      }
    });

    return html;
  }

  recordAnswer(qId, val) {
    if (this.isReviewMode) return;
    this.userAnswers[qId] = String(val).trim();
  }

  restoreUserInputsUI(part) {
    Object.entries(this.userAnswers).forEach(([qId, val]) => {
      const inp = document.getElementById(`inp_diag_lis_${qId}`);
      if (inp) inp.value = val;

      const sel = document.getElementById(`sel_diag_lis_${qId}`);
      if (sel) sel.value = val;

      const rad = document.querySelector(`input[name="rad_diag_lis_${qId}"][value="${val}"]`);
      if (rad) rad.checked = true;
    });
  }

  seekAudio(sec) {
    const audio = document.getElementById(this.audioElementId);
    if (audio && sec !== undefined) {
      audio.currentTime = parseFloat(sec);
      audio.play().catch(() => {});
    }
  }

  // =========================================================================
  // 5. CHẤM ĐIỂM CHUẨN XÁC TUYỆT ĐỐI (EVALUATE)
  // =========================================================================
  evaluate() {
    let score = 0;
    let total = 0;
    const wrongList = [];
    const details = [];

    this.parts.forEach(part => {
      const answersMap = part.answers || {};
      const qKeys = Object.keys(answersMap);
      total += qKeys.length;

      qKeys.forEach(qId => {
        const expected = answersMap[qId];
        const userVal = (this.userAnswers[qId] || '').trim();
        const isCorrect = this.checkMatch(userVal, expected);

        if (isCorrect) score++;

        const expStr = Array.isArray(expected) ? expected.join(' / ') : String(expected);
        const qTitle = part.questions?.[qId]?.text || `Câu ${part.questions?.[qId]?.num || qId}`;

        const item = {
          questionId: qId,
          partNum: part.partNum,
          userAnswer: userVal || "(Bỏ trống)",
          expectedAnswer: expStr,
          isCorrect: isCorrect,
          explanation: part.questions?.[qId]?.explanation?.steps?.join(' ') || ''
        };

        details.push(item);
        if (!isCorrect) {
          wrongList.push({
            num: part.questions?.[qId]?.num || qId,
            q: `${part.title} - ${qTitle}`,
            chosen: userVal || "(Bỏ trống)",
            expected: expStr
          });
        }
      });
    });

    return {
      score,
      total,
      wrongList,
      details,
      answersSnapshot: this.userAnswers
    };
  }

  checkMatch(userVal, exp) {
    if (!userVal) return false;
    const u = userVal.toLowerCase().replace(/\s+/g, ' ').trim();

    if (Array.isArray(exp)) {
      return exp.some(e => {
        const cleanE = String(e).toLowerCase().replace(/\s+/g, ' ').trim();
        return u === cleanE;
      });
    }
    const cleanE = String(exp).toLowerCase().replace(/\s+/g, ' ').trim();
    return u === cleanE;
  }

  // =========================================================================
  // 6. CHẾ ĐỘ XEM LẠI 2 CỘT SPLIT SCREEN + THANH KÉO 3D DUOLINGO
  // =========================================================================
  renderReviewMode(evalResult) {
    this.isReviewMode = true;
    this.userAnswers = evalResult.answersSnapshot || this.userAnswers;

    const mount = document.getElementById(this.containerId);
    if (!mount || this.parts.length === 0) return;

    // Gộp toàn bộ Transcript các Part
    const fullTranscriptHtml = this.parts.map(p => `
      <div style="margin-bottom:20px;">
        <h4 style="color:#0284C7; border-bottom:2px solid #BAE6FD; padding-bottom:6px; margin:0 0 10px 0;">📜 ${p.title}</h4>
        <div>${p.transcriptHtml || 'Chưa có bản ký âm transcript.'}</div>
      </div>
    `).join('');

    mount.innerHTML = `
      <div id="lisSplitWrap" style="display:flex; height:calc(100vh - 215px); position:relative; user-select:none;">
        <!-- CỘT TRÁI: TRANSCRIPT BẤM NGHE TỪNG CÂU -->
        <div id="lisLeftPane" style="width:48%; height:100%; overflow-y:auto; background:#FFFFFF; border:2px solid #E8E2D8; border-left:6px solid #0284C7; border-radius:18px; padding:22px 24px; box-sizing:border-box; line-height:1.75; font-size:14px;">
          ${fullTranscriptHtml}
        </div>

        <!-- THANH KÉO 3D DUOLINGO -->
        <div id="lisResizerBar" style="width:20px; cursor:col-resize; display:flex; align-items:center; justify-content:center; z-index:10; flex-shrink:0;">
          <div style="width:34px; height:60px; background:#FFFFFF; border:2.5px solid #E8E2D8; border-bottom:5px solid #D3CBC0; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#0284C7; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <i class="fa-solid fa-arrows-left-right"></i>
          </div>
        </div>

        <!-- CỘT PHẢI: CÂU HỎI VÀ ĐÁP ÁN ĐÚNG SAI -->
        <div id="lisRightPane" style="flex:1; height:100%; overflow-y:auto; padding-right:4px; box-sizing:border-box;">
          <div id="activeLisQuestionsMount"></div>
        </div>
      </div>
    `;

    // Render lại câu hỏi Part đầu tiên
    this.switchPart(0);

    // Kích hoạt bấm dòng Transcript tua Audio
    document.querySelectorAll('#lisLeftPane .transcript-line[data-time]').forEach(line => {
      line.style.cursor = 'pointer';
      line.onclick = () => {
        const t = line.getAttribute('data-time');
        if (t) this.seekAudio(parseFloat(t));
      };
    });

    // Tô màu đúng/sai cho các câu hỏi
    (evalResult.details || []).forEach(d => {
      const inp = document.getElementById(`inp_diag_lis_${d.questionId}`);
      const row = document.getElementById(`diag_row_lis_${d.questionId}`);
      const box = document.getElementById(`diag_box_lis_${d.questionId}`);

      if (inp) {
        inp.disabled = true;
        inp.style.background = d.isCorrect ? '#DCFCE7' : '#FEE2E2';
        inp.style.borderColor = d.isCorrect ? '#16A34A' : '#DC2626';
        inp.style.color = d.isCorrect ? '#166534' : '#991B1B';
      }
      if (row) row.style.background = d.isCorrect ? '#F0FDF4' : '#FEF2F2';
      if (box) {
        box.style.borderColor = d.isCorrect ? '#86EFAC' : '#FCA5A5';
        box.style.background = d.isCorrect ? '#F0FDF4' : '#FFF5F5';
      }
    });

    this.initDraggableResizer('lisSplitWrap', 'lisLeftPane', 'lisResizerBar', 'lisRightPane');
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
        handle.style.background = '#F0F9FF';
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
}

export const diagListeningEngine = new DiagListeningEngine();
window.diagListeningEngine = diagListeningEngine;
