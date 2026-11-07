/**
 * js/theory-video-engine.js - HẠ TẦNG QUẢN LÝ VIDEO LÝ THUYẾT & CHIẾN THUẬT IELTS MASTER
 * Tích hợp 20 bài giảng Reading Cambridge thực tế của Thầy Phúc
 * Hỗ trợ Bộ lọc Dạng bài con (Sub-Category), Quản lý Category 2 chiều, Chuyển dạng bài đơn & hàng loạt
 */

import { CONFIG } from './config.js';

const THEORY_STORAGE_KEY = 'tram_theory_videos_data';
const COMPLETED_STORAGE_KEY = 'tram_theory_completed_vids';
const WATCH_PROGRESS_KEY = 'tram_theory_watch_progress';
const CATEGORY_ORDER_KEY = 'tram_theory_category_order';

// THỨ TỰ ƯU TIÊN SƯ PHẠM CHO TAB TẤT CẢ
const SKILL_PRIORITY = {
  'listening': 1,
  'pre_listening': 2,
  'reading': 3,
  'pre_reading': 4,
  'writing_t1': 5,
  'pre_writing_t1': 6,
  'writing_t2': 7,
  'pre_writing_t2': 8,
  'speaking': 9,
  'pre_speaking': 10,
  'grammar': 11,
  'vocab': 12
};

