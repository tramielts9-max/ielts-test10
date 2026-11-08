/**
 * curriculum-system/engine-system.js
 * BỘ MÁY ĐIỀU PHỐI TÍNH XUÔI THEO SỐ BUỔI HỌC (300K/BUỔI - 12 BUỔI/NỬA BAND + LŨY TIẾN)
 * GIAI ĐOẠN 3 HOÀN CHỈNH: BẮC CẦU BLUEPRINT CÂU SAI DIAGNOSTIC SANG LỘ TRÌNH 5 CHẶNG
 * TÍNH NĂNG ĐỘT PHÁ:
 *  1. CƠ CHẾ CỨU BÀI KHẨN CẤP (URGENT REMEDIAL INJECTION): GIỮ 100% ĐỐT CÂU SAI & ĐẨY LÊN ĐẦU CHẶNG
 *  2. VÔ HIỆU HÓA HEAD-CUT ĐỐI VỚI BÀI TẬP BỊ HỔNG NỀN TẢNG
 *  3. HÀM GENERATEROADMAPFROMDIAGNOSTIC SINH LỘ TRÌNH VỚI CỜ PENDING_ADMIN_APPROVAL
 *  4. BẢO TOÀN 100% 75% ĐỀ THI THẬT, 28 UNIT TỪ VỰNG & VÒNG LẶP ÔN TẬP 3 NGÀY
 */

export class CurriculumEngineSystem {
  constructor() {
    this.allNodes = [];
  }

  setNodes(nodes) {
    if (!Array.isArray(nodes)) {
      this.allNodes = [];
      return;
    }
    this.allNodes = nodes.map(n => ({
      ...n,
      benefit: n.benefit || this.generateBenefit(n)
    }));
  }

  generateBenefit(node) {
    if (!node) return "Củng cố phản xạ và độ chính xác ngôn ngữ học thuật.";
    const d = (node.domain || '').toUpperCase();
    const t = (node.title || '').toLowerCase();

    if (d === 'GRAMMAR') {
      if (t.includes('lý thuyết')) return "Nắm vững bản chất công thức, tránh dịch 'word-by-word' từ tiếng Việt.";
      return "Triệt tiêu lỗi sai thì, sai cấu trúc câu đơn/phức khi viết và nói.";
    }
    if (d === 'VOCABULARY') return "Nạp từ vựng học thuật theo ngữ cảnh mạch tư duy (Collocations & Topic Words).";
    if (d === 'PRE_LISTENING') return "Luyện tai bắt âm nối, nuốt âm (-s, -ed), số liệu và tên riêng chuẩn xác.";
    if (d === 'PRE_READING') return "Rèn kỹ thuật Skimming & Scanning định vị từ khóa không cần tra từ điển.";
    if (d === 'PRE_SPEAKING') return "Shadowing nhại giọng bản ngữ, chuẩn hóa ngữ điệu và phản xạ kéo dài câu trả lời.";
    if (d.includes('PRE_WRITING')) return "Chuyển ngữ kịch bản Việt ➔ Anh 3 mốc Band, rèn tư duy dàn ý PEEL.";
    if (d === 'READING') {
      if (t.includes('có mớm')) return "Luyện chiến thuật làm chủ dạng bài (Gap Fill, TFNG) có mớm dẫn dắt.";
      return "Tự lực định vị từ khóa dưới áp lực bấm giờ 15-20p/Passage chuẩn phòng thi.";
    }
    if (d === 'LISTENING') return "Rèn độ nhạy bắt từ khóa chuyển ý (Signposting) và bẫy đổi ý (actually, but).";
    if (d === 'WRITING_T1') return "Tự viết bài mô tả biểu đồ 150 từ hoàn chỉnh trong đúng 20 phút (Overview & Grouping).";
    if (d === 'WRITING_T2') return "Viết bài luận học thuật 250 từ chuẩn 4 đoạn PEEL, nâng cấp từ vựng C1 chuẩn xác.";
    if (d === 'SPEAKING') return "Phản xạ trả lời trôi chảy theo cấu trúc AREA, không bị khựng quá 3 giây.";
    if (d === 'MOCK_TEST') return "Rèn luyện thể lực và tâm lý phòng thi dưới áp lực làm bài liên tục 3 tiếng.";
    return "Củng cố phản xạ và độ chính xác ngôn ngữ học thuật.";
  }

  // TÍNH CHUẨN SỐ BUỔI HỌC THEO CÔNG THỨC LŨY TIẾN (5.5 -> 7.0 = 42 BUỔI / 91 NGÀY BTVN)
  calculateSessionsByBands(startBand, targetBand) {
    const s = Math.round((parseFloat(startBand) || 0.0) * 2) / 2;
    const t = Math.round((Math.min(7.0, parseFloat(targetBand) || 7.0)) * 2) / 2;

    if (s >= t) return { sessions: 12, months: 1.0, days: 26, hours: 39, weeks: 4 };

    const stepCosts = {
      '0.0-0.5': 12, '0.5-1.0': 12, '1.0-1.5': 12, '1.5-2.0': 12,
      '2.0-2.5': 12, '2.5-3.0': 12, '3.0-3.5': 12, '3.5-4.0': 12,
      '4.0-4.5': 12, '4.5-5.0': 12,
      '5.0-5.5': 12, // Chuẩn 12 buổi
      '5.5-6.0': 13, // +1 buổi = 13
      '6.0-6.5': 14, // +1 buổi = 14
      '6.5-7.0': 15  // +1 buổi = 15
    };

    let totalSessions = 0;
    let curr = s;

    while (curr < t) {
      const next = Math.round((curr + 0.5) * 2) / 2;
      const key = `${curr.toFixed(1)}-${next.toFixed(1)}`;
      totalSessions += (stepCosts[key] || 12);
      curr = next;
    }

    const months = Math.round((totalSessions / 12) * 10) / 10;
    const days = Math.round(months * 26);
    const hours = Math.round(days * 1.5 * 10) / 10;
    const weeks = Math.round(months * 4);

    return {
      sessions: totalSessions,
      months,
      days,
      hours,
      weeks
    };
  }

