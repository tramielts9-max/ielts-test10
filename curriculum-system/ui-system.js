/**
 * curriculum-system/ui-system.js
 * GIAO DIỆN LỘ TRÌNH, LỊCH CHUYÊN CẦN & BANNER LỊCH SỬ PASTEL ĐỔI MÀU THEO HỌC PHẦN
 * (BẢN ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ TÍNH NĂNG NÀO)
 * TÍCH HỢP TOÀN DIỆN:
 *  1. TẠM KHÓA CẢNH CÁO HỌC VIÊN 1-CLICK & MỞ KHÓA VÀO LẠI TRONG 2 GIÂY
 *  2. HỆ THỐNG LỊCH HỌC TRỰC TIẾP (GOOGLE CALENDAR INTEGRATION): HIỂN THỊ BUỔI HỌC & XIN DỜI LỊCH
 */

import { curriculumEngineSystem } from './engine-system.js';
import { MASTER_CURRICULUM_SYSTEM } from './manifest-system.js';
import { analyzeStudentDiagnostic } from './ai-service-system.js';
import { CONFIG } from '../js/config.js';
import { stateManager } from '../js/state.js';

const CLOUD_SCRIPT_URL = CONFIG.DRIVE_STORAGE_URL;

// 👑 DANH SÁCH EMAIL CÓ QUYỀN ADMIN TỐI CAO BẤT KHẢ XÂM PHẠM
const HARDCODED_ADMIN_EMAILS = [
  "tramielts9@gmail.com",
  "dinhnguyenphuc019.2@gmail.com"
];

let diagRecognition = null;
let isDiagRecording = false;

class CurriculumUISystem {
  constructor() {
    curriculumEngineSystem.setNodes(MASTER_CURRICULUM_SYSTEM);
    this.calCurrentMonth = new Date().getMonth();
    this.calCurrentYear = new Date().getFullYear();
    this.cachedAttempts = [];
    this.cachedEmail = '';
    this.cachedSchedules = []; // 📅 Lưu trữ danh sách buổi học được đồng bộ từ Cloud
    this.selectedDateStr = this.getFormattedDate(new Date());
    this.isListCollapsed = false;
    this.targetStudentEmail = '';
    this.suppressCloudFetchForEmail = '';
    this.isForceEditing = false;
    this.studentLockCache = {}; // Lưu cache trạng thái khóa của học sinh
    this.activeRescheduleEventId = null;

    this.initSpeechSTT();
    this.injectRescheduleModal();
  }

