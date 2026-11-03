/**
 * js/auth-lock.js - HỆ THỐNG PHÂN QUYỀN FREEMIUM & LÁ CHẮN TƯƠNG TÁC TỰ ĐỘNG
 * Trạm IELTS - BẢN MASTER NÂNG CẤP TOÀN DIỆN (CHỐNG CRASH DOM & ĐỒNG BỘ KHÓA CLOUD)
 * BẢO VỆ TOÀN DIỆN: GRAMMAR & VOCAB (LÂU DÀI) + CÁC BÀI PRE VÀ LINK NGOÀI (TẠM THỜI)
 * ĐÃ TÍCH HỢP: CHẾ ĐỘ XEM BÁO CÁO DÀNH CHO PHỤ HUYNH (BYPASS KHÓA READ-ONLY AN TOÀN)
 * Tương thích kép: Dùng được cho cả import module lẫn thẻ script độc lập
 */

const AUTH_STORAGE_KEYS = {
  STUDENT_ID: 'tram_student_id',
  ACCESS_STATUS: 'tram_access_status', // 'active' | 'locked'
  ADMIN_SECRET: 'phuc_tramielts'
};

const HARDCODED_ADMINS = [
  "tramielts9@gmail.com",
  "dinhnguyenphuc019.2@gmail.com"
];

const CLOUD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNErQQFdciAQM0k9KUrACtpX7rxKkopjChYAC2Ubwj5MGzFOeekDEGs8C1n7P9cNR6vg/exec";

class AuthLockSystem {
  constructor() {
    this.studentId = this.getOrCreateStudentID();
    this.isCloudLocked = false;
    
    // AN TOÀN TUYỆT ĐỐI: Chờ DOM sẵn sàng mới vẽ giao diện, chống lỗi crash document.body null
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  // KIỂM TRA XEM ĐÂY CÓ PHẢI LÀ PHỤ HUYNH ĐANG XEM BÁO CÁO KHÔNG
  isParentView() {
    try {
      const params = new URLSearchParams(window.location.search);
      const isParentMode = params.get('mode') === 'parent';
      const isParentPage = window.location.pathname.includes('parent-report');
      return isParentMode || isParentPage;
    } catch (e) {
      return false;
    }
  }

  async init() {
    // Nếu là Phụ Huynh xem báo cáo: Bỏ qua toàn bộ giao diện khóa và Admin
    if (this.isParentView()) {
      return;
    }

    this.initAdminBar();
    this.injectConversionModal();
    this.injectAdminLockoutModal();
    
    // Kiểm tra trạng thái khóa từ xa của Giáo viên trên Cloud
    await this.verifyCloudAccess();
    
    // Kích hoạt lá chắn bảo vệ tương tác
    this.activateUniversalInteractionBarrier();
  }

  // 1. Tự sinh hoặc lấy mã học viên TR-xxxx
  getOrCreateStudentID() {
    let id = localStorage.getItem(AUTH_STORAGE_KEYS.STUDENT_ID);
    if (!id) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      id = `TR-${randNum}`;
      localStorage.setItem(AUTH_STORAGE_KEYS.STUDENT_ID, id);
    }
    return id;
  }