  // =========================================================================
  // BỘ TRỢ THỦ BÓC TÁCH BLUEPRINT CÂU SAI TỪ BÀI THI DIAGNOSTIC
  // =========================================================================
  extractRemedialTagsFromBlueprint(blueprintProfile = {}) {
    if (!blueprintProfile || typeof blueprintProfile !== 'object') return [];

    const tags = new Set();

    // 1. Tags ngữ pháp làm sai (VD: G_PAST_SIMPLE, G_IRREG_V2, G_ARTICLES)
    if (Array.isArray(blueprintProfile.wrongGrammarTags)) {
      blueprintProfile.wrongGrammarTags.forEach(t => {
        if (t && typeof t === 'string') tags.add(t.trim().toUpperCase());
      });
    }

    // 2. Kỹ năng đọc sai (VD: READ_TFNG_TRAP, READ_Q05, READ_CAM...)
    if (Array.isArray(blueprintProfile.failedReadingSkills)) {
      blueprintProfile.failedReadingSkills.forEach(t => {
        if (t && typeof t === 'string') tags.add(t.trim().toUpperCase());
      });
    }

    // 3. Kỹ năng nghe sai (VD: LIS_P1_Q2, LIS_MAP_LABELLING)
    if (Array.isArray(blueprintProfile.failedListeningSkills)) {
      blueprintProfile.failedListeningSkills.forEach(t => {
        if (t && typeof t === 'string') tags.add(t.trim().toUpperCase());
      });
    }

    // 4. Tiêu chí viết yếu (VD: TR_TASK2_MISSING, GRA)
    if (Array.isArray(blueprintProfile.weakWritingCriteria)) {
      blueprintProfile.weakWritingCriteria.forEach(t => {
        if (t && typeof t === 'string') tags.add(t.trim().toUpperCase());
      });
    }

    // 5. Tiêu chí nói yếu (VD: FC_SHORT_RESPONSE, PRON)
    if (Array.isArray(blueprintProfile.weakSpeakingCriteria)) {
      blueprintProfile.weakSpeakingCriteria.forEach(t => {
        if (t && typeof t === 'string') tags.add(t.trim().toUpperCase());
      });
    }

    return Array.from(tags);
  }

  isNodeMatchingRemedial(node, remedialTags = []) {
    if (!node || !remedialTags || remedialTags.length === 0) return false;
    const nodeTags = (node.tags || []).map(t => String(t).toUpperCase());
    const nodeId = String(node.id || '').toUpperCase();
    const nodeTitle = String(node.title || '').toUpperCase();

    return remedialTags.some(rt => {
      if (!rt) return false;
      const target = rt.toUpperCase();
      // Khớp trực tiếp tag
      if (nodeTags.includes(target)) return true;
      // Khớp id hoặc từ khóa trong title
      if (nodeId.includes(target) || target.includes(nodeId)) return true;
      // Khớp các tiền tố ngữ pháp đặc trị
      if (target.startsWith('G_') && nodeTags.some(t => t.includes(target) || target.includes(t))) return true;
      // Khớp kỹ năng đọc/nghe
      if (target.startsWith('READ_') && node.domain === 'READING') {
        if (target.includes('TFNG') && nodeTitle.includes('TFNG')) return true;
        if (target.includes('MAP') && nodeTitle.includes('MAP')) return true;
      }
      if (target.startsWith('LIS_') && (node.domain === 'LISTENING' || node.domain === 'PRE_LISTENING')) {
        if (target.includes('P1') && (nodeTags.includes('LIS_P1') || nodeTitle.includes('PART 1'))) return true;
        if (target.includes('MAP') && nodeTitle.includes('MAP')) return true;
      }
      return false;
    });
  }