// 20 BÀI GIẢNG READING CAMBRIDGE GỐC CỦA THẦY PHÚC
const REAL_DEFAULT_VIDEOS = [
  {
    "id": "vid_1793938556045",
    "skillKey": "reading",
    "category": "TRUE/FALSE/NOT GIVEN",
    "order": 1,
    "title": "GIẢI QUYẾT DẠNG TRUE/ FALSE/ NOT GIVEN 🟢✔️🔴✖️🟡❓ - Record chữa số 1 - Cam 20 Test 1 + 2",
    "youtubeUrl": "https://youtu.be/EqJJGQRQzlM?si=7ub6FMwVD-HhOdNN",
    "youtubeId": "EqJJGQRQzlM",
    "duration": "9:06",
    "description": "Hướng dẫn nhận diện xu hướng thông tin và cách phân biệt ranh giới giữa False và Not Given.",
    "isPublished": true,
    "updatedAt": "2026-11-06T06:06:26.440Z"
  },
  {
    "id": "vid_1793944663879",
    "skillKey": "reading",
    "category": "TRUE/FALSE/NOT GIVEN",
    "order": 2,
    "title": "GIẢI QUYẾT DẠNG TRUE/FALSE/NOT GIVEN 🟢✔️🔴✖️🟡❓ - Record chữa số 2 - Cam 20 Test 3 Part 1",
    "youtubeUrl": "https://youtu.be/ciiJ9Zl8e8A?si=lhJzZGTlGItNzaHo",
    "youtubeId": "ciiJ9Zl8e8A",
    "duration": "5:55",
    "description": "Chiến thuật định vị keyword không biến đổi trong đoạn văn ngắn Part 1.",
    "isPublished": true,
    "updatedAt": "2026-11-06T05:57:43.879Z"
  },
  {
    "id": "vid_1793945245900",
    "skillKey": "reading",
    "category": "TRUE/FALSE/NOT GIVEN",
    "order": 3,
    "title": "GIẢI QUYẾT DẠNG TRUE/FALSE/NOT GIVEN 🟢✔️🔴✖️🟡❓ - Record chữa số 3 - Cam 20 Test 4 Part 1",
    "youtubeUrl": "https://youtu.be/KomJsbkfBTg?si=cQO7c5-cKnRRfZkm",
    "youtubeId": "KomJsbkfBTg",
    "duration": "7:11",
    "description": "Kỹ thuật quét câu hỏi theo trật tự thời gian và bắt bẫy từ chỉ mức độ tuyệt đối.",
    "isPublished": true,
    "updatedAt": "2026-11-06T06:07:25.900Z"
  },
  {
    "id": "vid_1793954925618",
    "skillKey": "reading",
    "category": "TRUE/FALSE/NOT GIVEN",
    "order": 4,
    "title": "GIẢI QUYẾT DẠNG TRUE/FALSE/NOT GIVEN 🟢✔️🔴✖️🟡❓ - Record chữa số 4 - Cam 19 Test 1 Part 1",
    "youtubeUrl": "https://youtu.be/nx4mTf7BfBE?si=kAEFXdAqhe_TyL8e",
    "youtubeId": "nx4mTf7BfBE",
    "duration": "13:40",
    "description": "Tư duy T/F/NG chuẩn Cambridge – dạng câu hỏi gây lú nhất IELTS Reading, công thức nhận biết không cần từ vựng cao.",
    "isPublished": true,
    "updatedAt": "2026-11-06T08:48:45.618Z"
  },
  {
    "id": "vid_1793954982173",
    "skillKey": "reading",
    "category": "TRUE/FALSE/NOT GIVEN",
    "order": 5,
    "title": "GIẢI QUYẾT DẠNG TRUE/FALSE/NOT GIVEN 🟢✔️🔴✖️🟡❓ - Record chữa số 5 - Cam 19 Test 2 Part 1",
    "youtubeUrl": "https://youtu.be/uGBo29zh9Nk?si=hC4yMp9tgg8O6X2r",
    "youtubeId": "uGBo29zh9Nk",
    "duration": "11:57",
    "description": "Cách đối chiếu thông tin để tránh nhầm TRUE thành NOT GIVEN, 3 bẫy Cambridge hay gài.",
    "isPublished": true,
    "updatedAt": "2026-11-06T08:49:42.173Z"
  },
  {
    "id": "vid_1793955393465",
    "skillKey": "reading",
    "category": "GAP FILL",
    "order": 6,
    "title": "GIẢI QUYẾT DẠNG GAP FILL ▢▢▢✏️ - Record chữa Part 1 Cam 20 Test 1 + 2",
    "youtubeUrl": "https://youtu.be/6_TnwvW9r8Y?si=C28_ssiVKemx0yTW",
    "youtubeId": "6_TnwvW9r8Y",
    "duration": "14:30",
    "description": "Cách nhận diện từ loại để đoán trước đáp án, soi keyword trước khi đọc bài.",
    "isPublished": true,
    "updatedAt": "2026-11-06T08:56:33.465Z"
  },
  {
    "id": "vid_1793955492405",
    "skillKey": "reading",
    "category": "GAP FILL",
    "order": 7,
    "title": "GIẢI QUYẾT DẠNG GAP FILL ▢▢▢✏️ Record chữa số 2 Part 1 Cam 20 Test 3",
    "youtubeUrl": "https://youtu.be/_0hAIuiU1uI?si=QQH6452qCSobcTpP",
    "youtubeId": "_0hAIuiU1uI",
    "duration": "10:01",
    "description": "Những bẫy paraphrase thường xuất hiện trong Cambridge, cách chọn nhanh không bị nhiễu.",
    "isPublished": true,
    "updatedAt": "2026-11-06T08:58:12.405Z"
  },
  {
    "id": "vid_1793955555973",
    "skillKey": "reading",
    "category": "GAP FILL",
    "order": 8,
    "title": "GIẢI QUYẾT DẠNG GAP FILL ▢▢▢✏️ - Record chữa số 3 - Part 1 Cam 20 Test 4",
    "youtubeUrl": "https://youtu.be/eylyuYVQ1Ys?si=ZJZag-psCPR5GEzP",
    "youtubeId": "eylyuYVQ1Ys",
    "duration": "7:44",
    "description": "Quy trình làm Gap Fill chuẩn chỉ, không đoán mò, không mất phương hướng.",
    "isPublished": true,
    "updatedAt": "2026-11-06T08:59:15.973Z"
  },
  {
    "id": "vid_1793955933167",
    "skillKey": "reading",
    "category": "GAP FILL",
    "order": 9,
    "title": "GIẢI QUYẾT DẠNG GAP FILL ▢▢▢✏️ - Record chữa số 4 - Part 1 Test 1 Cam 19",
    "youtubeUrl": "https://youtu.be/Nc4F4V0BzNo?si=k3c7rDUkvsV_xbZK",
    "youtubeId": "Nc4F4V0BzNo",
    "duration": "14:09",
    "description": "Phương pháp bám đuôi cấu trúc ngữ pháp để điền đúng số lượng từ quy định.",
    "isPublished": true,
    "updatedAt": "2026-11-06T09:05:33.167Z"
  },
  {
    "id": "vid_1793959572483",
    "skillKey": "reading",
    "category": "MATCHING INFORMATION",
    "order": 10,
    "title": "GIẢI QUYẾT DẠNG MATCHING INFORMATION🩸🩸🩸 - Record chữa Part 2 Cam 20 Test 1",
    "youtubeUrl": "https://youtu.be/9Xniwwk6BFM?si=syHvzbeDBkQSmlpk",
    "youtubeId": "9Xniwwk6BFM",
    "duration": "6:40",
    "description": "Cách skim đoạn văn để nắm ý nhanh, bắt KEYWORD chuẩn mà không cần vốn từ vựng quá cao.",
    "isPublished": true,
    "updatedAt": "2026-11-06T10:09:14.390Z"
  },
  {
    "id": "vid_1793959680915",
    "skillKey": "reading",
    "category": "MATCHING INFORMATION",
    "order": 11,
    "title": "GIẢI QUYẾT DẠNG MATCHING INFORMATION 🕵️🕵️‍♂️🕵️‍♀️ - Record số 2 chữa Cam 20 Test 2 + 3 part 2",
    "youtubeUrl": "https://youtu.be/6q4JFIsxIcU?si=zufwZTf7yHG5K04-",
    "youtubeId": "6q4JFIsxIcU",
    "duration": "11:42",
    "description": "Chiến lược tránh nhầm Matching Information với Matching Heading khi nhiều câu cùng trỏ về một đoạn.",
    "isPublished": true,
    "updatedAt": "2026-11-06T10:08:00.915Z"
  },
  {
    "id": "vid_1793959932537",
    "skillKey": "reading",
    "category": "MULTIPLE CHOICES 1 ANSWER",
    "order": 12,
    "title": "GIẢI QUYẾT DẠNG MULTIPLE CHOICES 1 ANSWER 🟥💊 vs 🟦💊 - Record chữa cam 20 test 1 part 3",
    "youtubeUrl": "https://youtu.be/h-SH64hPfAg?si=Vl3iU06e1kknVCRq",
    "youtubeId": "h-SH64hPfAg",
    "duration": "8:00",
    "description": "Xác định ý chính của câu hỏi trước khi nhìn đáp án, chiến lược loại trừ đáp án bẫy.",
    "isPublished": true,
    "updatedAt": "2026-11-06T10:12:12.537Z"
  },
  {
    "id": "vid_1793960005730",
    "skillKey": "reading",
    "category": "MULTIPLE CHOICES 1 ANSWER",
    "order": 13,
    "title": "GIẢI QUYẾT DẠNG MULTIPLE CHOICES 1 ANSWER Ⓐ Ⓑ Ⓒ Ⓓ - Record chữa cam 20 test 2 part 3",
    "youtubeUrl": "https://youtu.be/SHVcagazics?si=-bPHvAN6Vaxuynix",
    "youtubeId": "SHVcagazics",
    "duration": "9:02",
    "description": "Tư duy so sánh từng lựa chọn với văn bản gốc để không bị đọc lan man mất thời gian.",
    "isPublished": true,
    "updatedAt": "2026-11-06T10:13:25.730Z"
  },
  {
    "id": "vid_1793963228573",
    "skillKey": "reading",
    "category": "MULTIPLE CHOICES 1 ANSWER",
    "order": 14,
    "title": "GIẢI QUYẾT DẠNG MULTIPLE CHOICES 1 ANSWER Ⓐ Ⓑ Ⓒ Ⓓ - Record chữa cam 20 test 3 part 3",
    "youtubeUrl": "https://youtu.be/Gzwa4HO5_Ys?si=VQZbwqO-gN4Bc5RV",
    "youtubeId": "Gzwa4HO5_Ys",
    "duration": "11:26",
    "description": "Cách xử lý câu hỏi suy luận tác giả trong bài đọc dài Part 3.",
    "isPublished": true,
    "updatedAt": "2026-11-06T11:07:08.573Z"
  },
  {
    "id": "vid_1793963297866",
    "skillKey": "reading",
    "category": "MULTIPLE CHOICES 1 ANSWER",
    "order": 15,
    "title": "GIẢI QUYẾT DẠNG MULTIPLE CHOICES 1 ANSWER 🟥💊 vs 🟦💊 - Record chữa cam 20 test 1 part 3",
    "youtubeUrl": "https://youtu.be/h-SH64hPfAg?si=Ld-9Yw3kaOeXN3UB",
    "youtubeId": "h-SH64hPfAg",
    "duration": "8:00",
    "description": "Kỹ thuật gạch chân từ khóa trung tâm và phát hiện phương án làm nhiễu.",
    "isPublished": true,
    "updatedAt": "2026-11-06T11:08:17.866Z"
  },
  {
    "id": "vid_1793963400996",
    "skillKey": "reading",
    "category": "MULTIPLE CHOICES 2 ANSWERS",
    "order": 16,
    "title": "GIẢI QUYẾT DẠNG MULTIPLE CHOICES 2 ANSWERS ⓵➋➌⓸⓹- Record số 1 chữa Cam 20 Test 2 Part 2",
    "youtubeUrl": "https://youtu.be/IjVxij7imJ4?si=945yuTYVk358m2aU",
    "youtubeId": "IjVxij7imJ4",
    "duration": "6:15",
    "description": "Cách chia câu hỏi thành 2 lớp thông tin để chọn trọn vẹn 2 đáp án chính xác.",
    "isPublished": true,
    "updatedAt": "2026-11-06T11:10:00.996Z"
  },
  {
    "id": "vid_1793963520525",
    "skillKey": "reading",
    "category": "MATCHING NAMES",
    "order": 17,
    "title": "GIẢI QUYẾT DẠNG MATCHING NAMES 🧠🧠🧠 - Record chữa Cam 20 Test 3 Part 3",
    "youtubeUrl": "https://youtu.be/gReP8iN26FU?si=uzF9y232ve18sB4i",
    "youtubeId": "gReP8iN26FU",
    "duration": "18:34",
    "description": "Kỹ thuật lia theo danh sách tên nhà khoa học, bắt trúng quan điểm đồng ý hoặc phản đối.",
    "isPublished": true,
    "updatedAt": "2026-11-06T11:12:00.525Z"
  },
  {
    "id": "vid_1793963587858",
    "skillKey": "reading",
    "category": "MATCHING NAMES",
    "order": 18,
    "title": "GIẢI QUYẾT DẠNG MATCHING NAMES 🧠🧠🧠 - Record chữa Cam 20 Test 1 Part 2",
    "youtubeUrl": "https://youtu.be/goilQ23az2g?si=J3TPKCfJ29NtrqdK",
    "youtubeId": "goilQ23az2g",
    "duration": "8:31",
    "description": "Phân biệt rõ ràng khi nào các chuyên gia đồng tình, dè dặt hoặc giữ lập trường trung lập.",
    "isPublished": true,
    "updatedAt": "2026-11-06T11:13:07.858Z"
  },
  {
    "id": "vid_1793964222799",
    "skillKey": "reading",
    "category": "YES/NO/NOT GIVEN",
    "order": 19,
    "title": "GIẢI QUYẾT DẠNG YES/NO/NOT GIVEN 🟩🟥🟨 ( KHÓ, PHÂN LOẠI) - Record chữa Part 3 Test 1 Cam 20",
    "youtubeUrl": "https://youtu.be/_QKopM5Mfxk?si=liawvLmnz3FtYvwQ",
    "youtubeId": "_QKopM5Mfxk",
    "duration": "14:41",
    "description": "Tư duy phân loại nâng cao: Khi ý đúng nhưng phạm vi sai (scope shift) hoặc thiếu mấu chốt.",
    "isPublished": true,
    "updatedAt": "2026-11-06T11:23:42.799Z"
  }
];

