/**
 * js/theory-video-engine.js - HẠ TẦNG QUẢN LÝ VIDEO LÝ THUYẾT VÀ BÀI GIẢNG TOÀN HỆ THỐNG
 * Trạm IELTS - Phục vụ Admin thêm link YouTube tự do & Phục vụ Học sinh xem bài giảng
 * Cơ chế: Lưu trữ LocalStorage + Đồng bộ Google Cloud Script + Xuất File JSON 1-click
 */

import { CONFIG } from './config.js';

const THEORY_STORAGE_KEY = 'tram_theory_videos_data';

// DỮ LIỆU BAN ĐẦU MẪU ĐỂ WEB CÓ SẴN BÀI GIẢNG TEST NGAY LẬP TỨC
const DEFAULT_VIDEOS = [
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
    id: "vid_wt1_02",
    skillKey: "writing_t1",
    category: "Line Graph",
    order: 2,
    title: "Kỹ thuật gom nhóm và phân chia thân bài Body 1 & Body 2",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "18:45",
    description: "Chiến thuật chia thân bài theo thời gian hoặc theo nhóm đối tượng tăng/giảm.",
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
    id: "vid_grammar_01",
    skillKey: "grammar",
    category: "Mệnh đề quan hệ",
    order: 1,
    title: "Mệnh đề quan hệ xác định & không xác định trong IELTS",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "12:30",
    description: "Cách dùng dấu phẩy và ứng dụng nâng band tiêu chí Grammatical Range and Accuracy.",
    createdAt: "2026-11-05"
  }
];

class TheoryVideoEngine {
  constructor() {
    this.videos = this.loadLocalVideos();
    // Tự động kiểm tra và đồng bộ từ Google Drive khi khởi chạy
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

  // 3. Hàm Regex bóc tách YouTube ID từ MỌI định dạng link
  extractYoutubeId(url) {
    if (!url) return '';
    const cleanUrl = url.trim();
    // Nếu truyền vào sẵn mã ID 11 ký tự
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return cleanUrl;
    }
    // Regex quét qua các định dạng: watch?v=, youtu.be/, shorts/, embed/
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : '';
  }

  // 4. Lấy danh sách video (Hỗ trợ lọc theo Skill và sắp xếp thứ tự Order)
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

    // Sắp xếp theo order tăng dần (1, 2, 3...)
    list.sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));
    return list;
  }

  // 5. Thêm hoặc cập nhật video
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
    // Bắn lệnh đồng bộ lên Google Drive Apps Script nếu có kết nối
    await this.syncToCloud();
    return payload;
  }

  // 6. Xóa video
  async deleteVideo(videoId) {
    const updatedList = this.videos.filter(v => v.id !== videoId);
    this.saveLocalVideos(updatedList);
    await this.syncToCloud();
    return true;
  }

  // 7. Đồng bộ lên Google Drive Cloud Script
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
      console.log("☁️ [TheoryEngine] Đã đồng bộ video lên Cloud thành công.");
    } catch (e) {
      console.warn("⚠️ [TheoryEngine] Không thể đồng bộ Cloud (vẫn lưu tốt trên LocalStorage):", e);
    }
  }

  // 8. Tải video mới nhất từ Google Drive Cloud Script
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
        console.log("☁️ [TheoryEngine] Đã cập nhật danh sách video mới nhất từ Cloud.");
      }
    } catch (e) {
      // Giữ nguyên LocalStorage nếu mất kết nối mạng
    }
  }

  // 9. Nút bấm 1-click xuất file JSON vĩnh viễn
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

// Khởi tạo và chia sẻ toàn cục an toàn
export const theoryVideoEngine = new TheoryVideoEngine();
window.theoryVideoEngine = theoryVideoEngine;