  /**
   * LỌC KHO BÀI TẬP THÔNG MINH:
   * CƠ CHẾ CỨU BÀI KHẨN CẤP (URGENT REMEDIAL INJECTION):
   * GIỮ 100% ĐỐT BÀI TẬP TƯƠNG ỨNG VỚI CÂU SAI & MIỄN TRỪ HOÀN TOÀN KHỎI LUẬT HEAD-CUT
   */
  pruneCurriculumByBands(startBand = 0.0, targetBand = 7.0, aiOptions = {}) {
    const sBand = parseFloat(startBand) || 0.0;
    const tBand = Math.min(7.0, parseFloat(targetBand) || 7.0);

    // Bóc tách tags cứu bài từ blueprintProfile hoặc các trường yếu
    const blueprintProfile = aiOptions.blueprintProfile || aiOptions.details?.blueprintProfile || {};
    const blueprintRemedialTags = this.extractRemedialTagsFromBlueprint(blueprintProfile);

    const weakTags = [
      ...(aiOptions.retained_weak_tags || []),
      ...(aiOptions.weak_tags || []),
      ...blueprintRemedialTags
    ];

    const prunedTags = aiOptions.pruned_tags || aiOptions.mastered_tags || [];
    const excludedDomains = (aiOptions.pruned_domains || aiOptions.excluded_domains || []).map(d => String(d).toUpperCase());
    const focusDomains = (aiOptions.focus_domains || []).map(d => String(d).toUpperCase());
    const isFullVocab = (aiOptions.vocab_requirement === 'FULL_100_PERCENT');
    const prohibitedLevels = aiOptions.quota_policy?.prohibited_levels || [];

    return this.allNodes.filter((node, idx) => {
      if (!node) return false;
      const d = (node.domain || '').toUpperCase();
      const nodeTags = node.tags || [];
      const stg = node.stage || 'S1';
      const titleLower = (node.title || '').toLowerCase();
      const idUpper = (node.id || '').toUpperCase();

      const isRemedial = this.isNodeMatchingRemedial(node, weakTags);

      // 🔴 NGUYÊN TẮC CỨU BÀI TỐI CAO:
      // NẾU LÀ ĐỐT CỨU BÀI DO HỌC SINH LÀM SAI TRONG BÀI THI -> BẮT BUỘC GIỮ LẠI 100%, CẤM CẮT ĐẦU!
      if (isRemedial) {
        node.isRemedial = true;
        node.remedialReason = "Đặc trị lỗi sai bài thi chẩn đoán (Diagnostic Blueprint)";
        return true;
      }

      // 1. LUẬT LỌC TRÌNH ĐỘ CỦA AI: CHẶN CÁC BÀI VỠ LÒNG NẾU THUỘC PROHIBITED LEVELS
      if (prohibitedLevels.includes("A1")) {
        const isA1Content = idUpper.includes('_A1') || titleLower.includes(' a1') || nodeTags.some(t => String(t).includes('_A1'));
        if (isA1Content && !isRemedial) {
          return false;
        }
      }

      // 2. BẢO TỒN 100% KHO TỪ VỰNG 28 UNIT KHI CÓ CHỈ ĐẠO
      if (isFullVocab && d === 'VOCABULARY') {
        return true;
      }

      // 3. CẮT BỎ CÁC DOMAIN BỊ AI LOẠI TRỪ (VÍ DỤ: PRE_READING)
      if (excludedDomains.some(ex => d === ex || d.startsWith(ex) || ex.includes(d))) {
        return false;
      }

      // 4. CẮT BỎ CÁC TAGS RÂU RIA AI ĐÁNH GIÁ ĐÃ VỮNG
      if (prunedTags.length > 0 && nodeTags.length > 0 && nodeTags.every(t => prunedTags.includes(t))) {
        return false;
      }

      // 5. BẢO VỆ CÁC DOMAIN TRỌNG TÂM ĐỂ DÀNH NGUYÊN LIỆU CHO CÁC CHẶNG
      if (focusDomains.some(fc => d === fc || d.includes(fc))) {
        if (tBand <= 5.5 && stg === 'S4') return false;
        return true;
      }

      // 6. CẮT ĐẦU THEO BAND XUẤT PHÁT (HEAD-CUT) - CHỈ ÁP DỤNG NẾU KHÔNG PHẢI BÀI CỨU
      if (sBand >= 3.5 && stg === 'S1') return false;
      if (sBand >= 4.5 && stg === 'S1') return false;
      if (sBand >= 5.0 && stg === 'S2' && !d.includes('PRE_WRITING')) return false;
      if (sBand >= 5.5 && stg === 'S2') return false;
      if (sBand >= 6.0 && stg === 'S3' && (titleLower.includes('có mớm') || d.includes('PRE_'))) return false;
      if (sBand >= 6.5 && stg === 'S3') return false;

      // 7. CẮT ĐUÔI THEO BAND MỤC TIÊU (TAIL-CUT)
      if (tBand <= 5.0 && (stg === 'S3' || stg === 'S4')) return false;
      if (tBand <= 5.5 && stg === 'S4') return false;
      if (tBand <= 6.0 && stg === 'S4') return false;
      if (tBand <= 6.5 && stg === 'S4' && idx % 3 === 0) return false;

      return true;
    });
  }

  calculateTotals(retainedNodes, speedProfile = 'normal', dailyHours = 1.5, startBand = 0.0, targetBand = 7.0) {
    const stats = this.calculateSessionsByBands(startBand, targetBand);

    return {
      totalSelfStudyHours: stats.hours,
      totalDays: stats.days,
      estimatedMonths: stats.months,
      totalWeeks: stats.weeks,
      totalLiveSessions: stats.sessions,
      totalTeacherHours: stats.sessions * 2,
      tuitionVND: (stats.sessions * 300000).toLocaleString('vi-VN') + 'đ',
      nodeCount: (retainedNodes || []).length
    };
  }

