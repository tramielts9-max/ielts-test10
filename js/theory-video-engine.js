/**
 * js/theory-video-engine.js - HẠ TẦNG QUẢN LÝ VIDEO LÝ THUYẾT VÀ BÀI GIẢNG TOÀN HỆ THỐNG
 * Trạm IELTS - Phục vụ Admin thêm/sửa/xóa link YouTube & Phục vụ Học sinh xem bài giảng
 * Nâng cấp: Sắp xếp Listening -> Reading -> Writing -> Speaking, Kéo thả đổi thứ tự, Thumbnail, Tiến độ học
 */

import { CONFIG } from './config.js';

const THEORY_STORAGE_KEY = 'tram_theory_videos_data';
const WATCH_PROGRESS_KEY = 'tram_theory_watch_progress';
const COMPLETED_VIDEOS_KEY = 'tram_theory_completed_videos';

// BẢNG TRỌNG SỐ ƯU TIÊN SẮP XẾP SƯ PHẠM KHI XEM TAB "TẤT CẢ"
const SKILL_PRIORITY = {
  listening: 1,
  pre_listening: 2,
  reading: 3,
  pre_reading: 4,
  writing_t1: 5,
  pre_writing_t1: 6,
  writing_t2: 7,
  pre_writing_t2: 8,
  speaking: 9,
  pre_speaking: 10,
  grammar: 11,
  vocab: 12
};

// DỮ LIỆU BAN ĐẦU MẪU ĐỂ WEB CÓ SẴN BÀI GIẢNG TEST NGAY LẬP TỨC
const DEFAULT_VIDEOS = [
  {
    id: "vid_lis_01",
    skillKey: "listening",
    category: "Section 1",
    order: 1,
    title: "Chiến thuật xử lý bẫy Form Completion & Số liệu Listening",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "16:20",
    description: "Kỹ năng bắt nhịp phát âm tên riêng, số điện thoại, ngày tháng và bẫy tự sửa (Self-correction).",
    createdAt: "2026-11-05"
  },
  {
    id: "vid_wt1_01",
    skillKey: "writing_t1",
    category: "Line Graph",
    order: 1,
    title: "Bản chất Line Graph & Kỹ thuật viết Overview chuẩn 8.0+",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "15:20",
    description: "Hướng dẫn cách nhận diện xu hướng chính, tránh bẫy liệt kê số liệu vào phần Overview.",
    createdAt: "2026-11-05"
  },
  {
    id: "vid_wt2_01",
    skillKey: "writing_t2",
    category: "Opinion Essay",
    order: 1,
    title: "Cách lập dàn ý dạng bài Opinion (Agree or Disagree)",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "22:10",
    description: "Phân biệt giữa Balanced Approach (cân bằng) và Strong Opinion (nghiêng hẳn một phía).",
    createdAt: "2026-11-05"
  },
  {
    id: "vid_spk_01",
    skillKey: "speaking",
    category: "Part 1 & 2",
    order: 1,
    title: "Kỹ thuật kéo dài câu trả lời Speaking không bị cụt ý",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "14:15",
    description: "Áp dụng công thức A.R.E.A (Answer - Reason - Example - Alternative) để đạt độ trôi chảy 7.0+.",
    createdAt: "2026-11-05"
  }
];

class TheoryVideoEngine {
  constructor() {
    this.videos = this.loadLocalVideos();
    this.syncFromCloud();
  }

  // 1. Tải dữ liệu từ LocalStorage, nếu chưa có thì nạp dữ liệu mặc định
  loadLocalVideos() {
    try {
      const raw = localStorage.getItem(THEORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("⚠️ [TheoryEngine] Lỗi đọc bộ nhớ cục bộ, sử dụng dữ liệu mặc định.");
    }
    this.saveLocalVideos(DEFAULT_VIDEOS);
    return [...DEFAULT_VIDEOS];
  }

  // 2. Lưu vào LocalStorage
  saveLocalVideos(data) {
    try {
      localStorage.setItem(THEORY_STORAGE_KEY, JSON.stringify(data));
      this.videos = data;
    } catch (e) {
      console.error("❌ [TheoryEngine] Không thể ghi LocalStorage:", e);
    }
  }

  // 3. Regex bóc tách YouTube ID từ MỌI định dạng link
  extractYoutubeId(url) {
    if (!url) return '';
    const cleanUrl = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return cleanUrl;
    }
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : '';
  }

  // 4. Lấy link ảnh Thumbnail tự động từ YouTube
  getThumbnailUrl(youtubeId) {
    if (!youtubeId) return 'assets/default-video-thumb.png';
    return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
  }

