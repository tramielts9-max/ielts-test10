/**
 * =========================================================================
 * js/calendar-system.js - BỘ MÁY GOOGLE CALENDAR QUẢN TRỊ VIÊN & DUYỆT LỊCH HỌC
 * BẢN SIÊU NÂNG CẤP MASTER (AI VOICE CALENDAR X MAKEUP ENGINE X ATOMIC BATCH):
 *  1. SIDEBAR TRÁI: MINI CALENDAR + LỌC HỌC SINH MULTI-CHECKBOX
 *  2. 4 CHẾ ĐỘ XEM: NGÀY (DAY), TUẦN (WEEK), THÁNG (MONTH), LỊCH BIỂU (AGENDA)
 *  3. BỘ MÁY LẶP LẠI SIÊU LINH HOẠT (RECURRENCE ENGINE):
 *     - BIẾN BUỔI TẠM THÀNH LỊCH LẶP LẠI NGAY TRONG BẢNG ĐIỀU CHỈNH
 *     - HỖ TRỢ LẶP ĐÚNG 1 KHUNG GIỜ RIÊNG BIỆT (VÍ DỤ CHỈ LẶP T7 09:00 - 11:00)
 *     - HỖ TRỢ LẶP NHIỀU THỨ TRONG TUẦN (T2, T4, T6...)
 *  4. XÓA CHUỖI THÔNG MINH (3 LỰA CHỌN: CHỈ BUỔI NÀY / TỪ NAY VỀ SAU / TOÀN BỘ CHUỖI)
 *  5. SỬA CHUỖI THÔNG MINH (ÁP DỤNG RIÊNG HOẶC ĐỒNG BỘ TOÀN CHUỖI)
 *  6. PHÁT HIỆN TRÙNG LỊCH (CONFLICT DETECTOR: BÁO ĐỎ KHI TRÙNG GIỜ GIÁO VIÊN)
 *  7. PHÂN LOẠI MÀU THEO KỸ NĂNG: SPEAKING, WRITING 1, WRITING 2, L&R, MOCK
 *  8. TỰ ĐỘNG BUNG GIAO DIỆN TRÀN VIỀN (FULL-WIDTH 98% TOÀN MÀN HÌNH)
 *  9. CHỐNG MẤT LỊCH VỚI SMART MERGE & ATOMIC BATCH WRITE GHI 1 LẦN TRÊN CLOUD
 * 10. TRỢ LÝ HYBRID AI (NÓI HOẶC GÕ CHỮ): THỜI GIAN THU ÂM KHÔNG GIỚI HẠN + WATERFALL GEMINI
 * 11. ĐỘNG CƠ XIN NGHỈ & HỌC BÙ 1-CLICK: BẢO LƯU BUỔI HỌC VÀ TẠO BUỔI BÙ LIÊN KẾT
 * =========================================================================
 */

import { CONFIG } from './config.js';
import { stateManager } from './state.js';

// 1. MÃ HÓA RUNTIME AUTH KEY CHO GEMINI AI (CHUẨN TỪ QUIZ-V.JS)
const _AUTH_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 116, 80, 107, 51, 45, 50,
  75, 103, 117, 114, 119, 117, 116, 65, 115, 55, 95, 118, 82, 66,
  121, 81, 110, 113, 67, 48, 77, 86, 55, 52, 66, 119, 107, 82, 107,
  80, 110, 74, 89, 70, 90, 49, 119
];

function getDecodedKey() {
  return _AUTH_SEEDS.map(c => String.fromCharCode(c)).join('');
}

// 2. DANH SÁCH MODEL AI THỰC THI THEO THỨ TỰ ƯU TIÊN FALLBACK WATERFALL
const GEMINI_WATERFALL_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
];

// Danh mục kỹ năng và mã màu Google Calendar chuẩn
export const SKILL_COLORS = {
  speaking: { label: "Speaking 1-1", color: "#DC2626", bg: "#FEE2E2", border: "#F87171" },
  writing2: { label: "Writing Task 2", color: "#7C3AED", bg: "#F3E8FF", border: "#C084FC" },
  writing1: { label: "Writing Task 1", color: "#2563EB", bg: "#DBEAFE", border: "#60A5FA" },
  listening_reading: { label: "Listening & Reading", color: "#0D9488", bg: "#CCFBF1", border: "#2DD4BF" },
  mock: { label: "Full Mock Test", color: "#D97706", bg: "#FEF3C7", border: "#FBBF24" }
};

class AdminCalendarSystem {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'week'; // 'day' | 'week' | 'month' | 'agenda'
    this.selectedStudentFilter = 'all';
    this.searchQuery = '';
    this.events = [];
    this.knownStudents = [];
    this.tuitionRegistry = {};
    this.activeEditingEvent = null;
    this.makeupTargetEvent = null;
    this.isLoading = false;
    this.isSidebarOpen = true;

    // Trạng thái Trợ lý Giọng nói & Gõ chữ Voice AI
    this.speechRecognition = null;
    this.isRecordingVoice = false;
    this.voiceTranscript = '';

    // Lắng nghe phím tắt điều hướng chuẩn Google Calendar
    this.bindKeyboardShortcuts();

