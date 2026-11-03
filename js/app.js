/**
 * js/app.js - Điểm khởi động tập trung cho mọi bài Test
 * BẢN HOÀN THIỆN ĐẦY ĐỦ: TÍCH HỢP MODAL BÁO CÁO PHỤ HUYNH QUA ZALO (BÀI LẺ & CẢ NGÀY)
 */
import { CONFIG } from './config.js';
import { stateManager } from './state.js';
import { TestTimer } from './timer.js';
import { initHighlighting } from './highlight.js';
import { initResizer } from './resizer.js';
import { initAudioTranscriptSync } from './audio-sync.js';
import { askGemini } from './ai-assistant.js';
import { TestEvaluator } from './evaluator.js';

// 1. Font Size & Theme
let currentFontSize = parseInt(localStorage.getItem('ielts_font_size')) || 15;
applyFontSize(currentFontSize);

function applyFontSize(size) {
  document.documentElement.style.setProperty('--font-size-base', `${size}px`);
  document.querySelectorAll('.passage-box, .question-box').forEach(el => {
    el.style.fontSize = `${size}px`;
  });
}

window.changeFontSize = (delta) => {
  currentFontSize = Math.min(Math.max(currentFontSize + delta, 12), 24);
  applyFontSize(currentFontSize);
  localStorage.setItem('ielts_font_size', currentFontSize);
};