class TheoryVideoEngine {
  constructor() {
    this.videos = this.loadLocalVideos();
    this.categoryOrders = this.loadCategoryOrders();
    this.syncFromCloud();
  }

  // Chuẩn hóa tên Dạng bài
  normalizeCategory(cat = '') {
    if (!cat) return 'CHUNG';
    return cat.trim().replace(/\s*\/\s*/g, '/').toUpperCase();
  }

  loadCategoryOrders() {
    try {
      const raw = localStorage.getItem(CATEGORY_ORDER_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  saveCategoryOrders(orders) {
    try {
      this.categoryOrders = orders;
      localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(orders));
    } catch (e) {}
  }

  loadLocalVideos() {
    try {
      const raw = localStorage.getItem(THEORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(v => ({
            ...v,
            category: this.normalizeCategory(v.category),
            isPublished: v.isPublished !== false
          }));
        }
      }
    } catch (e) {
      console.warn("⚠️ [TheoryEngine] Lỗi đọc bộ nhớ cục bộ, sử dụng dữ liệu mặc định.");
    }
    this.saveLocalVideos(REAL_DEFAULT_VIDEOS);
    return [...REAL_DEFAULT_VIDEOS];
  }

  saveLocalVideos(data) {
    try {
      localStorage.setItem(THEORY_STORAGE_KEY, JSON.stringify(data));
      this.videos = data;
    } catch (e) {
      console.error("❌ [TheoryEngine] Lỗi ghi LocalStorage:", e);
    }
  }

  extractYoutubeId(url) {
    if (!url) return '';
    const cleanUrl = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = cleanUrl.match(regExp);
    return (match && match[1]) ? match[1] : '';
  }

  getThumbnailUrl(youtubeId) {
    if (!youtubeId) return '';
    return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
  }

  // LẤY DANH SÁCH DẠNG BÀI KÈM SỐ ĐẾM BÀI HỌC VÀ THỨ TỰ SẮP XẾP
  getSubCategories(skillKey = 'all', isAdmin = false) {
    let list = this.videos;
    if (!isAdmin) {
      list = list.filter(v => v.isPublished !== false);
    }
    if (skillKey && skillKey !== 'all') {
      list = list.filter(v => v.skillKey === skillKey);
    }

    const counts = {};
    list.forEach(v => {
      const cat = this.normalizeCategory(v.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    let cats = Object.keys(counts);

    // Áp dụng thứ tự sắp xếp dạng bài đã lưu
    const savedOrder = this.categoryOrders[skillKey] || [];
    if (savedOrder.length > 0) {
      cats.sort((a, b) => {
        let idxA = savedOrder.indexOf(a);
        let idxB = savedOrder.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });
    }

    return cats.map(name => ({
      name,
      count: counts[name]
    }));
  }

  // LỌC VIDEO KÈM SUB-CATEGORY & PHÂN QUYỀN BẢN NHÁP
  getVideos(skillKey = 'all', subCategory = 'all', searchQuery = '', isAdmin = false) {
    let list = [...this.videos];

    if (!isAdmin) {
      list = list.filter(v => v.isPublished !== false);
    }

    if (skillKey && skillKey !== 'all') {
      list = list.filter(v => v.skillKey === skillKey);
    }

    if (subCategory && subCategory !== 'all') {
      const normSub = this.normalizeCategory(subCategory);
      list = list.filter(v => this.normalizeCategory(v.category) === normSub);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(v => 
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (skillKey === 'all') {
        const pA = SKILL_PRIORITY[a.skillKey] || 99;
        const pB = SKILL_PRIORITY[b.skillKey] || 99;
        if (pA !== pB) return pA - pB;
      }
      return (parseInt(a.order) || 999) - (parseInt(b.order) || 999);
    });

    return list;
  }

  // DI CHUYỂN DẠNG BÀI CHO 1 VIDEO
  async moveVideoCategory(videoId, newCategory) {
    const v = this.videos.find(item => item.id === videoId);
    if (!v) return;
    v.category = this.normalizeCategory(newCategory);
    v.updatedAt = new Date().toISOString();
    this.saveLocalVideos(this.videos);
    await this.syncToCloud();
    return true;
  }

  // DI CHUYỂN DẠNG BÀI HÀNG LOẠT (BATCH MOVE)
  async batchMoveCategory(videoIds = [], newCategory) {
    if (!videoIds.length || !newCategory) return;
    const targetCat = this.normalizeCategory(newCategory);
    let changed = false;

    this.videos.forEach(v => {
      if (videoIds.includes(v.id)) {
        v.category = targetCat;
        v.updatedAt = new Date().toISOString();
        changed = true;
      }
    });

    if (changed) {
      this.saveLocalVideos(this.videos);
      await this.syncToCloud();
    }
    return true;
  }

  // ĐỔI TÊN DẠNG BÀI TOÀN HỆ THỐNG (RENAME CATEGORY)
  async renameCategory(skillKey, oldName, newName) {
    if (!oldName || !newName) return;
    const normOld = this.normalizeCategory(oldName);
    const normNew = this.normalizeCategory(newName);
    if (normOld === normNew) return;

    this.videos.forEach(v => {
      if ((skillKey === 'all' || v.skillKey === skillKey) && this.normalizeCategory(v.category) === normOld) {
        v.category = normNew;
        v.updatedAt = new Date().toISOString();
      }
    });

    // Cập nhật mảng thứ tự
    if (this.categoryOrders[skillKey]) {
      this.categoryOrders[skillKey] = this.categoryOrders[skillKey].map(c => c === normOld ? normNew : c);
      this.saveCategoryOrders(this.categoryOrders);
    }

    this.saveLocalVideos(this.videos);
    await this.syncToCloud();
    return true;
  }

  // XÓA DẠNG BÀI (CHUYỂN TOÀN BỘ BÀI SANG DẠNG MẶC ĐỊNH HOẶC CHUNG)
  async deleteCategory(skillKey, catName, fallbackCat = 'CHUNG') {
    if (!catName) return;
    const normCat = this.normalizeCategory(catName);
    const targetFallback = this.normalizeCategory(fallbackCat);

    this.videos.forEach(v => {
      if ((skillKey === 'all' || v.skillKey === skillKey) && this.normalizeCategory(v.category) === normCat) {
        v.category = targetFallback;
        v.updatedAt = new Date().toISOString();
      }
    });

    if (this.categoryOrders[skillKey]) {
      this.categoryOrders[skillKey] = this.categoryOrders[skillKey].filter(c => c !== normCat);
      this.saveCategoryOrders(this.categoryOrders);
    }

    this.saveLocalVideos(this.videos);
    await this.syncToCloud();
    return true;
  }

  // SẮP XẾP THỨ TỰ HIỂN THỊ CÁC NÚT DẠNG BÀI
  async moveCategoryOrder(skillKey, catName, direction) {
    const list = this.getSubCategories(skillKey, true).map(c => c.name);
    const idx = list.indexOf(catName);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    const orders = { ...this.categoryOrders };
    orders[skillKey] = list;
    this.saveCategoryOrders(orders);
    return list;
  }

  async togglePublishStatus(videoId) {
    const v = this.videos.find(item => item.id === videoId);
    if (!v) return;
    v.isPublished = !(v.isPublished !== false);
    this.saveLocalVideos(this.videos);
    await this.syncToCloud();
    return v.isPublished;
  }

  async saveVideo(videoData) {
    const youtubeId = this.extractYoutubeId(videoData.youtubeUrl);
    if (!youtubeId) throw new Error("Đường dẫn YouTube không hợp lệ!");

    const payload = {
      id: videoData.id || `vid_${Date.now()}`,
      skillKey: videoData.skillKey || 'reading',
      category: this.normalizeCategory(videoData.category || 'CHUNG'),
      order: parseInt(videoData.order) || (this.videos.length + 1),
      title: (videoData.title || 'Bài giảng lý thuyết').trim(),
      youtubeUrl: videoData.youtubeUrl.trim(),
      youtubeId: youtubeId,
      duration: (videoData.duration || 'N/A').trim(),
      description: (videoData.description || '').trim(),
      isPublished: videoData.isPublished !== false,
      updatedAt: new Date().toISOString()
    };

    const idx = this.videos.findIndex(v => v.id === payload.id);
    let updated = [...this.videos];
    if (idx >= 0) updated[idx] = payload;
    else updated.push(payload);

    this.saveLocalVideos(updated);
    await this.syncToCloud();
    return payload;
  }

  async deleteVideo(videoId) {
    const updated = this.videos.filter(v => v.id !== videoId);
    this.saveLocalVideos(updated);
    await this.syncToCloud();
    return true;
  }

  async moveVideo(videoId, direction) {
    const list = [...this.videos];
    const idx = list.findIndex(v => v.id === videoId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const tempOrder = list[idx].order;
    list[idx].order = list[targetIdx].order;
    list[targetIdx].order = tempOrder;

    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    this.saveLocalVideos(list);
    await this.syncToCloud();
  }

  async reorderVideos(orderedIds = []) {
    const map = new Map(this.videos.map(v => [v.id, v]));
    const updated = [];
    orderedIds.forEach((id, idx) => {
      const v = map.get(id);
      if (v) {
        v.order = idx + 1;
        updated.push(v);
        map.delete(id);
      }
    });
    map.forEach(v => updated.push(v));
    this.saveLocalVideos(updated);
    await this.syncToCloud();
  }

  isCompleted(videoId) {
    try {
      const arr = JSON.parse(localStorage.getItem(COMPLETED_STORAGE_KEY) || '[]');
      return arr.includes(videoId);
    } catch (e) { return false; }
  }

  toggleCompleted(videoId) {
    try {
      let arr = JSON.parse(localStorage.getItem(COMPLETED_STORAGE_KEY) || '[]');
      if (arr.includes(videoId)) arr = arr.filter(id => id !== videoId);
      else arr.push(videoId);
      localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(arr));
      return arr.includes(videoId);
    } catch (e) { return false; }
  }

  saveWatchProgress(videoId, seconds) {
    if (!videoId || seconds < 5) return;
    try {
      const map = JSON.parse(localStorage.getItem(WATCH_PROGRESS_KEY) || '{}');
      map[videoId] = Math.floor(seconds);
      localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  getWatchProgress(videoId) {
    try {
      const map = JSON.parse(localStorage.getItem(WATCH_PROGRESS_KEY) || '{}');
      return map[videoId] || 0;
    } catch (e) { return 0; }
  }

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
      if (data?.success && Array.isArray(data.videos) && data.videos.length > 0) {
        this.saveLocalVideos(data.videos);
      }
    } catch (e) {}
  }

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
