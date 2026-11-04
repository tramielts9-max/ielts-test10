/**
 * =========================================================================
 * js/calendar-system.js - BỘ MÁY GOOGLE CALENDAR QUẢN TRỊ VIÊN & DUYỆT LỊCH HỌC
 * BẢN PRO TOÀN DIỆN (GOOGLE CALENDAR DESKTOP REPLICA x DUOLINGO THEME):
 *  1. SIDEBAR TRÁI: MINI CALENDAR + LỌC HỌC SINH MULTI-CHECKBOX
 *  2. 4 CHẾ ĐỘ XEM: NGÀY (DAY), TUẦN (WEEK), THÁNG (MONTH), LỊCH BIỂU (AGENDA)
 *  3. BỘ MÁY XẾP LỊCH LẶP LẠI (RECURRENCE ENGINE: TỰ TÍNH VÀ SINH ĐỦ 12 BUỔI)
 *  4. PHÁT HIỆN TRÙNG LỊCH (CONFLICT DETECTOR: BÁO ĐỎ KHI TRÙNG GIỜ GIÁO VIÊN)
 *  5. PHÂN LOẠI MÀU THEO KỸ NĂNG: SPEAKING, WRITING 1, WRITING 2, L&R, MOCK
 *  6. THANH THỐNG KÊ GIỜ DẠY (TIME INSIGHTS MINI)
 *  7. BẢNG QUẢN LÝ HỌC PHÍ & ĐẾM LÙI BUỔI HỌC CỦA TỪNG HỌC VIÊN
 *  8. BẢO LƯU 100% KHẢ NĂNG CHỐNG CRASH VỚI DỰ PHÒNG LOCALSTORAGE
 * =========================================================================
 */