  // =========================================================================
  // ĐIỀU PHỐI LỘ TRÌNH DỰA THEO BLUEPRINT CỦA AI HOẶC BÀI THI DIAGNOSTIC
  // =========================================================================
  generateDailyCalendar(retainedNodes, speedProfile = 'normal', dailyHours = 1.5, startBand = 0.0, targetBand = 7.0, aiOptions = {}) {
    const stats = this.calculateSessionsByBands(startBand, targetBand);
    const targetDays = stats.days; // 91 ngày chuẩn cho mốc 5.5 -> 7.0
    const dailyTargetMinutes = Math.round(dailyHours * 60); // 90 phút/ngày

    if (aiOptions.schedule_mode === 'SEQUENTIAL_PHASES' || aiOptions.blueprintProfile) {
      return this.generateSequentialPhasesCalendar(retainedNodes, targetDays, dailyTargetMinutes, speedProfile, stats, aiOptions);
    }

    return this.generateStandardSpiralCalendar(retainedNodes, targetDays, dailyTargetMinutes, speedProfile, stats, aiOptions);
  }

  // =========================================================================
  // THUẬT TOÁN BĂM 5 CHẶNG TUẦN TỰ: 75% ĐỀ THI THẬT, VÒNG LẶP 3 NGÀY & ĐẨY BÀI CỨU LÊN ĐẦU
  // =========================================================================
  generateSequentialPhasesCalendar(retainedNodes, targetDays, dailyTargetMinutes, speedProfile, stats, aiOptions) {
    const calendarDays = [];
    const quota = aiOptions.quota_policy || {};
    const reviewInterval = quota.review_interval_days || 3;

    // 1. Phân loại bài tập chi tiết & ưu tiên bài cứu
    const qRemedialGrammar = [];
    const qStandardGrammar = [];
    const qVocab = [];
    const qReading = [];
    const qPreListening = [];
    const qOfficialListening = [];
    const qPreWriting = [];
    const qOfficialWritingT1 = [];
    const qOfficialWritingT2 = [];
    const qPreSpeaking = [];
    const qOfficialSpeaking = [];

    // Sắp xếp bài từ vựng đúng thứ tự Unit 1 -> 10 (300 từ) rồi đến Unit 1 -> 18 (540 từ)
    const rawVocab = (retainedNodes || []).filter(n => (n.domain || '').toUpperCase() === 'VOCABULARY');
    rawVocab.sort((a, b) => {
      const getNum = id => parseInt(String(id).replace(/[^0-9]/g, ''), 10) || 0;
      return getNum(a.id) - getNum(b.id);
    });
    rawVocab.forEach(n => qVocab.push({ ...n, benefit: n.benefit || this.generateBenefit(n) }));

    (retainedNodes || []).forEach(node => {
      if (!node) return;
      const d = (node.domain || '').toUpperCase();
      const nWithBenefit = {
        ...node,
        benefit: node.benefit || this.generateBenefit(node),
        title: node.isRemedial ? `[🚨 ĐẶC TRỊ CÂU SAI] ${node.title}` : node.title
      };

      if (d === 'GRAMMAR') {
        if (node.isRemedial) qRemedialGrammar.push(nWithBenefit);
        else qStandardGrammar.push(nWithBenefit);
      } else if (d === 'READING' || d === 'PRE_READING') {
        if (node.isRemedial) qReading.unshift(nWithBenefit); // Đưa bài đọc yếu lên đầu
        else qReading.push(nWithBenefit);
      } else if (d === 'PRE_LISTENING') {
        qPreListening.push(nWithBenefit);
      } else if (d === 'LISTENING') {
        if (node.isRemedial) qOfficialListening.unshift(nWithBenefit);
        else qOfficialListening.push(nWithBenefit);
      } else if (d.includes('PRE_WRITING')) {
        qPreWriting.push(nWithBenefit);
      } else if (d === 'WRITING_T1') {
        qOfficialWritingT1.push(nWithBenefit);
      } else if (d === 'WRITING_T2') {
        qOfficialWritingT2.push(nWithBenefit);
      } else if (d === 'PRE_SPEAKING') {
        qPreSpeaking.push(nWithBenefit);
      } else if (d === 'SPEAKING') {
        qOfficialSpeaking.push(nWithBenefit);
      }
    });

    // Gom hàng đợi Grammar: BÀI CỨU XẾP ĐẦU TIÊN
    const qGrammar = [...qRemedialGrammar, ...qStandardGrammar];

    // Kho lưu trữ đề thi đã học để phục vụ Vòng lặp Ôn tập Spaced Repetition
    const reviewPoolReading = [...qReading];
    const reviewPoolListening = [...qOfficialListening];

    // 2. Tính toán phân bổ số ngày cho từng Chặng (Tổng cộng chuẩn targetDays)
    const daysPhase1 = Math.min(12, Math.max(6, Math.ceil(qGrammar.length / 2)));
    const daysPhase2 = qVocab.length > 0 ? qVocab.length : 28;
    const daysPhase3 = 16;
    const daysPhase4 = 19;
    const daysPhase5 = Math.max(10, targetDays - (daysPhase1 + daysPhase2 + daysPhase3 + daysPhase4));

    const pickFromQueue = (queue) => {
      if (!queue || queue.length === 0) return null;
      const task = queue.shift();
      const dur = task.duration?.[speedProfile] || task.duration?.normal || 25;
      return { ...task, assignedDurationMinutes: dur };
    };

    let currentDayNum = 1;

    // -----------------------------------------------------------------------
    // CHẶNG 1: NỀN TẢNG NGỮ PHÁP (ƯU TIÊN CỨU CÂU SAI ĐẶC TRỊ LÊN ĐẦU)
    // -----------------------------------------------------------------------
    for (let i = 0; i < daysPhase1 && currentDayNum <= targetDays; i++) {
      const dayTasks = [];
      let mins = 0;

      while (mins < dailyTargetMinutes && qGrammar.length > 0) {
        const task = pickFromQueue(qGrammar);
        if (task) {
          dayTasks.push(task);
          mins += task.assignedDurationMinutes;
        }
      }

      if (dayTasks.length === 0) {
        dayTasks.push({
          id: `S2_GRAM_REV_${currentDayNum}`,
          stage: "S2", domain: "GRAMMAR", type: "PRACTICE",
          title: `Tổng ôn & Triệt tiêu lỗi câu phức / Thì quá khứ #${i + 1}`,
          benefit: "Luyện phản xạ chuyển đổi câu chủ động sang bị động và sử dụng mệnh đề quan hệ.",
          assignedDurationMinutes: 60,
          url: "grammar/index-g.html"
        });
        mins = 60;
      }

      calendarDays.push({
        dayNumber: currentDayNum,
        totalMinutes: mins,
        phaseId: "PHASE_1_GRAMMAR",
        phaseName: "Chặng 1: Nền Tảng Ngữ Pháp & Cứu Lỗi Sai Diagnostic",
        phaseDesc: "Tập trung triệt tiêu toàn bộ lỗi chia thì, động từ bất quy tắc và câu phức bị sai trong bài thi đầu vào.",
        nodes: dayTasks
      });
      currentDayNum++;
    }

    // -----------------------------------------------------------------------
    // CHẶNG 2: READING & 100% KHO TỪ VỰNG (28 UNIT CHẠY SẠCH SẼ TỪNG NGÀY)
    // -----------------------------------------------------------------------
    for (let i = 0; i < daysPhase2 && currentDayNum <= targetDays; i++) {
      const dayTasks = [];
      let mins = 0;

      // 1. Đúng 1 Unit từ vựng tuần tự (Unit 1 đến 28)
      const vTask = pickFromQueue(qVocab);
      if (vTask) {
        dayTasks.push(vTask);
        mins += vTask.assignedDurationMinutes;
      }

      // 2. Chạy song song 1 bài Reading Cambridge
      const rTask = pickFromQueue(qReading);
      if (rTask) {
        dayTasks.push(rTask);
        mins += rTask.assignedDurationMinutes;
      } else {
        dayTasks.push({
          id: `REV_READ_${currentDayNum}`,
          stage: "S4", domain: "READING", type: "TEST",
          title: `Reading Cambridge Thực Chiến: Giải Passage 3 dưới áp lực 20 phút`,
          benefit: "Rèn kỹ thuật xử lý dạng bài khó Summary Completion và True/False/Not Given.",
          assignedDurationMinutes: 45,
          url: "reading/reading.html"
        });
        mins += 45;
      }

      calendarDays.push({
        dayNumber: currentDayNum,
        totalMinutes: mins,
        phaseId: "PHASE_2_READING_VOCAB",
        phaseName: "Chặng 2: Đột Phá Reading & Quét Sạch 100% Từ Vựng (28 Unit)",
        phaseDesc: "Cày sạch toàn bộ 10 Unit bộ 300 từ và 18 Unit bộ 540 từ, kết hợp giải đề Reading chuẩn phòng thi.",
        nodes: dayTasks
      });
      currentDayNum++;
    }

    // -----------------------------------------------------------------------
    // CHẶNG 3: LISTENING THỰC CHIẾN (CHẶN A1, ĐẨY NHANH VÀO ĐỀ CAMBRIDGE)
    // -----------------------------------------------------------------------
    for (let i = 0; i < daysPhase3 && currentDayNum <= targetDays; i++) {
      const dayTasks = [];
      let mins = 0;

      if (qPreListening.length > 0 && i < 5) {
        const pTask = pickFromQueue(qPreListening);
        if (pTask) { dayTasks.push(pTask); mins += pTask.assignedDurationMinutes; }
      }

      while (mins < dailyTargetMinutes && qOfficialListening.length > 0) {
        const lTask = pickFromQueue(qOfficialListening);
        if (lTask) { dayTasks.push(lTask); mins += lTask.assignedDurationMinutes; }
      }

      if (dayTasks.length === 0) {
        dayTasks.push({
          id: `REV_LIS_${currentDayNum}`,
          stage: "S4", domain: "LISTENING", type: "TEST",
          title: `Listening Cambridge 1.1x: Bẫy Matching Features & Chuyển ý Part 2/Part 3`,
          benefit: "Luyện phản xạ bắt từ khóa khi người nói đảo chiều và trị tật mất dấu track âm thanh.",
          assignedDurationMinutes: 45,
          url: "listening/listening.html"
        });
        mins = 45;
      }

      calendarDays.push({
        dayNumber: currentDayNum,
        totalMinutes: mins,
        phaseId: "PHASE_3_LISTENING",
        phaseName: "Chặng 3: Chiến Thuật Listening & Trị Bẫy Đảo Chiều",
        phaseDesc: "Rèn kỹ năng bám dấu bài nghe, triệt tiêu lỗi bỏ trống chuỗi câu ở Part 2 và Part 3.",
        nodes: dayTasks
      });
      currentDayNum++;
    }

    // -----------------------------------------------------------------------
    // CHẶNG 4: THỰC CHIẾN WRITING (75% ĐỀ THI THẬT TASK 1/TASK 2 + ÔN TẬP 3 NGÀY)
    // -----------------------------------------------------------------------
    for (let i = 0; i < daysPhase4 && currentDayNum <= targetDays; i++) {
      const dayTasks = [];
      let mins = 0;
      const isReviewDay = (reviewInterval > 0 && (i + 1) % reviewInterval === 0);

      // CỨ ĐÚNG CHU KỲ 3 NGÀY: CHÈN 1 ĐỀ READING CAMBRIDGE ĐỂ ÔN TẬP DUY TRÌ
      if (isReviewDay) {
        const revTask = reviewPoolReading.length > 0 
          ? { ...reviewPoolReading[(i * 2) % reviewPoolReading.length], assignedDurationMinutes: 40, title: `[🔄 ÔN TẬP DUY TRÌ] ${reviewPoolReading[(i * 2) % reviewPoolReading.length].title}` }
          : {
            id: `REV_READ_MAINT_${currentDayNum}`, stage: "S4", domain: "READING", type: "TEST",
            title: `[🔄 ÔN TẬP DUY TRÌ] Giải Đề Reading Cam Bấm Giờ 40 Phút`,
            benefit: "Giữ tay định vị từ khóa và phản xạ làm bài thi đọc hiểu dưới áp lực thời gian.",
            assignedDurationMinutes: 40, url: "reading/reading.html"
          };
        dayTasks.push(revTask);
        mins += revTask.assignedDurationMinutes;
      }

      if (qPreWriting.length > 0 && i < 4 && mins < dailyTargetMinutes) {
        const pwTask = pickFromQueue(qPreWriting);
        if (pwTask) { dayTasks.push(pwTask); mins += pwTask.assignedDurationMinutes; }
      }

      if (qOfficialWritingT2.length > 0 && mins < dailyTargetMinutes) {
        const wt2Task = pickFromQueue(qOfficialWritingT2);
        if (wt2Task) { dayTasks.push(wt2Task); mins += wt2Task.assignedDurationMinutes; }
      }

      if (qOfficialWritingT1.length > 0 && mins < dailyTargetMinutes) {
        const wt1Task = pickFromQueue(qOfficialWritingT1);
        if (wt1Task) { dayTasks.push(wt1Task); mins += wt1Task.assignedDurationMinutes; }
      }

      if (dayTasks.length === 0) {
        dayTasks.push({
          id: `REV_WRT2_FINAL_${currentDayNum}`, stage: "S4", domain: "WRITING_T2", type: "PRACTICE",
          title: `Writing Task 2 Độc Lập: Viết luận 250 từ chuẩn PEEL (Bấm giờ 40 phút)`,
          benefit: "Tự lên dàn ý và triển khai luận điểm độc lập, cai nghiện hoàn toàn thói quen ngâm bài mẫu.",
          assignedDurationMinutes: 50, url: "writing task 2/index-t2.html"
        });
        mins = 50;
      }

      calendarDays.push({
        dayNumber: currentDayNum,
        totalMinutes: mins,
        phaseId: "PHASE_4_WRITING",
        phaseName: "Chặng 4: Thực Chiến Writing Task 1 & Task 2 (Cai Nghiện Bài Mẫu)",
        phaseDesc: "Tối thiểu 75% thời lượng viết bài luận Task 2 và biểu đồ Task 1 bấm giờ, kết hợp ôn đề Reading mỗi 3 ngày.",
        nodes: dayTasks
      });
      currentDayNum++;
    }

    // -----------------------------------------------------------------------
    // CHẶNG 5: VỀ ĐÍCH BÙNG NỔ SPEAKING (100% ĐỀ THI FORECAST + ÔN TẬP 3 NGÀY)
    // -----------------------------------------------------------------------
    let dayInPhase5 = 1;
    while (currentDayNum <= targetDays) {
      const dayTasks = [];
      let mins = 0;
      const isReviewDay = (reviewInterval > 0 && dayInPhase5 % reviewInterval === 0);

      if (isReviewDay) {
        const revLisTask = reviewPoolListening.length > 0
          ? { ...reviewPoolListening[(dayInPhase5 * 3) % reviewPoolListening.length], assignedDurationMinutes: 30, title: `[🔄 ÔN TẬP DUY TRÌ] ${reviewPoolListening[(dayInPhase5 * 3) % reviewPoolListening.length].title}` }
          : {
            id: `REV_LIS_MAINT_${currentDayNum}`, stage: "S4", domain: "LISTENING", type: "TEST",
            title: `[🔄 ÔN TẬP DUY TRÌ] Nghe Lại 1 Đề Listening Cam 1.1x Bấm Giờ 30 Phút`,
            benefit: "Duy trì phản xạ bắt âm thanh và độ nhạy bám dấu câu hỏi trước ngày thi thật.",
            assignedDurationMinutes: 30, url: "listening/listening.html"
          };
        dayTasks.push(revLisTask);
        mins += revLisTask.assignedDurationMinutes;
      }

      if (qPreSpeaking.length > 0 && mins < dailyTargetMinutes) {
        const psTask = pickFromQueue(qPreSpeaking);
        if (psTask) {
          psTask.assignedDurationMinutes = 20;
          dayTasks.push(psTask);
          mins += psTask.assignedDurationMinutes;
        }
      }

      while (mins < dailyTargetMinutes && qOfficialSpeaking.length > 0) {
        const spkTask = pickFromQueue(qOfficialSpeaking);
        if (spkTask) {
          dayTasks.push(spkTask);
          mins += spkTask.assignedDurationMinutes;
        }
      }

      if (dayTasks.length <= 1) {
        dayTasks.push({
          id: `REV_SPK_FORECAST_${currentDayNum}`, stage: "S4", domain: "SPEAKING", type: "PRACTICE",
          title: `Speaking Part 2 & Part 3 Forecast: Nói liên tục 2 phút theo chủ đề thi thật`,
          benefit: "Rèn phản xạ kéo dài câu trả lời dứt khoát, triệt tiêu tật đệm 'like', 'yeah' và lỗi nhảy thì lung tung.",
          assignedDurationMinutes: 35, url: "speaking/index-s.html"
        });
        mins += 35;
      }

      calendarDays.push({
        dayNumber: currentDayNum,
        totalMinutes: mins,
        phaseId: "PHASE_5_SPEAKING",
        phaseName: "Chặng 5: Về Đích - Đột Phá Speaking & Shadowing Toàn Diện",
        phaseDesc: "100% các ngày luyện đề thi thật Forecast Part 1/2/3, Shadowing ấm giọng và ôn đề Listening định kỳ 3 ngày.",
        nodes: dayTasks
      });
      currentDayNum++;
      dayInPhase5++;
    }

    return {
      totalDays: calendarDays.length,
      estimatedMonths: stats.months,
      dailySchedule: calendarDays
    };
  }