window.toggleTheme = () => {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('ielts_theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('btnThemeToggle');
  if (btn) btn.innerText = isDark ? '☀️ Sáng' : '🌙 Tối';
};

window.askGeminiAI = (qId) => askGemini(qId);
window.highlightText = (id) => {
  document.querySelectorAll('.hl-active').forEach(el => el.classList.remove('hl-active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('hl-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

async function initApp() {
  const isListening = !!document.querySelector('audio') || window.location.pathname.includes('lis') || window.location.search.includes('lis');

  const timer = new TestTimer('timerDisplay', (sec) => {
    if (sec % 5 === 0) collectAndSaveState();
  });
  window.startTimer = () => timer.start();
  window.pauseTimer = () => timer.pause();

  initHighlighting();
  initResizer();
  if (isListening) initAudioTranscriptSync();

  const user = stateManager.getUser();
  const nameInput = document.getElementById('studentNameInput');
  const emailInput = document.getElementById('studentEmailInput');
  if (nameInput && user.name) nameInput.value = user.name;
  if (emailInput && user.email) emailInput.value = user.email;

  const evaluator = new TestEvaluator(window.TEST_DATA);

  window.checkAnswers = async () => {
    const studentName = nameInput ? nameInput.value.trim() : "";
    const studentEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";

    if (!studentName || !studentEmail) {
      alert("⚠️ Vui lòng điền Họ tên và Email trước khi nộp bài!");
      return;
    }

    stateManager.saveUser(studentName, studentEmail);
    timer.stop();

    const evaluation = evaluator.evaluate();
    const scoreStr = `${evaluation.score}/${evaluation.total}`;
    
    const scoreBadge = document.getElementById('scoreBadge');
    const scoreText = document.getElementById('scoreText');
    if (scoreBadge) scoreBadge.style.display = 'block';
    if (scoreText) scoreText.innerText = scoreStr;

    document.body.classList.add('submitted-mode');
    document.getElementById('passageBox')?.classList.add('submitted');

    collectAndSaveState(true, scoreStr);
    
    // Gửi bài lên Google Drive và nhận phản hồi
    let cloudResult = null;
    try {
      cloudResult = await evaluator.submitToCloud(evaluation, studentName, studentEmail, timer.formatTime(timer.seconds));
    } catch (err) {
      console.warn("Lỗi lưu Cloud:", err);
    }

    // Lấy attemptId để tạo link bài lẻ
    const attemptId = (cloudResult && cloudResult.attemptId) ? cloudResult.attemptId : (evaluation.attemptId || `att_${Date.now()}`);
    
    // Bật Modal Báo Cáo Phụ Huynh (2 lựa chọn: Bài này HOẶC Cả ngày)
    showParentShareModal({
      studentName: studentName,
      studentEmail: studentEmail,
      scoreStr: scoreStr,
      attemptId: attemptId,
      testTitle: document.title || "Bài luyện tập IELTS"
    });
  };

  function collectAndSaveState(isSubmitted = false, scoreStr = '') {
    if (stateManager.isReviewMode) return;
    const state = {
      seconds: timer.seconds,
      isSubmitted: isSubmitted || document.body.classList.contains('submitted-mode'),
      scoreText: scoreStr || document.getElementById('scoreText')?.innerText || '',
      inputs: {},
      radios: {},
      thoughts: {},
      aiResponses: {}
    };
    document.querySelectorAll('input.fill-input').forEach(i => state.inputs[i.id] = i.value);
    document.querySelectorAll('input[type="radio"]:checked').forEach(r => state.radios[r.name] = r.value);
    document.querySelectorAll('.thought-box textarea').forEach(t => state.thoughts[t.id] = t.value);
    document.querySelectorAll('.ai-response').forEach(a => {
      if (a.innerHTML.trim() !== '') state.aiResponses[a.id] = a.innerHTML;
    });
    stateManager.saveTestProgress(state);
  }

  // Lắng nghe nhập liệu để tự động lưu tạm chống mất bài
  document.addEventListener('input', () => collectAndSaveState());
  document.addEventListener('change', () => collectAndSaveState());

  // ==========================================================================
  // KIỂM TRA CHẾ ĐỘ XEM LẠI BÀI TỪ GOOGLE DRIVE (REVIEW MODE CHO HỌC SINH HOẶC PHỤ HUYNH)
  // ==========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get('attemptId');
  const emailParam = urlParams.get('email');
  const isParentMode = urlParams.get('mode') === 'parent';

  if (attemptId && emailParam && CONFIG.DRIVE_STORAGE_URL) {
    try {
      const res = await fetch(CONFIG.DRIVE_STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_single_attempt", email: emailParam, attemptId: attemptId })
      });
      const data = await res.json();
      if (data?.attempt) {
        restoreReviewMode(data.attempt, timer, evaluator, isParentMode);
        return;
      }
    } catch (e) {
      console.warn("Không thể tải bài làm từ Cloud:", e);
    }
  }

  // Khôi phục bài đang làm dở từ LocalStorage (Chỉ khi không ở chế độ phụ huynh)
  if (!isParentMode) {
    const saved = stateManager.getSavedProgress();
    if (saved) {
      if (saved.seconds) timer.setTime(saved.seconds);
      if (saved.inputs) Object.entries(saved.inputs).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
      if (saved.radios) Object.entries(saved.radios).forEach(([name, val]) => { const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; });
      if (saved.thoughts) Object.entries(saved.thoughts).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
      if (saved.aiResponses) Object.entries(saved.aiResponses).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'block'; el.innerHTML = val; }
      });

      if (saved.isSubmitted) {
        evaluator.evaluate();
        document.body.classList.add('submitted-mode');
        document.getElementById('passageBox')?.classList.add('submitted');
        const scoreBadge = document.getElementById('scoreBadge');
        const scoreText = document.getElementById('scoreText');
        if (scoreBadge) scoreBadge.style.display = 'block';
        if (scoreText) scoreText.innerText = saved.scoreText;
        evaluator.renderPostSubmissionControls();
      }
    }
  }
}

