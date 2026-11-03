/**
 * diagnostic/js-diag/diag-listening.js
 * BỘ ĐIỀU KHIỂN LISTENING KHẢO THÍ CHUYÊN BIỆT (TEST 1, 2, 3 & 3 SET XOAY TUA)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ TÍNH NĂNG NÀO
 * - TỰ ĐỘNG THÍCH ỨNG: NẠP FILE GỘP TEST2/3 HOẶC NẠP LIÊN HOÀN FILE RỜI P1, P2, P3, P4
 * - HỖ TRỢ ĐỦ 4 DẠNG: ĐIỀN BẢNG CÓ NÚT TUA GIÂY TỪNG CÂU, MAP LABELLING, MATCHING 2 CỘT CÓ ANSWER BANK, MCQ
 * - AUDIO CONTROLLER TỰ NHẢY STARTTIME THEO PART
 * - REVIEW MODE TÍCH HỢP TRANSCRIPT CLICK-TO-SEEK & GIẢI THÍCH CHI TIẾT
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

    // Bộ nhớ lưu đáp án học sinh: { [qId]: "A" | "text" }
    this.userAnswers = {};
    // Bộ đo phản xạ Telemetry
    this.metrics = {};
    this.isReviewMode = false;
  }

  // =========================================================================
  // 1. NẠP DỮ LIỆU ĐA TẦNG (HỖ TRỢ CẢ FILE GỘP CŨ VÀ FILE CAM 21 MỚI)
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

    // A. THỬ NẠP FILE TRỰC TIẾP TỪ ĐƯỜNG DẪN TRUYỀN VÀO (FILE GỘP test2-listening-s1.json)
    try {
      const res = await fetch(`${jsonUrl}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.parts) && data.parts.length > 0) {
          this.audioUrl = data.audioUrl || "";
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

    // B. NẾU KHÔNG CÓ FILE GỘP, TỰ TÌM CÁC FILE RỜI CAM 21 THEO TỪNG TEST
    // • Test 1: Khảo sát nền tảng -> Part 1
    // • Test 2: Nửa đầu đề thi -> Part 1 & Part 2
    // • Test 3: Nửa sau đề thi -> Part 3 & Part 4
    let partsToLoad = [1];
    if (this.testId === 'test_02') partsToLoad = [1, 2];
    if (this.testId === 'test_03') partsToLoad = [3, 4];

    for (const pNum of partsToLoad) {
      const tryUrls = [
        `data-diag/listening/cam21-lis-test${this.setNum}-p${pNum}.json`,
        `../listening/data-l/cam21-lis-test${this.setNum}/cam21-lis-test${this.setNum}-p${pNum}.json`,
        `data-diag/listening/cam21-test${this.setNum}-p${pNum}.json`,
        `data-diag/listening/test${this.testId.replace('test_0','')}-listening-s${this.setNum}.json`
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
        partData.partNum = partData.partNum || pNum;
        if (!this.audioUrl && partData.audioUrl) this.audioUrl = partData.audioUrl;
        this.parts.push(partData);
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
          <p style="color:#475569; font-size:13.5px; margin:0 0 16px 0;">Đang chuẩn bị file âm thanh. Em có thể bấm tiếp tục sang phần thi Reading bên dưới.</p>
          <button type="button" onclick="window.switchSkillSection('reading')" class="btn-3d btn-3d-blue">
            Tiếp tục sang phần Reading &rarr;
          </button>
        </div>
      `;
      return;
    }

    // Gán file âm thanh chung vào Audio Player
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

      <!-- KHUNG BĂNG KÝ ÂM TRANSCRIPT (TỰ ĐỘNG BẬT KHI NỘP BÀI) -->
      <div id="listeningTranscriptContainer" style="display:none; margin-top:24px; background:#FFFFFF; border:2px solid #BAE6FD; border-left:6px solid #0284C7; border-radius:16px; padding:20px 24px; max-height:480px; overflow-y:auto; line-height:1.8; font-size:14px;">
        <h4 style="margin:0 0 10px 0; color:#0284C7; font-size:16px; font-weight:900;">
          📜 BĂNG KÝ ÂM TRANSCRIPT (BẤM VÀO TỪNG CÂU ĐỂ TUA AUDIO ĐẾN ĐÚNG ĐOẠN ĐÓ):
        </h4>
        <div id="transcriptLinesMount"></div>
      </div>
    `;

    this.switchPart(0, false);
  }

  // =========================================================================
  // 3. CHUYỂN PART & TỰ ĐỘNG TUA AUDIO (SEEK TO STARTTIME)
  // =========================================================================
  switchPart(partIndex, shouldSeekAndPlay = true) {
    if (!this.parts[partIndex]) return;

    this.activePartIndex = partIndex;
    const part = this.parts[partIndex];

    // Cập nhật trạng thái Active trên nút Sub-tab
    this.parts.forEach((_, idx) => {
      const btn = document.getElementById(`btnPartTab_${idx}`);
      if (btn) {
        btn.className = `btn-3d ${idx === partIndex ? 'btn-3d-blue' : 'btn-3d-white'}`;
      }
    });

    // Cập nhật tiêu đề audio và thời gian bắt đầu
    const audioEl = document.getElementById(this.audioElementId);
    const labelEl = document.getElementById(this.audioLabelId);
    if (labelEl) {
      const timeStr = part.startTime ? ` (Từ ${this.formatSecondsToTime(part.startTime)})` : '';
      labelEl.innerText = `${part.title || `Part ${part.partNum || partIndex + 1}`}${timeStr}`;
    }

    // Đổi file âm thanh nếu từng part dùng file mp3 riêng
    if (audioEl && part.audioUrl && audioEl.src !== part.audioUrl) {
      audioEl.src = part.audioUrl;
    }

    // Nhảy mốc giây audio
    if (audioEl && shouldSeekAndPlay) {
      let seekTarget = part.startTime;
      if (seekTarget === undefined) {
        // Tự tìm mốc giây từ câu hỏi đầu tiên
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

    // Render nội dung câu hỏi
    const container = document.getElementById('activePartContainer');
    if (container) {
      container.innerHTML = this.buildPartQuestionsHtml(part);
      this.restoreUserInputsUI(part);
    }

    // Nạp Transcript nếu đang ở Review Mode
    const tMount = document.getElementById('transcriptLinesMount');
    if (tMount) {
      tMount.innerHTML = part.transcriptHtml || 'Bản ký âm transcript chưa sẵn sàng.';
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

    (part.groups || []).forEach(group => {
      html += `<div style="font-size:15px; font-weight:900; color:#1E293B; margin:16px 0 6px 0;">${group.title || ''}</div>`;
      if (group.instructions) {
        html += `<div style="background:#FAF7F2; border:1.5px solid #E8E2D8; border-radius:10px; padding:8px 12px; font-size:13px; font-weight:700; color:#475569; margin-bottom:12px;">${group.instructions}</div>`;
      }

      // A. ĐIỀN TỪ DẠNG BẢNG (TABLE) HOẶC NOTES (CÓ NÚT TUA GIÂY TỪNG CÂU)
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

      // B. DẠNG BẢN ĐỒ MAP LABELLING
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
                <th style="padding:10px 12px; text-align:left; font-size:13.5px;">Địa điểm cần xác định</th>
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

      // C. DẠNG NỐI THÔNG TIN MATCHING 2 CỘT (CÓ HỘP ANSWER BANK BÊN PHẢI)
      } else if (group.type === 'matching' && Array.isArray(group.options)) {
        html += `
          <div style="display:flex; gap:18px; margin-bottom:18px; flex-wrap:wrap; align-items:flex-start;">
            <!-- Cột trái: Câu hỏi + Menu chọn đáp án -->
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

            <!-- Cột phải: Ngân hàng đáp án (Answer Bank) -->
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

      // D. DẠNG TRẮC NGHIỆM MCQ (CÓ NÚT TUA GIÂY TỪNG CÂU)
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
  // 5. GHI NHỚ ĐÁP ÁN & ĐỒNG BỘ UI
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
  // 6. CHẤM ĐIỂM CHUẨN XÁC TUYỆT ĐỐI (EVALUATOR)
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
        const qTitle = part.questions?.[qId]?.text || `Câu ${part.questions?.[qId]?.num || qId}`;

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

    // Mở khung Transcript
    const tBox = document.getElementById('listeningTranscriptContainer');
    if (tBox) tBox.style.display = 'block';

    // Mở Part đầu tiên
    this.switchPart(0, false);

    // Tô viền xanh/đỏ cho các câu hỏi
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
}

export const diagListeningEngine = new DiagListeningEngine();
window.diagListeningEngine = diagListeningEngine;