  // =========================================================================
  // THUẬT TOÁN XOAY VÒNG TIÊU CHUẨN (KHI KHÔNG YÊU CẦU THỨ TỰ BẮT BUỘC)
  // =========================================================================
  generateStandardSpiralCalendar(retainedNodes, targetDays, dailyTargetMinutes, speedProfile, stats, aiOptions) {
    const calendarDays = [];
    const qGrammar = [];
    const qVocab = [];
    const qPreLis = [];
    const qOffLis = [];
    const qPreRead = [];
    const qOffRead = [];
    const qPreWrite = [];
    const qOffWrite = [];
    const qPreSpk = [];
    const qOffSpk = [];
    const qMock = [];

    (retainedNodes || []).forEach(node => {
      if (!node) return;
      const d = (node.domain || '').toUpperCase();
      const nWithBenefit = { ...node, benefit: node.benefit || this.generateBenefit(node) };

      if (d === 'GRAMMAR') qGrammar.push(nWithBenefit);
      else if (d === 'VOCABULARY') qVocab.push(nWithBenefit);
      else if (d === 'PRE_LISTENING') qPreLis.push(nWithBenefit);
      else if (d === 'LISTENING') qOffLis.push(nWithBenefit);
      else if (d === 'PRE_READING') qPreRead.push(nWithBenefit);
      else if (d === 'READING') qOffRead.push(nWithBenefit);
      else if (d.includes('PRE_WRITING')) qPreWrite.push(nWithBenefit);
      else if (d.includes('WRITING')) qOffWrite.push(nWithBenefit);
      else if (d === 'PRE_SPEAKING') qPreSpk.push(nWithBenefit);
      else if (d === 'SPEAKING') qOffSpk.push(nWithBenefit);
      else if (d === 'MOCK_TEST') qMock.push(nWithBenefit);
    });

    const pickTask = (queue, maxAllowed = 40) => {
      if (!queue || queue.length === 0) return null;
      const candidate = queue.shift();
      const dur = candidate.duration?.[speedProfile] || candidate.duration?.normal || 20;
      return { ...candidate, assignedDurationMinutes: dur };
    };

    for (let currentDay = 1; currentDay <= targetDays; currentDay++) {
      let dayMinutes = 0;
      const dayNodes = [];

      if (qGrammar.length > 0) {
        const t = pickTask(qGrammar, 30);
        if (t) { dayNodes.push(t); dayMinutes += t.assignedDurationMinutes; }
      }
      if (dayMinutes < dailyTargetMinutes && (qPreLis.length > 0 || qOffLis.length > 0)) {
        const t = pickTask(qPreLis.length > 0 ? qPreLis : qOffLis, 35);
        if (t) { dayNodes.push(t); dayMinutes += t.assignedDurationMinutes; }
      }
      if (dayMinutes < dailyTargetMinutes && (qVocab.length > 0 || qPreRead.length > 0 || qOffRead.length > 0)) {
        const t = pickTask(currentDay % 2 === 1 && qVocab.length > 0 ? qVocab : (qPreRead.length > 0 ? qPreRead : qOffRead), 35);
        if (t) { dayNodes.push(t); dayMinutes += t.assignedDurationMinutes; }
      }
      if (dayMinutes < dailyTargetMinutes && (qPreWrite.length > 0 || qOffWrite.length > 0)) {
        const t = pickTask(qPreWrite.length > 0 ? qPreWrite : qOffWrite, 45);
        if (t) { dayNodes.push(t); dayMinutes += t.assignedDurationMinutes; }
      }
      if (dayMinutes < dailyTargetMinutes && (qPreSpk.length > 0 || qOffSpk.length > 0)) {
        const t = pickTask(qPreSpk.length > 0 ? qPreSpk : qOffSpk, 35);
        if (t) { dayNodes.push(t); dayMinutes += t.assignedDurationMinutes; }
      }

      if (dayNodes.length === 0) {
        dayNodes.push({
          id: `MOCK_FULL_${currentDay}`,
          stage: "S4", domain: "MOCK_TEST", type: "TEST",
          title: `Tổng duyệt Đề Thi Thử Áp Lực Chuẩn Phòng Thi 3 Tiếng`,
          benefit: "Rèn luyện thể lực và chiến thuật làm bài liên tục 4 kỹ năng.",
          assignedDurationMinutes: 120,
          url: "reading/reading.html"
        });
        dayMinutes = 120;
      }

      calendarDays.push({
        dayNumber: currentDay,
        totalMinutes: dayMinutes,
        phaseId: "PHASE_SPIRAL",
        phaseName: "Lộ Trình Tích Hợp 4 Kỹ Năng",
        phaseDesc: "Phát triển đồng đều 4 kỹ năng kết hợp củng cố ngữ pháp và từ vựng mỗi ngày.",
        nodes: dayNodes
      });
    }

    return {
      totalDays: calendarDays.length,
      estimatedMonths: stats.months,
      dailySchedule: calendarDays
    };
  }

