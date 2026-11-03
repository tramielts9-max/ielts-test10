/**
 * diagnostic/js-diag/diag-listening.js
 * BỘ ĐIỀU KHIỂN LISTENING KHẢO THÍ CHUYÊN BIỆT (TEST 1, 2, 3 & 3 SET)
 * BẢN FULL ĐẦY ĐỦ 100% - BẢO TOÀN TẤT CẢ TÍNH NĂNG GỐC + HIGHLIGHT KHÔNG GIỚI HẠN
 */

export class DiagListeningEngine {
  constructor(options = {}) {
    this.containerId = options.containerId || 'listeningQuestionsMount';
    this.audioElementId = options.audioElementId || 'diagAudioPlayer';
    this.audioLabelId = options.audioLabelId || 'currentAudioLabel';

    this.testId = "test_01";
    this.setNum = 1;
    this.parts = [];
    this.audioUrl = "";
    this.activePartIndex = 0;

    // Bộ nhớ đáp án: { [qId]: "A" | "text" }
    this.userAnswers = {};
    this.metrics = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐA TẦNG (TEST 1 DÙNG 3 FILE GỐC, TEST 2 & 3 CHUẨN CAM)
  // =========================================================================
  async loadTestFromJson(jsonUrl) {
    const urlParams = new URLSearchParams(window.location.search);
    this.testId = urlParams.get('testId') || 'test_01';
    const rawSet = parseInt(urlParams.get('set') || urlParams.get('ver'), 10);
    this.setNum = (!isNaN(rawSet) && rawSet >= 1 && rawSet <= 3) ? rawSet : 1;

    this.parts = [];
    this.userAnswers = {};
    this.metrics = {};
    this.isReviewMode = false;

    // A. NẾU LÀ TEST 1: NẠP ĐÚNG FILE GỐC test1-listening-s1/s2/s3.json
    if (this.testId === 'test_01') {
      const t1Urls = [
        `data-diag/listening/test1-listening-s${this.setNum}.json`,
        jsonUrl
      ];
      for (const u of t1Urls) {
        try {
          const res = await fetch(`${u}?t=${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.parts)) {
              this.parts = data.parts;
              this.audioUrl = data.parts[0]?.audioUrl || "";
              return true;
            }
          }
        } catch (e) {}
      }
    }

    // B. THỬ NẠP FILE TỪ jsonUrl (FILE GỘP CŨ test2-listening-s*.json HOẶC test3)
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.parts) && data.parts.length > 0) {
          this.audioUrl = data.audioUrl || data.parts[0]?.audioUrl || "";
          this.parts = data.parts;
          this.parts.forEach(p => {
            if (!p.audioUrl && this.audioUrl) p.audioUrl = this.audioUrl;
          });
          return true;
        } else if (data.groups) {
          data.partNum = 1;
          this.audioUrl = data.audioUrl || "";
          this.parts = [data];
          return true;
        }
      }
    } catch (e) {}

    // C. NẾU LÀ CÁC FILE RỜI CAM 21 (cam21-lis-test*-p*.json)
    let partsToLoad = [1, 2];
    if (this.testId === 'test_03') partsToLoad = [3, 4];

    for (const pNum of partsToLoad) {
      const tryUrls = [
        `data-diag/listening/cam21-lis-test${this.setNum}-p${pNum}.json`,
        `../listening/data-l/cam21-lis-test${this.setNum}/cam21-lis-test${this.setNum}-p${pNum}.json`,
        `data-diag/listening/cam21-test${this.setNum}-p${pNum}.json`
      ];

      for (const u of tryUrls) {
        try {
          const res = await fetch(`${u}?t=${Date.now()}`);
          if (res.ok) {
            const partData = await res.json();
            partData.partNum = partData.partNum || pNum;
            if (!this.audioUrl && partData.audioUrl) this.audioUrl = partData.audioUrl;
            this.parts.push(partData);
            break;
          }
        } catch (e) {}
      }
    }

    return this.parts.length > 0;
  }

  // =========================================================================
  // 2. RENDER GIAO DIỆN PHÒNG THI NGHE ĐẦY ĐỦ
  // =========================================================================
  render() {
    const mount = document.getElementById(this.containerId);
    if (!mount) return;

    if (this.parts.length === 0) {
      mount.innerHTML = `
        <div style="background:#EFF6FF; border:2px solid #BFDBFE; border-radius:16px; padding:24px; text-align:center;">
          <h4 style="color:#0369A1; margin:0 0 8px 0; font-size:16px;">🎧 PHẦN KHẢO SÁT LISTENING</h4>
          <p style="color:#475569; font-size:13.5px; margin:0 0 16px 0;">Em có thể kiểm tra file âm thanh hoặc bấm tiếp tục sang bài Reading.</p>
          <button type="button" onclick="window.switchSkillSection('reading')" class="btn-3d btn-3d-blue">
            Tiếp tục sang phần Reading &rarr;
          </button>
        </div>
      `;
      return;
    }

    // Nạp link âm thanh của Part đầu tiên
    const audioEl = document.getElementById(this.audioElementId);
    const firstAudio = this.parts[0]?.audioUrl || this.audioUrl;
    if (audioEl && firstAudio) {
      audioEl.src = firstAudio;
      audioEl.preload = "auto";
    }

    let tabsHtml = '';
    if (this.parts.length > 1) {
      tabsHtml = `
        <div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap; align-items:center; background:#FFFFFF; border:2px solid #E8E2D8; border-radius:16px; padding:8px 12px;">
          <span style="font-size:12.5px; font-weight:900; color:#0369A1; text-transform:uppercase; margin-right:4px;">
            Chọn Phần Nghe:
          </span>
          ${this.parts.map((p, idx) => {
            const timeLabel = p.startTime ? ` (Từ ${this.formatSecondsToTime(p.startTime)})` : '';
            return `
              <button type="button" 
                      id="btnPartTab_${idx}" 
                      class="btn-3d ${idx === 0 ? 'btn-3d-blue' : 'btn-3d-white'}" 
                      style="padding:8px 16px; font-size:13px;"
                      onclick="window.diagListeningEngine.switchPart(${idx}, true)">
                Part ${p.partNum || idx + 1}${timeLabel}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    mount.innerHTML = `
      ${tabsHtml}
      <div id="activePartContainer"></div>

      <!-- KHUNG BĂNG KÝ ÂM TRANSCRIPT (HIỆN KHI REVIEW MODE) -->
      <div id="listeningTranscriptContainer" style="display:none; margin-top:24px; background:#FFFFFF; border:2px solid #BAE6FD; border-left:6px solid #0284C7; border-radius:16px; padding:20px 24px; max-height:480px; overflow-y:auto; line-height:1.8; font-size:14px;">
        <h4 style="margin:0 0 10px 0; color:#0284C7; font-size:16px; font-weight:900;">
          📜 BĂNG KÝ ÂM TRANSCRIPT (BẤM VÀO TỪNG CÂU ĐỂ TUA AUDIO ĐẾN ĐÚNG ĐOẠN ĐÓ):
        </h4>
        <div id="transcriptLinesMount"></div>
      </div>
    `;

    this.switchPart(0, false);
    this.initTextHighlighter(mount);
  }

  // =========================================================================
  // 3. CHUYỂN PART & TỰ ĐỘNG TUA / ĐỔI LINK AUDIO
  // =========================================================================
  switchPart(partIndex, shouldSeekAndPlay = true) {
    if (!this.parts[partIndex]) return;

    this.activePartIndex = partIndex;
    const part = this.parts[partIndex];

    this.parts.forEach((_, idx) => {
      const btn = document.getElementById(`btnPartTab_${idx}`);
      if (btn) btn.className = `btn-3d ${idx === partIndex ? 'btn-3d-blue' : 'btn-3d-white'}`;
    });

    const audioEl = document.getElementById(this.audioElementId);
    const labelEl = document.getElementById(this.audioLabelId);
    if (labelEl) {
      const timeStr = part.startTime ? ` (Từ ${this.formatSecondsToTime(part.startTime)})` : '';
      labelEl.innerText = `${part.title || `Part ${part.partNum || partIndex + 1}`}${timeStr}`;
    }

    // Đổi link âm thanh nếu Part đó dùng file MP3 riêng biệt (như ở Test 1)
    if (audioEl && part.audioUrl && audioEl.src !== part.audioUrl) {
      audioEl.src = part.audioUrl;
    }

    // Nhảy mốc giây nếu dùng chung 1 file MP3 dài (như ở Test 2, 3, 4)
    if (audioEl && shouldSeekAndPlay) {
      let seekTarget = part.startTime;
      if (seekTarget === undefined) {
        const firstQId = (part.groups?.[0]?.questionIds || [])[0];
        if (firstQId && part.questions?.[firstQId]?.time) {
          seekTarget = Math.max(0, part.questions[firstQId].time - 20);
        }
      }
      if (seekTarget !== undefined) {
        audioEl.currentTime = parseFloat(seekTarget);
        audioEl.play().catch(() => {});
      }
    }

    const container = document.getElementById('activePartContainer');
    if (container) {
      container.innerHTML = this.buildPartQuestionsHtml(part);
      this.restoreUserInputsUI(part);
    }

    const tMount = document.getElementById('transcriptLinesMount');
    if (tMount && part.transcriptHtml) {
      tMount.innerHTML = part.transcriptHtml;
      this.bindTranscriptClickEvents();
    }
  }

  // =========================================================================
  // 4. RENDER CÂU HỎI ĐẦY ĐỦ 100% CẢ 4 DẠNG (GIỮ NGUYÊN NÚT TUA CÂU & ANSWER BANK)
  // =========================================================================
  buildPartQuestionsHtml(part) {
    const replaySec = part.startTime || 0;
    let html = `
      <div style="border-bottom:2px solid #E8E2D8; padding-bottom:10px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <b style="font-size:16px; color:#0C4A6E;">${part.title || `Listening Part ${part.partNum || 1}`}</b>
        <button type="button" class="btn-3d btn-3d-white" style="padding:6px 14px; font-size:12px;" onclick="window.diagListeningEngine.seekAudio(${replaySec})">
          ▶ Phát lại từ đầu Part này (${this.formatSecondsToTime(replaySec)})
        </button>
      </div>
    `;

    // TRƯỜNG HỢP A: ĐỀ TEST 1 CỦA MÀY (CÂU HỎI NẰM DẠNG DICTIONARY part.questions)
    if (part.questions && !part.groups) {
      Object.entries(part.questions).forEach(([qId, q]) => {
        html += `
          <div class="q-item-box" id="box_${qId}" style="background:#FAF7F2; border:2px solid #E8E2D8; border-radius:16px; padding:18px; margin-bottom:14px;">
            <b style="font-size:14.5px; color:#1E293B; display:block; margin-bottom:10px;">${q.q || q.text || `Câu ${q.num}`}</b>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px;">
              ${(q.options || []).map(opt => {
                const letter = opt.charAt(0);
                return `
                  <label class="option-label" onclick="window.diagListeningEngine.recordAnswer('${qId}', '${letter}')">
                    <input type="radio" name="ans_${qId}" value="${letter}">
                    <span>${opt}</span>
                  </label>
                `;
              }).join('')}
            </div>
            <div id="fb_${qId}" style="display:none; font-size:12.5px; font-weight:800; margin-top:8px; padding:6px 10px; border-radius:8px;"></div>
          </div>
        `;
      });
      return html;
    }

    // TRƯỜNG HỢP B: ĐỀ CAMBRIDGE 21 (CÓ GROUPS, TEMPLATES, MAP, MATCHING)
    (part.groups || []).forEach(group => {
      html += `<div style="font-size:15px; font-weight:900; color:#1E293B; margin:16px 0 6px 0;">${group.title || ''}</div>`;
      if (group.instructions) {
        html += `<div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:10px; padding:8px 12px; font-size:13px; font-weight:700; color:#475569; margin-bottom:12px;">${group.instructions}</div>`;
      }

      // 1. Điền từ dạng Table hoặc Notes
      if (group.type === 'table' || group.type === 'notes' || group.tableHtml || group.template) {
        let contentBody = group.tableHtml || group.template || '';
        (group.questionIds || []).forEach(qId => {
          const q = (part.questions || {})[qId];
          const width = q?.inputWidth || "120px";
          const num = q?.num || qId.replace('q', '');
          const audioTimeBtn = q?.time ? `
            <button type="button" class="btn-3d btn-3d-white" style="padding:2px 7px; font-size:11px; margin-left:4px; vertical-align:middle;" onclick="window.diagListeningEngine.seekAudio(${q.time})">
              ▶ ${this.formatSecondsToTime(q.time)}
            </button>
          ` : '';

          const inputHtml = `
            <span style="display:inline-block; vertical-align:middle; margin:2px 0;">
              <input type="text" 
                     id="inp_${qId}" 
                     class="diag-input" 
                     style="width:${width}; padding:5px 8px; text-align:center; font-weight:800; color:#0284C7; display:inline-block; vertical-align:middle; margin:0 2px;" 
                     placeholder="[${num}]"
                     oninput="window.diagListeningEngine.recordAnswer('${qId}', this.value)">
              ${audioTimeBtn}
              <div id="fb_${qId}" style="display:none; font-size:12px; font-weight:800; padding:2px 6px; border-radius:4px; margin-top:2px;"></div>
            </span>
          `;
          contentBody = contentBody.replace(new RegExp(`{{${qId}}}`, 'g'), inputHtml);
        });

        html += `<div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:12px; padding:16px 18px; margin-bottom:18px; font-size:14px; line-height:1.85;">${contentBody}</div>`;

      // 2. Map Labelling
      } else if (group.type === 'map' || group.imageUrl) {
        const optsLetters = ['A','B','C','D','E','F','G','H','I','J'].slice(0, group.optionsCount || 9);
        const imgPath = group.imageUrl?.startsWith('../') ? group.imageUrl : (group.imageUrl?.startsWith('data-l/') ? `../listening/${group.imageUrl}` : (group.imageUrl || '../listening/data-l/images/cam21-t2-p2-map.png'));

        html += `
          <div style="background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:12px; text-align:center; margin-bottom:14px;">
            <img src="${imgPath}" alt="Map" style="max-width:100%; max-height:380px; border-radius:8px; border:1px solid #CBD5E1; object-fit:contain;">
          </div>
          <table style="width:100%; border-collapse:collapse; background:#FFFFFF; border:2px solid #E8E2D8; border-radius:12px; overflow:hidden; margin-bottom:18px;">
            <thead>
              <tr style="background:#FAF7F2;">
                <th style="padding:10px 12px; text-align:left; font-size:13.5px;">Địa điểm</th>
                ${optsLetters.map(l => `<th style="padding:10px 4px; text-align:center; font-size:13px;">${l}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${(group.questionIds || []).map(qId => {
                const q = (part.questions || {})[qId];
                const num = q?.num || qId.replace('q','');
                return `
                  <tr style="border-top:1px solid #E8E2D8;" id="row_${qId}">
                    <td style="padding:10px 12px; font-weight:800; font-size:13.5px;">
                      Câu ${num}: ${q?.text || ''}
                      ${q?.time ? `<button type="button" class="btn-3d btn-3d-white" style="padding:2px 6px; font-size:11px; margin-left:4px;" onclick="window.diagListeningEngine.seekAudio(${q.time})">▶</button>` : ''}
                      <div id="fb_${qId}" style="display:none; font-size:12px; font-weight:800; margin-top:2px;"></div>
                    </td>
                    ${optsLetters.map(letter => `
                      <td style="text-align:center; padding:4px;">
                        <input type="radio" name="ans_${qId}" value="${letter}" onchange="window.diagListeningEngine.recordAnswer('${qId}', '${letter}')" style="cursor:pointer; width:16px; height:16px; accent-color:#0284C7;">
                      </td>
                    `).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;

      // 3. Matching 2 Cột với Hộp Answer Bank
      } else if (group.type === 'matching' && Array.isArray(group.options)) {
        html += `
          <div style="display:flex; gap:18px; margin-bottom:18px; flex-wrap:wrap; align-items:flex-start;">
            <div style="flex:1.4; min-width:280px; display:flex; flex-direction:column; gap:8px;">
              ${(group.questionIds || []).map(qId => {
                const q = (part.questions || {})[qId];
                const num = q?.num || qId.replace('q','');
                return `
                  <div class="q-item-box" id="box_${qId}" style="margin-bottom:0; padding:12px 14px; background:#FFFFFF;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <b style="font-size:13.5px; color:#1E293B;">Câu ${num}: ${q?.text || ''}</b>
                      ${q?.time ? `<button type="button" class="btn-3d btn-3d-white" style="padding:2px 6px; font-size:11px;" onclick="window.diagListeningEngine.seekAudio(${q.time})">▶ ${this.formatSecondsToTime(q.time)}</button>` : ''}
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                      <span style="font-size:12.5px; font-weight:800; color:#64748B;">Đáp án chọn:</span>
                      <select id="sel_${qId}" class="diag-input" style="width:auto; min-width:180px; padding:6px 10px; font-size:13px; margin-top:0;" onchange="window.diagListeningEngine.recordAnswer('${qId}', this.value)">
                        <option value="">-- Chọn đáp án A-${String.fromCharCode(64 + group.options.length)} --</option>
                        ${group.options.map(opt => `<option value="${opt.key}">${opt.key}. ${opt.text}</option>`).join('')}
                      </select>
                    </div>
                    <div id="fb_${qId}" style="display:none; font-size:12px; font-weight:800; margin-top:4px;"></div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Answer Bank -->
            <div style="flex:1; min-width:240px; background:#FFFFFF; border:2px solid #E8E2D8; border-radius:14px; padding:14px; position:sticky; top:10px;">
              <b style="font-size:13.5px; color:#0369A1; display:block; margin-bottom:10px;">📋 ${group.optionsTitle || 'Danh mục lựa chọn'}:</b>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${group.options.map(opt => `
                  <div style="background:#FAF7F2; border:1px solid #CBD5E1; border-radius:8px; padding:6px 10px; font-size:13px; font-weight:700;">
                    <span style="background:#0284C7; color:white; padding:1px 6px; border-radius:4px; font-weight:900;">${opt.key}</span>
                    <span style="color:#1E293B; margin-left:4px;">${opt.text}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;

      // 4. Trắc nghiệm MCQ
      } else {
        (group.questionIds || []).forEach(qId => {
          const q = (part.questions || {})[qId];
          if (!q) return;
          const num = q.num || qId.replace('q','');

          html += `
            <div class="q-item-box" id="box_${qId}" style="background:#FAF7F2; margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <b style="font-size:14px; color:#1E293B;">Câu ${num}. ${q.text || ''}</b>
                ${q.time ? `<button type="button" class="btn-3d btn-3d-white" style="padding:2px 7px; font-size:11px;" onclick="window.diagListeningEngine.seekAudio(${q.time})">▶ ${this.formatSecondsToTime(q.time)}</button>` : ''}
              </div>
              ${q.options && Array.isArray(q.options) ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:6px;">
                  ${q.options.map(opt => {
                    const letter = opt.charAt(0);
                    return `
                      <label class="option-label" onclick="window.diagListeningEngine.recordAnswer('${qId}', '${letter}')">
                        <input type="radio" name="ans_${qId}" value="${letter}">
                        <span>${opt}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              ` : `
                <input type="text" class="diag-input" id="inp_${qId}" placeholder="Điền đáp án..." oninput="window.diagListeningEngine.recordAnswer('${qId}', this.value)">
              `}
              <div id="fb_${qId}" style="display:none; font-size:12px; font-weight:800; margin-top:6px;"></div>
            </div>
          `;
        });
      }
    });

    return html;
  }

  // =========================================================================
  // 5. GHI NHẬN ĐÁP ÁN & ĐỒNG BỘ GIAO DIỆN
  // =========================================================================
  recordAnswer(qId, val) {
    if (this.isReviewMode) return;
    this.userAnswers[qId] = String(val).trim();
  }

  restoreUserInputsUI(part) {
    Object.entries(this.userAnswers).forEach(([qId, val]) => {
      const inp = document.getElementById(`inp_${qId}`);
      if (inp) inp.value = val;

      const sel = document.getElementById(`sel_${qId}`);
      if (sel) sel.value = val;

      const radio = document.querySelector(`input[name="ans_${qId}"][value="${val}"]`);
      if (radio) radio.checked = true;
    });
  }

  seekAudio(seconds) {
    const audio = document.getElementById(this.audioElementId);
    if (audio && seconds !== undefined) {
      audio.currentTime = parseFloat(seconds);
      audio.play().catch(() => {});
    }
  }

  bindTranscriptClickEvents() {
    document.querySelectorAll('#transcriptLinesMount .transcript-line[data-time]').forEach(line => {
      line.style.cursor = 'pointer';
      line.title = 'Bấm để nghe từ đoạn này';
      line.onclick = () => {
        const t = line.getAttribute('data-time');
        if (t) this.seekAudio(parseFloat(t));
      };
    });
  }

  formatSecondsToTime(sec) {
    if (!sec && sec !== 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // =========================================================================
  // 6. CHẤM ĐIỂM CHUẨN XÁC TUYỆT ĐỐI (EVALUATE)
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
        let isCorrect = false;

        if (userVal && expected) {
          if (Array.isArray(expected)) {
            isCorrect = expected.some(a => String(a).toLowerCase().trim() === userVal.toLowerCase());
          } else {
            isCorrect = userVal.toLowerCase() === String(expected).toLowerCase().trim();
          }
        }

        if (isCorrect) score++;

        const expStr = Array.isArray(expected) ? expected.join(' / ') : String(expected);
        const qTitle = part.questions?.[qId]?.text || part.questions?.[qId]?.q || `Câu ${part.questions?.[qId]?.num || qId}`;

        const item = {
          questionId: qId,
          partNum: part.partNum || 1,
          userAnswer: userVal || "(Bỏ trống)",
          expectedAnswer: expStr,
          isCorrect: isCorrect,
          explanation: part.questions?.[qId]?.explanation?.steps?.join(' ') || ''
        };

        details.push(item);
        if (!isCorrect) {
          wrongList.push({
            num: part.questions?.[qId]?.num || qId,
            q: `${part.title || 'Listening'} - ${qTitle}`,
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

  // =========================================================================
  // 7. REVIEW MODE: BẬT TRANSCRIPT & TÔ MÀU ĐÚNG SAI KÈM GIẢI THÍCH
  // =========================================================================
  renderReviewMode(evalResult) {
    this.isReviewMode = true;
    this.userAnswers = evalResult.answersSnapshot || this.userAnswers;

    const tBox = document.getElementById('listeningTranscriptContainer');
    if (tBox) tBox.style.display = 'block';

    this.switchPart(0, false);

    (evalResult.details || []).forEach(item => {
      const fb = document.getElementById(`fb_${item.questionId}`);
      const inp = document.getElementById(`inp_${item.questionId}`);
      const box = document.getElementById(`box_${item.questionId}`);
      const row = document.getElementById(`row_${item.questionId}`);
      const sel = document.getElementById(`sel_${item.questionId}`);

      if (inp) {
        inp.style.borderColor = item.isCorrect ? '#22C55E' : '#EF4444';
        inp.style.backgroundColor = item.isCorrect ? '#F0FDF4' : '#FEF2F2';
        inp.disabled = true;
      }
      if (sel) {
        sel.style.borderColor = item.isCorrect ? '#22C55E' : '#EF4444';
        sel.disabled = true;
      }
      if (box) {
        box.style.border = `2px solid ${item.isCorrect ? '#22C55E' : '#EF4444'}`;
        box.style.background = item.isCorrect ? '#F0FDF4' : '#FEF2F2';
      }
      if (row) {
        row.style.backgroundColor = item.isCorrect ? '#F0FDF4' : '#FEF2F2';
      }
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = item.isCorrect ? '#166534' : '#DC2626';
        fb.innerHTML = `
          <div>${item.isCorrect ? '✓ Đúng' : `✗ Sai (Đáp án chuẩn: <b>${item.expectedAnswer}</b>)`}</div>
          ${item.explanation ? `<div style="font-size:11.5px; margin-top:2px; font-weight:normal; color:#475569;">💡 ${item.explanation}</div>` : ''}
        `;
      }
    });
  }

  // =========================================================================
  // 8. CÔNG CỤ HIGHLIGHT KHÔNG GIỚI HẠN (IELTS CBT TEXT HIGHLIGHTER)
  // =========================================================================
  initTextHighlighter(container) {
    if (!container || container._hasHighlighter) return;
    container._hasHighlighter = true;

    // Tạo popup nút highlight nổi
    let pop = document.getElementById('ielts_highlighter_pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'ielts_highlighter_pop';
      pop.style.cssText = `
        position: absolute; display: none; z-index: 99999;
        background: #1E293B; border-radius: 8px; padding: 4px 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25); gap: 4px; align-items: center;
      `;
      pop.innerHTML = `
        <button type="button" id="btnDoHighlight" style="background:#FEF08A; color:#854D0E; border:none; border-radius:5px; padding:4px 8px; font-weight:800; font-size:12px; cursor:pointer;">
          🖍 Tô vàng
        </button>
        <button type="button" id="btnClearHighlight" style="background:#475569; color:white; border:none; border-radius:5px; padding:4px 8px; font-weight:800; font-size:12px; cursor:pointer;">
          ✕ Xóa
        </button>
      `;
      document.body.appendChild(pop);
    }

    let savedRange = null;

    const checkSelection = (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        if (!pop.contains(e.target)) pop.style.display = 'none';
        return;
      }

      savedRange = sel.getRangeAt(0).cloneRange();
      const rect = savedRange.getBoundingClientRect();
      pop.style.top = `${window.scrollY + rect.top - 38}px`;
      pop.style.left = `${window.scrollX + rect.left + rect.width / 2 - 40}px`;
      pop.style.display = 'flex';
    };

    container.addEventListener('mouseup', checkSelection);
    container.addEventListener('touchend', checkSelection);

    document.getElementById('btnDoHighlight').onclick = () => {
      if (!savedRange) return;
      const span = document.createElement('mark');
      span.style.cssText = 'background:#FEF08A; color:inherit; padding:1px 2px; border-radius:3px; cursor:pointer;';
      span.className = 'ielts-user-highlight';
      span.title = 'Bấm để xóa highlight';
      span.onclick = (e) => {
        e.stopPropagation();
        const p = span.parentNode;
        while (span.firstChild) p.insertBefore(span.firstChild, span);
        p.removeChild(span);
      };
      try {
        savedRange.surroundContents(span);
      } catch (err) {
        document.execCommand('hiliteColor', false, '#FEF08A');
      }
      pop.style.display = 'none';
      window.getSelection().removeAllRanges();
    };

    document.getElementById('btnClearHighlight').onclick = () => {
      document.execCommand('removeFormat', false, null);
      pop.style.display = 'none';
      window.getSelection().removeAllRanges();
    };
  }
}

export const diagListeningEngine = new DiagListeningEngine();
window.diagListeningEngine = diagListeningEngine;
