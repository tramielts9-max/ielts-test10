/**
 * =========================================================================
 * js/calendar-system.js - BỘ MÁY GOOGLE CALENDAR QUẢN TRỊ VIÊN & DUYỆT LỊCH HỌC
 * TRẠM IELTS - THIẾT KẾ ĐỘC LẬP, AN TOÀN, KHÔNG XÂM LẤN DỮ LIỆU CŨ
 * TÍCH HỢP ĐỒNG BỘ HAI CHIỀU VỚI GOOGLE APPS SCRIPT DRIVE
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
    this.activeEditingEvent = null;
    this.isLoading = false;

    // Tự sinh modal HTML vào trang
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

  // 2. TỰ ĐỘNG THU THẬP DANH SÁCH HỌC SINH ĐỂ ĐƯA VÀO DROPDOWN
  async fetchKnownStudents() {
    const listMap = new Map();

    // Lấy từ lịch sử local
    try {
      const hist = JSON.parse(localStorage.getItem('ielts_local_history') || '[]');
      hist.forEach(h => {
        if (h.studentEmail && !h.studentEmail.includes('admin')) {
          listMap.set(h.studentEmail.toLowerCase().trim(), h.studentName || 'Học viên');
        }
      });
    } catch(e) {}

    // Lấy từ các event đã từng xếp
    this.events.forEach(ev => {
      if (ev.studentEmail) {
        listMap.set(ev.studentEmail.toLowerCase().trim(), ev.studentName || 'Học viên');
      }
    });

    this.knownStudents = Array.from(listMap.entries()).map(([email, name]) => ({ email, name }));
  }

  // 3. RENDER TỔNG THỂ BẢNG LỊCH
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

  // 4. BANNER CẢNH BÁO YÊU CẦU XIN DỜI LỊCH
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
          Xử lý đơn đầu tiên &rarr;
        </button>
      </div>
    `;
  }

  // 5. GIAO DIỆN LỊCH TUẦN (WEEK VIEW)
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
        const heightPx = Math.max(38, this.durationToPixels(ev.startTime, ev.endTime));

        let cardClass = 'cal-ev-scheduled';
        if (ev.status === 'reschedule_requested') cardClass = 'cal-ev-requested';
        if (ev.status === 'completed') cardClass = 'cal-ev-completed';

        eventsHtml += `
          <div class="cal-event-card ${cardClass}" style="top: ${topPx}px; height: ${heightPx}px;" onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
            <div class="cal-event-title">${ev.status === 'reschedule_requested' ? '⚠️ ' : ''}${ev.studentName}</div>
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

  // 6. GIAO DIỆN LỊCH THÁNG (MONTH VIEW)
  renderMonthViewHtml() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Thứ 2 = 0
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
              <div class="cal-month-event-item ${ev.status === 'reschedule_requested' ? 'is-requested' : ''}" onclick="event.stopPropagation(); window.adminCalendar.openEditModal('${ev.id}')">
                ${ev.startTime} ${ev.studentName}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `<div class="cal-month-grid">${gridHtml}</div>`;
  }

  // TIỆN ÍCH TÍNH TOÁN NGÀY GIỜ
  getFilteredEvents() {
    if (this.selectedStudentFilter === 'all') return this.events;
    return this.events.filter(ev => (ev.studentEmail || '').toLowerCase().trim() === this.selectedStudentFilter.toLowerCase().trim());
  }

  timeToPixels(timeStr, startHour = 7) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return Math.max(0, ((h - startHour) * 52) + (m / 60 * 52));
  }

  durationToPixels(startStr, endStr) {
    if (!startStr || !endStr) return 52;
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    const totalMinutes = ((h2 * 60) + m2) - ((h1 * 60) + m1);
    return (totalMinutes / 60) * 52;
  }

  getDaysOfWeek(d) {
    const curr = new Date(d);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Bắt đầu từ Thứ 2
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
  // 7. MODAL TẠO & SỬA BUỔI HỌC (CRUD ACTIONS)
  // =========================================================================
  injectModals() {
    if (document.getElementById('adminCalendarModal')) return;

    const modalHtml = `
      <div id="adminCalendarModal" class="cal-modal-backdrop" style="display:none;">
        <div class="cal-modal-box">
          <button type="button" onclick="window.adminCalendar.closeModal()" style="position:absolute; top:14px; right:16px; background:#F1ECE6; border:none; width:34px; height:34px; border-radius:50%; font-weight:900; color:#7E7672; cursor:pointer; font-size:16px;">✕</button>

          <h3 id="calModalHeading" style="margin:0 0 14px 0; color:#8B1518; font-size:18px; font-weight:900;">
            📅 XẾP LỊCH HỌC CHO HỌC VIÊN
          </h3>

          <div id="calModalRescheduleNotice" style="display:none; background:#FEF2F2; border:1.5px solid #FCA5A5; padding:8px 12px; border-radius:10px; margin-bottom:12px; font-size:12.5px; color:#991B1B;"></div>

          <div class="cal-form-group">
            <label>👤 Chọn học sinh:</label>
            <input type="text" id="calInputStudentSearch" list="calStudentDataList" placeholder="Nhập tên hoặc email học sinh..." class="cal-form-input">
            <datalist id="calStudentDataList"></datalist>
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
              <input type="time" id="calInputStartTime" value="19:30" class="cal-form-input">
            </div>
            <div>
              <label>⏰ Kết thúc:</label>
              <input type="time" id="calInputEndTime" value="21:00" class="cal-form-input">
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

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; gap:8px;">
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
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  populateStudentDatalist() {
    const dl = document.getElementById('calStudentDataList');
    if (!dl) return;
    dl.innerHTML = this.knownStudents.map(st => `<option value="${st.email}">${st.name}</option>`).join('');
  }

  openCreateModal(dateStr = '', startTimeStr = '19:30') {
    this.activeEditingEvent = null;
    this.populateStudentDatalist();

    document.getElementById('calModalHeading').innerText = '➕ XẾP LỊCH HỌC MỚI';
    document.getElementById('calModalRescheduleNotice').style.display = 'none';
    document.getElementById('btnCalDeleteEvent').style.display = 'none';

    document.getElementById('calInputStudentSearch').value = this.selectedStudentFilter !== 'all' ? this.selectedStudentFilter : '';
    document.getElementById('calInputTitle').value = 'Speaking 1-1 & Sửa Writing Task 2';
    document.getElementById('calInputDate').value = dateStr || this.formatIsoDate(new Date());
    document.getElementById('calInputStartTime').value = startTimeStr;

    // Tự tính giờ kết thúc sau 1 tiếng 30 phút
    const [h, m] = startTimeStr.split(':').map(Number);
    const endH = String((h + 1) + Math.floor((m + 30) / 60)).padStart(2, '0');
    const endM = String((m + 30) % 60).padStart(2, '0');
    document.getElementById('calInputEndTime').value = `${endH}:${endM}`;

    document.getElementById('calInputMeetUrl').value = '';
    document.getElementById('calInputNotes').value = '';

    document.getElementById('adminCalendarModal').style.display = 'flex';
  }

  openEditModal(eventId) {
    const ev = this.events.find(e => e.id === eventId);
    if (!ev) return;

    this.activeEditingEvent = ev;
    this.populateStudentDatalist();

    document.getElementById('calModalHeading').innerText = '✏️ ĐIỀU CHỈNH BUỔI HỌC';
    document.getElementById('btnCalDeleteEvent').style.display = 'block';

    const notice = document.getElementById('calModalRescheduleNotice');
    if (ev.status === 'reschedule_requested' && ev.rescheduleRequest) {
      notice.style.display = 'block';
      notice.innerHTML = `⚠️ <b>HỌC SINH XIN DỜI LỊCH:</b><br>"${ev.rescheduleRequest.reason}"<br>⏰ Giờ mong muốn: <b>${ev.rescheduleRequest.suggestedTime || 'Chưa hẹn'}</b>`;
    } else {
      notice.style.display = 'none';
    }

    document.getElementById('calInputStudentSearch').value = ev.studentEmail;
    document.getElementById('calInputTitle').value = ev.title;
    document.getElementById('calInputDate').value = ev.date;
    document.getElementById('calInputStartTime').value = ev.startTime;
    document.getElementById('calInputEndTime').value = ev.endTime;
    document.getElementById('calInputMeetUrl').value = ev.meetUrl || '';
    document.getElementById('calInputNotes').value = ev.notes || '';

    document.getElementById('adminCalendarModal').style.display = 'flex';
  }

  closeModal() {
    const m = document.getElementById('adminCalendarModal');
    if (m) m.style.display = 'none';
    this.activeEditingEvent = null;
  }

  async saveEvent() {
    const studentInput = document.getElementById('calInputStudentSearch').value.trim();
    const title = document.getElementById('calInputTitle').value.trim();
    const date = document.getElementById('calInputDate').value;
    const startTime = document.getElementById('calInputStartTime').value;
    const endTime = document.getElementById('calInputEndTime').value;
    const meetUrl = document.getElementById('calInputMeetUrl').value.trim();
    const notes = document.getElementById('calInputNotes').value.trim();

    if (!studentInput || !date || !startTime || !endTime) {
      alert("⚠️ Vui lòng điền đủ: Học sinh, Ngày học, Giờ bắt đầu và Giờ kết thúc!");
      return;
    }

    const email = studentInput.toLowerCase();
    const matched = this.knownStudents.find(s => s.email === email);
    const studentName = matched ? matched.name : (studentInput.split('@')[0] || 'Học viên');

    const btn = document.getElementById('btnCalSaveEvent');
    btn.disabled = true;
    btn.innerText = "⏳ Đang lưu...";

    const eventPayload = {
      id: this.activeEditingEvent ? this.activeEditingEvent.id : `evt_${Date.now()}`,
      studentEmail: email,
      studentName: studentName,
      title: title || 'Buổi học IELTS Trực tiếp',
      date: date,
      startTime: startTime,
      endTime: endTime,
      meetUrl: meetUrl,
      notes: notes,
      status: 'scheduled' // Khi lưu xong tự chuyển về trạng thái chuẩn
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

      // Cập nhật danh sách tại chỗ
      const existIdx = this.events.findIndex(e => e.id === eventPayload.id);
      if (existIdx !== -1) {
        this.events[existIdx] = eventPayload;
      } else {
        this.events.push(eventPayload);
      }
      localStorage.setItem('admin_cached_schedules', JSON.stringify(this.events));

      alert("🎉 Đã lưu buổi học thành công!");
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
    if (!confirm(`⚠️ Bạn có chắc muốn XOÁ buổi học của [${this.activeEditingEvent.studentName}] vào ngày ${this.activeEditingEvent.date} không?`)) return;

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
}

export const adminCalendar = new AdminCalendarSystem();
window.adminCalendar = adminCalendar;