// HÀM KHÔI PHỤC BÀI LÀM ĐÃ NỘP (CÓ TÙY BIẾN CHO PHỤ HUYNH)
function restoreReviewMode(attempt, timer, evaluator, isParentMode = false) {
  stateManager.isReviewMode = true;
  timer.stop();

  // 1. Thêm Banner thông báo
  const banner = document.createElement('div');
  if (isParentMode) {
    // Banner Xanh Lịch sự dành riêng cho Phụ Huynh
    banner.style.cssText = "background: #ECFDF5; color: #065F46; border: 2px solid #10B981; padding: 12px 18px; font-weight: 700; font-size: 14.5px; text-align: center; border-radius: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15); font-family: system-ui, sans-serif;";
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">📋</span>
        <span>BÁO CÁO PHỤ HUYNH — Học viên: <b>${attempt.studentName || 'Học viên'}</b> | Điểm số: <b style="color: #047857; font-size: 16px;">${attempt.score}</b> (${attempt.timestamp || 'Gần đây'})</span>
      </div>
      <div>
        <a href="../parent-report.html?email=${encodeURIComponent(attempt.studentEmail || '')}&mode=parent" style="background: #10B981; color: white; padding: 7px 14px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">📅 Xem Báo Cáo Cả Ngày</a>
      </div>
    `;
  } else {
    // Banner Vàng cho Học sinh xem lại
    banner.style.cssText = "background: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b; padding: 10px 16px; font-weight: 700; font-size: 14px; text-align: center; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;";
    banner.innerHTML = `
      <span>📜 ĐANG XEM LẠI BÀI (${attempt.timestamp}) — Điểm số: <b>${attempt.score}</b> (Học viên: ${attempt.studentName})</span>
      <div style="display:flex; gap:8px;">
        <button type="button" id="btnExitReview" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">🔄 Làm lại bài này</button>
        <a href="index.html" style="background: #b45309; color: white; padding: 6px 12px; text-decoration: none; border-radius: 6px; font-weight: bold;">🔙 Về Trang chủ</a>
      </div>
    `;
  }
  
  document.body.insertBefore(banner, document.body.firstChild);

  if (!isParentMode) {
    document.getElementById('btnExitReview')?.addEventListener('click', () => {
      stateManager.clearProgress();
      const cleanUrl = window.location.pathname + `?test=` + (new URLSearchParams(window.location.search).get('test') || '');
      window.location.href = cleanUrl;
    });
  }

  // 2. Điền lại toàn bộ dữ liệu & VÔ HIỆU HÓA chỉnh sửa
  if (attempt.inputs) {
    Object.entries(attempt.inputs).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.disabled = true; }
    });
  }
  if (attempt.radios) {
    Object.entries(attempt.radios).forEach(([name, val]) => {
      const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (el) el.checked = true;
    });
    document.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
  }
  if (attempt.thoughts) {
    Object.entries(attempt.thoughts).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.disabled = true; }
    });
  }
  if (attempt.aiResponses) {
    Object.entries(attempt.aiResponses).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'block'; el.innerHTML = val; }
    });
  }

  // 3. Hiển thị đáp án đúng/sai và lời giải
  evaluator.evaluate();
  document.body.classList.add('submitted-mode');
  document.getElementById('passageBox')?.classList.add('submitted');

  const scoreBadge = document.getElementById('scoreBadge');
  const scoreText = document.getElementById('scoreText');
  if (scoreBadge) scoreBadge.style.display = 'block';
  if (scoreText) scoreText.innerText = attempt.score;

  // Ẩn nút nộp bài
  document.querySelector('.btn-submit')?.remove();
}

// ==========================================================================
// MODAL BÁO CÁO PHỤ HUYNH THÔNG MINH (CHỌN GỬI BÀI LẺ HOẶC CẢ NGÀY)
// ==========================================================================
function showParentShareModal(info) {
  // Xóa modal cũ nếu đã tồn tại
  document.getElementById('parentShareModal')?.remove();

  const todayStr = new Date().toISOString().split('T')[0];
  const currentOrigin = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
  
  // 1. Link xem riêng bài vừa làm
  const singleAttemptUrl = `${window.location.origin}${window.location.pathname}?mode=parent&email=${encodeURIComponent(info.studentEmail)}&attemptId=${encodeURIComponent(info.attemptId)}`;
  
  // 2. Link xem bảng tổng kết cả ngày (tìm file parent-report.html ở thư mục gốc)
  const rootPath = window.location.pathname.includes('/') ? window.location.pathname.split('/')[1] : '';
  const dailyReportUrl = `${window.location.origin}/${rootPath ? rootPath + '/' : ''}parent-report.html?mode=parent&email=${encodeURIComponent(info.studentEmail)}&date=${todayStr}`;

  // Nội dung soạn sẵn cho 2 kịch bản
  const textSingle = `Dạ Ba/Mẹ, hôm nay con (${info.studentName}) vừa hoàn thành bài tập [${info.testTitle}] trên Trạm IELTS, kết quả đạt: ${info.scoreStr}.\nBa/Mẹ bấm vào link này xem chi tiết bài làm của con nhé:\n${singleAttemptUrl}`;
  const textDaily = `Dạ kính gửi Ba/Mẹ, hôm nay (${new Date().toLocaleDateString('vi-VN')}) con (${info.studentName}) đã hoàn thành bài tập theo lịch học Trạm IELTS.\nKính mời Ba/Mẹ bấm vào link sau để xem Bảng tổng kết kết quả học tập hôm nay của con:\n${dailyReportUrl}`;

  const modalHtml = `
    <div id="parentShareModal" style="position:fixed; inset:0; z-index:999999; background:rgba(15, 23, 42, 0.75); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
      <div style="background:#FFFFFF; border-radius:24px; max-width:480px; width:100%; padding:26px 22px; box-shadow:0 25px 50px rgba(0,0,0,0.3); border:2px solid #E2E8F0; position:relative;">
        
        <button type="button" onclick="document.getElementById('parentShareModal').remove()" style="position:absolute; top:16px; right:16px; background:#F1F5F9; border:none; width:34px; height:34px; border-radius:50%; font-weight:900; color:#64748B; cursor:pointer; font-size:16px;">✕</button>

        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:38px; margin-bottom:6px;">🎉</div>
          <h3 style="margin:0; font-size:20px; font-weight:900; color:#0F172A;">Nộp Bài Thành Công!</h3>
          <p style="margin:4px 0 0 0; font-size:14px; color:#475569; font-weight:600;">Kết quả của em: <b style="color:#0284C7; font-size:17px;">${info.scoreStr}</b></p>
        </div>

        <!-- TAB CHỌN CHẾ ĐỘ BÁO CÁO -->
        <div style="display:flex; background:#F1F5F9; border-radius:12px; padding:4px; margin-bottom:14px;">
          <button type="button" id="tabDailyBtn" onclick="window.switchShareTab('daily')" style="flex:1; padding:9px; border:none; border-radius:10px; font-weight:800; font-size:13px; cursor:pointer; background:#FFFFFF; color:#0F172A; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            📅 Báo Cáo Cả Ngày
          </button>
          <button type="button" id="tabSingleBtn" onclick="window.switchShareTab('single')" style="flex:1; padding:9px; border:none; border-radius:10px; font-weight:800; font-size:13px; cursor:pointer; background:transparent; color:#64748B;">
            📌 Báo Cáo Bài Này
          </button>
        </div>

        <!-- KHUNG NỘI DUNG TIN NHẮN TỰ ĐỘNG -->
        <div style="margin-bottom:16px;">
          <label style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; margin-bottom:6px; display:block;">Nội dung tin nhắn gửi Phụ Huynh:</label>
          <textarea id="shareMsgArea" readonly style="width:100%; height:110px; border:2px solid #CBD5E1; border-radius:12px; padding:10px; font-size:13px; font-family:inherit; color:#1E293B; line-height:1.5; resize:none; box-sizing:border-box; background:#F8FAFC; outline:none;"></textarea>
        </div>

        <!-- CÁC NÚT HÀNH ĐỘNG -->
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button type="button" id="btnCopyShare" onclick="window.copyShareMessage()" style="background:#0284C7; color:#FFFFFF; border:none; padding:12px 18px; border-radius:12px; font-weight:800; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:3px solid #0369A1;">
            📋 Sao Chép Tin Nhắn & Link
          </button>

          <a id="btnDirectZalo" href="https://zalo.me" target="_blank" style="background:#0068FF; color:#FFFFFF; text-decoration:none; padding:12px 18px; border-radius:12px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:3px solid #004EC4;">
            💬 Mở Zalo Để Dán Tin Nhắn
          </a>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Lưu biến toàn cục tạm thời để xử lý sự kiện nút bấm trong modal
  window.__shareState = {
    currentMode: 'daily',
    textDaily: textDaily,
    textSingle: textSingle
  };

  // Mặc định hiển thị tab Báo Cáo Cả Ngày
  const msgArea = document.getElementById('shareMsgArea');
  if (msgArea) msgArea.value = textDaily;
}

// HÀM CHUYỂN ĐỔI TAB GỬI BÁO CÁO
window.switchShareTab = function(mode) {
  const tabDaily = document.getElementById('tabDailyBtn');
  const tabSingle = document.getElementById('tabSingleBtn');
  const msgArea = document.getElementById('shareMsgArea');
  if (!window.__shareState || !msgArea) return;

  window.__shareState.currentMode = mode;

  if (mode === 'daily') {
    tabDaily.style.background = '#FFFFFF';
    tabDaily.style.color = '#0F172A';
    tabDaily.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';

    tabSingle.style.background = 'transparent';
    tabSingle.style.color = '#64748B';
    tabSingle.style.boxShadow = 'none';

    msgArea.value = window.__shareState.textDaily;
  } else {
    tabSingle.style.background = '#FFFFFF';
    tabSingle.style.color = '#0F172A';
    tabSingle.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';

    tabDaily.style.background = 'transparent';
    tabDaily.style.color = '#64748B';
    tabDaily.style.boxShadow = 'none';

    msgArea.value = window.__shareState.textSingle;
  }
};

// HÀM SAO CHÉP NỘI DUNG CHỐNG MỌI LỖI TRÊN ĐIỆN THOẠI
window.copyShareMessage = function() {
  const msgArea = document.getElementById('shareMsgArea');
  const copyBtn = document.getElementById('btnCopyShare');
  if (!msgArea) return;

  const textToCopy = msgArea.value;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      onCopySuccess(copyBtn);
    }).catch(() => {
      fallbackCopy(msgArea, copyBtn);
    });
  } else {
    fallbackCopy(msgArea, copyBtn);
  }
};