  initSpeechSTT() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) return;

    diagRecognition = new window.SpeechRecognition();
    diagRecognition.continuous = true;
    diagRecognition.interimResults = true;
    diagRecognition.lang = 'vi-VN';

    diagRecognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      const area = document.getElementById('diagTextInput');
      if (area) area.value = (final + interim).trim();
    };

    diagRecognition.onerror = (e) => console.warn("STT Lỗi:", e.error);
  }

  // =========================================================================
  // 1. QUẢN LÝ PHIÊN ĐĂNG NHẬP, ĐÓNG VAI & PHÂN QUYỀN ADMIN TỐI CAO
  // =========================================================================
  isImpersonating() {
    return !!localStorage.getItem('ielts_impersonating_email');
  }

  getOriginalAdminEmail() {
    return localStorage.getItem('ielts_admin_backup_email') || 'tramielts9@gmail.com';
  }

  checkIsAdmin() {
    if (this.isImpersonating()) return true;

    const currentEmail = (localStorage.getItem('ielts_student_email') || '').toLowerCase().trim();
    const backupEmail = (localStorage.getItem('ielts_admin_backup_email') || '').toLowerCase().trim();

    const allAdminList = [
      ...HARDCODED_ADMIN_EMAILS,
      ...(CONFIG?.ADMIN_EMAILS || []).map(e => e.toLowerCase())
    ];

    const isMatch = currentEmail.includes('admin') ||
                    backupEmail.includes('admin') ||
                    allAdminList.includes(currentEmail) ||
                    allAdminList.includes(backupEmail);

    return isMatch;
  }

  getActiveWorkingEmail() {
    if (this.isImpersonating()) {
      return (localStorage.getItem('ielts_impersonating_email') || '').toLowerCase().trim();
    }
    if (this.checkIsAdmin() && this.targetStudentEmail) {
      return this.targetStudentEmail.toLowerCase().trim();
    }
    return (localStorage.getItem('ielts_student_email') || 'guest').toLowerCase().trim();
  }

  setTargetStudentEmail(email) {
    this.targetStudentEmail = (email || '').toLowerCase().trim();
    this.isForceEditing = false;
    this.render();
  }

  triggerEditRoadmap() {
    this.isForceEditing = true;
    this.render();
  }

  async startImpersonation(studentEmail) {
    const clean = (studentEmail || '').toLowerCase().trim();
    if (!clean || clean === 'guest') {
      alert("⚠️ Vui lòng nhập email học viên hợp lệ!");
      return;
    }
    const currentAdmin = localStorage.getItem('ielts_student_email') || 'tramielts9@gmail.com';
    if (!localStorage.getItem('ielts_admin_backup_email')) {
      localStorage.setItem('ielts_admin_backup_email', currentAdmin);
    }
    localStorage.setItem('ielts_impersonating_email', clean);
    localStorage.setItem('ielts_student_email', clean);
    this.targetStudentEmail = clean;

    await this.fetchStudentRoadmapFromCloud(clean);
    await this.fetchStudentHistoryFromCloud(clean);
    await this.fetchSchedules(clean);

    alert(`🎭 Đã chuyển sang chế độ điều khiển tài khoản học viên: ${clean}`);
    window.location.reload();
  }

  stopImpersonation() {
    const backup = this.getOriginalAdminEmail();
    localStorage.setItem('ielts_student_email', backup);
    localStorage.removeItem('ielts_impersonating_email');
    localStorage.removeItem('ielts_admin_backup_email');
    this.targetStudentEmail = '';
    this.isForceEditing = false;
    alert("⬅ Đã thoát khỏi tài khoản học viên. Trở về quyền Quản trị viên!");
    window.location.reload();
  }

  // =========================================================================
  // 2. TÍNH NĂNG TẠM KHÓA CẢNH CÁO & MỞ KHÓA 1-CLICK TRÊN CLOUD
  // =========================================================================
  async checkStudentAccess(email) {
    const clean = (email || '').toLowerCase().trim();
    if (!clean || clean === 'guest') return true;

    // Admin và tài khoản thuộc whitelist không bao giờ bị khóa
    if (HARDCODED_ADMIN_EMAILS.includes(clean) || clean.includes('admin')) return true;

    if (!CLOUD_SCRIPT_URL) return true;

    try {
      const response = await fetch(`${CLOUD_SCRIPT_URL}?action=check_student_access&studentId=${encodeURIComponent(clean)}`);
      if (response.ok) {
        const res = await response.json();
        // Mặc định nếu chưa bị gán "locked" thì là được học
        const isUnlocked = (res.isUnlocked !== false);
        this.studentLockCache[clean] = isUnlocked;
        return isUnlocked;
      }
    } catch(e) {}

    return this.studentLockCache[clean] !== false;
  }

  async toggleStudentLock(studentEmail, newStatus) {
    const clean = (studentEmail || '').toLowerCase().trim();
    if (!clean || clean === 'guest') {
      alert("⚠️ Vui lòng chọn học sinh trước khi thực hiện thao tác này!");
      return;
    }

    if (HARDCODED_ADMIN_EMAILS.includes(clean)) {
      alert("⚠️ Không thể khóa tài khoản Quản trị viên tối cao!");
      return;
    }

    const isLocking = (newStatus === 'locked');
    const confirmMsg = isLocking
      ? `⚠️ Bạn có chắc muốn TẠM KHÓA học viên [${clean}] để cảnh cáo BTVN không?`
      : `✅ Bạn có muốn MỞ KHÓA cho học viên [${clean}] tiếp tục học không?`;

    if (!confirm(confirmMsg)) return;

    try {
      if (CLOUD_SCRIPT_URL) {
        await fetch(CLOUD_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "admin_set_student_status",
            studentId: clean,
            status: newStatus
          })
        });
      }

      this.studentLockCache[clean] = !isLocking;
      alert(isLocking 
        ? `🚫 Đã TẠM KHÓA học viên [${clean}]. Máy học sinh sẽ hiện bảng cảnh cáo ngay lập tức!` 
        : `🔓 Đã MỞ KHÓA thành công cho học viên [${clean}]! Học sinh có thể vào học lại ngay.`
      );
      this.render();
    } catch(e) {
      alert("Lỗi kết nối máy chủ: " + e.message);
    }
  }

  // HỌC SINH TỰ BẤM KIỂM TRA ĐỂ VÀO LẠI KHI THẦY ĐÃ MỞ KHÓA
  async checkReentry() {
    const email = (localStorage.getItem('ielts_student_email') || 'guest').toLowerCase().trim();
    const btn = document.getElementById('btnCheckReentry');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "⏳ Đang kiểm tra quyền truy cập...";
    }

    delete this.studentLockCache[email];
    const isUnlocked = await this.checkStudentAccess(email);

    if (isUnlocked) {
      alert("🎉 Chào mừng em quay trở lại! Quyền truy cập đã được mở khóa hoàn toàn.");
      window.location.reload();
    } else {
      alert("⚠️ Thầy chưa mở khóa trên hệ thống. Em hãy nhắn tin báo Thầy kiểm tra rồi bấm lại nhé!");
      if (btn) {
        btn.disabled = false;
        btn.innerText = "🔄 Thầy đã mở khóa, bấm để vào học tiếp";
      }
    }
  }

  // =========================================================================
  // 3. CÔ LẬP BỘ NHỚ LỊCH SỬ & KÉO DỮ LIỆU TỪ CLOUD
  // =========================================================================
  getStorageKey(email) {
    const clean = (email || this.getActiveWorkingEmail()).toLowerCase().trim();
    return `ielts_roadmap_data_${clean}`;
  }

  getSavedRoadmap(email) {
    try {
      const target = (email || this.getActiveWorkingEmail()).toLowerCase().trim();
      const raw = localStorage.getItem(this.getStorageKey(target));
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }

  saveRoadmap(email, data) {
    const target = (email || this.getActiveWorkingEmail()).toLowerCase().trim();
    localStorage.setItem(this.getStorageKey(target), JSON.stringify(data));
    this.syncRoadmapToCloud(target, data);
  }

  syncRoadmapToCloud(email, roadmapData) {
    if (!CLOUD_SCRIPT_URL) return;
    try {
      fetch(CLOUD_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "save_student_roadmap",
          studentEmail: email,
          roadmap: roadmapData
        })
      }).catch(() => {});
    } catch(e) {}
  }

  async fetchStudentRoadmapFromCloud(email) {
    if (!CLOUD_SCRIPT_URL || !email || email === 'guest') return null;
    try {
      const response = await fetch(`${CLOUD_SCRIPT_URL}?action=get_student_roadmap&studentEmail=${encodeURIComponent(email)}`);
      if (response.ok) {
        const cloudData = await response.json();
        if (cloudData && cloudData.roadmap) {
          localStorage.setItem(this.getStorageKey(email), JSON.stringify(cloudData.roadmap));
          return cloudData.roadmap;
        }
      }
    } catch(e) {}
    return null;
  }

  async fetchStudentHistoryFromCloud(email) {
    if (!CLOUD_SCRIPT_URL || !email || email === 'guest') return [];
    try {
      const response = await fetch(`${CLOUD_SCRIPT_URL}?action=get_student_history&studentEmail=${encodeURIComponent(email)}`);
      if (response.ok) {
        const cloudData = await response.json();
        const attempts = cloudData.attempts || [];
        localStorage.setItem(`ielts_history_${email}`, JSON.stringify(attempts));
        return attempts;
      }
    } catch(e) {}
    return [];
  }

  // 📅 ĐỒNG BỘ LỊCH HỌC TỪ CLOUD CHO HỌC SINH HIỆN TẠI
  async fetchSchedules(email) {
    if (!CLOUD_SCRIPT_URL || !email || email === 'guest') return [];
    try {
      const res = await fetch(CLOUD_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_schedules", userEmail: email })
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.events)) {
        this.cachedSchedules = data.events;
        localStorage.setItem(`ielts_schedules_${email}`, JSON.stringify(this.cachedSchedules));
        return this.cachedSchedules;
      }
    } catch(e) {
      // Fallback về bộ nhớ local nếu mất mạng
      try {
        const local = localStorage.getItem(`ielts_schedules_${email}`);
        if (local) this.cachedSchedules = JSON.parse(local);
      } catch(err) {}
    }
    return this.cachedSchedules;
  }

  getNodeCompletionInfo(node, specifiedEmail = null) {
    try {
      const activeEmail = (specifiedEmail || this.getActiveWorkingEmail()).toLowerCase().trim();
      const adminEmail = (localStorage.getItem('ielts_admin_backup_email') || 'tramielts9@gmail.com').toLowerCase().trim();
      
      let history = [];
      const isViewingStudent = this.isImpersonating() || 
                               (this.checkIsAdmin() && this.targetStudentEmail && this.targetStudentEmail !== adminEmail) ||
                               (specifiedEmail && specifiedEmail !== adminEmail);

      if (isViewingStudent) {
        const studentRaw = localStorage.getItem(`ielts_history_${activeEmail}`);
        history = studentRaw ? JSON.parse(studentRaw) : [];
      } else {
        history = stateManager.getLocalHistory() || [];
      }

      const matches = history.filter(item => {
        if (!item) return false;
        const t = (item.testTitle || '').toLowerCase();
        const nTitle = (node.title || '').toLowerCase();
        const nId = (node.id || '').toLowerCase();
        const u = (item.pageUrl || '').toLowerCase();
        const nu = (node.url || '').toLowerCase();

        const matchId = nId && t.includes(nId);
        const matchTitle = (nTitle && t.includes(nTitle)) || (t && nTitle.includes(t));
        const matchUrl = nu && u && (u.includes(nu) || nu.includes(u));
        const codeInNode = node.url?.match(/[\d]+[\-\.][\d]+/)?.[0];
        const matchCode = codeInNode && t.includes(codeInNode);

        return matchId || matchTitle || matchUrl || matchCode;
      });

      if (matches.length > 0) {
        matches.sort((a, b) => stateManager.extractEpoch(a) - stateManager.extractEpoch(b));
        const first = matches[0];
        const latest = matches.length > 1 ? matches[matches.length - 1] : null;

        return {
          isCompleted: true,
          totalAttempts: matches.length,
          firstAttempt: {
            score: first.score || 'Đã nộp',
            timeSpent: first.timeSpent && first.timeSpent !== 'N/A' ? first.timeSpent : 'Hoàn thành',
            timestamp: first.timestamp || ''
          },
          latestAttempt: latest ? {
            score: latest.score || 'Đã nộp',
            timeSpent: latest.timeSpent && latest.timeSpent !== 'N/A' ? latest.timeSpent : 'Hoàn thành',
            timestamp: latest.timestamp || ''
          } : null
        };
      }
    } catch(e) {}
    return { isCompleted: false, totalAttempts: 0 };
  }

  isNodeCompletedInHistory(node) {
    return this.getNodeCompletionInfo(node).isCompleted;
  }

  getModuleTheme(moduleType, url = '', title = '') {
    const detected = moduleType || stateManager.detectModuleType(url, title);
    return CONFIG.MODULES[detected]?.theme || {
      bg: "#F8FAFC",
      border: "#E2E8F0",
      tagBg: "#64748B",
      text: "#1E293B",
      label: "Luyện Tập"
    };
  }

  toggleMicrophone() {
    if (!diagRecognition) {
      alert("⚠️ Trình duyệt không hỗ trợ nhận diện giọng nói. Em hãy gõ trực tiếp nhé!");
      return;
    }
    const btn = document.getElementById('btnDiagMic');
    const status = document.getElementById('diagMicStatus');

    if (!isDiagRecording) {
      try {
        diagRecognition.start();
        isDiagRecording = true;
        btn.classList.add('recording');
        btn.innerHTML = `<i class="fa-solid fa-stop"></i> Đang nghe... Bấm để Dừng`;
        if (status) status.innerText = "🔴 Đang lắng nghe giọng nói...";
      } catch (e) {}
    } else {
      try {
        diagRecognition.stop();
        isDiagRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Bấm để nói tự thuật trình độ`;
        if (status) status.innerText = "✅ Đã nhận diện xong!";
      } catch (e) {}
    }
  }

  handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const area = document.getElementById('diagTextInput');
      if (area) area.value = e.target.result;
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // 4. CHẨN ĐOÁN AI & NẠP HẠN NGẠCH 75% ĐỀ THI THẬT + VÒNG LẶP 3 NGÀY
  // =========================================================================
  async runAIDiagnostic() {
    const text = document.getElementById('diagTextInput')?.value.trim();
    if (!text) {
      alert("⚠️ Em vui lòng nói vào micro hoặc dán báo cáo trước khi chẩn đoán nhé!");
      return;
    }
    const btn = document.getElementById('btnStartAIAnalyze');
    btn.disabled = true;
    btn.innerHTML = `⏳ AI Gemini đang băm lộ trình 5 chặng & khóa hạn ngạch đề thật...`;

    try {
      const result = await analyzeStudentDiagnostic(text);
      btn.disabled = false;
      btn.innerHTML = `⚡ Chẩn đoán lại`;

      const resBox = document.getElementById('diagAIResultContainer');
      resBox.style.display = 'block';

      const startB = parseFloat(result.estimated_band) || 2.0;
      const parsedTarget = parseFloat(result.target_band);
      const targetB = Math.min(7.0, !isNaN(parsedTarget) ? parsedTarget : 7.0);

      const pruned = curriculumEngineSystem.pruneCurriculumByBands(startB, targetB, result);
      const savedCount = MASTER_CURRICULUM_SYSTEM.length - pruned.length;
      const stats = curriculumEngineSystem.calculateSessionsByBands(startB, targetB);

      const targetEmail = this.getActiveWorkingEmail();
      const isAdmin = this.checkIsAdmin();
      const quota = result.quota_policy || {};

      let badgesHtml = '';
      if (result.schedule_mode === 'SEQUENTIAL_PHASES') {
        badgesHtml += `<span style="background:#dbeafe; color:#1d4ed8; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12px;">📚 LỘ TRÌNH 5 CHẶNG TUẦN TỰ</span> `;
      }
      if (result.vocab_requirement === 'FULL_100_PERCENT') {
        badgesHtml += `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12px;">📖 HỌC SẠCH 100% TỪ VỰNG (28 UNIT)</span> `;
      }
      if (quota.min_official_exam_ratio) {
        badgesHtml += `<span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12px;">🛡️ HẠN NGẠCH ${Math.round(quota.min_official_exam_ratio * 100)}% ĐỀ THI THẬT</span> `;
      }
      if (quota.review_interval_days) {
        badgesHtml += `<span style="background:#f3e8ff; color:#7e22ce; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12px;">🔄 ÔN TẬP DUY TRÌ: ${quota.review_interval_days} NGÀY/ĐỀ CAM</span> `;
      }
      if (quota.prohibited_levels && quota.prohibited_levels.length > 0) {
        badgesHtml += `<span style="background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12px;">🚫 ĐÃ CHẶN BÀI VỠ LÒNG: ${quota.prohibited_levels.join(', ')}</span> `;
      }
      if (result.bottleneck_skill) {
        badgesHtml += `<span style="background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12px;">🚨 Điểm nghẽn: ${result.bottleneck_skill}</span> `;
      }
      if (result.pruned_domains && result.pruned_domains.length > 0) {
        badgesHtml += `<span style="background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:8px; font-weight:800; font-size:12px;">✂️ Gọt bỏ: ${result.pruned_domains.join(', ')}</span> `;
      }

      let constraintsHtml = '';
      if (result.pedagogical_constraints && result.pedagogical_constraints.length > 0) {
        constraintsHtml = `
          <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:10px; padding:10px 14px; margin:10px 0; font-size:13px; color:#92400e;">
            <b>📌 Chỉ thị sư phạm đặc trị từ Gemini:</b>
            <ul style="margin:4px 0 0 16px; padding:0; line-height:1.5;">
              ${result.pedagogical_constraints.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      resBox.innerHTML = `
        <div class="cs-ai-report-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <b style="color:#166534; font-size:15px;">🎯 KẾT QUẢ ĐIỀU PHỐI TỪ AI GEMINI</b>
            <span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:20px; font-weight:800; font-size:12px;">
              Band ước lượng: ~${startB} ➔ Mục tiêu: ${targetB}
            </span>
          </div>
          
          ${isAdmin ? `
            <div style="background:#e0f2fe; color:#0369a1; padding:6px 12px; border-radius:8px; font-size:13px; font-weight:800; margin-top:8px;">
              👤 Đang thiết lập lộ trình riêng cho học viên: <u>${targetEmail}</u>
            </div>
          ` : ''}

          <p style="font-size:13.5px; color:#1e293b; margin:10px 0; line-height:1.5;">
            <b>Nhận xét:</b> ${result.academic_summary}
          </p>

          ${badgesHtml ? `<div style="margin-bottom:8px; display:flex; flex-wrap:wrap; gap:6px;">${badgesHtml}</div>` : ''}
          ${constraintsHtml}

          <div style="display:flex; gap:12px; font-size:13px; color:#64748b; flex-wrap:wrap; margin-bottom:12px;">
            <span>✂️ Gọt bỏ: <b>${savedCount} bài thừa</b></span>
            <span>🏫 Khóa học: <b>${stats.sessions} buổi</b> (${stats.months} tháng)</span>
            <span>⏱️ BTVN: <b>${stats.days} ngày</b> (${stats.hours}h tự cày)</span>
          </div>

          <button type="button" onclick="window.curriculumUI.applyBandRoadmap(${startB}, ${targetB}, ${JSON.stringify(result).replace(/"/g, '&quot;')})" style="background:#16a34a; color:white; border:none; padding:12px 18px; border-radius:12px; font-weight:900; font-size:14px; cursor:pointer; width:100%; box-shadow:0 3px 0 #15803d;">
            🚀 Phê Duyệt & Kích Hoạt Lộ Trình Này Cho [${targetEmail}]
          </button>
        </div>
      `;
    } catch (e) {
      alert("Lỗi phân tích: " + e.message);
      btn.disabled = false;
      btn.innerHTML = `⚡ Bắt đầu chẩn đoán bằng AI Gemini`;
    }
  }

  applyBandRoadmap(startBand, targetBand, aiData = null) {
    const targetEmail = this.getActiveWorkingEmail();
    const sBand = parseFloat(startBand) || 0.0;
    const tBand = Math.min(7.0, parseFloat(targetBand) || 7.0);

    if (sBand >= tBand) {
      alert("⚠️ Điểm mục tiêu mong muốn (Target Band) phải lớn hơn Điểm hiện tại của em ít nhất 0.5 Band nhé!");
      return;
    }

    const isAdmin = this.checkIsAdmin();
    const retainedNodes = curriculumEngineSystem.pruneCurriculumByBands(sBand, tBand, aiData || {});
    const totals = curriculumEngineSystem.calculateTotals(retainedNodes, 'normal', 1.5, sBand, tBand);
    const scheduleData = curriculumEngineSystem.generateDailyCalendar(retainedNodes, 'normal', 1.5, sBand, tBand, aiData || {});

    const payload = {
      createdAt: new Date().toISOString(),
      studentEmail: targetEmail,
      startBand: sBand,
      targetBand: tBand,
      speedProfile: 'normal',
      dailyHours: 1.5,
      currentDay: 1,
      totals,
      schedule: scheduleData.dailySchedule,
      completedNodeIds: [],
      aiDiagnosticData: aiData,
      isLockedByAdmin: isAdmin
    };

    this.saveRoadmap(targetEmail, payload);
    this.isForceEditing = false;
    this.suppressCloudFetchForEmail = '';
    alert(`✅ Đã phê duyệt và kích hoạt lộ trình 5 chặng (${totals.totalLiveSessions} buổi - ${totals.totalDays} ngày) cho học viên: ${targetEmail}!`);
    this.render();
  }

  // NÚT ĐẶT LẠI: XÓA SẠCH VÀ NHẢY VỀ FORM THIẾT LẬP
  resetRoadmap() {
    const email = this.getActiveWorkingEmail();
    const isAdmin = this.checkIsAdmin();
    const data = this.getSavedRoadmap(email);

    if (data?.isLockedByAdmin && !isAdmin) {
      alert("🔒 Lộ trình này đã được Giáo viên phê duyệt và khóa bảo vệ. Em không thể tự ý đặt lại!");
      return;
    }

    if (confirm(`⚠️ Bạn có chắc muốn XÓA LỘ TRÌNH và thiết lập lại từ đầu cho [${email}] không?`)) {
      localStorage.removeItem(this.getStorageKey(email));
      this.syncRoadmapToCloud(email, null);
      this.suppressCloudFetchForEmail = email;
      this.isForceEditing = true;
      this.render();
    }
  }

  // =========================================================================
  // 5. THANH ĐIỀU PHỐI ADMIN VỚI NÚT KHÓA/MỞ KHÓA HỌC VIÊN 1-CLICK
  // =========================================================================
  renderAdminControlBar() {
    if (!this.checkIsAdmin() && !this.isImpersonating()) return '';

    const currentTarget = this.targetStudentEmail || 'Chính mình (Mặc định)';
    const isTargetLocked = this.targetStudentEmail ? (this.studentLockCache[this.targetStudentEmail] === false) : false;

    return `
      <div style="background:#8B1518; color:white; border-radius:14px; padding:12px 18px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 3px 0 #5E0C0E;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">👑</span>
          <div>
            <b style="font-size:14px;">BẢNG ĐIỀU PHỐI GIÁO VIÊN / ADMIN</b>
            <div style="font-size:12px; opacity:0.9;">
              Đang can thiệp cho: <b style="color:#FCD34D;">${currentTarget}</b>
              ${this.targetStudentEmail ? (isTargetLocked ? ' <span style="background:#DC2626; color:white; padding:1px 6px; border-radius:4px; font-size:11px; font-weight:900;">ĐANG BỊ KHÓA</span>' : ' <span style="background:#16A34A; color:white; padding:1px 6px; border-radius:4px; font-size:11px; font-weight:900;">HOẠT ĐỘNG</span>') : ''}
            </div>
          </div>
        </div>
        
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <input type="email" id="adminTargetEmailInput" placeholder="Nhập email học sinh..." value="${this.targetStudentEmail}" style="padding:7px 12px; border-radius:8px; border:none; font-size:13px; font-weight:700; width:210px; color:#1e293b;">
          
          <button type="button" onclick="window.curriculumUI.setTargetStudentEmail(document.getElementById('adminTargetEmailInput').value)" style="background:#FCD34D; color:#8B1518; border:none; padding:7px 12px; border-radius:8px; font-weight:900; font-size:12px; cursor:pointer;">
            🎯 Chọn HS
          </button>

          ${this.targetStudentEmail ? (
            isTargetLocked
              ? `<button type="button" onclick="window.curriculumUI.toggleStudentLock('${this.targetStudentEmail}', 'active')" style="background:#10B981; color:white; border:none; padding:7px 12px; border-radius:8px; font-weight:900; font-size:12px; cursor:pointer;" title="Mở khóa ngay cho học viên này tiếp tục học">🔓 Mở khóa lại</button>`
              : `<button type="button" onclick="window.curriculumUI.toggleStudentLock('${this.targetStudentEmail}', 'locked')" style="background:#EF4444; color:white; border:none; padding:7px 12px; border-radius:8px; font-weight:900; font-size:12px; cursor:pointer;" title="Tạm khóa quyền truy cập để cảnh cáo BTVN">🚫 Tạm khóa HS</button>`
          ) : ''}

          <button type="button" onclick="window.curriculumUI.triggerEditRoadmap()" style="background:#3B82F6; color:white; border:none; padding:7px 12px; border-radius:8px; font-weight:900; font-size:12px; cursor:pointer;" title="Mở lại form để điều chỉnh hoặc dùng AI">
            ✏️ Soạn Lại
          </button>

          <button type="button" onclick="window.curriculumUI.startImpersonation(document.getElementById('adminTargetEmailInput').value || '${this.targetStudentEmail}')" style="background:#10B981; color:white; border:none; padding:7px 12px; border-radius:8px; font-weight:900; font-size:12px; cursor:pointer;" title="Nhảy thẳng vào tài khoản học sinh để xem dữ liệu sạch">
            🎭 Đóng vai HS &rarr;
          </button>

          ${this.targetStudentEmail ? `
            <button type="button" onclick="window.curriculumUI.setTargetStudentEmail('')" style="background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.4); padding:7px 10px; border-radius:8px; font-size:12px; cursor:pointer;">
              ✕ Bỏ chọn
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderFloatingImpersonationBar() {
    if (!this.isImpersonating()) return '';
    const activeEmail = this.getActiveWorkingEmail();

    return `
      <div style="position:fixed; bottom:16px; right:16px; z-index:99999; background:#DC2626; color:white; padding:12px 20px; border-radius:16px; box-shadow:0 8px 24px rgba(0,0,0,0.3); border:2px solid #FEF2F2; display:flex; align-items:center; gap:14px; font-weight:800; font-size:13px;">
        <div>
          <span>🎭 ĐANG ĐÓNG VAI:</span> <u style="color:#FEF08A;">${activeEmail}</u>
          <div style="font-size:11px; opacity:0.9; font-weight:600;">Lịch sử bài làm hiển thị chính xác của học viên</div>
        </div>
        <button type="button" onclick="window.curriculumUI.stopImpersonation()" style="background:#FFFFFF; color:#DC2626; border:none; padding:7px 16px; border-radius:10px; font-weight:900; font-size:12.5px; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
          ⬅ Thoát về Admin
        </button>
      </div>
    `;
  }

  // =========================================================================
  // 6. RENDER GIAO DIỆN LỘ TRÌNH (TỰ ĐỘNG CHẶN NẾU HỌC SINH ĐANG BỊ KHÓA)
  // =========================================================================
  async render(targetContainerId = 'roadmapSectionMount') {
    let container = document.getElementById(targetContainerId);
    if (!container) return;

    const email = this.getActiveWorkingEmail();
    const isAdmin = this.checkIsAdmin();

    // 1. KIỂM TRA QUYỀN TRUY CẬP: NẾU LÀ HỌC SINH VÀ ĐANG BỊ KHÓA -> HIỆN BẢNG CẢNH CÁO
    if (!isAdmin && !this.isImpersonating()) {
      const isUnlocked = await this.checkStudentAccess(email);
      if (!isUnlocked) {
        container.innerHTML = `
          <div class="cs-container">
            <div style="background:#FFF1F2; border:2.5px solid #FDA4AF; border-radius:20px; padding:36px 24px; text-align:center; max-width:620px; margin:30px auto; box-shadow:0 8px 24px rgba(225,29,72,0.12);">
              <div style="font-size:48px; margin-bottom:12px;">⛔</div>
              <h3 style="color:#9F1239; font-size:22px; font-weight:900; margin:0 0 10px 0;">
                TÀI KHOẢN ĐANG BỊ TẠM DỪNG BỞI GIÁO VIÊN
              </h3>
              <p style="color:#4C0519; font-size:14.5px; line-height:1.6; margin:0 auto 20px auto; max-width:500px; font-weight:600;">
                Em chưa hoàn thành BTVN đúng hạn hoặc cần trao đổi trực tiếp với Thầy/Cô.<br>
                <b style="color:#BE123C;">Vui lòng nhắn tin Zalo cho Thầy để nhận lại quyền truy cập học tập nhé!</b>
              </p>
              <button type="button" id="btnCheckReentry" onclick="window.curriculumUI.checkReentry()" style="background:#BE123C; color:white; border:none; padding:12px 26px; border-radius:12px; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 3px 0 #881337;">
                🔄 Thầy đã mở khóa, bấm để vào học tiếp
              </button>
            </div>
          </div>
        `;
        return;
      }
    }

    let data = this.getSavedRoadmap(email);

    if (!data && email !== 'guest' && this.suppressCloudFetchForEmail !== email) {
      data = await this.fetchStudentRoadmapFromCloud(email);
    }

    // Tự động kéo lịch học của học sinh về nếu có email
    if (email && email !== 'guest') {
      this.fetchSchedules(email).then(() => {
        // Tự làm mới lịch nếu đã có attempts
        if (this.cachedAttempts.length > 0) {
          this.renderTodayHistoryAndCalendar(this.cachedAttempts, email);
        }
      });
    }

    const adminBarHtml = this.renderAdminControlBar();
    const floatingBarHtml = this.renderFloatingImpersonationBar();

    if (!data || this.isForceEditing) {
      container.innerHTML = `
        <div class="cs-container">
          ${adminBarHtml}
          ${floatingBarHtml}
          <div style="text-align:center; padding:10px;">
            <h3 style="margin:0 0 6px 0; font-size:22px; font-weight:900; color:#8B1518;">
              🎯 THIẾT LẬP LỘ TRÌNH CHO: <span style="color:#0284c7;">${email}</span>
            </h3>
            <p style="margin:0 auto 16px auto; max-width:650px; font-size:14px; color:#64748b; font-weight:700;">
              Lộ trình tính xuôi theo số buổi học (300k/buổi - 12 buổi/tháng) hoặc phân tích tự động bằng AI Gemini:
            </p>

            <div style="background:#FAF7F2; border:2px solid #E8E2D8; border-radius:18px; padding:20px; max-width:620px; margin:0 auto 20px auto; display:flex; flex-direction:column; gap:14px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; text-align:left;">
                <div>
                  <label style="font-size:13px; font-weight:800; color:#1e293b; display:block; margin-bottom:5px;">📍 1. Điểm hiện tại:</label>
                  <select id="matrixStartBandSelect" class="border border-slate-300 rounded p-2 text-sm w-full font-bold">
                    <option value="0.0">0.0 (Mất gốc hoàn toàn)</option>
                    <option value="2.0">2.0 (Biết bập bõm, mất gốc)</option>
                    <option value="3.0">3.0 (Nhớ từ vựng căn bản)</option>
                    <option value="3.5">3.5 (Ngữ pháp câu đơn)</option>
                    <option value="4.0">4.0 (Đã học tiếng Anh cơ bản)</option>
                    <option value="4.5">4.5 (Có gốc, chưa làm đề)</option>
                    <option value="5.0" selected>5.0 (Bắt đầu làm quen đề)</option>
                    <option value="5.5">5.5 (Đã thi thử 5.0 - 5.5)</option>
                    <option value="6.0">6.0 (Cần lên 6.5 - 7.0)</option>
                    <option value="6.5">6.5 (Nước rút chạm trần 7.0)</option>
                  </select>
                </div>

                <div>
                  <label style="font-size:13px; font-weight:800; color:#1e293b; display:block; margin-bottom:5px;">🎯 2. Mục tiêu mong muốn:</label>
                  <select id="matrixTargetBandSelect" class="border border-slate-300 rounded p-2 text-sm w-full font-bold">
                    <option value="5.0">Band 5.0 (Tốt nghiệp cơ bản / Định cư)</option>
                    <option value="5.5">Band 5.5 (Chuẩn đầu ra Cao đẳng / ĐH)</option>
                    <option value="6.0" selected>Band 6.0 (Xét tuyển Đại học Top đầu)</option>
                    <option value="6.5">Band 6.5 (Chuẩn vàng Du học & Việc làm)</option>
                    <option value="7.0">Band 7.0 (TRẦN CAO NHẤT KHÓA HỌC)</option>
                  </select>
                </div>
              </div>

              <div style="font-size:13px; color:#64748b; text-align:left; font-weight:700;">
                🏫 Lớp học: <b>3 buổi/tuần (2h/buổi = 12 buổi/tháng)</b> • BTVN: <b>1.5h tự cày/ngày</b>.
              </div>

              <button type="button" onclick="window.curriculumUI.applyBandRoadmap(document.getElementById('matrixStartBandSelect').value, document.getElementById('matrixTargetBandSelect').value)" style="background:#8B1518; color:white; border:none; padding:12px; border-radius:14px; font-weight:900; font-size:14.5px; cursor:pointer;">
                🚀 BẮT ĐẦU TẠO LỘ TRÌNH RIÊNG
              </button>
            </div>

            <div class="cs-diag-box">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                  <b style="color:#0369a1; font-size:14px;"><i class="fa-solid fa-wand-magic-sparkles"></i> CHẨN ĐOÁN & BĂM 5 CHẶNG TUẦN TỰ BẰNG AI GEMINI</b>
                  <div style="font-size:12.5px; color:#64748b; margin-top:2px; font-weight:700;">Dán báo cáo điểm chi tiết hoặc nói tự thuật, AI sẽ băm đúng 5 Chặng tuần tự:</div>
                </div>
                <button type="button" id="btnDiagMic" class="cs-diag-mic-btn" onclick="window.curriculumUI.toggleMicrophone()">
                  <i class="fa-solid fa-microphone"></i> Bấm để nói tự thuật trình độ
                </button>
              </div>

              <textarea id="diagTextInput" class="cs-diag-textarea" placeholder="Dán toàn bộ bản phân tích điểm hoặc gõ tự thuật..."></textarea>

              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="file" id="diagFileInput" accept=".txt" style="display:none;" onchange="window.curriculumUI.handleFileUpload(this.files[0])">
                  <button type="button" onclick="document.getElementById('diagFileInput').click()" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:7px 14px; border-radius:8px; font-size:12.5px; font-weight:bold; cursor:pointer;">
                    📄 Tải file báo cáo (.txt)
                  </button>
                  <span id="diagMicStatus" style="font-size:12.5px; color:#16a34a; font-weight:bold;"></span>
                </div>

                <button type="button" id="btnStartAIAnalyze" onclick="window.curriculumUI.runAIDiagnostic()" style="background:#0284c7; color:white; border:none; padding:10px 20px; border-radius:10px; font-weight:800; font-size:13.5px; cursor:pointer;">
                  ⚡ Gửi AI Phân Tích & Băm Lộ Trình 5 Chặng
                </button>
              </div>

              <div id="diagAIResultContainer" style="display:none;"></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    data.schedule.forEach(day => {
      day.nodes.forEach(node => {
        if (!data.completedNodeIds.includes(node.id) && this.isNodeCompletedInHistory(node)) {
          data.completedNodeIds.push(node.id);
        }
      });
    });

    const completedTotal = data.completedNodeIds.length;
    const progressPercent = data.totals.nodeCount > 0 ? Math.min(100, Math.round((completedTotal / data.totals.nodeCount) * 100)) : 0;
    const currentDayPlan = data.schedule.find(s => s.dayNumber === data.currentDay) || data.schedule[0];
    const totalDaysCount = data.schedule.length;
    const isLocked = !!data.isLockedByAdmin;

    container.innerHTML = `
      <div class="cs-container">
        ${adminBarHtml}
        ${floatingBarHtml}

        <!-- BANNER ĐỒNG BỘ SỐ NGÀY ĐỘNG (${totalDaysCount} NGÀY) -->
        <div style="background: linear-gradient(135deg, #8B1518 0%, #B91C1C 100%); border-radius: 18px; padding: 20px 24px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 0 #5E0C0E; color: white;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #FFC800; color: #5A3800; font-size: 12px; font-weight: 900; padding: 3px 10px; border-radius: 20px;">CHẶNG: BAND ${data.startBand || 0.0} ➔ ${data.targetBand || 7.0}</span>
              ${isAdmin ? `
                <span style="background: #FEF08A; color: #854D0E; font-size: 12px; font-weight: 900; padding: 3px 10px; border-radius: 20px;">👑 QUYỀN ADMIN: TOÀN QUYỀN ĐIỀU CHỈNH</span>
              ` : (isLocked ? `
                <span style="background: #DCFCE7; color: #166534; font-size: 12px; font-weight: 900; padding: 3px 10px; border-radius: 20px;">🔒 ĐÃ KHÓA BỞI GIÁO VIÊN</span>
              ` : '')}
              <span style="font-size: 13.5px; opacity: 0.95; font-weight: 700;">(1.5h BTVN/ngày)</span>
            </div>
            <h3 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 900; color: #FFFFFF;">
              🗺️ LỘ TRÌNH 5 CHẶNG TUẦN TỰ: ${email} (${totalDaysCount} NGÀY)
            </h3>
            <p style="margin: 5px 0 0 0; font-size: 13.5px; opacity: 0.95; font-weight: 700;">
              Lộ trình được thiết lập tuần tự: Ngữ pháp ➔ Reading + 100% Từ vựng ➔ Listening ➔ Writing ➔ Bùng nổ Speaking.
            </p>
          </div>
          
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <a href="curriculum-system/roadmap.html?studentEmail=${encodeURIComponent(email)}" class="btn-3d" style="background: #FFFFFF; color: #8B1518 !important; border-bottom: 4px solid rgba(0,0,0,0.18); font-size: 14.5px; padding: 12px 22px;">
              🚀 XEM TOÀN BỘ LỘ TRÌNH &rarr;
            </a>

            ${isAdmin ? `
              <button type="button" onclick="window.curriculumUI.triggerEditRoadmap()" class="btn-3d" style="background: #3B82F6; color: #FFFFFF !important; border-bottom: 4px solid #1D4ED8; padding: 12px 16px; font-size: 13.5px;" title="Soạn lại hoặc điều chỉnh bằng AI">
                ✏️ Soạn lại
              </button>
            ` : ''}

            ${(!isLocked || isAdmin) ? `
              <button type="button" onclick="window.curriculumUI.resetRoadmap()" class="btn-3d" style="background: rgba(255,255,255,0.2); color: #FFFFFF !important; border: 1.5px solid rgba(255,255,255,0.4); border-bottom: 4px solid rgba(0,0,0,0.2); padding: 12px 16px; font-size: 13.5px;" title="Xóa và thiết lập lại từ đầu">
                🔄 Đặt lại
              </button>
            ` : ''}
          </div>
        </div>

        <div class="cs-header">
          <div class="cs-title-group">
            <h3>
              <i class="fa-solid fa-calendar-day"></i> NHIỆM VỤ HỌC HÔM NAY (NGÀY ${data.currentDay}/${totalDaysCount})
            </h3>
          </div>
        </div>

        <!-- 4 Ô THỐNG KÊ DUOLINGO 3D -->
        <div class="cs-stats-grid">
          <div class="cs-stat-box stat-box-red">
            <div class="cs-stat-val" style="color: #8B1518;">🎯 ${completedTotal}/${data.totals.nodeCount}</div>
            <div class="cs-stat-lbl" style="color: #630D10;">Đốt đã hoàn thành</div>
          </div>
          <div class="cs-stat-box stat-box-green">
            <div class="cs-stat-val" style="color: #15803D;">⚡ ${data.totals.totalSelfStudyHours}h</div>
            <div class="cs-stat-lbl" style="color: #14532D;">BTVN Tự cày (${totalDaysCount} ngày)</div>
          </div>
          <div class="cs-stat-box stat-box-blue">
            <div class="cs-stat-val" style="color: #0284C7;">🏫 ${data.totals.totalLiveSessions} buổi</div>
            <div class="cs-stat-lbl" style="color: #0369A1;">Học GV (${data.totals.totalTeacherHours}h - HP: ${data.totals.tuitionVND})</div>
          </div>
          <div class="cs-stat-box stat-box-gold">
            <div class="cs-stat-val" style="color: #D97706;">⏳ ${data.totals.estimatedMonths} tháng</div>
            <div class="cs-stat-lbl" style="color: #92400E;">${data.totals.totalWeeks} tuần (${totalDaysCount} ngày BTVN)</div>
          </div>
        </div>

        <div class="cs-progress-container">
          <div class="cs-progress-header">
            <span>Tiến độ hoàn thành</span>
            <span><b>${progressPercent}%</b> (${completedTotal}/${data.totals.nodeCount} bài)</span>
          </div>
          <div class="cs-progress-bar-bg">
            <div class="cs-progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- DANH SÁCH BÀI TẬP HÔM NAY -->
        <div class="cs-task-list">
          ${currentDayPlan.nodes.map(node => {
            const compInfo = this.getNodeCompletionInfo(node);
            const isDone = compInfo.isCompleted;

            return `
              <div class="cs-task-card ${isDone ? 'is-done' : ''}">
                <div class="cs-task-info">
                  <div class="cs-task-meta">
                    <span class="cs-node-id">${node.id}</span>
                    <span class="cs-node-domain">${node.domain}</span>
                    <span class="cs-node-time">⏱️ Dự kiến: <b>${node.assignedDurationMinutes} phút</b></span>
                  </div>
                  <div class="cs-task-title">
                    ${isDone ? '✓ ' : ''}${node.title}
                  </div>
                  
                  ${isDone ? `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                      <div style="font-size: 13px; font-weight: 800; color: #166534; background: #DCFCE7; border: 1.5px solid #86EFAC; border-radius: 8px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="background: #166534; color: white; padding: 1px 6px; border-radius: 5px; font-size: 11px;">LẦN 1</span>
                        <span>🎯 Điểm: <b>${compInfo.firstAttempt.score}</b></span>
                        <span>⏱️ Thời gian: <b>${compInfo.firstAttempt.timeSpent}</b></span>
                        <span>📅 Nộp lúc: <b>${compInfo.firstAttempt.timestamp}</b></span>
                      </div>

                      ${compInfo.latestAttempt ? `
                        <div style="font-size: 13px; font-weight: 800; color: #065F46; background: #A7F3D0; border: 1.5px solid #34D399; border-radius: 8px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <span style="background: #059669; color: white; padding: 1px 6px; border-radius: 5px; font-size: 11px;">LẦN 2 (MỚI NHẤT)</span>
                          <span>🎯 Điểm: <b>${compInfo.latestAttempt.score}</b></span>
                          <span>⏱️ Thời gian: <b>${compInfo.latestAttempt.timeSpent}</b></span>
                          <span>📅 Nộp lúc: <b>${compInfo.latestAttempt.timestamp}</b></span>
                        </div>
                      ` : ''}
                    </div>
                  ` : `
                    <div style="font-size: 13px; color: #756D68; background: #FAF7F2; border: 1.5px solid #E8E2D8; padding: 6px 12px; border-radius: 10px; margin-top: 6px; line-height: 1.4; font-weight: 700;">
                      💡 <b>Lợi ích:</b> ${node.benefit || 'Củng cố phản xạ ngôn ngữ và kỹ năng học thuật.'}
                    </div>
                  `}
                </div>

                <div>
                  ${isDone ? `
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                      <span class="cs-btn-action cs-btn-done" style="padding: 5px 12px; font-size: 12px; border-radius: 8px;">
                        <i class="fa-solid fa-circle-check"></i> Đã hoàn thành
                      </span>
                      <a href="${node.url}" target="_blank" class="cs-btn-action" style="background: #FFFFFF; color: #166534; border: 2px solid #86EFAC; border-bottom: 4px solid #4ADE80; padding: 7px 16px; font-size: 13px; text-decoration: none; border-radius: 10px; font-weight: 900; white-space: nowrap;">
                        🔄 Làm lại bài &rarr;
                      </a>
                    </div>
                  ` : `
                    <a href="${node.url}" target="_blank" class="cs-btn-action cs-btn-start">
                      🚀 Vào làm bài &rarr;
                    </a>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 7. LỊCH CHUYÊN CẦN & BANNER LỊCH SỬ TÔNG MÀU PASTEL CHUẨN MÔN (KÈM LỊCH HỌC)
  // =========================================================================
  renderTodayHistoryAndCalendar(attempts = [], email = '') {
    this.cachedAttempts = stateManager.sortAttemptsDescending(attempts);
    this.cachedEmail = email;

    const container = document.getElementById('historyResultsList');
    if (!container) return;

    const selectedAttempts = this.cachedAttempts.filter(att => (att.timestamp || '').includes(this.selectedDateStr));

    // Lọc các buổi học trùng ngày được chọn (Chuyển "DD/MM/YYYY" sang "YYYY-MM-DD")
    const parts = this.selectedDateStr.split('/');
    const selectedIsoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
    const selectedSchedules = (this.cachedSchedules || []).filter(ev => ev.date === selectedIsoDate);

    const todayStr = this.getFormattedDate(new Date());
    const todayAttemptsCount = this.cachedAttempts.filter(att => (att.timestamp || '').includes(todayStr)).length;
    const badge = document.getElementById('totalAttemptsBadge');
    if (badge) badge.innerText = `${todayAttemptsCount} bài hôm nay`;

    const uniqueDates = new Set();
    this.cachedAttempts.forEach(att => {
      const m = att.timestamp?.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m) uniqueDates.add(m[1]);
    });
    const streakCount = this.calculateStreak(uniqueDates);
    const streakBadge = document.getElementById('streakCounterBadge');
    if (streakBadge) {
      streakBadge.innerHTML = `<i class="fa-solid fa-fire"></i> ${streakCount} NGÀY`;
    }

    const calHtml = this.generateMonthCalendarHtml(this.cachedAttempts);
    const isToday = this.selectedDateStr === todayStr;
    const displayDateLabel = isToday ? `Hôm nay (${this.selectedDateStr})` : `Ngày ${this.selectedDateStr}`;

    let listHtml = `
      <div style="margin-top: 20px; border-top: 2px dashed #E8E2D8; padding-top: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <b style="font-size: 16px; color: #8B1518;">
            📝 Chi tiết ngày học: ${displayDateLabel}
          </b>
          <button type="button" onclick="window.curriculumUI.toggleListCollapse()" class="cs-cal-btn" style="cursor: pointer; padding: 6px 14px; font-size: 13px;">
            ${this.isListCollapsed ? 'Mở rộng ▼' : 'Thu gọn ▲'}
          </button>
        </div>

        <div id="csSelectedDateListBody" style="display: ${this.isListCollapsed ? 'none' : 'block'};">
    `;

    // 📅 1. HIỂN THỊ BUỔI HỌC TRỰC TIẾP VỚI GIÁO VIÊN (NẾU CÓ)
    if (selectedSchedules.length > 0) {
      selectedSchedules.forEach(ev => {
        const isRequested = ev.status === 'reschedule_requested';
        const isDone = ev.status === 'completed';

        listHtml += `
          <div style="background: #FFFBEB; border: 2.5px solid #FCD34D; border-bottom: 5px solid #F59E0B; border-radius: 16px; padding: 14px 18px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.08);">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="background: #D97706; color: #FFFFFF; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">
                  🏫 LỚP HỌC TRỰC TIẾP
                </span>
                ${isRequested ? '<span style="background: #EF4444; color: white; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px;">⏳ ĐANG CHỜ THẦY DUYỆT DỜI LỊCH</span>' : ''}
                ${isDone ? '<span style="background: #16A34A; color: white; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px;">✓ ĐÃ HỌC XONG</span>' : ''}
              </div>
              <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 900; color: #78350F;">
                ${ev.title || 'Buổi học IELTS với Thầy'}
              </h4>
              <div style="font-size: 13.5px; font-weight: 800; color: #92400E;">
                ⏱️ Khung giờ: <b>${ev.startTime} - ${ev.endTime}</b>
                ${ev.meetUrl ? ` • <a href="${ev.meetUrl}" target="_blank" style="color: #0284C7; text-decoration: underline; font-weight: 900;">🔗 Vào phòng học Google Meet</a>` : ''}
              </div>
              ${ev.notes ? `<div style="font-size: 12.5px; color: #78350F; margin-top: 4px; font-style: italic;">📌 Ghi chú: ${ev.notes}</div>` : ''}
              ${isRequested && ev.rescheduleRequest?.reason ? `
                <div style="font-size: 12px; color: #B91C1C; background: #FEF2F2; padding: 4px 8px; border-radius: 6px; margin-top: 6px; border: 1px solid #FECACA;">
                  💬 Lý do xin dời: <b>${ev.rescheduleRequest.reason}</b> (${ev.rescheduleRequest.suggestedTime || 'Chưa hẹn giờ'})
                </div>
              ` : ''}
            </div>

            <div>
              ${!isDone ? `
                <button type="button" onclick="window.curriculumUI.openRescheduleModal('${ev.id}', '${ev.title.replace(/'/g, "\\'")}', '${this.selectedDateStr} ${ev.startTime}')" class="btn-3d" style="background: #FFFFFF; color: #92400E !important; border: 2px solid #FCD34D; border-bottom: 4px solid #F59E0B; padding: 8px 14px; font-size: 12.5px; border-radius: 12px; cursor: pointer;">
                  <i class="fa-solid fa-clock-rotate-left"></i> ${isRequested ? 'Sửa yêu cầu dời lịch' : 'Xin dời lịch học'}
                </button>
              ` : ''}
            </div>
          </div>
        `;
      });
    }

    // 📝 2. HIỂN THỊ DANH SÁCH BÀI TẬP VỀ NHÀ ĐÃ NỘP TRONG NGÀY
    if (selectedAttempts.length === 0 && selectedSchedules.length === 0) {
      listHtml += `
        <div style="text-align: center; padding: 22px 14px; background: #FAF7F2; border-radius: 16px; border: 2px dashed #E8E2D8;">
          <div style="font-size: 26px; margin-bottom: 4px;">📅</div>
          <b style="color: #261F1D; font-size: 15px;">Chưa có bài nộp hay buổi học nào trong ngày ${this.selectedDateStr}</b>
          <div style="font-size: 13px; color: #756D68; margin-top: 3px; font-weight: 700;">Nhấp vào các ô có màu trên lịch để xem lại bài nhé!</div>
        </div>
      `;
    } else {
      selectedAttempts.forEach(att => {
        const reviewLink = this.resolveReviewPageUrl(att.pageUrl, att.id, email);
        const th = this.getModuleTheme(att.moduleType, att.pageUrl, att.testTitle);

        listHtml += `
          <div class="history-item-banner" style="background: ${th.bg}; border: 2px solid ${th.border}; border-bottom: 4px solid ${th.border}; border-radius: 16px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="background: ${th.tagBg}; color: #FFFFFF; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">
                  ${th.label}
                </span>
                <b style="font-size: 15px; color: ${th.text};">${att.testTitle}</b>
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #64748B;">
                ⏱️ Nộp lúc: <b>${att.timestamp}</b> • Làm trong: <b>${att.timeSpent || 'N/A'}</b>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="score-pill" style="background: ${th.tagBg}; color: white; padding: 6px 12px; border-radius: 12px; font-weight: 900; font-size: 13.5px;">
                Điểm: ${att.score}
              </span>
              <a href="${reviewLink}" target="_blank" class="btn-review" style="background: #FFFFFF; color: ${th.text}; border: 1.5px solid ${th.border}; border-bottom: 3px solid ${th.border}; text-decoration: none; padding: 6px 14px; border-radius: 12px; font-size: 13px; font-weight: 900; display: inline-flex; align-items: center; gap: 5px;">
                👁️ Xem chi tiết
              </a>
            </div>
          </div>
        `;
      });
    }

    listHtml += `</div></div>`;
    container.innerHTML = calHtml + listHtml;
  }

  generateMonthCalendarHtml(attempts) {
    const year = this.calCurrentYear;
    const month = this.calCurrentMonth;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    // Đếm bài tập đã làm theo ngày
    const dateCountMap = {};
    attempts.forEach(att => {
      const m = att.timestamp?.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m && parseInt(m[2], 10) === (month + 1) && parseInt(m[3], 10) === year) {
        const d = parseInt(m[1], 10);
        dateCountMap[d] = (dateCountMap[d] || 0) + 1;
      }
    });

    // 📅 Bản đồ buổi học trực tiếp trong tháng
    const scheduleDateMap = {};
    (this.cachedSchedules || []).forEach(ev => {
      if (ev.date) {
        const sParts = ev.date.split('-');
        if (sParts.length === 3 && parseInt(sParts[0], 10) === year && parseInt(sParts[1], 10) === (month + 1)) {
          const d = parseInt(sParts[2], 10);
          if (!scheduleDateMap[d]) scheduleDateMap[d] = [];
          scheduleDateMap[d].push(ev);
        }
      }
    });

    const now = new Date();
    const isCurrentMonthNow = now.getFullYear() === year && now.getMonth() === month;
    const todayDateNum = now.getDate();

    let gridHtml = '';
    for (let i = 0; i < adjustedFirstDay; i++) {
      gridHtml += `<div class="cs-cal-cell cs-cal-cell-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const count = dateCountMap[day] || 0;
      const schedulesOnDay = scheduleDateMap[day] || [];
      const hasSchedule = schedulesOnDay.length > 0;
      const isFuture = isCurrentMonthNow && (day > todayDateNum);

      const dStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      const isSelected = this.selectedDateStr === dStr;

      let colorClass = 'cal-color-zero';
      if (isFuture) {
        colorClass = 'cal-color-future';
      } else if (count === 0) {
        colorClass = 'cal-color-zero';
      } else if (count === 1) {
        colorClass = 'cal-color-low';
      } else if (count === 2) {
        colorClass = 'cal-color-mid';
      } else if (count >= 3 && count <= 4) {
        colorClass = 'cal-color-full';
      } else if (count >= 5) {
        colorClass = 'cal-color-over';
      }

      const activeBorder = isSelected ? 'box-shadow: 0 0 0 3.5px #8B1518, 0 4px 12px rgba(0,0,0,0.25); transform: scale(1.08); z-index: 5;' : '';

      // Huy hiệu thể hiện buổi học trực tiếp
      let scheduleBadgeHtml = '';
      if (hasSchedule) {
        const firstEv = schedulesOnDay[0];
        const isReq = schedulesOnDay.some(s => s.status === 'reschedule_requested');
        const badgeColor = isReq ? '#EF4444' : '#D97706';
        scheduleBadgeHtml = `
          <span style="background:${badgeColor}; color:white; font-size:10px; font-weight:900; padding:1px 4px; border-radius:4px; margin-top:2px; display:inline-block; max-width:95%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            🔴 ${firstEv.startTime}
          </span>
        `;
      }

      gridHtml += `
        <div class="cs-cal-cell ${colorClass}" style="${activeBorder}" onclick="window.curriculumUI.selectCalendarDate(${day}, ${month}, ${year})">
          <span>${day}</span>
          ${scheduleBadgeHtml}
          ${count > 0 ? `<span class="cs-cal-subtext">${count >= 5 ? '🔥 ' : ''}${count} bài</span>` : ''}
        </div>
      `;
    }

    return `
      <div class="cs-calendar-wrapper">
        <div class="cs-calendar-nav">
          <b class="cs-calendar-title">
            <i class="fa-solid fa-fire text-amber-500"></i> LỊCH CHUYÊN CẦN: THÁNG ${month + 1}/${year}
          </b>
          <div style="display:flex; gap:8px;">
            <button type="button" class="cs-cal-btn" onclick="window.curriculumUI.changeCalMonth(-1)">◀ Tháng trước</button>
            <button type="button" class="cs-cal-btn" onclick="window.curriculumUI.changeCalMonth(1)">Tháng sau ▶</button>
          </div>
        </div>

        <div class="cs-calendar-grid">
          <div class="cs-cal-day-name">T2</div>
          <div class="cs-cal-day-name">T3</div>
          <div class="cs-cal-day-name">T4</div>
          <div class="cs-cal-day-name">T5</div>
          <div class="cs-cal-day-name">T6</div>
          <div class="cs-cal-day-name">T7</div>
          <div class="cs-cal-day-name">CN</div>
          ${gridHtml}
        </div>

        <div class="cs-legend-bar">
          <span style="color: #756D68; font-size: 13.5px; margin-right: 6px;">Ký hiệu:</span>
          <div class="cs-legend-item"><span style="width:10px; height:10px; background:#D97706; border-radius:50%; display:inline-block;"></span> <span>🔴 Lịch học với Thầy</span></div>
          <div class="cs-legend-item"><span class="cs-legend-dot cal-color-low"></span> <span>1 bài BTVN</span></div>
          <div class="cs-legend-item"><span class="cs-legend-dot cal-color-mid"></span> <span>2 bài</span></div>
          <div class="cs-legend-item"><span class="cs-legend-dot cal-color-full"></span> <span>3-4 bài</span></div>
          <div class="cs-legend-item"><span class="cs-legend-dot cal-color-over"></span> <span>5+ bài 🔥</span></div>
        </div>
      </div>
    `;
  }

  selectCalendarDate(day, month, year) {
    this.selectedDateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    this.renderTodayHistoryAndCalendar(this.cachedAttempts, this.cachedEmail);
  }

  toggleListCollapse() {
    this.isListCollapsed = !this.isListCollapsed;
    const body = document.getElementById('csSelectedDateListBody');
    if (body) body.style.display = this.isListCollapsed ? 'none' : 'block';
  }

  changeCalMonth(delta) {
    this.calCurrentMonth += delta;
    if (this.calCurrentMonth > 11) {
      this.calCurrentMonth = 0;
      this.calCurrentYear += 1;
    } else if (this.calCurrentMonth < 0) {
      this.calCurrentMonth = 11;
      this.calCurrentYear -= 1;
    }
    this.renderTodayHistoryAndCalendar(this.cachedAttempts, this.cachedEmail);
  }

  getFormattedDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return `${day}/${m}/${y}`;
  }

  calculateStreak(uniqueDatesSet) {
    let streak = 0;
    const checkDate = new Date();
    while (true) {
      const str = this.getFormattedDate(checkDate);
      if (uniqueDatesSet.has(str)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (streak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = this.getFormattedDate(checkDate);
          if (uniqueDatesSet.has(yesterdayStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return streak;
  }

  resolveReviewPageUrl(pageUrl, id, email) {
    if (!pageUrl) return `reading/runner-reading.html?attemptId=${id}&email=${encodeURIComponent(email)}`;
    let target = pageUrl;
    if (target.startsWith('runner-reading.html')) target = 'reading/' + target;
    if (target.startsWith('runner-listening.html')) target = 'listening/' + target;
    const sep = target.includes('?') ? '&' : '?';
    return `${target}${sep}attemptId=${id}&email=${encodeURIComponent(email)}`;
  }

  // =========================================================================
  // 8. MODAL HỌC SINH XIN DỜI LỊCH (STUDENT RESCHEDULE POPUP)
  // =========================================================================
  injectRescheduleModal() {
    if (document.getElementById('studentRescheduleModal')) return;

    const modalHtml = `
      <div id="studentRescheduleModal" style="display:none; position:fixed; inset:0; z-index:999999; background:rgba(15, 23, 42, 0.75); backdrop-filter:blur(6px); align-items:center; justify-content:center; padding:16px;">
        <div style="background:#FFFFFF; border:3px solid #E8E2D8; border-bottom:7px solid #D3CBC0; border-radius:26px; max-width:460px; width:100%; padding:26px; position:relative; box-shadow:0 20px 40px rgba(0,0,0,0.3); font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
          
          <button type="button" onclick="window.curriculumUI.closeRescheduleModal()" style="position:absolute; top:14px; right:16px; background:#F1ECE6; border:none; width:34px; height:34px; border-radius:50%; font-weight:900; color:#7E7672; cursor:pointer; font-size:16px;">✕</button>

          <div style="width:56px; height:56px; border-radius:50%; background:#FFF4E5; border:3px solid #FCD34D; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto; font-size:26px;">
            📅
          </div>

          <h3 style="margin:0 0 6px 0; color:#8B1518; font-size:19px; font-weight:900; text-align:center;">
            XIN PHÉP DỜI LỊCH HỌC
          </h3>
          <p id="rescheduleEventInfo" style="margin:0 0 16px 0; font-size:13px; font-weight:700; color:#64748B; text-align:center;">
            Buổi học: Đang tải...
          </p>

          <div style="margin-bottom:14px;">
            <label style="font-size:13px; font-weight:800; color:#1e293b; display:block; margin-bottom:5px;">
              📝 Lý do xin dời lịch: <span style="color:#DC2626;">*</span>
            </label>
            <textarea id="rescheduleReasonInput" placeholder="Ví dụ: Em bị trùng lịch thi học kỳ ở trường..." style="width:100%; box-sizing:border-box; padding:10px 14px; border:2px solid #E8E2D8; border-radius:12px; font-family:inherit; font-weight:700; font-size:13.5px; height:70px; outline:none; resize:none;"></textarea>
          </div>

          <div style="margin-bottom:18px;">
            <label style="font-size:13px; font-weight:800; color:#1e293b; display:block; margin-bottom:5px;">
              ⏰ Đề xuất khung giờ muốn học bù (nếu có):
            </label>
            <input type="text" id="rescheduleSuggestedTimeInput" placeholder="Ví dụ: Tối mai 19:30 hoặc Chủ nhật..." style="width:100%; box-sizing:border-box; padding:10px 14px; border:2px solid #E8E2D8; border-radius:12px; font-family:inherit; font-weight:700; font-size:13.5px; outline:none;">
          </div>

          <button type="button" id="btnSubmitReschedule" onclick="window.curriculumUI.submitRescheduleRequest()" style="background:#8B1518; color:#FFFFFF; border:none; padding:13px 20px; border-radius:14px; font-weight:900; font-size:14.5px; width:100%; cursor:pointer; border-bottom:4px solid #5E0C0E;">
            🚀 Gửi Lời Nhắn Xin Dời Cho Thầy
          </button>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  }

  openRescheduleModal(eventId, title, currentDateTime) {
    this.activeRescheduleEventId = eventId;
    const modal = document.getElementById('studentRescheduleModal');
    const info = document.getElementById('rescheduleEventInfo');
    const reasonInput = document.getElementById('rescheduleReasonInput');
    const timeInput = document.getElementById('rescheduleSuggestedTimeInput');

    if (info) {
      info.innerHTML = `Buổi học: <b style="color:#1e293b;">${title}</b><br>Thời gian hiện tại: <b style="color:#D97706;">${currentDateTime}</b>`;
    }
    if (reasonInput) reasonInput.value = '';
    if (timeInput) timeInput.value = '';
    if (modal) modal.style.display = 'flex';
  }

  closeRescheduleModal() {
    const modal = document.getElementById('studentRescheduleModal');
    if (modal) modal.style.display = 'none';
    this.activeRescheduleEventId = null;
  }

  async submitRescheduleRequest() {
    const eventId = this.activeRescheduleEventId;
    const reason = document.getElementById('rescheduleReasonInput')?.value.trim();
    const suggestedTime = document.getElementById('rescheduleSuggestedTimeInput')?.value.trim();
    const email = this.getActiveWorkingEmail();

    if (!reason) {
      alert("⚠️ Em vui lòng ghi lý do xin dời lịch để Thầy nắm được nhé!");
      return;
    }

    const btn = document.getElementById('btnSubmitReschedule');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "⏳ Đang gửi yêu cầu lên máy chủ...";
    }

    try {
      if (CLOUD_SCRIPT_URL) {
        const res = await fetch(CLOUD_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "student_request_reschedule",
            studentEmail: email,
            eventId: eventId,
            reason: reason,
            suggestedTime: suggestedTime
          })
        });
        const data = await res.json();
        if (data && data.success) {
          alert("🎉 " + data.message);
        } else {
          alert("⚠️ " + (data.error || "Gửi yêu cầu dời lịch thành công"));
        }
      }

      // Cập nhật ngay trong cache của học sinh để giao diện đổi màu tức thì
      const ev = (this.cachedSchedules || []).find(e => e.id === eventId);
      if (ev) {
        ev.status = 'reschedule_requested';
        ev.rescheduleRequest = { reason, suggestedTime, requestedAt: new Date().toISOString() };
      }

      this.closeRescheduleModal();
      this.renderTodayHistoryAndCalendar(this.cachedAttempts, email);

    } catch (e) {
      alert("Lỗi kết nối máy chủ: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "🚀 Gửi Lời Nhắn Xin Dời Cho Thầy";
      }
    }
  }
}

export const curriculumUI = new CurriculumUISystem();
window.curriculumUI = curriculumUI;
