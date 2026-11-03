/**
 * =========================================================================
 * js/calendar-system.js - BỘ MÁY GOOGLE CALENDAR QUẢN TRỊ VIÊN & DUYỆT LỊCH HỌC
 * BẢN NÂNG CẤP TOÀN DIỆN:
 *  1. HỖ TRỢ XẾP LỊCH HỌC 1-1 HOẶC HỌC NHÓM (2+ HỌC SINH CÙNG LÚC)
 *  2. THỜI LƯỢNG MẶC ĐỊNH 2 TIẾNG (TỰ DO ĐIỀU CHỈNH)
 *  3. BẢNG QUẢN LÝ GÓI HỌC PHÍ & ĐẾM NGƯỢC SỐ BUỔI CÒN LẠI TỪNG HỌC SINH
 * =========================================================================
 */

import { CONFIG } from './config.js';
import { stateManager } from './state.js';

class AdminCalendarSystem {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'week'; // 'week' | 'month'
    this.selectedStudentFilter = 'all';
    this.events = [];
    this.knownStudents = [];
    this.tuitionRegistry = {};
    this.activeEditingEvent = null;
    this.isLoading = false;

    // Tự động tiêm các modal HTML vào DOM khi sẵn sàng
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectModals());
    } else {
      this.injectModals();
    }
  }

  // Khởi động khi admin mở tab Calendar
  async init(mountContainerId = 'adminCalendarMountPoint') {
    this.mountId = mountContainerId;
    await this.fetchKnownStudents();
    await this.loadSchedules();
    await this.loadTuitionData();
    this.render();
  }

  // 1. TẢI TẤT CẢ BUỔI HỌC TỪ GOOGLE DRIVE
  async loadSchedules() {
    this.isLoading = true;
    const user = stateManager.getUser();

    try {
      if (CONFIG.DRIVE_STORAGE_URL) {
        const res = await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "get_schedules", userEmail: user.email })
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.events)) {
          this.events = data.events;
          localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));
        }
      }
    } catch (e) {
      console.warn("Dùng cache lịch học trên thiết bị:", e);
      try {
        const raw = localStorage.getItem('admin_cached_schedules');
        if (raw) this.events = JSON.parse(raw);
      } catch (err) {}
    } finally {
      this.isLoading = false;
    }
  }

  // 2. TẢI DỮ LIỆU HỌC PHÍ TOÀN BỘ HỌC SINH
  async loadTuitionData() {
    try {
      const raw = localStorage.getItem('admin_cached_tuition_registry');
      if (raw) this.tuitionRegistry = JSON.parse(raw);
    } catch(e) {}
  }

  // 3. TỰ ĐỘNG THU THẬP DANH SÁCH HỌC SINH ĐỂ ĐƯA VÀO CHECKLIST & BỘ LỌC
  async fetchKnownStudents() {
    const listMap = new Map();

    // Lấy từ lịch sử làm bài
    try {
      const hist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      hist.forEach(h => {
        if (h.studentEmail && !h.studentEmail.includes('admin')) {
          listMap.set(h.studentEmail.toLowerCase().trim(), h.studentName || 'Học viên');
        }
      });
    } catch(e) {}

    // Lấy từ các event đã xếp (kể cả event học nhóm)
    this.events.forEach(ev => {
      if (Array.isArray(ev.studentEmails)) {
        ev.studentEmails.forEach((em, idx) => {
          const nm = (ev.studentNames && ev.studentNames[idx]) ? ev.studentNames[idx] : 'Học viên';
          listMap.set(em.toLowerCase().trim(), nm);
        });
      } else if (ev.studentEmail) {
        listMap.set(ev.studentEmail.toLowerCase().trim(), ev.studentName || 'Học viên');
      }
    });

    this.knownStudents = Array.from(listMap.entries()).map(([email, name]) => ({ email, name }));
  }

  // 4. RENDER TỔNG THỂ BẢNG LỊCH ADMIN
  render() {
    const container = document.getElementById(this.mountId);
    if (!container) return;

    const rescheduleRequests = this.events.filter(ev => ev.status === 'reschedule_requested');

    container.innerHTML = `
      <div class="cal-app-container">
        
        <!-- A. BANNER BÁO CÁO YÊU CẦU DỜI LỊCH (NẾU CÓ) -->
        ${rescheduleRequests.length > 0 ? this.renderRescheduleAlertBanner(rescheduleRequests) : ''}

        <!-- B. THANH ĐIỀU HƯỚNG TOOLBAR -->
        <div class="cal-top-toolbar">
          <div class="cal-nav-group">
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.navigateTime(-1)" style="padding: 7px 14px; font-size: 13px;">◀</button>
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.goToday()" style="padding: 7px 14px; font-size: 13px;">Hôm nay</button>
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.navigateTime(1)" style="padding: 7px 14px; font-size: 13px;">▶</button>
            <span class="cal-title-display">${this.getCalendarTitle()}</span>
          </div>

          <div class="cal-nav-group">
            <!-- Lọc học sinh -->
            <select class="cal-filter-select" onchange="window.adminCalendar.changeStudentFilter(this.value)">
              <option value="all" ${this.selectedStudentFilter === 'all' ? 'selected' : ''}>👥 Tất cả học sinh (${this.knownStudents.length})</option>
              ${this.knownStudents.map(st => `
                <option value="${st.email}" ${this.selectedStudentFilter === st.email ? 'selected' : ''}>
                  👤 ${st.name} (${st.email})
                </option>
              `).join('')}
            </select>

            <!-- Chọn Tuần / Tháng -->
            <div class="cal-view-selector">
              <button type="button" class="cal-view-btn ${this.viewMode === 'week' ? 'active' : ''}" onclick="window.adminCalendar.switchView('week')">Tuần</button>
              <button type="button" class="cal-view-btn ${this.viewMode === 'month' ? 'active' : ''}" onclick="window.adminCalendar.switchView('month')">Tháng</button>
            </div>

            <!-- NÚT QUẢN LÝ HỌC PHÍ -->
            <button type="button" class="btn-3d btn-3d-white" onclick="window.adminCalendar.openTuitionModal()" style="padding: 9px 16px; font-size: 13px; color:#B45309 !important; border-color:#FCD34D;">
              💰 QUẢN LÝ HỌC PHÍ
            </button>

            <!-- Nút xếp lịch mới -->
            <button type="button" class="btn-3d btn-3d-red" onclick="window.adminCalendar.openCreateModal()" style="padding: 9px 18px; font-size: 13px;">
              ➕ XẾP LỊCH HỌC
            </button>
          </div>
        </div>

        <!-- C. VÙNG HIỂN THỊ CHÍNH -->
        ${this.isLoading ? '<div style="text-align:center; padding:40px; font-weight:800; color:#78716C;">⏳ Đang đồng bộ lịch học từ Cloud...</div>' : ''}
        ${!this.isLoading && this.viewMode === 'week' ? this.renderWeekViewHtml() : ''}
        ${!this.isLoading && this.viewMode === 'month' ? this.renderMonthViewHtml() : ''}

      </div>
    `;
  }

  // 5. BANNER CẢNH BÁO YÊU CẦU XIN DỜI LỊCH
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

  // 6. GIAO DIỆN LỊCH TUẦN (WEEK VIEW)
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

        let cardClass = 'cal-ev-scheduled';
        if (ev.isGroup) cardClass = 'cal-ev-group';
        if (ev.status === 'reschedule_requested') cardClass = 'cal-ev-requested';
        if (ev.status === 'completed') cardClass = 'cal-ev-completed';

        eventsHtml += `
          <div class="cal-event-card ${cardClass}" style="top: ${topPx}px; height: ${heightPx}px;" onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
            <div class="cal-event-title">
              ${ev.status === 'reschedule_requested' ? '⚠️ ' : ''}${ev.isGroup ? '👥 ' : ''}${ev.studentName}
            </div>
            <div class="cal-event-time">${ev.startTime} - ${ev.endTime} (2h)</div>
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

  // 7. GIAO DIỆN LỊCH THÁNG (MONTH VIEW)
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
          <div style="overflow-y:auto; max-height:60px;">
            ${dayEvents.map(ev => `
              <div class="cal-month-event-item ${ev.isGroup ? 'is-group' : ''} ${ev.status === 'reschedule_requested' ? 'is-requested' : ''}" onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
                ${ev.startTime} ${ev.isGroup ? '👥' : ''} ${ev.studentName}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `<div class="cal-month-grid">${gridHtml}</div>`;
  }

  // TIỆN ÍCH LỌC VÀ TÍNH TOÁN
  getFilteredEvents() {
    if (this.selectedStudentFilter === 'all') return this.events;
    const filter = this.selectedStudentFilter.toLowerCase().trim();
    return this.events.filter(ev => {
      if ((ev.studentEmail || '').toLowerCase().trim() === filter) return true;
      if (Array.isArray(ev.studentEmails) && ev.studentEmails.map(e => e.toLowerCase().trim()).includes(filter)) return true;
      return false;
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
    return (totalMinutes / 60) * 52;
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
    const week = this.getDaysOfWeek(this.currentDate);
    return `${week[0].dateNum} - ${week[6].dateNum}/${y}`;
  }

  navigateTime(direction) {
    if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
    } else {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    }
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

  changeStudentFilter(email) {
    this.selectedStudentFilter = email;
    this.render();
  }

  // =========================================================================
  // 8. MODAL TẠO & SỬA BUỔI HỌC (CHỌN NHIỀU HỌC SINH + MẶC ĐỊNH 2 TIẾNG)
  // =========================================================================
  injectModals() {
    if (document.getElementById('adminCalendarModal')) return;

    const modalHtml = `
      <!-- 1. MODAL XẾP LỊCH HỌC -->
      <div id="adminCalendarModal" class="cal-modal-backdrop" style="display:none;">
        <div class="cal-modal-box">
          <button type="button" onclick="window.adminCalendar.closeModal()" style="position:absolute; top:14px; right:16px; background:#F1ECE6; border:none; width:34px; height:34px; border-radius:50%; font-weight:900; color:#7E7672; cursor:pointer; font-size:16px;">✕</button>

          <h3 id="calModalHeading" style="margin:0 0 14px 0; color:#8B1518; font-size:18px; font-weight:900;">
            📅 XẾP LỊCH HỌC CHO HỌC VIÊN
          </h3>

          <div id="calModalRescheduleNotice" style="display:none; background:#FEF2F2; border:1.5px solid #FCA5A5; padding:8px 12px; border-radius:10px; margin-bottom:12px; font-size:12.5px; color:#991B1B;"></div>

          <!-- CHỌN 1 HOẶC NHIỀU HỌC SINH (HỌC 1-1 HOẶC HỌC NHÓM) -->
          <div class="cal-form-group">
            <label style="display:flex; justify-content:space-between; align-items:center;">
              <span>👥 Chọn học sinh (Tick 2+ bạn để xếp học nhóm):</span>
              <span id="calSelectedStudentCount" style="color:#0284C7; font-size:11.5px;">Đã chọn: 0 bạn</span>
            </label>
            <div id="calStudentChecklistContainer" class="cal-student-checklist"></div>
            <div style="margin-top:6px;">
              <input type="text" id="calCustomStudentEmail" placeholder="Hoặc gõ thêm email học sinh mới..." class="cal-form-input" style="padding:6px 10px; font-size:12px;">
            </div>
          </div>

          <div class="cal-form-group">
            <label>📝 Tiêu đề buổi học:</label>
            <input type="text" id="calInputTitle" value="Speaking 1-1 & Sửa Writing Task 2" class="cal-form-input">
          </div>

          <div style="display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:10px;" class="cal-form-group">
            <div>
              <label>📅 Ngày:</label>
              <input type="date" id="calInputDate" class="cal-form-input">
            </div>
            <div>
              <label>⏰ Bắt đầu:</label>
              <input type="time" id="calInputStartTime" value="19:30" class="cal-form-input" onchange="window.adminCalendar.autoCalculateEndTime()">
            </div>
            <div>
              <label>⏰ Kết thúc (Mặc định 2h):</label>
              <input type="time" id="calInputEndTime" value="21:30" class="cal-form-input">
            </div>
          </div>

          <div class="cal-form-group">
            <label>🔗 Link Google Meet / Zoom:</label>
            <input type="url" id="calInputMeetUrl" placeholder="https://meet.google.com/..." class="cal-form-input">
          </div>

          <div class="cal-form-group">
            <label>📌 Ghi chú chuẩn bị trước buổi học:</label>
            <input type="text" id="calInputNotes" placeholder="Ví dụ: Đọc trước bài đọc Passage 2..." class="cal-form-input">
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:18px; gap:8px;">
            <button type="button" id="btnCalDeleteEvent" onclick="window.adminCalendar.deleteCurrentEvent()" class="btn-3d" style="background:#EF4444; color:white !important; border-bottom:4px solid #B91C1C; padding:10px 16px; font-size:13px; display:none;">
              🗑️ Xóa buổi học
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
        <div class="cal-modal-box" style="max-width:620px;">
          <button type="button" onclick="window.adminCalendar.closeTuitionModal()" style="position:absolute; top:14px; right:16px; background:#F1ECE6; border:none; width:34px; height:34px; border-radius:50%; font-weight:900; color:#7E7672; cursor:pointer; font-size:16px;">✕</button>

          <h3 style="margin:0 0 6px 0; color:#B45309; font-size:18px; font-weight:900;">
            💰 QUẢN LÝ GÓI HỌC PHÍ & ĐẾM BUỔI HỌC
          </h3>
          <p style="margin:0 0 14px 0; font-size:13px; color:#78716C; font-weight:700;">
            Cài đặt số buổi phụ huynh đã đóng tiền (VD: 12 hoặc 15 buổi). Hệ thống tự đếm ngược và cảnh báo khi hết hạn:
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

  // Tự động nhảy giờ kết thúc sau đúng 2 tiếng (120 phút)
  autoCalculateEndTime() {
    const startVal = document.getElementById('calInputStartTime')?.value || '19:30';
    const [h, m] = startVal.split(':').map(Number);
    const endH = String((h + 2) % 24).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    const endInput = document.getElementById('calInputEndTime');
    if (endInput) endInput.value = `${endH}:${endM}`;
  }

  renderStudentChecklist(selectedEmails = []) {
    const container = document.getElementById('calStudentChecklistContainer');
    if (!container) return;

    if (this.knownStudents.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:#78716C; padding:6px;">Chưa có học sinh nào trong bộ nhớ. Mày hãy gõ email vào ô dưới nhé!</div>`;
      return;
    }

    container.innerHTML = this.knownStudents.map((st, idx) => {
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

  openCreateModal(dateStr = '', startTimeStr = '19:30') {
    this.activeEditingEvent = null;
    const preselect = this.selectedStudentFilter !== 'all' ? [this.selectedStudentFilter.toLowerCase()] : [];
    this.renderStudentChecklist(preselect);

    document.getElementById('calModalHeading').innerText = '➕ XẾP LỊCH HỌC MỚI';
    document.getElementById('calModalRescheduleNotice').style.display = 'none';
    document.getElementById('btnCalDeleteEvent').style.display = 'none';

    document.getElementById('calInputTitle').value = 'Speaking 1-1 & Sửa Writing Task 2';
    document.getElementById('calInputDate').value = dateStr || this.formatIsoDate(new Date());
    document.getElementById('calInputStartTime').value = startTimeStr;
    
    // Mặc định chuẩn 2 tiếng
    this.autoCalculateEndTime();

    document.getElementById('calInputMeetUrl').value = '';
    document.getElementById('calInputNotes').value = '';
    document.getElementById('calCustomStudentEmail').value = '';

    document.getElementById('adminCalendarModal').style.display = 'flex';
  }

  openEditModal(eventId) {
    const ev = this.events.find(e => e.id === eventId);
    if (!ev) return;

    this.activeEditingEvent = ev;
    const selectedList = Array.isArray(ev.studentEmails) ? ev.studentEmails : [ev.studentEmail];
    this.renderStudentChecklist(selectedList.map(e => (e || '').toLowerCase()));

    document.getElementById('calModalHeading').innerText = '✏️ ĐIỀU CHỈNH BUỔI HỌC';
    document.getElementById('btnCalDeleteEvent').style.display = 'block';

    const notice = document.getElementById('calModalRescheduleNotice');
    if (ev.status === 'reschedule_requested' && ev.rescheduleRequest) {
      notice.style.display = 'block';
      notice.innerHTML = `⚠️ <b>HỌC SINH XIN DỜI LỊCH:</b><br>"${ev.rescheduleRequest.reason}"<br>⏰ Giờ mong muốn: <b>${ev.rescheduleRequest.suggestedTime || 'Chưa hẹn'}</b>`;
    } else {
      notice.style.display = 'none';
    }

    document.getElementById('calInputTitle').value = ev.title;
    document.getElementById('calInputDate').value = ev.date;
    document.getElementById('calInputStartTime').value = ev.startTime;
    document.getElementById('calInputEndTime').value = ev.endTime;
    document.getElementById('calInputMeetUrl').value = ev.meetUrl || '';
    document.getElementById('calInputNotes').value = ev.notes || '';
    document.getElementById('calCustomStudentEmail').value = '';

    document.getElementById('adminCalendarModal').style.display = 'flex';
  }

  closeModal() {
    const m = document.getElementById('adminCalendarModal');
    if (m) m.style.display = 'none';
    this.activeEditingEvent = null;
  }

  async saveEvent() {
    // 1. Thu thập danh sách học sinh được tick chọn
    const checkedBoxes = Array.from(document.querySelectorAll('#calStudentChecklistContainer input[type="checkbox"]:checked'));
    let studentEmails = checkedBoxes.map(cb => cb.value.toLowerCase().trim());
    let studentNames = checkedBoxes.map(cb => cb.getAttribute('data-name') || 'Học viên');

    // Nếu có gõ thêm email mới ngoài checklist
    const customEmail = document.getElementById('calCustomStudentEmail')?.value.trim().toLowerCase();
    if (customEmail && !studentEmails.includes(customEmail)) {
      studentEmails.push(customEmail);
      studentNames.push(customEmail.split('@')[0]);
    }

    if (studentEmails.length === 0) {
      alert("⚠️ Vui lòng tick chọn ít nhất 1 học sinh (hoặc gõ email) để xếp lịch!");
      return;
    }

    const title = document.getElementById('calInputTitle').value.trim();
    const date = document.getElementById('calInputDate').value;
    const startTime = document.getElementById('calInputStartTime').value;
    const endTime = document.getElementById('calInputEndTime').value;
    const meetUrl = document.getElementById('calInputMeetUrl').value.trim();
    const notes = document.getElementById('calInputNotes').value.trim();

    if (!date || !startTime || !endTime) {
      alert("⚠️ Vui lòng chọn Ngày học, Giờ bắt đầu và Giờ kết thúc!");
      return;
    }

    const btn = document.getElementById('btnCalSaveEvent');
    btn.disabled = true;
    btn.innerText = "⏳ Đang lưu...";

    const eventPayload = {
      id: this.activeEditingEvent ? this.activeEditingEvent.id : `evt_${Date.now()}`,
      studentEmail: studentEmails[0],
      studentName: studentNames.join(', '),
      studentEmails: studentEmails,
      studentNames: studentNames,
      isGroup: studentEmails.length > 1,
      title: title || (studentEmails.length > 1 ? `Lớp nhóm (${studentNames.join(', ')})` : 'Speaking 1-1'),
      date: date,
      startTime: startTime,
      endTime: endTime,
      meetUrl: meetUrl,
      notes: notes,
      status: 'scheduled'
    };

    try {
      const user = stateManager.getUser();
      if (CONFIG.DRIVE_STORAGE_URL) {
        await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "admin_save_schedule",
            adminEmail: user.email,
            event: eventPayload
          })
        });
      }

      // Cập nhật mảng tại chỗ để đổi màu ngay
      const existIdx = this.events.findIndex(e => e.id === eventPayload.id);
      if (existIdx !== -1) {
        this.events[existIdx] = eventPayload;
      } else {
        this.events.push(eventPayload);
      }
      localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));

      alert("🎉 Đã lưu lịch học thành công!");
      this.closeModal();
      this.render();
    } catch (e) {
      alert("Lỗi lưu lịch: " + e.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "💾 LƯU LỊCH";
    }
  }

  async deleteCurrentEvent() {
    if (!this.activeEditingEvent) return;
    if (!confirm(`⚠️ Bạn có chắc muốn XOÁ buổi học này không?`)) return;

    const eventId = this.activeEditingEvent.id;
    const user = stateManager.getUser();

    try {
      if (CONFIG.DRIVE_STORAGE_URL) {
        await fetch(CONFIG.DRIVE_STORAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "admin_delete_schedule",
            adminEmail: user.email,
            eventId: eventId
          })
        });
      }

      this.events = this.events.filter(e => e.id !== eventId);
      localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));

      alert("✅ Đã xoá buổi học thành công!");
      this.closeModal();
      this.render();
    } catch(e) {
      alert("Lỗi xoá lịch: " + e.message);
    }
  }

  // =========================================================================
  // 9. QUẢN LÝ HỌC PHÍ (TUITION MODAL ACTIONS)
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
              <button type="button" onclick="window.adminCalendar.saveStudentTuition('${st.email}', '${st.name}')" class="btn-3d" style="background:#0284C7; color:white !important; padding:6px 12px; font-size:12px; border-radius:8px; border-bottom:3px solid #0369A1;">
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
            adminEmail: user.email,
            studentEmail: email,
            studentName: name,
            paidSessions: paid
          })
        });
      }

      this.tuitionRegistry[email.toLowerCase().trim()] = { paidSessions: paid, studentName: name };
      localStorage.setItem('admin_cached_tuition_registry', JSON.stringify(this.tuitionRegistry));

      alert(`🎉 Đã cập nhật gói ${paid} buổi cho học viên ${name}!`);
      this.openTuitionModal(); // Làm mới bảng
    } catch(e) {
      alert("Lỗi lưu học phí: " + e.message);
    }
  }
}

export const adminCalendar = new AdminCalendarSystem();
window.adminCalendar = adminCalendar;