function fallbackCopy(textareaEl, copyBtn) {
  try {
    textareaEl.select();
    textareaEl.setSelectionRange(0, 99999);
    document.execCommand('copy');
    onCopySuccess(copyBtn);
  } catch (err) {
    alert("⚠️ Em hãy chạm giữ vào khung văn bản để chọn 'Sao chép' nhé!");
  }
}

function onCopySuccess(copyBtn) {
  if (copyBtn) {
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = "✅ Đã Sao Chép! Hãy Dán Vào Zalo";
    copyBtn.style.background = "#16A34A";
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      copyBtn.style.background = "#0284C7";
    }, 2500);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ==========================================================================
// BỘ MÁY SOCRATIC TIỆM TIẾN: BẤM GỬI LÀ HIỆN ĐÁP ÁN + MỞ NẤC TIẾP THEO
// ==========================================================================
window.checkSocratic = function(qId, stepIdx, guideAnswer, bridgeNext, finalAnswer) {
  const inputEl = document.getElementById(`${qId}_soc_in_${stepIdx}`);
  const fbEl = document.getElementById(`${qId}_soc_fb_${stepIdx}`);
  const nextStepEl = document.getElementById(`${qId}_soc_step_${stepIdx + 1}`);
  const badgeEl = document.getElementById(`socratic_badge_${qId}`);
  if (!fbEl) return;

  // 1. Khóa ô nhập và nút gửi của nấc hiện tại
  if (inputEl) inputEl.disabled = true;
  const btn = document.getElementById(`btn_${qId}_s${stepIdx}`);
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.cursor = "default";
  }

  // 2. Hiện ngay Lời giải hướng dẫn & Cầu nối dẫn dắt
  fbEl.style.display = "block";
  fbEl.innerHTML = `
    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; border-radius: 6px; margin-top: 8px; line-height: 1.6;">
      <div style="color: #166534; font-weight: 700; margin-bottom: 4px;">🎯 LỜI GIẢI HƯỚNG DẪN:</div>
      <div style="color: #1e293b;">${guideAnswer}</div>
      ${bridgeNext ? `<div style="margin-top: 6px; font-style: italic; color: #475569; font-size: 0.95em;">🌉 <i>${bridgeNext}</i></div>` : ''}
    </div>
  `;

  // 3. Mở khóa nấc tiếp theo
  if (nextStepEl) {
    nextStepEl.style.display = "block";
    if (badgeEl) badgeEl.innerText = `Nấc ${stepIdx + 1}/4`;
    const nextInput = document.getElementById(`${qId}_soc_in_${stepIdx + 1}`);
    if (nextInput) setTimeout(() => nextInput.focus(), 150);
  } else {
    // Đã qua nấc 4/4: Đánh dấu hoàn thành
    if (badgeEl) {
      badgeEl.innerText = `✓ Đã hoàn thành 4/4 nấc`;
      badgeEl.style.background = "#16a34a";
      badgeEl.style.color = "white";
    }

    // Tự động điền đáp án chuẩn vào bài làm chính
    if (finalAnswer) {
      const textInput = document.getElementById(`${qId}_input`);
      if (textInput) {
        textInput.value = finalAnswer;
        textInput.dispatchEvent(new Event('input'));
      }
      const radioBtn = document.querySelector(`input[name="${qId}"][value="${finalAnswer}"]`);
      if (radioBtn) {
        radioBtn.checked = true;
        radioBtn.dispatchEvent(new Event('change'));
      }
    }
  }
};