  // 5. Lấy danh sách video (Sắp xếp theo thứ tự Listening -> Reading -> Writing -> Speaking)
  getVideos(skillKey = 'all', searchQuery = '') {
    let list = [...this.videos];

    if (skillKey && skillKey !== 'all') {
      list = list.filter(v => v.skillKey === skillKey);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(v => 
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q))
      );
    }

    // SẮP XẾP:
    // Nếu xem "Tất Cả": Ưu tiên theo Skill (Listening -> Reading -> Writing -> Speaking), sau đó theo Order
    // Nếu xem theo 1 Skill cụ thể: Sắp xếp theo Order tăng dần (1, 2, 3...)
    list.sort((a, b) => {
      if (skillKey === 'all') {
        const priorityA = SKILL_PRIORITY[a.skillKey] || 99;
        const priorityB = SKILL_PRIORITY[b.skillKey] || 99;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
      }
      return (parseInt(a.order) || 999) - (parseInt(b.order) || 999);
    });

    return list;
  }

  // 6. Thêm hoặc cập nhật thông tin video
  async saveVideo(videoData) {
    const youtubeId = this.extractYoutubeId(videoData.youtubeUrl);
    if (!youtubeId) {
      throw new Error("Link YouTube không hợp lệ! Vui lòng kiểm tra lại đường dẫn.");
    }

    const payload = {
      id: videoData.id || `vid_${Date.now()}`,
      skillKey: videoData.skillKey || 'writing_t1',
      category: (videoData.category || 'Chung').trim(),
      order: parseInt(videoData.order) || (this.videos.length + 1),
      title: (videoData.title || 'Bài giảng lý thuyết').trim(),
      youtubeUrl: videoData.youtubeUrl.trim(),
      youtubeId: youtubeId,
      duration: (videoData.duration || 'N/A').trim(),
      description: (videoData.description || '').trim(),
      updatedAt: new Date().toISOString()
    };

    const existingIndex = this.videos.findIndex(v => v.id === payload.id);
    let updatedList = [...this.videos];

    if (existingIndex >= 0) {
      updatedList[existingIndex] = payload;
    } else {
      updatedList.push(payload);
    }

    this.saveLocalVideos(updatedList);
    await this.syncToCloud();
    return payload;
  }

  // 7. Xóa video đơn lẻ
  async deleteVideo(videoId) {
    const updatedList = this.videos.filter(v => v.id !== videoId);
    this.saveLocalVideos(updatedList);
    await this.syncToCloud();
    return true;
  }

  // 8. Đổi thứ tự bài học (Di chuyển Lên hoặc Xuống)
  async moveVideo(videoId, direction = 'up') {
    const list = [...this.videos];
    const index = list.findIndex(v => v.id === videoId);
    if (index === -1) return false;

    const targetIndex = (direction === 'up') ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return false;

    // Hoán đổi vị trí trong mảng
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Cập nhật lại số order tương ứng
    list.forEach((item, idx) => {
      item.order = idx + 1;
    });

    this.saveLocalVideos(list);
    await this.syncToCloud();
    return true;
  }

  // 9. Cập nhật mảng thứ tự sau khi Kéo - Thả (Drag and Drop)
  async reorderVideos(orderedIds = []) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return false;
    const currentMap = new Map(this.videos.map(v => [v.id, v]));
    const reordered = [];

    orderedIds.forEach((id, idx) => {
      if (currentMap.has(id)) {
        const item = currentMap.get(id);
        item.order = idx + 1;
        reordered.push(item);
        currentMap.delete(id);
      }
    });

    // Gom nốt các video còn lại nếu có
    currentMap.forEach(v => reordered.push(v));

    this.saveLocalVideos(reordered);
    await this.syncToCloud();
    return true;
  }

  // 10. Ghi nhớ giây đang xem dở (Resume Watch Time)
  saveWatchProgress(videoId, seconds) {
    try {
      const raw = localStorage.getItem(WATCH_PROGRESS_KEY) || '{}';
      const progressMap = JSON.parse(raw);
      progressMap[videoId] = Math.floor(seconds);
      localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(progressMap));
    } catch (e) {}
  }

  getWatchProgress(videoId) {
    try {
      const raw = localStorage.getItem(WATCH_PROGRESS_KEY) || '{}';
      const progressMap = JSON.parse(raw);
      return progressMap[videoId] || 0;
    } catch (e) {
      return 0;
    }
  }

  // 11. Quản lý trạng thái hoàn thành (Tích xanh)
  toggleCompleted(videoId) {
    try {
      const raw = localStorage.getItem(COMPLETED_VIDEOS_KEY) || '[]';
      let list = JSON.parse(raw);
      if (list.includes(videoId)) {
        list = list.filter(id => id !== videoId);
      } else {
        list.push(videoId);
      }
      localStorage.setItem(COMPLETED_VIDEOS_KEY, JSON.stringify(list));
      return list.includes(videoId);
    } catch (e) {
      return false;
    }
  }

  isCompleted(videoId) {
    try {
      const raw = localStorage.getItem(COMPLETED_VIDEOS_KEY) || '[]';
      const list = JSON.parse(raw);
      return list.includes(videoId);
    } catch (e) {
      return false;
    }
  }

  // 12. Đồng bộ Google Drive Cloud Script
  async syncToCloud() {
    if (!CONFIG.DRIVE_STORAGE_URL) return;
    try {
      await fetch(CONFIG.DRIVE_STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "save_theory_videos",
          videos: this.videos,
          adminSecret: "phuc_tramielts"
        })
      });
    } catch (e) {}
  }

  async syncFromCloud() {
    if (!CONFIG.DRIVE_STORAGE_URL) return;
    try {
      const res = await fetch(CONFIG.DRIVE_STORAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_theory_videos" })
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        this.saveLocalVideos(data.videos);
      }
    } catch (e) {}
  }

  // 13. Xuất file JSON vĩnh viễn 1-click
  exportJSON() {
    const jsonStr = JSON.stringify(this.videos, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-theory-manifest-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const theoryVideoEngine = new TheoryVideoEngine();
window.theoryVideoEngine = theoryVideoEngine;