  // =========================================================================
  // HÀM MỚI GIAI ĐOẠN 3: BẮC CẦU TỪ ATTEMPT SNAPSHOT SANG LỘ TRÌNH TỰ ĐỘNG
  // =========================================================================
  /**
   * Tự động sinh payload lộ trình chuẩn từ kết quả bài thi Diagnostic
   * @param {Object} attemptSnapshot - Gói tin nộp bài chẩn đoán
   * @returns {Object} Payload lộ trình hoàn chỉnh có approvalStatus: "pending_admin_approval"
   */
  generateRoadmapFromDiagnostic(attemptSnapshot = {}) {
    const details = attemptSnapshot.details || {};
    const blueprintProfile = details.blueprintProfile || {};

    // 1. Xác định điểm xuất phát: Ưu tiên potentialBand -> officialBand -> score -> mặc định 4.0
    let startBand = 4.0;
    if (details.potentialBand && !isNaN(parseFloat(details.potentialBand))) {
      startBand = parseFloat(details.potentialBand);
    } else if (details.officialBand && !isNaN(parseFloat(details.officialBand))) {
      startBand = parseFloat(details.officialBand);
    } else if (attemptSnapshot.score) {
      const match = String(attemptSnapshot.score).match(/(\d+(\.\d+)?)/);
      if (match) startBand = parseFloat(match[1]);
    }
    startBand = Math.round(startBand * 2) / 2;

    // 2. Tự động đề xuất mục tiêu: startBand + 1.5 Band (trần tối đa 7.0)
    let targetBand = Math.min(7.0, Math.round((startBand + 1.5) * 2) / 2);
    if (targetBand <= startBand) {
      targetBand = Math.min(7.0, startBand + 0.5);
    }

    // 3. Đóng gói các lựa chọn AI
    const aiOptions = {
      schedule_mode: 'SEQUENTIAL_PHASES',
      vocab_requirement: 'FULL_100_PERCENT',
      quota_policy: {
        max_pre_skill_ratio: 0.25,
        min_official_exam_ratio: 0.75,
        prohibited_levels: startBand >= 5.0 ? ["A1"] : [],
        review_interval_days: 3,
        review_skills: ["READING", "LISTENING"]
      },
      academic_summary: `Lộ trình thích ứng sinh tự động từ bài thi chẩn đoán [${attemptSnapshot.testTitle || 'Diagnostic'}]. Điểm chuẩn giờ: Band ${details.officialBand || startBand} | Tiềm năng: Band ${details.potentialBand || startBand}. Hệ thống đã nạp trực tiếp danh sách câu sai vào Chặng 1 & 2 để cứu bài.`,
      blueprintProfile: blueprintProfile
    };

    // 4. Lọc kho bài tập (Cứu bài khẩn cấp 100% câu sai)
    const retainedNodes = this.pruneCurriculumByBands(startBand, targetBand, aiOptions);
    const totals = this.calculateTotals(retainedNodes, 'normal', 1.5, startBand, targetBand);
    const scheduleData = this.generateDailyCalendar(retainedNodes, 'normal', 1.5, startBand, targetBand, aiOptions);

    const studentEmail = (attemptSnapshot.studentEmail || 'guest').toLowerCase().trim();

    return {
      createdAt: new Date().toISOString(),
      studentEmail: studentEmail,
      startBand: startBand,
      targetBand: targetBand,
      speedProfile: 'normal',
      dailyHours: 1.5,
      currentDay: 1,
      totals: totals,
      schedule: scheduleData.dailySchedule,
      completedNodeIds: [],
      aiDiagnosticData: aiOptions,

      // 🔴 BỘ CỜ BẢO MẬT & CỔNG PHÊ DUYỆT ADMIN GATE:
      approvalStatus: "pending_admin_approval",
      isLockedByAdmin: true,

      // Metadata nguồn gốc bài thi Diagnostic
      diagnosticSource: {
        attemptId: attemptSnapshot.id || null,
        testTitle: attemptSnapshot.testTitle || "TEST CHẨN ĐOÁN",
        officialBand: details.officialBand || String(startBand),
        potentialBand: details.potentialBand || String(startBand),
        overallScore: details.overallScore || attemptSnapshot.score || "N/A",
        timeSpent: attemptSnapshot.timeSpent || "N/A",
        completedAt: attemptSnapshot.timestamp || new Date().toISOString(),
        blueprintProfile: blueprintProfile
      }
    };
  }
}

export const curriculumEngineSystem = new CurriculumEngineSystem();