  // 2. Kiểm tra học sinh có quyền Admin hoặc đã active chưa
  isStudentActive() {
    // Phụ huynh được cấp quyền xem dữ liệu (Read-Only)
    if (this.isParentView()) {
      return true;
    }

    const email = (localStorage.getItem('ielts_student_email') || '').toLowerCase().trim();
    const backupEmail = (localStorage.getItem('ielts_admin_backup_email') || '').toLowerCase().trim();

    if (
      email.includes('admin') ||
      backupEmail.includes('admin') ||
      HARDCODED_ADMINS.includes(email) ||
      HARDCODED_ADMINS.includes(backupEmail)
    ) {
      return true;
    }

    if (this.isCloudLocked) return false;

    return localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_STATUS) === 'active';
  }

  // 3. Kiểm tra xem học sinh có bị Thầy bấm "🚫 Tạm khóa" từ xa trên Cloud không
  async verifyCloudAccess() {
    if (this.isParentView()) {
      this.isCloudLocked = false;
      return;
    }

    const email = (localStorage.getItem('ielts_student_email') || '').toLowerCase().trim();
    if (!email || email === 'guest' || HARDCODED_ADMINS.includes(email) || email.includes('admin')) {
      this.isCloudLocked = false;
      return;
    }

    if (!CLOUD_SCRIPT_URL) return;

    try {
      const res = await fetch(`${CLOUD_SCRIPT_URL}?action=check_student_access&studentId=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.isUnlocked === false) {
          this.isCloudLocked = true;
          this.showAdminLockoutModal();
        } else {
          this.isCloudLocked = false;
        }
      }
    } catch (e) {
      // Nếu lỗi mạng thì không chặn học sinh làm bài
      this.isCloudLocked = false;
    }
  }

  // 4. Khóa chuyển đổi (Execution Lock) - Chặn hành động và bung Modal
  enforceLock(actionName = "Bài tập & Chấm thi AI") {
    if (this.isStudentActive()) return true;
    
    if (this.isCloudLocked) {
      this.showAdminLockoutModal();
    } else {
      this.showConversionModal(actionName);
    }
    return false;
  }

  // 5. LÁ CHẮN TỰ ĐỘNG TOÀN SÀN: BẢO VỆ CẢ BÀI TẬP NỘI BỘ LẪN CÁC LINK NGOÀI VÀ NÚT ĐẶC THÙ
  activateUniversalInteractionBarrier() {
    if (this.isStudentActive()) return;

    const interactiveSelectors = [
      // --- I. Ô NHẬP LIỆU & NÚT NỘP CHUẨN CHUNG (LÂU DÀI) ---
      'input:not([id*="admin"]):not([id*="login"]):not([id*="search"]):not([id*="Search"])',
      'textarea:not([id*="admin"])',
      'select:not([id*="admin"]):not([id*="courseSelector"])',
      '.choice-btn',
      '.option-btn',
      '.btn-submit',
      '.btn-submit-grading',
      '.btn-full-submit',
      '#btnSubmitGrading',
      '#btnStartGrading',
      '#btnBottomSubmit',
      '#recBtn',

      // --- II. GRAMMAR (BẢO VỆ LÂU DÀI) ---
      '.input-blank-g',
      '.choice-label-g',
      '.choice-label-g input',
      '.btn-submit-g',
      '.btn-grade-part',
      '.btn-reset-part',
      '#btnGradeQuiz',
      '#btnSubmitToAI',
      '#aiRecallInput',

      // --- III. VOCABULARY (BẢO VỆ LÂU DÀI) ---
      '.col-vn-input',
      '#btnSubmitVocabList',
      '#btnSaveDraftVocab',
      '.btn-fc-action',
      '#btnFcWrong',
      '#btnFcCorrect',
      '.flashcard',
      'button[onclick*="startVocabFlashcard"]',
      'button[onclick*="startVocabListExam"]',
      'button[onclick*="viewPastVocabAttempt"]',

      // --- IV. PRE-SKILLS & LINK NGOÀI (BẢO VỆ ĐẶC TRỊ TẠM THỜI) ---
      '.pl-lesson-card a',
      '.pr-lesson-card a',
      'a[href*="elllo.org"]',
      'a[href*="test-english.com"]',
      'button[onclick*="openSubmitModalPL"]',
      'button[onclick*="openSubmitModalPR"]',
      'button[onclick*="startLessonFromPortal"]',
      'button[onclick*="openPastAttemptsFromPortal"]',
      '#btnRecord',
      '#btnStop',
      '#btnComplete',
      'button[onclick*="toggleShadowRecording"]',
      'button[onclick*="stopAndSubmitRecording"]',
      'button[onclick*="startLessonPWT1"]',
      'button[onclick*="openPastAttemptsPWT1"]',
      '#btnGrading',
      '#btnSaveDraftPWT1',
      '#btnSaveDraftPWT2'
    ].join(',');

    const blockEvent = (e) => {
      if (this.isStudentActive()) return;

      const target = e.target.closest(interactiveSelectors);
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (typeof target.blur === 'function') target.blur();

        if (this.isCloudLocked) {
          this.showAdminLockoutModal();
          return;
        }

        let featureName = "Làm bài tập";
        if (target.tagName === 'A' || target.closest('a')) featureName = "Làm bài tập liên kết";
        else if (target.matches('.btn-fc-action, .flashcard, button[onclick*="startVocab"]')) featureName = "Học từ vựng & Flashcard";
        else if (target.matches('#btnRecord, [onclick*="toggleShadowRecording"], #recBtn')) featureName = "Phòng thu âm Speaking";
        else if (target.matches('.input-blank-g, .choice-label-g, .btn-grade-part, #btnSubmitToAI')) featureName = "Làm bài tập Ngữ pháp";
        else if (target.tagName === 'TEXTAREA') featureName = "Viết bài luận / Trả lời";
        else if (target.type === 'radio' || target.classList.contains('choice-btn')) featureName = "Chọn đáp án trắc nghiệm";
        else if (target.innerText && (target.innerText.includes('Chấm') || target.innerText.includes('Nộp'))) featureName = "Chấm điểm & Sửa bài AI";

        this.showConversionModal(featureName);
      }
    };

    document.addEventListener('pointerdown', blockEvent, true);
    document.addEventListener('click', blockEvent, true);
    document.addEventListener('focusin', blockEvent, true);
    document.addEventListener('keydown', (e) => {
      if (this.isStudentActive()) return;
      if (e.target.closest(interactiveSelectors)) {
        e.preventDefault();
        e.stopPropagation();
        if (this.isCloudLocked) {
          this.showAdminLockoutModal();
        } else {
          this.showConversionModal("Làm bài tập");
        }
      }
    }, true);
  }

  // 6. MODAL 1: CẢNH CÁO TẠM KHÓA TỪ XA BỞI GIÁO VIÊN
  injectAdminLockoutModal() {
    if (document.getElementById('adminLockoutModal')) return;

    const modalHtml = `
      <div id="adminLockoutModal" style="display:none; position:fixed; inset:0; z-index:9999999; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px;">
        <div style="background:#FFF1F2; border:3px solid #FDA4AF; border-bottom:7px solid #E11D48; border-radius:26px; max-width:460px; width:100%; padding:32px 24px; text-align:center; position:relative; box-shadow:0 25px 50px rgba(0,0,0,0.4); font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
          
          <div style="width:64px; height:64px; border-radius:50%; background:#FFE4E6; border:3px solid #FDA4AF; display:flex; align-items:center; justify-content:center; margin:0 auto 14px auto; font-size:30px;">
            ⛔
          </div>

          <h3 style="margin:0 0 8px 0; color:#9F1239; font-size:20px; font-weight:900;">
            TÀI KHOẢN ĐANG BỊ TẠM DỪNG
          </h3>
          <p style="margin:0 0 20px 0; font-size:13.5px; font-weight:600; color:#4C0519; line-height:1.6;">
            Em chưa hoàn thành BTVN đúng hạn hoặc cần trao đổi trực tiếp với Thầy/Cô.<br>
            <b style="color:#BE123C;">Vui lòng nhắn tin Zalo cho Thầy để được mở lại quyền truy cập học tập nhé!</b>
          </p>

          <button type="button" id="btnLockoutReentry" onclick="window.authLockSystem.checkReentryFromModal()" style="background:#BE123C; color:#FFFFFF; border:none; padding:13px 24px; border-radius:14px; font-weight:900; font-size:14px; cursor:pointer; width:100%; border-bottom:4px solid #881337; margin-bottom:12px;">
            🔄 Thầy đã mở khóa, bấm để vào học tiếp
          </button>

          <a href="https://zalo.me/0967561243" target="_blank" style="background:#FFFFFF; color:#0068FF; text-decoration:none; padding:11px 20px; border-radius:14px; font-weight:800; font-size:13.5px; display:inline-flex; align-items:center; justify-content:center; gap:8px; border:2px solid #BFDBFE; border-bottom:4px solid #93C5FD; width:100%; box-sizing:border-box;">
            💬 Nhắn Zalo Cho Thầy Phúc
          </a>
        </div>
      </div>
    `;
    if (document.body) {
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  }

  showAdminLockoutModal() {
    const modal = document.getElementById('adminLockoutModal');
    if (modal) modal.style.display = 'flex';
  }

  async checkReentryFromModal() {
    const btn = document.getElementById('btnLockoutReentry');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "⏳ Đang kiểm tra quyền truy cập...";
    }

    await this.verifyCloudAccess();

    if (!this.isCloudLocked) {
      alert("🎉 Quyền truy cập đã được mở khóa thành công! Chúc em học tốt.");
      const modal = document.getElementById('adminLockoutModal');
      if (modal) modal.style.display = 'none';
      location.reload();
    } else {
      alert("⚠️ Thầy chưa mở khóa trên máy chủ. Em hãy nhắn Zalo báo Thầy kiểm tra rồi bấm lại nhé!");
      if (btn) {
        btn.disabled = false;
        btn.innerText = "🔄 Thầy đã mở khóa, bấm để vào học tiếp";
      }
    }
  }

  // 7. MODAL 2: ZALO ONBOARDING DÀNH CHO TÀI KHOẢN MỚI
  injectConversionModal() {
    if (document.getElementById('zaloConversionModal')) return;

    const modalHtml = `
      <div id="zaloConversionModal" style="display:none; position:fixed; inset:0; z-index:999999; background:rgba(15, 23, 42, 0.75); backdrop-filter:blur(6px); align-items:center; justify-content:center; padding:16px;">
        <div style="background:#FFFFFF; border:3px solid #E8E2D8; border-bottom:7px solid #D3CBC0; border-radius:26px; max-width:440px; width:100%; padding:26px 22px; text-align:center; position:relative; box-shadow:0 20px 40px rgba(0,0,0,0.3); font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
          
          <button type="button" onclick="window.authLockSystem.hideConversionModal()" style="position:absolute; top:14px; right:16px; background:#F1ECE6; border:none; width:34px; height:34px; border-radius:50%; font-weight:900; color:#7E7672; cursor:pointer; font-size:16px;">✕</button>

          <div style="width:60px; height:60px; border-radius:50%; background:#FFF4E5; border:3px solid #FCD34D; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto; font-size:26px;">
            🔒
          </div>

          <h3 style="margin:0 0 6px 0; color:#8B1518; font-size:19px; font-weight:900;">
            KÍCH HOẠT QUYỀN HỌC VIÊN
          </h3>
          <p id="lockFeatureNotice" style="margin:0 0 16px 0; font-size:13px; font-weight:700; color:#64748B;">
            Tính năng này yêu cầu tài khoản đã được phê duyệt lộ trình.
          </p>

          <div style="background:#F0F9FF; border:2px dashed #0284C7; border-radius:14px; padding:10px 14px; margin-bottom:16px;">
            <div style="font-size:11.5px; font-weight:800; color:#0369A1; text-transform:uppercase;">Mã Học Viên Của Em</div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:2px;">
              <span id="lockStudentIdDisplay" style="font-size:22px; font-weight:900; color:#0C4A6E; letter-spacing:1px;">${this.studentId}</span>
              <button type="button" onclick="window.authLockSystem.copyStudentId()" style="background:#0284C7; color:white; border:none; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">Copy</button>
            </div>
          </div>

          <!-- ẢNH QR ZALO -->
          <div style="margin-bottom:16px;">
            <div style="font-size:12.5px; font-weight:800; color:#334155; margin-bottom:8px;">Quét mã QR Zalo Thầy Phúc để mở quyền:</div>
            <img src="assets/zalo-qr.png" onerror="this.onerror=null; this.src='../assets/zalo-qr.png';" alt="QR Zalo Thầy Phúc" style="width:170px; height:170px; border-radius:14px; border:2px solid #E8E2D8; object-fit:cover; margin:0 auto; display:block;">
          </div>

          <a id="btnOpenZaloApp" href="https://zalo.me/0967561243" target="_blank" style="background:#0068FF; color:#FFFFFF; text-decoration:none; padding:13px 20px; border-radius:14px; font-weight:900; font-size:14.5px; display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:4px solid #004EC4; margin-bottom:12px;">
            Nhắn Zalo Cho Thầy Kích Hoạt
          </a>

          <div style="font-size:12px; font-weight:700; color:#64748B;">
            Thầy đã duyệt tài khoản của em? 
            <a href="javascript:location.reload()" style="color:#8B1518; font-weight:900; text-decoration:underline;">Tải lại trang</a>
          </div>

        </div>
      </div>
    `;
    if (document.body) {
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  }

  showConversionModal(featureName) {
    const modal = document.getElementById('zaloConversionModal');
    const notice = document.getElementById('lockFeatureNotice');
    if (notice) notice.innerHTML = `Để làm <b>${featureName}</b> và nhận AI sửa bài, em hãy gửi mã học viên cho thầy nhé!`;
    if (modal) modal.style.display = 'flex';
  }

  hideConversionModal() {
    const modal = document.getElementById('zaloConversionModal');
    if (modal) modal.style.display = 'none';
  }

  copyStudentId() {
    navigator.clipboard.writeText(this.studentId).then(() => {
      alert(`Đã copy mã học viên: ${this.studentId}`);
    });
  }

  // 8. THANH ADMIN NỔI
  initAdminBar() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('admin')) return;

    const barHtml = `
      <div id="floatingAdminBar" style="position:fixed; bottom:0; left:0; right:0; z-index:9999999; background:#0F172A; color:#FFFFFF; border-top:3px solid #D97706; padding:10px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; font-family:monospace; font-size:13px; box-shadow:0 -4px 20px rgba(0,0,0,0.4);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="background:#D97706; color:white; padding:3px 8px; border-radius:6px; font-weight:bold;">🛠️ TRẠM ADMIN TOOLBAR</span>
          <span>Mã tab hiện tại: <b style="color:#38BDF8;">${this.studentId}</b></span>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <input type="text" id="adminInputStudentCode" value="${this.studentId}" placeholder="Nhập mã TR-xxxx..." style="background:#1E293B; border:1px solid #475569; color:#FFFFFF; padding:6px 10px; border-radius:8px; outline:none; font-family:inherit; width:130px; font-weight:bold;">
          
          <button type="button" onclick="window.authLockSystem.adminSetStudentStatus('active')" style="background:#16A34A; color:white; border:none; padding:6px 14px; border-radius:8px; font-weight:bold; cursor:pointer;">
            ✓ Duyệt Active
          </button>

          <button type="button" onclick="window.authLockSystem.adminSetStudentStatus('locked')" style="background:#EF4444; color:white; border:none; padding:6px 14px; border-radius:8px; font-weight:bold; cursor:pointer;">
            🔒 Khóa Lại
          </button>
        </div>
      </div>
    `;
    if (document.body) {
      document.body.insertAdjacentHTML('beforeend', barHtml);
    }
  }

  adminSetStudentStatus(status) {
    const code = document.getElementById('adminInputStudentCode')?.value.trim() || this.studentId;
    if (code === this.studentId) {
      localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_STATUS, status);
      alert(`Đã cập nhật mã [${code}] sang trạng thái: ${status.toUpperCase()}`);
      location.reload();
    } else {
      alert(`Đã gửi lệnh cập nhật mã [${code}] ➔ ${status.toUpperCase()}`);
    }
  }
}

// KHỞI TẠO VÀ XUẤT TƯƠNG THÍCH KÉP
export const authLockSystem = new AuthLockSystem();
window.authLockSystem = authLockSystem;