    // Tiêm các modal cần thiết vào DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectModals());
    } else {
      this.injectModals();
    }
  }

  // Tiện ích kiểm tra xem email có phải Admin
  isAdminEmail(email) {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    const adminList = (CONFIG?.ADMIN_EMAILS || []).map(e => e.toLowerCase().trim());
    return adminList.includes(clean) || clean.includes('admin') || clean === 'tramielts9@gmail.com' || clean === 'dinhnguyenphuc019.2@gmail.com';
  }

  // Khởi động khi mở tab Lịch (kèm bung rộng tràn viền màn hình)
  async init(mountContainerId = 'adminCalendarMountPoint') {
    this.mountId = mountContainerId;
    
    // Tự động bung rộng giao diện tràn viền
    this.enableFullWidthMode();

    await this.loadSchedules();
    await this.fetchKnownStudents();
    await this.loadTuitionData();
    this.render();
  }

  // Tự động bung rộng toàn màn hình
  enableFullWidthMode() {
    document.body.classList.add('cal-fullwidth-active');
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
      mainContainer.classList.add('cal-expanded-container');
    }
  }

  // 1. TẢI TẤT CẢ BUỔI HỌC VỚI CƠ CHẾ SMART MERGE CHỐNG MẤT SẠCH LỊCH KHI RELOAD
  async loadSchedules() {
    this.isLoading = true;
    const user = stateManager.getUser();

    try {
      let cloudEvents = null;
      if (CONFIG.DRIVE_STORAGE_URL) {
        const res = await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "get_schedules", userEmail: user.email || 'tramielts9@gmail.com' })
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.events)) {
          cloudEvents = data.events;
        }
      }

      // Đọc bộ nhớ đệm an toàn trên thiết bị
      let localEvents = [];
      try {
        const cachedRaw = localStorage.getItem('admin_cached_schedules');
        if (cachedRaw) localEvents = JSON.parse(cachedRaw);
      } catch (err) {}

      // THUẬT TOÁN SMART MERGE: CHỐNG MẤT LỊCH TUYỆT ĐỐI
      if (Array.isArray(cloudEvents) && cloudEvents.length > 0) {
        this.events = cloudEvents;
        localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
      } else if (localEvents.length > 0) {
        console.warn("⚠️ Cloud trả về rỗng nhưng máy có lịch. Kích hoạt cơ chế Smart Sync phục hồi Drive!");
        this.events = localEvents;
        if (CONFIG.DRIVE_STORAGE_URL) {
          fetch(CONFIG.DRIVE_STORAGE_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "admin_save_schedules_batch",
              adminEmail: user.email || 'tramielts9@gmail.com',
              events: this.events
            })
          }).catch(e => console.warn("Lỗi tự phục hồi lên Cloud:", e));
        }
      } else {
        this.events = cloudEvents || [];
      }
    } catch (e) {
      console.warn("Mất kết nối Cloud, chuyển sang chế độ Offline Cache an toàn:", e);
      try {
        const raw = localStorage.getItem('admin_cached_schedules');
        if (raw) this.events = JSON.parse(raw);
      } catch (err) {}
    } finally {
      this.isLoading = false;
    }
  }

  // 2. TẢI DỮ LIỆU HỌC PHÍ TỪ DRIVE HOẶC CACHE
  async loadTuitionData() {
    try {
      const raw = localStorage.getItem('admin_cached_tuition_registry');
      if (raw) this.tuitionRegistry = JSON.parse(raw);
    } catch (e) {}
  }

  // 3. TỰ ĐỘNG THU THẬP TẤT CẢ HỌC SINH TỪ CLOUD
  async fetchKnownStudents() {
    const listMap = new Map();
    const user = stateManager.getUser();
    const adminEmail = user.email || 'tramielts9@gmail.com';

    if (CONFIG.DRIVE_STORAGE_URL) {
      try {
        const res = await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "admin_get_all", adminEmail: adminEmail })
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.attempts)) {
          data.attempts.forEach(att => {
            const em = (att.studentEmail || "").toLowerCase().trim();
            if (em && !this.isAdminEmail(em)) {
              listMap.set(em, att.studentName || "Học viên");
            }
          });
        }
      } catch (err) {
        console.warn("Không thể tải danh sách học sinh từ Cloud:", err);
      }
    }

    try {
      const hist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      hist.forEach(h => {
        const em = (h.studentEmail || '').toLowerCase().trim();
        if (em && !this.isAdminEmail(em) && !listMap.has(em)) {
          listMap.set(em, h.studentName || 'Học viên');
        }
      });
    } catch (e) {}

    this.events.forEach(ev => {
      if (Array.isArray(ev.studentEmails)) {
        ev.studentEmails.forEach((em, idx) => {
          const cleanEm = (em || '').toLowerCase().trim();
          if (cleanEm && !this.isAdminEmail(cleanEm) && !listMap.has(cleanEm)) {
            const nm = (ev.studentNames && ev.studentNames[idx]) ? ev.studentNames[idx] : 'Học viên';
            listMap.set(cleanEm, nm);
          }
        });
      } else if (ev.studentEmail) {
        const cleanEm = (ev.studentEmail || '').toLowerCase().trim();
        if (cleanEm && !this.isAdminEmail(cleanEm) && !listMap.has(cleanEm)) {
          listMap.set(cleanEm, ev.studentName || 'Học viên');
        }
      }
    });

    this.knownStudents = Array.from(listMap.entries()).map(([email, name]) => ({ email, name }));
  }

  // 4. LẮNG NGHE PHÍM TẮT BÀN PHÍM
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 't') { this.goToday(); }
      else if (key === 'w') { this.switchView('week'); }
      else if (key === 'm') { this.switchView('month'); }
      else if (key === 'd') { this.switchView('day'); }
      else if (key === 'a') { this.switchView('agenda'); }
      else if (key === 'v') { this.toggleVoiceAssistant(); }
    });
  }

  // 5. RENDER CHÍNH CỦA BẢNG LỊCH (GIAO DIỆN TRÀN VIỀN TOÀN MÀN HÌNH)
  render() {
    const container = document.getElementById(this.mountId);
    if (!container) return;

    const rescheduleRequests = this.events.filter(ev => ev.status === 'reschedule_requested');

    container.innerHTML = `
      <div class="cal-app-container">
        
        <!-- A. BANNER BÁO CÁO YÊU CẦU DỜI LỊCH (NẾU CÓ) -->
        ${rescheduleRequests.length > 0 ? this.renderRescheduleAlertBanner(rescheduleRequests) : ''}

        <!-- B. THANH ĐIỀU HƯỚNG TOP TOOLBAR -->
        <div class="cal-top-toolbar">
          <div class="cal-nav-group">
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.toggleSidebar()" title="Ẩn/Hiện Sidebar" style="padding: 7px 12px; font-size: 13px;">☰</button>
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.navigateTime(-1)" style="padding: 7px 14px; font-size: 13px;">◀</button>
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.goToday()" style="padding: 7px 14px; font-size: 13px;" title="Phím tắt: T">Hôm nay</button>
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.navigateTime(1)" style="padding: 7px 14px; font-size: 13px;">▶</button>
            <span class="cal-title-display">${this.getCalendarTitle()}</span>
          </div>

          <div class="cal-nav-group">
            <!-- Ô TÌM KIẾM SỰ KIỆN -->
            <input type="text" 
                   class="cal-search-input" 
                   placeholder="🔍 Tìm theo tên hoặc bài..." 
                   value="${this.searchQuery}" 
                   oninput="window.adminCalendar.handleSearch(this.value)">

            <!-- CHỌN VIEW: NGÀY / TUẦN / THÁNG / LỊCH BIỂU -->
            <div class="cal-view-selector">
              <button type="button" class="cal-view-btn ${this.viewMode === 'day' ? 'active' : ''}" onclick="window.adminCalendar.switchView('day')" title="Phím tắt: D">Ngày</button>
              <button type="button" class="cal-view-btn ${this.viewMode === 'week' ? 'active' : ''}" onclick="window.adminCalendar.switchView('week')" title="Phím tắt: W">Tuần</button>
              <button type="button" class="cal-view-btn ${this.viewMode === 'month' ? 'active' : ''}" onclick="window.adminCalendar.switchView('month')" title="Phím tắt: M">Tháng</button>
              <button type="button" class="cal-view-btn ${this.viewMode === 'agenda' ? 'active' : ''}" onclick="window.adminCalendar.switchView('agenda')" title="Phím tắt: A">Lịch Biểu</button>
            </div>

            <!-- NÚT QUẢN LÝ HỌC PHÍ -->
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.openTuitionModal()" style="padding: 9px 15px; font-size: 13px; color:#B45309 !important; border-color:#FCD34D;">
              💰 HỌC PHÍ
            </button>

            <!-- 🎙️ NÚT TRỢ LÝ AI (NÓI HOẶC GÕ CHỮ) -->
            <button type="button" class="btn-voice-ai ${this.isRecordingVoice ? 'recording' : ''}" id="btnVoiceCalendar" onclick="window.adminCalendar.toggleVoiceAssistant()" title="Nói hoặc gõ chữ để AI xếp lịch tự động (Phím tắt: V)">
              🎙️ ${this.isRecordingVoice ? 'ĐANG NGHE...' : 'GIỌNG NÓI AI'}
            </button>

            <!-- NÚT XẾP LỊCH MỚI BẰNG TAY -->
            <button type="button" class="btn-3d btn-3d-red" onclick="window.adminCalendar.openCreateModal()" style="padding: 9px 18px; font-size: 13px;">
              ➕ XẾP LỊCH HỌC
            </button>
          </div>
        </div>

        <!-- C. BỐ CỤC CHÍNH 2 CỘT RỘNG RÃI -->
        <div class="cal-main-layout ${this.isSidebarOpen ? '' : 'sidebar-collapsed'}">
          
          <!-- CỘT TRÁI: SIDEBAR -->
          <div class="cal-sidebar" id="calSidebarMount">
            ${this.renderSidebarHtml()}
          </div>

          <!-- CỘT PHẢI: LƯỚI LỊCH CHÍNH -->
          <div class="cal-grid-area">
            ${this.isLoading ? '<div style="text-align:center; padding:40px; font-weight:800; color:#78716C;">⏳ Đang đồng bộ lịch học từ Cloud...</div>' : ''}
            ${!this.isLoading && this.viewMode === 'day' ? this.renderDayViewHtml() : ''}
            ${!this.isLoading && this.viewMode === 'week' ? this.renderWeekViewHtml() : ''}
            ${!this.isLoading && this.viewMode === 'month' ? this.renderMonthViewHtml() : ''}
            ${!this.isLoading && this.viewMode === 'agenda' ? this.renderAgendaViewHtml() : ''}
          </div>

        </div>

        <!-- D. FOOTER THỐNG KÊ GIỜ DẠY -->
        ${this.renderTimeInsightsFooter()}

      </div>
    `;
  }

  // 6. RENDER BANNER XIN DỜI LỊCH
  renderRescheduleAlertBanner(requests) {
    return `
      <div class="cal-alert-banner">
        <div>
          <b>🔔 CÓ ${requests.length} YÊU CẦU XIN DỜI LỊCH HỌC:</b>
          <div style="font-size: 13px; color: #7F1D1D; margin-top: 2px;">
            ${requests.map(r => `• <b>${r.studentName}</b> (${r.date} lúc ${r.startTime}): "${r.rescheduleRequest?.reason || 'Xin dời'}" (Đề xuất: <i>${r.rescheduleRequest?.suggestedTime || 'Chưa hẹn'}</i>)`).join('<br>')}
          </div>
        </div>
        <button type="button" class="btn-3d" onclick="window.adminCalendar.openEditModal('${requests[0].id}')" style="background: #DC2626; color: white !important; font-size: 12px; padding: 7px 14px; border-bottom: 3px solid #991B1B;">
          Xử lý đơn &rarr;
        </button>
      </div>
    `;
  }

  // 7. RENDER SIDEBAR TRÁI
  renderSidebarHtml() {
    return `
      <div class="cal-mini-box">
        ${this.renderMiniCalendarHtml()}
      </div>

      <div class="cal-sidebar-filter-section">
        <div style="font-size: 12.5px; font-weight: 900; color: #8B1518; text-transform: uppercase; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
          <span>👥 Học Viên (${this.knownStudents.length})</span>
          <a href="javascript:void(0)" onclick="window.adminCalendar.changeStudentFilter('all')" style="font-size:11px; text-decoration:underline; color:#0284C7;">Hiện tất cả</a>
        </div>
        
        <div class="cal-sidebar-student-list">
          <label class="cal-sidebar-student-item ${this.selectedStudentFilter === 'all' ? 'active' : ''}">
            <input type="radio" name="studentFilterRadio" value="all" ${this.selectedStudentFilter === 'all' ? 'checked' : ''} onchange="window.adminCalendar.changeStudentFilter('all')">
            <span><b>Tất cả học sinh</b></span>
          </label>
          ${this.knownStudents.map(st => `
            <label class="cal-sidebar-student-item ${this.selectedStudentFilter === st.email ? 'active' : ''}">
              <input type="radio" name="studentFilterRadio" value="${st.email}" ${this.selectedStudentFilter === st.email ? 'checked' : ''} onchange="window.adminCalendar.changeStudentFilter('${st.email}')">
              <span class="cal-dot-indicator"></span>
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${st.name} (${st.email})">${st.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 8. RENDER MINI CALENDAR
  renderMiniCalendarHtml() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let gridHtml = '';
    const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    dayLabels.forEach(d => {
      gridHtml += `<div class="cal-mini-header-cell">${d}</div>`;
    });

    for (let i = 0; i < firstDayIndex; i++) {
      gridHtml += `<div class="cal-mini-cell empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const isSelected = this.isSameDay(thisDate, this.currentDate);
      const isToday = this.isSameDay(thisDate, new Date());
      const isoStr = this.formatIsoDate(thisDate);

      gridHtml += `
        <div class="cal-mini-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
             onclick="window.adminCalendar.jumpToDate('${isoStr}')">
          ${d}
        </div>
      `;
    }

    return `
      <div class="cal-mini-nav">
        <span style="font-weight:900; font-size:13px; color:#1E293B;">Tháng ${month + 1}/${year}</span>
        <div style="display:flex; gap:4px;">
          <button type="button" class="cal-mini-btn" onclick="window.adminCalendar.navigateMiniMonth(-1)">‹</button>
          <button type="button" class="cal-mini-btn" onclick="window.adminCalendar.navigateMiniMonth(1)">›</button>
        </div>
      </div>
      <div class="cal-mini-grid">
        ${gridHtml}
      </div>
    `;
  }

  // 9. GIAO DIỆN NGÀY (DAY VIEW)
  renderDayViewHtml() {
    const hours = [];
    for (let h = 7; h <= 22; h++) hours.push(h);

    const filteredEvents = this.getFilteredEvents();
    const dayIsoStr = this.formatIsoDate(this.currentDate);
    const eventsOnDay = filteredEvents.filter(ev => ev.date === dayIsoStr);

    let timeColHtml = '';
    hours.forEach(h => {
      timeColHtml += `<div class="cal-time-slot-label">${String(h).padStart(2, '0')}:00</div>`;
    });

    let hoursCellsHtml = '';
    hours.forEach(h => {
      const slotTime = `${String(h).padStart(2, '0')}:00`;
      hoursCellsHtml += `<div class="cal-hour-cell" onclick="window.adminCalendar.openCreateModal('${dayIsoStr}', '${slotTime}')"></div>`;
    });

    let eventsHtml = '';
    eventsOnDay.forEach(ev => {
      const topPx = this.timeToPixels(ev.startTime, 7);
      const heightPx = Math.max(48, this.durationToPixels(ev.startTime, ev.endTime));
      const skillStyle = this.getEventStyle(ev);
      const isSeries = !!ev.seriesId;
      const isExcused = ev.status === 'excused_absence';
      const isMakeup = !!ev.isMakeup;

      eventsHtml += `
        <div class="cal-event-card ${isExcused ? 'is-excused' : ''} ${isMakeup ? 'is-makeup' : ''}" 
             style="top: ${topPx}px; height: ${heightPx}px; background:${skillStyle.bg}; border:1.5px solid ${skillStyle.border}; border-left:5px solid ${skillStyle.color}; color:${skillStyle.color};" 
             onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
          <div class="cal-event-title">
            ${isMakeup ? '<span class="cal-makeup-badge">[HỌC BÙ]</span>' : ''}
            ${isSeries ? '🔁 ' : ''}${isExcused ? '⏸️ (Nghỉ có phép) ' : ''}${ev.status === 'reschedule_requested' ? '⚠️ ' : ''}${ev.isGroup ? '👥 ' : ''}${ev.studentName}
          </div>
          <div class="cal-event-time">${ev.startTime} - ${ev.endTime} • ${ev.title}</div>
          ${isExcused ? `
            <div style="margin-top:2px;">
              <button type="button" class="btn-cal-makeup" onclick="event.stopPropagation(); window.adminCalendar.openMakeupModal('${ev.id}')">
                ➕ Xếp Học Bù
              </button>
            </div>
          ` : ''}
          ${ev.meetUrl && !isExcused ? `<a href="${ev.meetUrl}" target="_blank" onclick="event.stopPropagation()" style="font-size:10px; color:${skillStyle.color}; text-decoration:underline; font-weight:800;">🔗 Vào Google Meet</a>` : ''}
        </div>
      `;
    });

    return `
      <div class="cal-week-grid-container" style="border-radius:14px;">
        <div class="cal-day-header-single">
          <b>${this.currentDate.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}</b>
          <span style="font-size:12px; color:#64748B;">(${eventsOnDay.length} buổi học)</span>
        </div>
        <div class="cal-week-body" style="grid-template-columns: 65px 1fr;">
          <div class="cal-time-col">${timeColHtml}</div>
          <div class="cal-day-col is-today" style="border-right:none;">
            ${hoursCellsHtml}
            ${eventsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // 10. GIAO DIỆN TUẦN (WEEK VIEW)
  renderWeekViewHtml() {
    const weekDays = this.getDaysOfWeek(this.currentDate);
    const hours = [];
    for (let h = 7; h <= 22; h++) hours.push(h);

    const filteredEvents = this.getFilteredEvents();

    let headerHtml = `<div class="cal-week-header-cell" style="background:#FAF7F2;"></div>`;
    weekDays.forEach(day => {
      const isToday = this.isSameDay(day.dateObj, new Date());
      headerHtml += `
        <div class="cal-week-header-cell ${isToday ? 'is-today' : ''}">
          <div class="cal-week-header-dayname">${day.dayName}</div>
          <div class="cal-week-header-daynum">${day.dateNum}</div>
        </div>
      `;
    });

    let timeColHtml = '';
    hours.forEach(h => {
      timeColHtml += `<div class="cal-time-slot-label">${String(h).padStart(2, '0')}:00</div>`;
    });

    let bodyColsHtml = '';
    weekDays.forEach(day => {
      const isToday = this.isSameDay(day.dateObj, new Date());
      const dayIsoStr = this.formatIsoDate(day.dateObj);
      const eventsOnDay = filteredEvents.filter(ev => ev.date === dayIsoStr);

      let eventsHtml = '';
      eventsOnDay.forEach(ev => {
        const topPx = this.timeToPixels(ev.startTime, 7);
        const heightPx = Math.max(48, this.durationToPixels(ev.startTime, ev.endTime));
        const skillStyle = this.getEventStyle(ev);
        const isSeries = !!ev.seriesId;
        const isExcused = ev.status === 'excused_absence';
        const isMakeup = !!ev.isMakeup;

        eventsHtml += `
          <div class="cal-event-card ${isExcused ? 'is-excused' : ''} ${isMakeup ? 'is-makeup' : ''}" 
               style="top: ${topPx}px; height: ${heightPx}px; background:${skillStyle.bg}; border:1.5px solid ${skillStyle.border}; border-left:4.5px solid ${skillStyle.color}; color:${skillStyle.color};" 
               onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
            <div class="cal-event-title">
              ${isMakeup ? '<span class="cal-makeup-badge">[BÙ]</span>' : ''}
              ${isSeries ? '🔁 ' : ''}${isExcused ? '⏸️ (Nghỉ) ' : ''}${ev.status === 'reschedule_requested' ? '⚠️ ' : ''}${ev.isGroup ? '👥 ' : ''}${ev.studentName}
            </div>
            <div class="cal-event-time">${ev.startTime} - ${ev.endTime}</div>
            ${isExcused ? `
              <div style="margin-top:2px;">
                <button type="button" class="btn-cal-makeup" onclick="event.stopPropagation(); window.adminCalendar.openMakeupModal('${ev.id}')">
                  ➕ Bù
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      let hoursCellsHtml = '';
      hours.forEach(h => {
        const slotTime = `${String(h).padStart(2, '0')}:00`;
        hoursCellsHtml += `<div class="cal-hour-cell" onclick="window.adminCalendar.openCreateModal('${dayIsoStr}', '${slotTime}')"></div>`;
      });

      bodyColsHtml += `
        <div class="cal-day-col ${isToday ? 'is-today' : ''}">
          ${hoursCellsHtml}
          ${eventsHtml}
        </div>
      `;
    });

    return `
      <div class="cal-week-grid-container">
        <div class="cal-week-header">${headerHtml}</div>
        <div class="cal-week-body">
          <div class="cal-time-col">${timeColHtml}</div>
          ${bodyColsHtml}
        </div>
      </div>
    `;
  }

  // 11. GIAO DIỆN THÁNG (MONTH VIEW)
  renderMonthViewHtml() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const filteredEvents = this.getFilteredEvents();

    let gridHtml = '';
    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    dayNames.forEach(d => {
      gridHtml += `<div style="text-align:center; font-weight:800; font-size:12px; color:#64748B; padding:6px 0;">${d}</div>`;
    });

    for (let i = 0; i < firstDayIndex; i++) {
      gridHtml += `<div style="background:#FAF7F2; border-radius:12px; opacity:0.4;"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const isToday = this.isSameDay(dateObj, new Date());
      const isoStr = this.formatIsoDate(dateObj);
      const dayEvents = filteredEvents.filter(ev => ev.date === isoStr);

      gridHtml += `
        <div class="cal-month-day-cell ${isToday ? 'is-today' : ''}" onclick="window.adminCalendar.openCreateModal('${isoStr}', '19:30')">
          <div class="cal-month-day-header">
            <span>${d}</span>
            ${dayEvents.length > 0 ? `<span style="font-size:11px; background:#E0F2FE; color:#0369A1; padding:1px 6px; border-radius:10px;">${dayEvents.length} lớp</span>` : ''}
          </div>
          <div style="overflow-y:auto; max-height:65px;">
            ${dayEvents.map(ev => {
              const style = this.getEventStyle(ev);
              const isExcused = ev.status === 'excused_absence';
              const isMakeup = !!ev.isMakeup;
              return `
                <div class="cal-month-event-item" 
                     style="border-left: 3px solid ${style.color}; color:${style.color}; ${isExcused ? 'opacity:0.6; text-decoration:line-through;' : ''}" 
                     onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
                  ${isMakeup ? '[BÙ]' : ''} ${ev.seriesId ? '🔁' : ''} ${ev.startTime} ${ev.isGroup ? '👥' : ''} ${ev.studentName}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return `<div class="cal-month-grid">${gridHtml}</div>`;
  }

  // 12. GIAO DIỆN LỊCH BIỂU (AGENDA VIEW)
  renderAgendaViewHtml() {
    const filteredEvents = [...this.getFilteredEvents()].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

    if (filteredEvents.length === 0) {
      return `
        <div style="text-align:center; padding:50px 20px; color:#78716C; background:#FAF7F2; border-radius:16px;">
          <div style="font-size:32px; margin-bottom:8px;">📅</div>
          <div style="font-size:15px; font-weight:800;">Không có buổi học nào phù hợp với bộ lọc hiện tại!</div>
        </div>
      `;
    }

    const groups = {};
    filteredEvents.forEach(ev => {
      if (!groups[ev.date]) groups[ev.date] = [];
      groups[ev.date].push(ev);
    });

    return `
      <div class="cal-agenda-container">
        ${Object.keys(groups).map(dateStr => {
          const dObj = new Date(dateStr);
          const isToday = this.isSameDay(dObj, new Date());
          const dateTitle = dObj.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });

          return `
            <div class="cal-agenda-group ${isToday ? 'is-today' : ''}">
              <div class="cal-agenda-date-header">
                <b>📅 ${dateTitle}</b>
                ${isToday ? '<span class="cal-pill-today">Hôm nay</span>' : ''}
              </div>
              <div class="cal-agenda-list">
                ${groups[dateStr].map(ev => {
                  const style = this.getEventStyle(ev);
                  const isExcused = ev.status === 'excused_absence';
                  const isMakeup = !!ev.isMakeup;

                  return `
                    <div class="cal-agenda-item" onclick="window.adminCalendar.openEditModal('${ev.id}')">
                      <div class="cal-agenda-time-pill" style="border-left: 4px solid ${style.color};">
                        <b>${ev.startTime} - ${ev.endTime}</b>
                      </div>
                      <div class="cal-agenda-content">
                        <div style="font-size:14px; font-weight:900; color:#1E293B;">
                          ${isMakeup ? '<span class="cal-makeup-badge">[HỌC BÙ]</span> ' : ''}
                          ${ev.seriesId ? '🔁 ' : ''}${ev.isGroup ? '👥 ' : '👤 '}${ev.studentName} • <span style="color:${style.color}">${ev.title}</span>
                        </div>
                        <div style="font-size:12px; color:#64748B; margin-top:2px;">
                          ${ev.notes ? `📌 Ghi chú: ${ev.notes}` : ''}
                          ${ev.meetUrl && !isExcused ? ` • <a href="${ev.meetUrl}" target="_blank" onclick="event.stopPropagation()" style="color:#0284C7; font-weight:800;">Link Meet</a>` : ''}
                        </div>
                      </div>
                      <div class="cal-agenda-status" style="display:flex; align-items:center; gap:6px;">
                        ${isExcused ? `
                          <button type="button" class="btn-cal-makeup" onclick="event.stopPropagation(); window.adminCalendar.openMakeupModal('${ev.id}')">
                            ➕ Xếp Học Bù
                          </button>
                        ` : ''}
                        <span class="status-badge status-${ev.status}">
                          ${ev.status === 'completed' ? 'Đã học' : (ev.status === 'reschedule_requested' ? 'Xin dời' : (ev.status === 'excused_absence' ? 'Nghỉ phép' : 'Sắp tới'))}
                        </span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 13. FOOTER THỐNG KÊ GIỜ DẠY
  renderTimeInsightsFooter() {
    const weekDays = this.getDaysOfWeek(this.currentDate);
    const startIso = this.formatIsoDate(weekDays[0].dateObj);
    const endIso = this.formatIsoDate(weekDays[6].dateObj);

    const weekEvents = this.events.filter(ev => ev.date >= startIso && ev.date <= endIso);
    let totalMinutes = 0;
    let singleCount = 0;
    let groupCount = 0;
    let pendingReschedule = 0;

    weekEvents.forEach(ev => {
      const duration = ev.durationMinutes || 120;
      totalMinutes += duration;
      if (ev.isGroup) groupCount++; else singleCount++;
      if (ev.status === 'reschedule_requested') pendingReschedule++;
    });

    const totalHours = (totalMinutes / 60).toFixed(1);

    return `
      <div class="cal-time-insights-bar">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">📊</span>
          <b>THỐNG KÊ TUẦN HIỆN TẠI:</b>
        </div>
        <div class="cal-insights-stats">
          <span>⏱️ Tổng giờ dạy: <b>${totalHours} giờ</b></span>
          <span>👤 Dạy 1-1: <b>${singleCount} buổi</b></span>
          <span>👥 Dạy nhóm: <b>${groupCount} buổi</b></span>
          ${pendingReschedule > 0 ? `<span style="color:#DC2626; font-weight:900;">⚠️ Xin dời: <b>${pendingReschedule} đơn</b></span>` : ''}
        </div>
      </div>
    `;
  }

  getEventStyle(ev) {
    if (ev.status === 'reschedule_requested') {
      return { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' };
    }
    if (ev.status === 'completed') {
      return { color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' };
    }
    if (ev.status === 'excused_absence') {
      return { color: '#64748B', bg: '#F1F5F9', border: '#94A3B8' };
    }
    if (ev.isMakeup) {
      return { color: '#C2410C', bg: '#FFF7ED', border: '#FDBA74' };
    }
    const skill = ev.skillType || (ev.isGroup ? 'writing2' : 'speaking');
    return SKILL_COLORS[skill] || SKILL_COLORS.speaking;
  }

  getFilteredEvents() {
    return this.events.filter(ev => {
      if (this.selectedStudentFilter !== 'all') {
        const f = this.selectedStudentFilter.toLowerCase().trim();
        const singleMatch = (ev.studentEmail || '').toLowerCase().trim() === f;
        const groupMatch = Array.isArray(ev.studentEmails) && ev.studentEmails.map(e => e.toLowerCase().trim()).includes(f);
        if (!singleMatch && !groupMatch) return false;
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase().trim();
        const titleMatch = (ev.title || '').toLowerCase().includes(q);
        const nameMatch = (ev.studentName || '').toLowerCase().includes(q);
        const noteMatch = (ev.notes || '').toLowerCase().includes(q);
        if (!titleMatch && !nameMatch && !noteMatch) return false;
      }

      return true;
    });
  }

  timeToPixels(timeStr, startHour = 7) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return Math.max(0, ((h - startHour) * 52) + (m / 60 * 52));
  }

  durationToPixels(startStr, endStr) {
    if (!startStr || !endStr) return 104;
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    const totalMinutes = ((h2 * 60) + m2) - ((h1 * 60) + m1);
    return Math.max(48, (totalMinutes / 60) * 52);
  }

  getDaysOfWeek(d) {
    const curr = new Date(d);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    const names = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push({
        dateObj: nextDay,
        dayName: names[i],
        dateNum: `${nextDay.getDate()}/${nextDay.getMonth() + 1}`
      });
    }
    return days;
  }

  formatIsoDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  getCalendarTitle() {
    const m = this.currentDate.getMonth() + 1;
    const y = this.currentDate.getFullYear();
    if (this.viewMode === 'month') return `Tháng ${m} năm ${y}`;
    if (this.viewMode === 'day') return `${this.currentDate.getDate()} tháng ${m}, ${y}`;
    const week = this.getDaysOfWeek(this.currentDate);
    return `${week[0].dateNum} - ${week[6].dateNum}/${y}`;
  }

  navigateTime(direction) {
    if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
    } else if (this.viewMode === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() + direction);
    } else {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    }
    this.render();
  }

  navigateMiniMonth(direction) {
    this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    this.render();
  }

  jumpToDate(isoStr) {
    const parts = isoStr.split('-').map(Number);
    this.currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
    this.render();
  }

  goToday() {
    this.currentDate = new Date();
    this.render();
  }

  switchView(mode) {
    this.viewMode = mode;
    this.render();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
    this.render();
  }

  changeStudentFilter(email) {
    this.selectedStudentFilter = email;
    this.render();
  }

  handleSearch(text) {
    this.searchQuery = text;
    this.render();
  }

  // 14. BỘ KIỂM TRA TRÙNG LỊCH
  checkScheduleConflict(date, startTime, endTime, excludeEventId = null) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const newStartMin = (startH * 60) + startM;
    const newEndMin = (endH * 60) + endM;

    for (const ev of this.events) {
      if (excludeEventId && ev.id === excludeEventId) continue;
      if (ev.date !== date) continue;
      if (ev.status === 'rescheduled_cancelled' || ev.status === 'excused_absence') continue;

      const [evStartH, evStartM] = ev.startTime.split(':').map(Number);
      const [evEndH, evEndM] = ev.endTime.split(':').map(Number);
      const evStartMin = (evStartH * 60) + evStartM;
      const evEndMin = (evEndH * 60) + evEndM;

      const isOverlap = Math.max(newStartMin, evStartMin) < Math.min(newEndMin, evEndMin);
      if (isOverlap) {
        return {
          hasConflict: true,
          conflictedEvent: ev
        };
      }
    }

    return { hasConflict: false };
  }

  // =========================================================================
  // 15. TRỢ LÝ AI HYBRID (NÓI HOẶC GÕ PHÍM - THU ÂM KHÔNG GIỚI HẠN THỜI GIAN)
  // =========================================================================
  toggleVoiceAssistant() {
    const modal = document.getElementById('adminVoiceAssistantModal');
    if (modal && modal.style.display === 'flex') {
      this.closeVoiceModal();
    } else {
      this.openVoiceModal();
      this.startVoiceRecognition();
    }
  }

  startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API.");
      const statusEl = document.getElementById('calVoiceStatusText');
      if (statusEl) statusEl.innerText = "⌨️ Micro không khả dụng. Thầy hãy gõ câu lệnh vào ô bên dưới nhé:";
      return;
    }

    try {
      if (this.speechRecognition) {
        try { this.speechRecognition.abort(); } catch(e) {}
      }

      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.lang = 'vi-VN';
      this.speechRecognition.continuous = true;       // BẬT THU ÂM LIÊN TỤC
      this.speechRecognition.interimResults = true;   // HIỂN THỊ CHỮ NGAY KHI ĐANG NÓI

      this.isRecordingVoice = true;
      this.updateVoiceButtonUI(true);

      const statusEl = document.getElementById('calVoiceStatusText');
      if (statusEl) statusEl.innerHTML = `🎙️ <span style="color:#DC2626;">Đang lắng nghe liên tục...</span> Thầy cứ nói tự nhiên, khi nào xong thì bấm nút <b>Gửi cho AI</b>:`;

      this.speechRecognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this.voiceTranscript += (this.voiceTranscript ? ' ' : '') + trans;
          } else {
            interim += trans;
          }
        }

        // Tự động đẩy văn bản vào khung gõ chữ (Textarea) theo thời gian thực
        const inputEl = document.getElementById('calVoiceTextInput');
        if (inputEl) {
          const combined = (this.voiceTranscript + (interim ? ' ' + interim : '')).trim();
          inputEl.value = combined;
        }
      };

      this.speechRecognition.onerror = (event) => {
        console.warn("Lỗi Web Speech:", event.error);
        if (event.error === 'no-speech') {
          return; // Thầy im lặng suy nghĩ thì không coi là lỗi
        }
      };

      this.speechRecognition.onend = () => {
        // TỰ ĐỘNG BẬT LẠI MICRO NẾU THẦY CHƯA CHỦ ĐỘNG BẤM DỪNG HOẶC GỬI
        if (this.isRecordingVoice) {
          try {
            this.speechRecognition.start();
            console.log("[Voice Assistant] Duy trì Micro không giới hạn thời gian...");
          } catch (e) {}
        }
      };

      this.speechRecognition.start();
    } catch (e) {
      console.warn("Không thể mở Micro:", e);
      this.isRecordingVoice = false;
      this.updateVoiceButtonUI(false);
    }
  }

  stopVoiceRecognition() {
    this.isRecordingVoice = false;
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
      this.speechRecognition = null;
    }
    this.updateVoiceButtonUI(false);
  }

  toggleMicRecordingState() {
    if (this.isRecordingVoice) {
      this.stopVoiceRecognition();
      const statusEl = document.getElementById('calVoiceStatusText');
      if (statusEl) statusEl.innerHTML = `⏸️ Đã tạm dừng Micro. Thầy có thể gõ thêm chữ hoặc bấm <b>Tiếp tục nói</b>:`;
      const btnToggle = document.getElementById('btnCalVoiceToggleMic');
      if (btnToggle) btnToggle.innerHTML = `🎙️ Tiếp tục nói`;
    } else {
      this.startVoiceRecognition();
      const btnToggle = document.getElementById('btnCalVoiceToggleMic');
      if (btnToggle) btnToggle.innerHTML = `⏸️ Tạm dừng Micro`;
    }
  }

  updateVoiceButtonUI(isRec) {
    const btn = document.getElementById('btnVoiceCalendar');
    if (btn) {
      if (isRec) {
        btn.classList.add('recording');
        btn.innerHTML = `🎙️ ĐANG NGHE...`;
      } else {
        btn.classList.remove('recording');
        btn.innerHTML = `🎙️ GIỌNG NÓI AI`;
      }
    }
  }

  openVoiceModal() {
    const modal = document.getElementById('adminVoiceAssistantModal');
    if (modal) {
      modal.style.display = 'flex';
      const statusText = document.getElementById('calVoiceStatusText');
      const textInput = document.getElementById('calVoiceTextInput');
      const btnToggle = document.getElementById('btnCalVoiceToggleMic');

      if (statusText) statusText.innerHTML = `🎙️ <span style="color:#DC2626;">Đang lắng nghe...</span> Thầy có thể nói vào Micro HOẶC gõ chữ vào ô dưới:`;
      if (textInput && !textInput.value.trim()) {
        textInput.value = '';
      }
      if (btnToggle) btnToggle.innerHTML = `⏸️ Tạm dừng Micro`;
    }
  }

  closeVoiceModal() {
    const modal = document.getElementById('adminVoiceAssistantModal');
    if (modal) modal.style.display = 'none';
    this.stopVoiceRecognition();
  }

  // Gửi lệnh cho AI (Lấy từ ô Textarea do Thầy nói hoặc gõ tay)
  submitVoiceCommandFromInput() {
    this.stopVoiceRecognition();
    const inputEl = document.getElementById('calVoiceTextInput');
    const text = (inputEl ? inputEl.value : this.voiceTranscript).trim();

    if (!text) {
      alert("⚠️ Thầy vui lòng nói vào Micro hoặc gõ nội dung yêu cầu xếp lịch vào ô trước khi gửi nhé!");
      return;
    }

    this.processVoiceCommandWithAI(text);
  }

  // Gọi Gemini AI tuần tự qua mảng Waterfall Models
  async callGeminiWithWaterfall(promptText) {
    const apiKey = getDecodedKey();
    let lastError = null;

    for (const model of GEMINI_WATERFALL_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) {
            console.log(`[AI Voice Calendar] Gọi thành công qua model: ${model}`);
            return txt;
          }
        } else {
          console.warn(`[AI Waterfall] Model ${model} trả về status ${res.status}, tự động chuyển model tiếp theo...`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AI Waterfall] Lỗi model ${model}:`, err.message);
      }
    }

    throw new Error(lastError ? lastError.message : "Tất cả các model Gemini trong danh sách ưu tiên đều không phản hồi.");
  }

  // Xử lý câu nói / câu chữ bằng AI Gemini
  async processVoiceCommandWithAI(commandText) {
    const statusText = document.getElementById('calVoiceStatusText');
    if (statusText) statusText.innerHTML = `⏳ <b>AI Gemini đang bóc tách thông tin lịch học...</b>`;

    const todayStr = this.formatIsoDate(new Date());
    const studentsSummary = this.knownStudents.map(s => `${s.name} (${s.email})`).join('; ');

    const systemPrompt = `
Bạn là Trợ lý AI Khảo thí & Quản lý Lịch học của Thầy tại TRẠM IELTS.
Nhiệm vụ: Trích xuất lịch học từ câu nói tự nhiên hoặc câu gõ chữ tiếng Việt của Thầy thành JSON có cấu trúc.

HÔM NAY LÀ: ${todayStr} (${new Date().toLocaleDateString('vi-VN', { weekday: 'long' })}).
DANH SÁCH HỌC SINH HIỆN CÓ:
${studentsSummary || 'Chưa có dữ liệu'}

CÂU LỆNH CỦA THẦY:
"${commandText}"

QUY TẮC BÓC TÁCH BẮT BUỘC:
1. "studentName": Tên học sinh tìm thấy gần nhất trong danh sách. Nếu không có trong danh sách, lấy tên được nói trong câu.
2. "skillType": Một trong các giá trị: "speaking", "writing2", "writing1", "listening_reading", "mock". (Mặc định: "speaking").
3. "date": Ngày bắt đầu (định dạng YYYY-MM-DD). Nếu nói "tối nay", "ngày mai", "thứ 3 tuần sau"... tự động tính toán chính xác từ hôm nay.
4. "startTime": Giờ bắt đầu (định dạng HH:mm, ví dụ "19:30"). Mặc định: "19:30".
5. "endTime": Giờ kết thúc (mặc định cộng thêm 2 tiếng từ startTime, ví dụ "21:30").
6. "repeatMode": "none" (buổi đơn lẻ), "single_day" (lặp 1 thứ mỗi tuần), hoặc "multi_days" (lặp nhiều thứ).
7. "repeatCount": Số buổi cần lặp lại (mặc định 12 nếu có lặp).
8. "daysOfWeek": Mảng các thứ trong tuần (0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7). Ví dụ thứ 3 và thứ 5 là [2, 4].
9. "notes": Ghi chú thêm nếu Thầy có dặn.

HÃY TRẢ VỀ DUY NHẤT 1 CHUỖI JSON (KHÔNG KÈM MARKDOWN, KHÔNG \`\`\`json):
{
  "studentName": "Đặng Minh Chương",
  "skillType": "speaking",
  "title": "Speaking 1-1 & Sửa Writing",
  "date": "2026-11-10",
  "startTime": "19:30",
  "endTime": "21:30",
  "repeatMode": "multi_days",
  "repeatCount": 12,
  "daysOfWeek": [2, 4],
  "notes": ""
}
`;

    try {
      const rawAiResponse = await this.callGeminiWithWaterfall(systemPrompt);
      const cleanJsonStr = rawAiResponse.replace(/^```json/, '').replace(/```$/, '').trim();
      const parsedData = JSON.parse(cleanJsonStr);

      this.closeVoiceModal();

      // Tự động map học sinh
      const matchedStudent = this.matchStudentByName(parsedData.studentName);
      const selectedEmails = matchedStudent ? [matchedStudent.email] : [];

      // Mở Modal Xếp Lịch và điền tự động dữ liệu do AI bóc tách
      this.openCreateModal(parsedData.date || todayStr, parsedData.startTime || '19:30');

      if (selectedEmails.length > 0) {
        this.renderStudentChecklist(selectedEmails);
      } else if (parsedData.studentName) {
        const customInput = document.getElementById('calCustomStudentEmail');
        if (customInput) customInput.value = parsedData.studentName;
      }

      if (parsedData.skillType) {
        const radio = document.querySelector(`input[name="eventSkillRadio"][value="${parsedData.skillType}"]`);
        if (radio) {
          radio.checked = true;
          this.updateSkillTheme(parsedData.skillType);
        }
      }

      if (parsedData.title) document.getElementById('calInputTitle').value = parsedData.title;
      if (parsedData.endTime) document.getElementById('calInputEndTime').value = parsedData.endTime;
      if (parsedData.notes) document.getElementById('calInputNotes').value = parsedData.notes;

      // Thiết lập chuỗi lặp lại nếu có
      if (parsedData.repeatMode && parsedData.repeatMode !== 'none') {
        const checkRepeat = document.getElementById('calCheckRepeat');
        if (checkRepeat) {
          checkRepeat.checked = true;
          this.toggleRepeatOptions(true);
        }

        const countInput = document.getElementById('calRepeatCount');
        if (countInput && parsedData.repeatCount) countInput.value = parsedData.repeatCount;

        if (parsedData.repeatMode === 'multi_days' && Array.isArray(parsedData.daysOfWeek)) {
          const multiRadio = document.querySelector('input[name="repeatModeRadio"][value="multi_days"]');
          if (multiRadio) multiRadio.checked = true;
          this.toggleDowSelection(true);

          document.querySelectorAll('.cal-dow-checkbox').forEach(cb => {
            const val = parseInt(cb.value, 10);
            cb.checked = parsedData.daysOfWeek.includes(val);
          });
        }
      }

      this.validateScheduleLive();
      alert(`🎉 AI đã bóc tách thành công lịch của bạn [${parsedData.studentName || 'Học viên'}]! Thầy hãy kiểm tra lại và bấm 'LƯU LỊCH' nhé.`);

    } catch (err) {
      alert("⚠️ Không thể phân tích: " + err.message);
      this.closeVoiceModal();
    }
  }

  // Tiện ích so khớp tên học sinh thông minh
  matchStudentByName(nameQuery) {
    if (!nameQuery) return null;
    const cleanQ = nameQuery.toLowerCase().trim();
    return this.knownStudents.find(s => {
      const cleanName = s.name.toLowerCase();
      return cleanName.includes(cleanQ) || cleanQ.includes(cleanName);
    }) || null;
  }

  // =========================================================================
  // 16. MODALS TOÀN BỘ HỆ THỐNG
  // =========================================================================
  injectModals() {
    if (document.getElementById('adminCalendarModal')) return;

    const modalHtml = `
      <!-- 1. MODAL XẾP & ĐIỀU CHỈNH BUỔI HỌC (CHỨA LẶP LẠI LINH HOẠT & HỌC BÙ) -->
      <div id="adminCalendarModal" class="cal-modal-backdrop" style="display:none;">
        <div class="cal-modal-box">
          <button type="button" onclick="window.adminCalendar.closeModal()" class="cal-modal-close-btn">✕</button>

          <h3 id="calModalHeading" style="margin:0 0 12px 0; color:#8B1518; font-size:18px; font-weight:900;">
            📅 XẾP LỊCH HỌC CHO HỌC VIÊN
          </h3>

          <div id="calModalRescheduleNotice" style="display:none;" class="cal-notice-box"></div>
          <div id="calModalConflictNotice" style="display:none;" class="cal-conflict-box"></div>
          <div id="calModalMakeupNotice" style="display:none;" class="cal-notice-box" style="background:#FFF7ED; border-color:#FDBA74; color:#C2410C;"></div>

          <!-- CHỌN KỸ NĂNG & MÀU SẮC -->
          <div class="cal-form-group">
            <label>🎨 Kỹ năng & Loại buổi học:</label>
            <div class="cal-skill-tag-group">
              ${Object.entries(SKILL_COLORS).map(([key, item]) => `
                <label class="cal-skill-radio-label">
                  <input type="radio" name="eventSkillRadio" value="${key}" ${key === 'speaking' ? 'checked' : ''} onchange="window.adminCalendar.updateSkillTheme(this.value)">
                  <span class="cal-skill-pill" style="border-color:${item.border}; color:${item.color}; background:${item.bg};">
                    ${item.label}
                  </span>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- CHỌN 1 HOẶC NHIỀU HỌC SINH -->
          <div class="cal-form-group">
            <label style="display:flex; justify-content:space-between; align-items:center;">
              <span>👥 Chọn học sinh (Tick 2+ bạn để xếp học nhóm):</span>
              <span id="calSelectedStudentCount" style="color:#0284C7; font-size:11.5px;">Đã chọn: 0 bạn</span>
            </label>
            <div id="calStudentChecklistContainer" class="cal-student-checklist"></div>
            <div style="margin-top:6px;">
              <input type="text" id="calCustomStudentEmail" placeholder="Hoặc gõ email học sinh mới..." class="cal-form-input" style="padding:6px 10px; font-size:12px;">
            </div>
          </div>

          <div class="cal-form-group">
            <label>📝 Tiêu đề buổi học:</label>
            <input type="text" id="calInputTitle" value="Speaking 1-1 & Sửa Writing Task 2" class="cal-form-input">
          </div>

          <div style="display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:10px;" class="cal-form-group">
            <div>
              <label>📅 Ngày học:</label>
              <input type="date" id="calInputDate" class="cal-form-input" onchange="window.adminCalendar.onDateChanged(); window.adminCalendar.validateScheduleLive();">
            </div>
            <div>
              <label>⏰ Bắt đầu:</label>
              <input type="time" id="calInputStartTime" value="19:30" class="cal-form-input" onchange="window.adminCalendar.autoCalculateEndTime(); window.adminCalendar.validateScheduleLive();">
            </div>
            <div>
              <label>⏰ Kết thúc (Mặc định 2h):</label>
              <input type="time" id="calInputEndTime" value="21:30" class="cal-form-input" onchange="window.adminCalendar.validateScheduleLive()">
            </div>
          </div>

          <!-- KHỐI TÙY CHỌN LẶP LẠI SIÊU LINH HOẠT -->
          <div id="calRecurrenceSection" class="cal-recurrence-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="calCheckRepeat" onchange="window.adminCalendar.toggleRepeatOptions(this.checked)">
                <b id="calRepeatCheckboxLabel">🔁 Lặp lại buổi học này hàng tuần</b>
              </label>
              <span id="calSeriesBadge" style="display:none;" class="cal-series-badge">Buổi thuộc chuỗi lặp</span>
            </div>

            <div id="calRepeatOptions" style="display:none; margin-top:10px;">
              <div class="cal-repeat-mode-box">
                <label class="cal-radio-repeat">
                  <input type="radio" name="repeatModeRadio" value="single_day" checked onchange="window.adminCalendar.toggleDowSelection(false)">
                  <span id="calLabelSingleDayRepeat">📌 Chỉ lặp đúng ngày này hàng tuần (cùng giờ)</span>
                </label>
                <label class="cal-radio-repeat">
                  <input type="radio" name="repeatModeRadio" value="multi_days" onchange="window.adminCalendar.toggleDowSelection(true)">
                  <span>🗓️ Lặp nhiều thứ trong tuần (T2, T4, T6...)</span>
                </label>
              </div>

              <div id="calMultiDowBox" style="display:none; margin-top:8px;">
                <div style="font-size:12px; color:#64748B; margin-bottom:6px;">Chọn các thứ trong tuần sẽ học cùng khung giờ này:</div>
                <div class="cal-dow-selector">
                  ${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, idx) => `
                    <label class="cal-dow-btn">
                      <input type="checkbox" class="cal-dow-checkbox" value="${(idx + 1) % 7}">
                      <span>${d}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:10px; margin-top:10px;">
                <span style="font-size:12.5px; font-weight:700;">Tổng số buổi cần xếp:</span>
                <input type="number" id="calRepeatCount" value="12" min="2" max="48" style="width:70px; padding:4px 8px; border-radius:8px; border:1.5px solid #CBD5E1; font-weight:800;">
                <span style="font-size:11.5px; color:#78716C;">(Ví dụ: 12 buổi)</span>
              </div>
            </div>
          </div>

          <div class="cal-form-group" style="margin-top:12px;">
            <label>🔗 Link Google Meet / Zoom:</label>
            <input type="url" id="calInputMeetUrl" placeholder="https://meet.google.com/..." class="cal-form-input">
          </div>

          <div class="cal-form-group">
            <label>📌 Ghi chú & Yêu cầu chuẩn bị:</label>
            <input type="text" id="calInputNotes" placeholder="Ví dụ: Đọc trước Passage 2 Cam 18..." class="cal-form-input">
          </div>

          <!-- TRẠNG THÁI BUỔI HỌC (TÍCH HỢP XIN NGHỈ BẢO LƯU) -->
          <div class="cal-form-group" id="calStatusSelectGroup" style="display:none;">
            <label>Trạng thái buổi học:</label>
            <select id="calInputStatus" class="cal-form-select" onchange="window.adminCalendar.onStatusChanged(this.value)">
              <option value="scheduled">Đã xếp lịch (Scheduled)</option>
              <option value="completed">Đã hoàn thành (Trừ 1 buổi học phí)</option>
              <option value="excused_absence">Học sinh xin nghỉ (Có bảo lưu - không trừ học phí)</option>
              <option value="reschedule_requested">Học sinh xin dời lịch</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:18px; gap:8px;">
            <div style="display:flex; gap:8px;">
              <button type="button" id="btnCalDeleteEvent" onclick="window.adminCalendar.promptDeleteEvent()" class="btn-3d btn-3d-delete" style="display:none;">
                🗑️ Xóa buổi
              </button>
              <button type="button" id="btnCalMakeupAction" onclick="window.adminCalendar.openMakeupModal(window.adminCalendar.activeEditingEvent?.id)" class="btn-3d" style="display:none; background:#F97316; color:white !important; border-bottom:3.5px solid #C2410C; font-size:13px; padding:10px 14px;">
                ➕ Xếp Lịch Bù
              </button>
            </div>
            <div style="display:flex; gap:8px; margin-left:auto;">
              <button type="button" onclick="window.adminCalendar.closeModal()" class="btn-3d btn-3d-white" style="padding:10px 16px; font-size:13px;">Hủy</button>
              <button type="button" id="btnCalSaveEvent" onclick="window.adminCalendar.saveEvent()" class="btn-3d btn-3d-red" style="padding:10px 20px; font-size:13.5px;">
                💾 LƯU LỊCH
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. MODAL XÁC NHẬN XÓA BUỔI LẶP LẠI (3 LỰA CHỌN) -->
      <div id="adminDeleteChoiceModal" class="cal-modal-backdrop" style="display:none; z-index:1000001;">
        <div class="cal-modal-box" style="max-width:440px; text-align:center;">
          <div style="font-size:36px; margin-bottom:8px;">🗑️</div>
          <h3 style="margin:0 0 8px 0; color:#DC2626; font-size:18px; font-weight:900;">XÓA BUỔI HỌC LẶP LẠI</h3>
          <p style="font-size:13px; color:#64748B; margin:0 0 16px 0; font-weight:700;">
            Buổi học này nằm trong một chuỗi lịch lặp lại. Thầy muốn xóa như thế nào?
          </p>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <button type="button" onclick="window.adminCalendar.executeDeleteOption('single')" class="btn-3d btn-3d-white" style="padding:11px; font-size:13px; text-align:left; justify-content:flex-start;">
              🔴 <b>Chỉ xóa buổi này</b> (Các tuần khác giữ nguyên)
            </button>
            <button type="button" onclick="window.adminCalendar.executeDeleteOption('future')" class="btn-3d btn-3d-white" style="padding:11px; font-size:13px; text-align:left; justify-content:flex-start; color:#B45309 !important;">
              🟠 <b>Xóa buổi này và tất cả các buổi sau</b>
            </button>
            <button type="button" onclick="window.adminCalendar.executeDeleteOption('all')" class="btn-3d" style="background:#EF4444; color:white !important; border-bottom:4px solid #B91C1C; padding:11px; font-size:13px; text-align:left; justify-content:flex-start;">
              ❌ <b>Xóa TOÀN BỘ chuỗi lịch lặp này</b>
            </button>
          </div>

          <div style="margin-top:14px;">
            <button type="button" onclick="window.adminCalendar.closeDeleteChoiceModal()" class="btn-3d btn-3d-white" style="padding:8px 20px; font-size:12.5px;">Hủy bỏ</button>
          </div>
        </div>
      </div>

      <!-- 3. MODAL QUẢN LÝ HỌC PHÍ -->
      <div id="adminTuitionModal" class="cal-modal-backdrop" style="display:none;">
        <div class="cal-modal-box" style="max-width:640px;">
          <button type="button" onclick="window.adminCalendar.closeTuitionModal()" class="cal-modal-close-btn">✕</button>

          <h3 style="margin:0 0 6px 0; color:#B45309; font-size:18px; font-weight:900;">
            💰 QUẢN LÝ GÓI HỌC PHÍ & ĐẾM LÙI BUỔI HỌC
          </h3>
          <p style="margin:0 0 14px 0; font-size:13px; color:#78716C; font-weight:700;">
            Hệ thống tự động đối chiếu số buổi đã dạy hoàn thành (Completed) để tính số buổi còn lại (Buổi nghỉ phép được bảo lưu):
          </p>

          <div style="overflow-x:auto;">
            <table class="cal-tuition-table">
              <thead>
                <tr>
                  <th>Học Sinh</th>
                  <th>Gói Đã Đóng</th>
                  <th>Đã Dạy</th>
                  <th>Còn Lại</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody id="calTuitionTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 4. MODAL TRỢ LÝ AI HYBRID (NÓI HOẶC GÕ CHỮ - THU ÂM KHÔNG GIỚI HẠN THỜI GIAN) -->
      <div id="adminVoiceAssistantModal" class="cal-modal-backdrop" style="display:none; z-index:1000002;">
        <div class="cal-modal-box" style="max-width:520px; text-align:left;">
          <button type="button" onclick="window.adminCalendar.closeVoiceModal()" class="cal-modal-close-btn">✕</button>

          <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
            <div style="font-size:32px;">🎙️</div>
            <div>
              <h3 style="margin:0; color:#4F46E5; font-size:17.5px; font-weight:900;">
                TRỢ LÝ AI XẾP LỊCH HỌC
              </h3>
              <div id="calVoiceStatusText" style="font-size:12.5px; color:#475569; font-weight:700; margin-top:2px;">
                Thầy có thể nói vào Micro HOẶC gõ chữ vào ô bên dưới:
              </div>
            </div>
          </div>

          <!-- KHUNG GÕ CHỮ & HIỂN THỊ GIỌNG NÓI ĐỒNG THỜI -->
          <div style="margin-bottom:12px;">
            <textarea id="calVoiceTextInput" 
                      class="cal-form-input" 
                      style="min-height:95px; padding:12px; font-size:13.5px; font-weight:600; line-height:1.5; border-radius:12px; resize:vertical; background:#FAF7F2; border:2px solid #CBD5E1;" 
                      placeholder="Thầy nói vào Micro (chữ sẽ tự chạy vào đây) HOẶC gõ phím trực tiếp vào đây...&#10;Ví dụ: Xếp cho Đặng Minh Chương học Speaking 1-1 tối thứ 3 và thứ 5 lúc 19:30 bắt đầu tuần này 12 buổi..."></textarea>
            
            <div style="font-size:11.5px; color:#64748B; font-weight:700; margin-top:6px; display:flex; justify-content:space-between; align-items:center;">
              <span>💡 Thầy có thể vừa nói vừa lấy tay gõ sửa lại chữ trong ô trước khi gửi.</span>
            </div>
          </div>

          <!-- HÀNG NÚT ĐIỀU KHIỂN -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:14px; flex-wrap:wrap;">
            <button type="button" id="btnCalVoiceToggleMic" onclick="window.adminCalendar.toggleMicRecordingState()" class="btn-3d btn-3d-white" style="padding:9px 14px; font-size:12.5px;">
              ⏸️ Tạm dừng Micro
            </button>

            <div style="display:flex; gap:8px; margin-left:auto;">
              <button type="button" onclick="window.adminCalendar.closeVoiceModal()" class="btn-3d btn-3d-white" style="padding:9px 15px; font-size:12.5px;">
                Đóng
              </button>
              <button type="button" onclick="window.adminCalendar.submitVoiceCommandFromInput()" class="btn-3d" style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color:white !important; border-bottom:3.5px solid #3730A3; padding:9px 18px; font-size:13px; font-weight:900;">
                🚀 GỬI CHO AI XẾP LỊCH
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Xử lý đổi trạng thái trực tiếp trên modal
  onStatusChanged(newStatus) {
    const makeupBtn = document.getElementById('btnCalMakeupAction');
    if (makeupBtn) {
      makeupBtn.style.display = newStatus === 'excused_absence' ? 'inline-block' : 'none';
    }
  }

  // Cập nhật nhãn lặp lại khi đổi ngày
  onDateChanged() {
    const dateVal = document.getElementById('calInputDate')?.value;
    if (!dateVal) return;
    const d = new Date(dateVal);
    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const label = document.getElementById('calLabelSingleDayRepeat');
    if (label) {
      label.innerText = `📌 Chỉ lặp đúng ${dayNames[d.getDay()]} hàng tuần (cùng giờ này)`;
    }
  }

  autoCalculateEndTime() {
    const startVal = document.getElementById('calInputStartTime')?.value || '19:30';
    const [h, m] = startVal.split(':').map(Number);
    const endH = String((h + 2) % 24).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    const endInput = document.getElementById('calInputEndTime');
    if (endInput) endInput.value = `${endH}:${endM}`;
  }

  toggleRepeatOptions(isChecked) {
    const box = document.getElementById('calRepeatOptions');
    if (box) box.style.display = isChecked ? 'block' : 'none';
  }

  toggleDowSelection(isMulti) {
    const dowBox = document.getElementById('calMultiDowBox');
    if (dowBox) dowBox.style.display = isMulti ? 'block' : 'none';
  }

  validateScheduleLive() {
    const date = document.getElementById('calInputDate')?.value;
    const startTime = document.getElementById('calInputStartTime')?.value;
    const endTime = document.getElementById('calInputEndTime')?.value;
    const conflictBox = document.getElementById('calModalConflictNotice');

    if (!date || !startTime || !endTime || !conflictBox) return;

    const conflictResult = this.checkScheduleConflict(date, startTime, endTime, this.activeEditingEvent?.id);
    if (conflictResult.hasConflict) {
      const c = conflictResult.conflictedEvent;
      conflictBox.style.display = 'block';
      conflictBox.innerHTML = `⚠️ <b>CẢNH BÁO TRÙNG LỊCH:</b> Khung giờ này Thầy đã có lịch dạy: <b>${c.studentName}</b> (${c.startTime} - ${c.endTime}).`;
    } else {
      conflictBox.style.display = 'none';
    }
  }

  renderStudentChecklist(selectedEmails = []) {
    const container = document.getElementById('calStudentChecklistContainer');
    if (!container) return;

    if (this.knownStudents.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:#78716C; padding:6px;">Chưa có học sinh nào. Thầy hãy gõ email vào ô dưới nhé!</div>`;
      return;
    }

    container.innerHTML = this.knownStudents.map(st => {
      const isChecked = selectedEmails.includes(st.email.toLowerCase().trim());
      return `
        <label class="cal-student-check-item">
          <input type="checkbox" value="${st.email}" data-name="${st.name}" ${isChecked ? 'checked' : ''} onchange="window.adminCalendar.updateSelectedCount()">
          <span><b>${st.name}</b> (${st.email})</span>
        </label>
      `;
    }).join('');

    this.updateSelectedCount();
  }

  updateSelectedCount() {
    const checked = document.querySelectorAll('#calStudentChecklistContainer input[type="checkbox"]:checked');
    const counter = document.getElementById('calSelectedStudentCount');
    if (counter) {
      counter.innerText = `Đã chọn: ${checked.length} bạn ${checked.length > 1 ? '(Lớp nhóm)' : ''}`;
    }
  }

  updateSkillTheme(skill) {
    const titleInput = document.getElementById('calInputTitle');
    if (titleInput && (!titleInput.value || titleInput.value.includes('Speaking') || titleInput.value.includes('Writing'))) {
      if (skill === 'speaking') titleInput.value = 'Speaking 1-1 & Sửa Writing Task 2';
      else if (skill === 'writing2') titleInput.value = 'Chữa Writing Task 2 Chuyên Sâu';
      else if (skill === 'writing1') titleInput.value = 'Luyện Writing Task 1 Dạng Biểu Đồ';
      else if (skill === 'listening_reading') titleInput.value = 'Chữa Đề Listening & Reading Cam 21';
      else if (skill === 'mock') titleInput.value = 'Thi Thử Mock Test Áp Lực Thật';
    }
  }

  openCreateModal(dateStr = '', startTimeStr = '19:30') {
    this.activeEditingEvent = null;
    this.makeupTargetEvent = null;

    const preselect = this.selectedStudentFilter !== 'all' ? [this.selectedStudentFilter.toLowerCase()] : [];
    this.renderStudentChecklist(preselect);

    document.getElementById('calModalHeading').innerText = '➕ XẾP LỊCH HỌC MỚI';
    document.getElementById('calModalRescheduleNotice').style.display = 'none';
    document.getElementById('calModalConflictNotice').style.display = 'none';
    document.getElementById('calModalMakeupNotice').style.display = 'none';
    document.getElementById('btnCalDeleteEvent').style.display = 'none';
    document.getElementById('btnCalMakeupAction').style.display = 'none';
    document.getElementById('calStatusSelectGroup').style.display = 'none';
    document.getElementById('calSeriesBadge').style.display = 'none';
    document.getElementById('calRepeatCheckboxLabel').innerText = '🔁 Lặp lại buổi học này hàng tuần';

    document.getElementById('calInputTitle').value = 'Speaking 1-1 & Sửa Writing Task 2';
    document.getElementById('calInputDate').value = dateStr || this.formatIsoDate(new Date());
    document.getElementById('calInputStartTime').value = startTimeStr;
    
    this.autoCalculateEndTime();

    document.getElementById('calInputMeetUrl').value = '';
    document.getElementById('calInputNotes').value = '';
    document.getElementById('calCustomStudentEmail').value = '';

    // Reset lặp lại
    const repeatCheck = document.getElementById('calCheckRepeat');
    if (repeatCheck) repeatCheck.checked = false;
    this.toggleRepeatOptions(false);
    this.onDateChanged();

    document.getElementById('adminCalendarModal').style.display = 'flex';
    this.validateScheduleLive();
  }

  // 17. MỞ MODAL XẾP LỊCH HỌC BÙ 1-CLICK (MAKEUP ENGINE)
  openMakeupModal(eventId) {
    const originalEv = this.events.find(e => e.id === eventId);
    if (!originalEv) return;

    this.closeModal();
    this.openCreateModal();

    this.makeupTargetEvent = originalEv;
    const selectedList = Array.isArray(originalEv.studentEmails) ? originalEv.studentEmails : [originalEv.studentEmail];
    this.renderStudentChecklist(selectedList.map(e => (e || '').toLowerCase()));

    document.getElementById('calModalHeading').innerText = '➕ XẾP BUỔI HỌC BÙ';
    document.getElementById('calInputTitle').value = `[HỌC BÙ] - ${originalEv.studentName} (${SKILL_COLORS[originalEv.skillType]?.label || 'IELTS'})`;
    document.getElementById('calInputNotes').value = `Học bù cho buổi nghỉ ngày ${originalEv.date} (${originalEv.startTime} - ${originalEv.endTime})`;
    document.getElementById('calInputMeetUrl').value = originalEv.meetUrl || '';

    const skillRadio = document.querySelector(`input[name="eventSkillRadio"][value="${originalEv.skillType || 'speaking'}"]`);
    if (skillRadio) skillRadio.checked = true;

    const makeupNotice = document.getElementById('calModalMakeupNotice');
    if (makeupNotice) {
      makeupNotice.style.display = 'block';
      makeupNotice.innerHTML = `📌 <b>LỊCH HỌC BÙ:</b> Buổi học này được tự động liên kết với buổi nghỉ ngày <b>${originalEv.date}</b> của học viên <b>${originalEv.studentName}</b>. Khi học sinh học xong buổi bù này, học phí mới được trừ.`;
    }

    document.getElementById('adminCalendarModal').style.display = 'flex';
  }

  // MỞ BẢNG ĐIỀU CHỈNH BUỔI HỌC
  openEditModal(eventId) {
    const ev = this.events.find(e => e.id === eventId);
    if (!ev) return;

    this.activeEditingEvent = ev;
    this.makeupTargetEvent = null;

    const selectedList = Array.isArray(ev.studentEmails) ? ev.studentEmails : [ev.studentEmail];
    this.renderStudentChecklist(selectedList.map(e => (e || '').toLowerCase()));

    document.getElementById('calModalHeading').innerText = '✏️ ĐIỀU CHỈNH BUỔI HỌC';
    document.getElementById('btnCalDeleteEvent').style.display = 'block';
    document.getElementById('calStatusSelectGroup').style.display = 'block';
    document.getElementById('calModalMakeupNotice').style.display = 'none';

    // HIỂN THỊ TRẠNG THÁI CHUỖI LẶP LẠI
    const seriesBadge = document.getElementById('calSeriesBadge');
    const repeatCheckboxLabel = document.getElementById('calRepeatCheckboxLabel');
    const repeatCheck = document.getElementById('calCheckRepeat');

    if (ev.seriesId) {
      seriesBadge.style.display = 'inline-block';
      repeatCheckboxLabel.innerText = '🔁 Đang là chuỗi lặp lại (Có thể đổi giờ hoặc mở rộng)';
      if (repeatCheck) repeatCheck.checked = true;
      this.toggleRepeatOptions(true);
    } else {
      seriesBadge.style.display = 'none';
      repeatCheckboxLabel.innerText = '🔁 Biến buổi này thành chuỗi lặp lại hàng tuần';
      if (repeatCheck) repeatCheck.checked = false;
      this.toggleRepeatOptions(false);
    }

    const notice = document.getElementById('calModalRescheduleNotice');
    if (ev.status === 'reschedule_requested' && ev.rescheduleRequest) {
      notice.style.display = 'block';
      notice.innerHTML = `⚠️ <b>HỌC SINH XIN DỜI LỊCH:</b><br>"${ev.rescheduleRequest.reason}"<br>⏰ Giờ mong muốn: <b>${ev.rescheduleRequest.suggestedTime || 'Chưa hẹn'}</b>`;
    } else {
      notice.style.display = 'none';
    }

    const skillRadio = document.querySelector(`input[name="eventSkillRadio"][value="${ev.skillType || 'speaking'}"]`);
    if (skillRadio) skillRadio.checked = true;

    document.getElementById('calInputTitle').value = ev.title;
    document.getElementById('calInputDate').value = ev.date;
    document.getElementById('calInputStartTime').value = ev.startTime;
    document.getElementById('calInputEndTime').value = ev.endTime;
    document.getElementById('calInputMeetUrl').value = ev.meetUrl || '';
    document.getElementById('calInputNotes').value = ev.notes || '';
    document.getElementById('calInputStatus').value = ev.status || 'scheduled';
    document.getElementById('calCustomStudentEmail').value = '';

    // Nút Xếp Lịch Bù hiển thị khi trạng thái là nghỉ phép
    this.onStatusChanged(ev.status);

    this.onDateChanged();
    document.getElementById('adminCalendarModal').style.display = 'flex';
    this.validateScheduleLive();
  }

  closeModal() {
    const m = document.getElementById('adminCalendarModal');
    if (m) m.style.display = 'none';
    this.activeEditingEvent = null;
    this.makeupTargetEvent = null;
  }

  // 18. LƯU BUỔI HỌC (SỬ DỤNG ATOMIC BATCH WRITE KHI LẶP CHUỖI ĐỂ TRÁNH MẤT LỊCH)
  async saveEvent() {
    const checkedBoxes = Array.from(document.querySelectorAll('#calStudentChecklistContainer input[type="checkbox"]:checked'));
    let studentEmails = checkedBoxes.map(cb => cb.value.toLowerCase().trim());
    let studentNames = checkedBoxes.map(cb => cb.getAttribute('data-name') || 'Học viên');

    const customEmail = document.getElementById('calCustomStudentEmail')?.value.trim().toLowerCase();
    if (customEmail && !studentEmails.includes(customEmail)) {
      studentEmails.push(customEmail);
      studentNames.push(customEmail.split('@')[0]);
    }

    if (studentEmails.length === 0) {
      alert("⚠️ Vui lòng tick chọn ít nhất 1 học sinh để xếp lịch!");
      return;
    }

    const title = document.getElementById('calInputTitle').value.trim();
    const date = document.getElementById('calInputDate').value;
    const startTime = document.getElementById('calInputStartTime').value;
    const endTime = document.getElementById('calInputEndTime').value;
    const meetUrl = document.getElementById('calInputMeetUrl').value.trim();
    const notes = document.getElementById('calInputNotes').value.trim();
    const skillType = document.querySelector('input[name="eventSkillRadio"]:checked')?.value || 'speaking';
    const status = document.getElementById('calInputStatus')?.value || 'scheduled';

    if (!date || !startTime || !endTime) {
      alert("⚠️ Vui lòng chọn Ngày học, Giờ bắt đầu và Giờ kết thúc!");
      return;
    }

    const conflictResult = this.checkScheduleConflict(date, startTime, endTime, this.activeEditingEvent?.id);
    if (conflictResult.hasConflict) {
      const c = conflictResult.conflictedEvent;
      if (!confirm(`⚠️ CẢNH BÁO: Khung giờ này Thầy đã có lịch dạy [${c.studentName}] (${c.startTime} - ${c.endTime}). Thầy có chắc muốn lưu trùng không?`)) {
        return;
      }
    }

    const btn = document.getElementById('btnCalSaveEvent');
    btn.disabled = true;
    btn.innerText = "⏳ Đang lưu...";

    const isRepeatChecked = document.getElementById('calCheckRepeat')?.checked;
    const repeatMode = document.querySelector('input[name="repeatModeRadio"]:checked')?.value || 'single_day';
    const user = stateManager.getUser();
    const adminEmail = user.email || 'tramielts9@gmail.com';

    try {
      // TRƯỜNG HỢP 1: SỬA TOÀN BỘ CHUỖI LẶP LẠI (DÙNG ATOMIC BATCH WRITE)
      if (this.activeEditingEvent && this.activeEditingEvent.seriesId) {
        const updateAll = confirm("Buổi học này thuộc chuỗi lặp lại. Thầy có muốn cập nhật thông tin này (giờ học, link meet, ghi chú) cho TOÀN BỘ các buổi trong chuỗi không?\n\n• Bấm OK: Cập nhật toàn bộ chuỗi\n• Bấm Cancel: Chỉ sửa riêng buổi hôm nay");
        
        if (updateAll) {
          const sid = this.activeEditingEvent.seriesId;
          const updatedBatch = [];

          this.events.forEach(ev => {
            if (ev.seriesId === sid) {
              ev.title = title;
              ev.startTime = startTime;
              ev.endTime = endTime;
              ev.meetUrl = meetUrl;
              ev.notes = notes;
              ev.skillType = skillType;
              ev.studentEmails = studentEmails;
              ev.studentNames = studentNames;
              ev.studentName = studentNames.join(', ');
              updatedBatch.push(ev);
            }
          });

          // Lưu Batch 1 lần duy nhất lên Google Drive
          if (CONFIG.DRIVE_STORAGE_URL && updatedBatch.length > 0) {
            await fetch(CONFIG.DRIVE_STORAGE_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({ action: "admin_save_schedules_batch", adminEmail: adminEmail, events: updatedBatch })
            });
          }

          localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
          alert("🎉 Đã cập nhật thành công cho toàn bộ chuỗi buổi học!");
          this.closeModal();
          this.render();
          return;
        }
      }

      // TRƯỜNG HỢP 2: TẠO MỚI CHUỖI LẶP LẠI (ATOMIC BATCH WRITE GHI 1 LẦN TRÊN DRIVE)
      if (isRepeatChecked && (!this.activeEditingEvent || !this.activeEditingEvent.seriesId)) {
        const repeatTotal = parseInt(document.getElementById('calRepeatCount')?.value, 10) || 12;
        const seriesId = `series_${Date.now()}`;
        const newEventsBatch = [];
        let curCheckDate = new Date(date);
        let createdCount = 0;

        if (repeatMode === 'single_day') {
          while (createdCount < repeatTotal) {
            const thisIso = this.formatIsoDate(curCheckDate);
            newEventsBatch.push({
              id: `evt_${Date.now()}_${createdCount}`,
              seriesId: seriesId,
              studentEmail: studentEmails[0],
              studentName: studentNames.join(', '),
              studentEmails: studentEmails,
              studentNames: studentNames,
              isGroup: studentEmails.length > 1,
              title: title || (studentEmails.length > 1 ? `Lớp nhóm (${studentNames.join(', ')})` : 'Speaking 1-1'),
              skillType: skillType,
              date: thisIso,
              startTime: startTime,
              endTime: endTime,
              meetUrl: meetUrl,
              notes: notes,
              status: 'scheduled'
            });
            createdCount++;
            curCheckDate.setDate(curCheckDate.getDate() + 7);
          }
        } else {
          const selectedDOWs = Array.from(document.querySelectorAll('.cal-dow-checkbox:checked')).map(cb => parseInt(cb.value, 10));
          if (selectedDOWs.length === 0) {
            alert("⚠️ Vui lòng tick chọn ít nhất 1 thứ trong tuần để lặp lại!");
            btn.disabled = false;
            btn.innerText = "💾 LƯU LỊCH";
            return;
          }

          while (createdCount < repeatTotal) {
            const currentDow = curCheckDate.getDay();
            if (selectedDOWs.includes(currentDow)) {
              const thisIso = this.formatIsoDate(curCheckDate);
              newEventsBatch.push({
                id: `evt_${Date.now()}_${createdCount}`,
                seriesId: seriesId,
                studentEmail: studentEmails[0],
                studentName: studentNames.join(', '),
                studentEmails: studentEmails,
                studentNames: studentNames,
                isGroup: studentEmails.length > 1,
                title: title || (studentEmails.length > 1 ? `Lớp nhóm (${studentNames.join(', ')})` : 'Speaking 1-1'),
                skillType: skillType,
                date: thisIso,
                startTime: startTime,
                endTime: endTime,
                meetUrl: meetUrl,
                notes: notes,
                status: 'scheduled'
              });
              createdCount++;
            }
            curCheckDate.setDate(curCheckDate.getDate() + 1);
          }
        }

        // GỬI DUY NHẤT 1 HTTP REQUEST BATCH LÊN GOOGLE DRIVE
        if (CONFIG.DRIVE_STORAGE_URL && newEventsBatch.length > 0) {
          await fetch(CONFIG.DRIVE_STORAGE_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "admin_save_schedules_batch", adminEmail: adminEmail, events: newEventsBatch })
          });
        }

        // Cập nhật mảng sự kiện trong bộ nhớ máy Thầy
        this.events.push(...newEventsBatch);
        localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
        alert(`🎉 Đã tự động tạo chuỗi ${createdCount} buổi học thành công không bị gián đoạn!`);

      } else {
        // TRƯỜNG HỢP 3: LƯU BUỔI ĐƠN LẺ HOẶC BUỔI HỌC BÙ
        const isMakeupSession = !!(this.makeupTargetEvent || this.activeEditingEvent?.isMakeup);
        const originalId = this.makeupTargetEvent ? this.makeupTargetEvent.id : (this.activeEditingEvent?.originalEventId || null);

        const eventPayload = {
          id: this.activeEditingEvent ? this.activeEditingEvent.id : `evt_${Date.now()}`,
          seriesId: this.activeEditingEvent?.seriesId || null,
          isMakeup: isMakeupSession,
          originalEventId: originalId,
          studentEmail: studentEmails[0],
          studentName: studentNames.join(', '),
          studentEmails: studentEmails,
          studentNames: studentNames,
          isGroup: studentEmails.length > 1,
          title: title || (studentEmails.length > 1 ? `Lớp nhóm (${studentNames.join(', ')})` : 'Speaking 1-1'),
          skillType: skillType,
          date: date,
          startTime: startTime,
          endTime: endTime,
          meetUrl: meetUrl,
          notes: notes,
          status: status
        };

        if (CONFIG.DRIVE_STORAGE_URL) {
          await fetch(CONFIG.DRIVE_STORAGE_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "admin_save_schedule", adminEmail: adminEmail, event: eventPayload })
          });
        }

        const existIdx = this.events.findIndex(e => e.id === eventPayload.id);
        if (existIdx !== -1) {
          this.events[existIdx] = eventPayload;
        } else {
          this.events.push(eventPayload);
        }
        localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
        alert("🎉 Đã lưu lịch học thành công!");
      }

      this.closeModal();
      this.render();
    } catch (e) {
      alert("Lỗi lưu lịch: " + e.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "💾 LƯU LỊCH";
    }
  }

  // =========================================================================
  // 19. XÓA BUỔI THÔNG MINH (XÓA ĐƠN HOẶC TOÀN CHUỖI)
  // =========================================================================
  promptDeleteEvent() {
    if (!this.activeEditingEvent) return;

    if (this.activeEditingEvent.seriesId) {
      document.getElementById('adminDeleteChoiceModal').style.display = 'flex';
    } else {
      if (confirm(`⚠️ Thầy có chắc muốn XOÁ buổi học này không?`)) {
        this.executeDeleteOption('single');
      }
    }
  }

  closeDeleteChoiceModal() {
    const modal = document.getElementById('adminDeleteChoiceModal');
    if (modal) modal.style.display = 'none';
  }

  async executeDeleteOption(mode) {
    if (!this.activeEditingEvent) return;

    const currentEv = this.activeEditingEvent;
    const user = stateManager.getUser();
    const adminEmail = user.email || 'tramielts9@gmail.com';
    let idsToDelete = [];

    if (mode === 'single' || !currentEv.seriesId) {
      idsToDelete = [currentEv.id];
    } else if (mode === 'all') {
      idsToDelete = this.events.filter(e => e.seriesId === currentEv.seriesId).map(e => e.id);
    } else if (mode === 'future') {
      idsToDelete = this.events.filter(e => e.seriesId === currentEv.seriesId && e.date >= currentEv.date).map(e => e.id);
    }

    try {
      for (const id of idsToDelete) {
        if (CONFIG.DRIVE_STORAGE_URL) {
          fetch(CONFIG.DRIVE_STORAGE_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "admin_delete_schedule", adminEmail: adminEmail, eventId: id })
          }).catch(() => {});
        }
      }

      this.events = this.events.filter(e => !idsToDelete.includes(e.id));
      localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));

      alert(`✅ Đã xoá thành công ${idsToDelete.length} buổi học!`);
      this.closeDeleteChoiceModal();
      this.closeModal();
      this.render();
    } catch (e) {
      alert("Lỗi xoá lịch: " + e.message);
    }
  }

  // =========================================================================
  // 20. QUẢN LÝ HỌC PHÍ (TUITION TRACKER)
  // =========================================================================
  openTuitionModal() {
    const modal = document.getElementById('adminTuitionModal');
    const tbody = document.getElementById('calTuitionTableBody');
    if (!modal || !tbody) return;

    if (this.knownStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#78716C;">Chưa có học sinh nào trong hệ thống.</td></tr>`;
    } else {
      tbody.innerHTML = this.knownStudents.map(st => {
        const em = st.email.toLowerCase().trim();
        const info = this.tuitionRegistry[em] || { paidSessions: 12 };

        const completed = this.events.filter(ev => {
          const match = (ev.studentEmail || '').toLowerCase().trim() === em ||
                        (Array.isArray(ev.studentEmails) && ev.studentEmails.includes(em));
          return match && ev.status === 'completed';
        }).length;

        const remaining = Math.max(0, (info.paidSessions || 12) - completed);
        const isAlert = remaining <= 1;

        return `
          <tr>
            <td>
              <b>${st.name}</b><br>
              <span style="font-size:11.5px; color:#78716C;">${st.email}</span>
            </td>
            <td>
              <input type="number" id="tuition_input_${st.email.replace(/[^a-zA-Z0-9]/g, '_')}" value="${info.paidSessions || 12}" min="1" max="100" style="width:65px; padding:4px 8px; border:1.5px solid #CBD5E1; border-radius:8px; font-weight:800;"> buổi
            </td>
            <td><b>${completed}</b> buổi</td>
            <td>
              <b style="color: ${isAlert ? '#DC2626' : '#16A34A'}; font-size:14px;">${remaining} buổi</b>
              ${isAlert ? '<div style="font-size:10.5px; color:#DC2626; font-weight:900;">⚠️ Tới hạn học phí</div>' : ''}
            </td>
            <td>
              <button type="button" onclick="window.adminCalendar.saveStudentTuition('${st.email}', '${st.name}')" class="btn-3d btn-3d-blue" style="padding:6px 12px; font-size:12px; border-radius:8px;">
                Lưu
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    modal.style.display = 'flex';
  }

  closeTuitionModal() {
    const modal = document.getElementById('adminTuitionModal');
    if (modal) modal.style.display = 'none';
  }

  async saveStudentTuition(email, name) {
    const safeKey = email.replace(/[^a-zA-Z0-9]/g, '_');
    const input = document.getElementById(`tuition_input_${safeKey}`);
    const paid = parseInt(input?.value, 10) || 12;
    const user = stateManager.getUser();

    try {
      if (CONFIG.DRIVE_STORAGE_URL) {
        await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "admin_set_tuition",
            adminEmail: user.email || 'tramielts9@gmail.com',
            studentEmail: email,
            studentName: name,
            paidSessions: paid
          })
        });
      }

      this.tuitionRegistry[email.toLowerCase().trim()] = { paidSessions: paid, studentName: name };
      localStorage.setItem('admin_cached_tuition_registry', JSON.stringify(this.tuitionRegistry));

      alert(`🎉 Đã cập nhật gói ${paid} buổi cho học viên ${name}!`);
      this.openTuitionModal();
    } catch (e) {
      alert("Lỗi lưu học phí: " + e.message);
    }
  }
}

export const adminCalendar = new AdminCalendarSystem();
window.adminCalendar = adminCalendar;