import { CONFIG } from './config.js';
import { stateManager } from './state.js';

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
    this.isLoading = false;
    this.isSidebarOpen = true;

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

  // Khởi động khi mở tab Lịch
  async init(mountContainerId = 'adminCalendarMountPoint') {
    this.mountId = mountContainerId;
    await this.loadSchedules();
    await this.fetchKnownStudents();
    await this.loadTuitionData();
    this.render();
  }

  // 1. TẢI TẤT CẢ BUỔI HỌC TỪ CLOUD / LOCALSTORAGE
  async loadSchedules() {
    this.isLoading = true;
    const user = stateManager.getUser();

    try {
      if (CONFIG.DRIVE_STORAGE_URL) {
        const res = await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "get_schedules", userEmail: user.email || 'tramielts9@gmail.com' })
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.events)) {
          this.events = data.events;
          localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
        }
      }
    } catch (e) {
      console.warn("Chuyển sang dùng bộ nhớ đệm thiết bị cho lịch học:", e);
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

    // A. Quét từ Cloud Google Drive
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

    // B. Quét từ bộ nhớ cục bộ
    try {
      const hist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      hist.forEach(h => {
        const em = (h.studentEmail || '').toLowerCase().trim();
        if (em && !this.isAdminEmail(em) && !listMap.has(em)) {
          listMap.set(em, h.studentName || 'Học viên');
        }
      });
    } catch (e) {}

    // C. Quét từ các buổi học đã xếp
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
      // Bỏ qua nếu đang gõ trong input hoặc textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 't') { this.goToday(); }
      else if (key === 'w') { this.switchView('week'); }
      else if (key === 'm') { this.switchView('month'); }
      else if (key === 'd') { this.switchView('day'); }
      else if (key === 'a') { this.switchView('agenda'); }
    });
  }

  // 5. RENDER CHÍNH CỦA BẢNG LỊCH (SPLIT VIEW VỚI SIDEBAR & MAIN BODY)
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

            <!-- NÚT XẾP LỊCH MỚI -->
            <button type="button" class="btn-3d btn-3d-red" onclick="window.adminCalendar.openCreateModal()" style="padding: 9px 18px; font-size: 13px;">
              ➕ XẾP LỊCH HỌC
            </button>
          </div>
        </div>

        <!-- C. BỐ CỤC CHÍNH 2 CỘT (SIDEBAR + MAIN CALENDAR) -->
        <div class="cal-main-layout ${this.isSidebarOpen ? '' : 'sidebar-collapsed'}">
          
          <!-- CỘT TRÁI: SIDEBAR (MINI CALENDAR & DANH SÁCH LỌC HỌC SINH) -->
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

        <!-- D. FOOTER: BẢNG THỐNG KÊ GIỜ DẠY (TIME INSIGHTS MINI) -->
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

  // 7. RENDER SIDEBAR TRÁI (MINI CALENDAR & FILTER HỌC SINH)
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

  // 8. RENDER BẢNG LỊCH NHỎ (MINI CALENDAR ENGINE)
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

  // 9. GIAO DIỆN XEM THEO NGÀY (DAY VIEW)
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

      eventsHtml += `
        <div class="cal-event-card" 
             style="top: ${topPx}px; height: ${heightPx}px; background:${skillStyle.bg}; border:1.5px solid ${skillStyle.border}; border-left:5px solid ${skillStyle.color}; color:${skillStyle.color};" 
             onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
          <div class="cal-event-title">
            ${ev.status === 'reschedule_requested' ? '⚠️ ' : ''}${ev.isGroup ? '👥 ' : ''}${ev.studentName}
          </div>
          <div class="cal-event-time">${ev.startTime} - ${ev.endTime} • ${ev.title}</div>
          ${ev.meetUrl ? `<a href="${ev.meetUrl}" target="_blank" onclick="event.stopPropagation()" style="font-size:10px; color:${skillStyle.color}; text-decoration:underline; font-weight:800;">🔗 Vào Google Meet</a>` : ''}
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

  // 10. GIAO DIỆN XEM THEO TUẦN (WEEK VIEW)
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

        eventsHtml += `
          <div class="cal-event-card" 
               style="top: ${topPx}px; height: ${heightPx}px; background:${skillStyle.bg}; border:1.5px solid ${skillStyle.border}; border-left:4.5px solid ${skillStyle.color}; color:${skillStyle.color};" 
               onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
            <div class="cal-event-title">
              ${ev.status === 'reschedule_requested' ? '⚠️ ' : ''}${ev.isGroup ? '👥 ' : ''}${ev.studentName}
            </div>
            <div class="cal-event-time">${ev.startTime} - ${ev.endTime}</div>
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

  // 11. GIAO DIỆN XEM THEO THÁNG (MONTH VIEW)
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
              return `
                <div class="cal-month-event-item" 
                     style="border-left: 3px solid ${style.color}; color:${style.color};" 
                     onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
                  ${ev.startTime} ${ev.isGroup ? '👥' : ''} ${ev.studentName}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return `<div class="cal-month-grid">${gridHtml}</div>`;
  }

  // 12. GIAO DIỆN LỊCH BIỂU (AGENDA / SCHEDULE VIEW)
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

    // Nhóm sự kiện theo ngày
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
                  return `
                    <div class="cal-agenda-item" onclick="window.adminCalendar.openEditModal('${ev.id}')">
                      <div class="cal-agenda-time-pill" style="border-left: 4px solid ${style.color};">
                        <b>${ev.startTime} - ${ev.endTime}</b>
                      </div>
                      <div class="cal-agenda-content">
                        <div style="font-size:14px; font-weight:900; color:#1E293B;">
                          ${ev.isGroup ? '👥 ' : '👤 '}${ev.studentName} • <span style="color:${style.color}">${ev.title}</span>
                        </div>
                        <div style="font-size:12px; color:#64748B; margin-top:2px;">
                          ${ev.notes ? `📌 Ghi chú: ${ev.notes}` : ''}
                          ${ev.meetUrl ? ` • <a href="${ev.meetUrl}" target="_blank" onclick="event.stopPropagation()" style="color:#0284C7; font-weight:800;">Link Meet</a>` : ''}
                        </div>
                      </div>
                      <div class="cal-agenda-status">
                        <span class="status-badge status-${ev.status}">${ev.status === 'completed' ? 'Đã học' : (ev.status === 'reschedule_requested' ? 'Xin dời' : 'Sắp tới')}</span>
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

  // 13. FOOTER THỐNG KÊ GIỜ DẠY (TIME INSIGHTS)
  renderTimeInsightsFooter() {
    const weekDays = this.getDaysOfWeek(this.currentDate);
    const startIso = this.formatIsoDate(weekDays[0].dateObj);
    const endIso = this.formatIsoDate(weekDays[6].dateObj);

    // Lọc sự kiện trong tuần hiện tại
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

  // TIỆN ÍCH LỌC VÀ LẤY MÀU SỰ KIỆN
  getEventStyle(ev) {
    if (ev.status === 'reschedule_requested') {
      return { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' };
    }
    if (ev.status === 'completed') {
      return { color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' };
    }
    const skill = ev.skillType || (ev.isGroup ? 'writing2' : 'speaking');
    return SKILL_COLORS[skill] || SKILL_COLORS.speaking;
  }

  getFilteredEvents() {
    return this.events.filter(ev => {
      // 1. Lọc theo học sinh
      if (this.selectedStudentFilter !== 'all') {
        const f = this.selectedStudentFilter.toLowerCase().trim();
        const singleMatch = (ev.studentEmail || '').toLowerCase().trim() === f;
        const groupMatch = Array.isArray(ev.studentEmails) && ev.studentEmails.map(e => e.toLowerCase().trim()).includes(f);
        if (!singleMatch && !groupMatch) return false;
      }

      // 2. Lọc theo từ khóa tìm kiếm
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
    if (!startStr || !endStr) return 104; // 2 tiếng = 104px
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

  // =========================================================================
  // 14. BỘ KIỂM TRA TRÙNG LỊCH (CONFLICT DETECTOR)
  // =========================================================================
  checkScheduleConflict(date, startTime, endTime, excludeEventId = null) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const newStartMin = (startH * 60) + startM;
    const newEndMin = (endH * 60) + endM;

    for (const ev of this.events) {
      if (excludeEventId && ev.id === excludeEventId) continue;
      if (ev.date !== date) continue;
      if (ev.status === 'rescheduled_cancelled') continue;

      const [evStartH, evStartM] = ev.startTime.split(':').map(Number);
      const [evEndH, evEndM] = ev.endTime.split(':').map(Number);
      const evStartMin = (evStartH * 60) + evStartM;
      const evEndMin = (evEndH * 60) + evEndM;

      // Kiểm tra giao khoảng thời gian [start, end)
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
  // 15. MODAL TẠO & SỬA BUỔI HỌC (LẶP LỊCH, CHECK TRÙNG, PHÂN MÀU)
  // =========================================================================
  injectModals() {
    if (document.getElementById('adminCalendarModal')) return;

    const modalHtml = `
      <!-- 1. MODAL XẾP LỊCH HỌC -->
      <div id="adminCalendarModal" class="cal-modal-backdrop" style="display:none;">
        <div class="cal-modal-box">
          <button type="button" onclick="window.adminCalendar.closeModal()" class="cal-modal-close-btn">✕</button>

          <h3 id="calModalHeading" style="margin:0 0 12px 0; color:#8B1518; font-size:18px; font-weight:900;">
            📅 XẾP LỊCH HỌC CHO HỌC VIÊN
          </h3>

          <div id="calModalRescheduleNotice" style="display:none;" class="cal-notice-box"></div>
          <div id="calModalConflictNotice" style="display:none;" class="cal-conflict-box"></div>

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
              <label>📅 Ngày bắt đầu:</label>
              <input type="date" id="calInputDate" class="cal-form-input" onchange="window.adminCalendar.validateScheduleLive()">
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

          <!-- KHỐI TÙY CHỌN LẶP LỊCH (RECURRENCE ENGINE) -->
          <div id="calRecurrenceSection" class="cal-recurrence-card">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="calCheckRepeat" onchange="window.adminCalendar.toggleRepeatOptions(this.checked)">
              <b>🔁 Lặp lại hàng tuần theo gói học phí</b>
            </label>

            <div id="calRepeatOptions" style="display:none; margin-top:10px;">
              <div style="font-size:12px; color:#64748B; margin-bottom:6px;">Chọn các thứ trong tuần sẽ học:</div>
              <div class="cal-dow-selector">
                ${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, idx) => `
                  <label class="cal-dow-btn">
                    <input type="checkbox" class="cal-dow-checkbox" value="${(idx + 1) % 7}">
                    <span>${d}</span>
                  </label>
                `).join('')}
              </div>

              <div style="display:flex; align-items:center; gap:10px; margin-top:10px;">
                <span style="font-size:12.5px; font-weight:700;">Số buổi cần xếp:</span>
                <input type="number" id="calRepeatCount" value="12" min="2" max="48" style="width:70px; padding:4px 8px; border-radius:8px; border:1.5px solid #CBD5E1; font-weight:800;">
                <span style="font-size:11.5px; color:#78716C;">(Ví dụ: 12 buổi = 1 khóa)</span>
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

          <!-- TRẠNG THÁI BUỔI HỌC -->
          <div class="cal-form-group" id="calStatusSelectGroup" style="display:none;">
            <label>Trạng thái buổi học:</label>
            <select id="calInputStatus" class="cal-form-select">
              <option value="scheduled">Đã xếp lịch (Scheduled)</option>
              <option value="completed">Đã hoàn thành (Trừ 1 buổi học phí)</option>
              <option value="reschedule_requested">Học sinh xin dời lịch</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:18px; gap:8px;">
            <button type="button" id="btnCalDeleteEvent" onclick="window.adminCalendar.deleteCurrentEvent()" class="btn-3d btn-3d-delete" style="display:none;">
              🗑️ Xóa buổi
            </button>
            <div style="display:flex; gap:8px; margin-left:auto;">
              <button type="button" onclick="window.adminCalendar.closeModal()" class="btn-3d btn-3d-white" style="padding:10px 16px; font-size:13px;">Hủy</button>
              <button type="button" id="btnCalSaveEvent" onclick="window.adminCalendar.saveEvent()" class="btn-3d btn-3d-red" style="padding:10px 20px; font-size:13.5px;">
                💾 LƯU LỊCH
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. MODAL QUẢN LÝ HỌC PHÍ & ĐẾM BUỔI HỌC -->
      <div id="adminTuitionModal" class="cal-modal-backdrop" style="display:none;">
        <div class="cal-modal-box" style="max-width:640px;">
          <button type="button" onclick="window.adminCalendar.closeTuitionModal()" class="cal-modal-close-btn">✕</button>

          <h3 style="margin:0 0 6px 0; color:#B45309; font-size:18px; font-weight:900;">
            💰 QUẢN LÝ GÓI HỌC PHÍ & ĐẾM LÙI BUỔI HỌC
          </h3>
          <p style="margin:0 0 14px 0; font-size:13px; color:#78716C; font-weight:700;">
            Hệ thống tự động đối chiếu số buổi đã dạy hoàn thành (Completed) để tính số buổi còn lại:
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
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Tự động tính giờ kết thúc sau 2 tiếng
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
      container.innerHTML = `<div style="font-size:12px; color:#78716C; padding:6px;">Chưa có học sinh nào. Mày hãy gõ email vào ô dưới nhé!</div>`;
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
    // Có thể tự động đổi tiêu đề gợi ý theo kỹ năng
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
    const preselect = this.selectedStudentFilter !== 'all' ? [this.selectedStudentFilter.toLowerCase()] : [];
    this.renderStudentChecklist(preselect);

    document.getElementById('calModalHeading').innerText = '➕ XẾP LỊCH HỌC MỚI';
    document.getElementById('calModalRescheduleNotice').style.display = 'none';
    document.getElementById('calModalConflictNotice').style.display = 'none';
    document.getElementById('btnCalDeleteEvent').style.display = 'none';
    document.getElementById('calStatusSelectGroup').style.display = 'none';
    document.getElementById('calRecurrenceSection').style.display = 'block';

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

    document.getElementById('adminCalendarModal').style.display = 'flex';
    this.validateScheduleLive();
  }

  openEditModal(eventId) {
    const ev = this.events.find(e => e.id === eventId);
    if (!ev) return;

    this.activeEditingEvent = ev;
    const selectedList = Array.isArray(ev.studentEmails) ? ev.studentEmails : [ev.studentEmail];
    this.renderStudentChecklist(selectedList.map(e => (e || '').toLowerCase()));

    document.getElementById('calModalHeading').innerText = '✏️ ĐIỀU CHỈNH BUỔI HỌC';
    document.getElementById('btnCalDeleteEvent').style.display = 'block';
    document.getElementById('calStatusSelectGroup').style.display = 'block';
    document.getElementById('calRecurrenceSection').style.display = 'none'; // Không lặp khi sửa buổi đơn lẻ

    const notice = document.getElementById('calModalRescheduleNotice');
    if (ev.status === 'reschedule_requested' && ev.rescheduleRequest) {
      notice.style.display = 'block';
      notice.innerHTML = `⚠️ <b>HỌC SINH XIN DỜI LỊCH:</b><br>"${ev.rescheduleRequest.reason}"<br>⏰ Giờ mong muốn: <b>${ev.rescheduleRequest.suggestedTime || 'Chưa hẹn'}</b>`;
    } else {
      notice.style.display = 'none';
    }

    // Chọn đúng skill radio
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

    document.getElementById('adminCalendarModal').style.display = 'flex';
    this.validateScheduleLive();
  }

  closeModal() {
    const m = document.getElementById('adminCalendarModal');
    if (m) m.style.display = 'none';
    this.activeEditingEvent = null;
  }

  // 16. LƯU BUỔI HỌC (HỖ TRỢ XẾP LẶP LẠI THEO CHUỖI RECURRENCE)
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

    // Kiểm tra trùng lịch
    const conflictResult = this.checkScheduleConflict(date, startTime, endTime, this.activeEditingEvent?.id);
    if (conflictResult.hasConflict) {
      const c = conflictResult.conflictedEvent;
      if (!confirm(`⚠️ CẢNH BÁO: Khung giờ này Thầy đã có lịch dạy [${c.studentName}] (${c.startTime} - ${c.endTime}). Bạn có chắc chắn muốn lưu đè trùng không?`)) {
        return;
      }
    }

    const btn = document.getElementById('btnCalSaveEvent');
    btn.disabled = true;
    btn.innerText = "⏳ Đang lưu...";

    const isRepeating = !this.activeEditingEvent && document.getElementById('calCheckRepeat')?.checked;

    try {
      const user = stateManager.getUser();
      const adminEmail = user.email || 'tramielts9@gmail.com';

      if (isRepeating) {
        // CƠ CHẾ XẾP LỊCH LẶP LẠI (RECURRENCE ENGINE)
        const selectedDOWs = Array.from(document.querySelectorAll('.cal-dow-checkbox:checked')).map(cb => parseInt(cb.value, 10));
        const repeatTotal = parseInt(document.getElementById('calRepeatCount')?.value, 10) || 12;

        if (selectedDOWs.length === 0) {
          alert("⚠️ Vui lòng chọn ít nhất 1 thứ trong tuần để lặp lại!");
          btn.disabled = false;
          btn.innerText = "💾 LƯU LỊCH";
          return;
        }

        const seriesId = `series_${Date.now()}`;
        const newEventsBatch = [];
        let curCheckDate = new Date(date);
        let createdCount = 0;

        // Sinh danh sách ngày tương ứng
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

        // Đẩy tuần tự lên Drive & lưu localStorage
        for (const evItem of newEventsBatch) {
          if (CONFIG.DRIVE_STORAGE_URL) {
            fetch(CONFIG.DRIVE_STORAGE_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({ action: "admin_save_schedule", adminEmail: adminEmail, event: evItem })
            }).catch(() => {});
          }
          this.events.push(evItem);
        }

        localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
        alert(`🎉 Đã tự động tạo chuỗi ${createdCount} buổi học thành công!`);

      } else {
        // XẾP / CẬP NHẬT 1 BUỔI ĐƠN LẺ
        const eventPayload = {
          id: this.activeEditingEvent ? this.activeEditingEvent.id : `evt_${Date.now()}`,
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

  // 17. XOÁ BUỔI HỌC
  async deleteCurrentEvent() {
    if (!this.activeEditingEvent) return;
    if (!confirm(`⚠️ Bạn có chắc chắn muốn XOÁ buổi học này không?`)) return;

    const eventId = this.activeEditingEvent.id;
    const user = stateManager.getUser();

    try {
      if (CONFIG.DRIVE_STORAGE_URL) {
        await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "admin_delete_schedule",
            adminEmail: user.email || 'tramielts9@gmail.com',
            eventId: eventId
          })
        });
      }

      this.events = this.events.filter(e => e.id !== eventId);
      localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));

      alert("✅ Đã xoá buổi học thành công!");
      this.closeModal();
      this.render();
    } catch (e) {
      alert("Lỗi xoá lịch: " + e.message);
    }
  }

  // =========================================================================
  // 18. QUẢN LÝ HỌC PHÍ (TUITION MODAL ACTIONS)
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

        // Đếm số buổi đã dạy (completed)
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
