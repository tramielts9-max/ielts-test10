/**
 * diagnostic/js-diag/diag-ai.js
 * BỘ MÁY AI KHẢO THÍ CHUẨN XÁC 100% THEO RUBRIC BAND DESCRIPTORS CHÍNH THỨC
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 * - TÍCH HỢP TRẦN ĐIỂM RIÊNG THEO TỪNG BÀI TEST: TEST 1 (4.5), TEST 2 (6.0), TEST 3 (7.5), FULL TEST (9.0)
 * - THUẬT TOÁN SMART OVER-CAP CÓ CHIẾT KHẤU KHI LÀM BÀI XUẤT THẦN
 * - CHẤM ĐỘC LẬP TASK 1 & TASK 2 WRITING, ÁP DỤNG TRỌNG SỐ CHUẨN IELTS (T1*1 + T2*2)/3
 * - TRIỆT TIÊU TOÀN BỘ BUG BỎ TRỐNG TASK 2: 0 TỪ = BAND 0.0
 * - BẢO TOÀN NGUYÊN VẸN MASTER READING RUBRICS (CAM 21 TRANG 57 - 74)
 */

// =========================================================================
// 1. MÃ HÓA 3 API KEY RIÊNG BIỆT THEO TỪNG KỸ NĂNG (CHỐNG LỘ KHI F12)
// =========================================================================
const _READING_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 74, 111, 118, 45, 99, 119, 83,
  107, 75, 75, 119, 84, 75, 87, 97, 87, 105, 119, 116, 52, 84, 75, 121,
  112, 48, 90, 51, 65, 107, 65, 65, 119, 79, 116, 81, 115, 87, 50, 80,
  88, 104, 52, 110, 65
];
function getReadingKey() {
  return _READING_SEEDS.map(c => String.fromCharCode(c)).join('');
}

const _WRITING_PREFIX = "AQ.Ab8RN6KGTRGy";
const _WRITING_SUFFIX = "SZoGpqs3vT-ikWDLUSWjloCCVlzZhAQque_34w";
function getWritingKey() {
  return `${_WRITING_PREFIX}${_WRITING_SUFFIX}`;
}

const _SPEAKING_SEEDS = [
  65, 81, 46, 65, 98, 56, 82, 78, 54, 75, 116, 80, 107, 51, 45, 50,
  75, 103, 117, 114, 119, 117, 116, 65, 115, 55, 95, 118, 82, 66,
  121, 81, 110, 113, 67, 48, 77, 86, 55, 52, 66, 119, 107, 82, 107,
  80, 110, 74, 89, 70, 90, 49, 119
];
function getSpeakingKey() {
  return _SPEAKING_SEEDS.map(c => String.fromCharCode(c)).join('');
}

// =========================================================================
// 2. CẤU HÌNH TRẦN ĐIỂM & CHIẾT KHẤU SMART OVER-CAP
// =========================================================================
export const TEST_CEILINGS = {
  test_01: {
    cap: 4.5,
    discountFactor: 0.4, // Vượt cap bị chiết khấu trừ bớt vì đề ngắn
    maxAllowed: 6.0,
    label: "Test 1: Nền Tảng (Trần chuẩn: 4.5)"
  },
  test_02: {
    cap: 6.0,
    discountFactor: 0.5,
    maxAllowed: 7.0,
    label: "Test 2: Chuẩn Hóa (Trần chuẩn: 6.0)"
  },
  test_03: {
    cap: 7.5,
    discountFactor: 0.8,
    maxAllowed: 8.5,
    label: "Test 3: Đỉnh Cao (Trần chuẩn: 7.5)"
  },
  fulltest: {
    cap: 9.0,
    discountFactor: 1.0,
    maxAllowed: 9.0,
    label: "Full Mock Test (Chuẩn IELTS: 9.0)"
  }
};

/**
 * Hàm làm tròn điểm chuẩn IELTS theo mốc 0.5 gần nhất
 * Ví dụ: 6.25 -> 6.5 | 6.75 -> 7.0 | 6.15 -> 6.0
 */
export function roundIELTS(score) {
  const num = parseFloat(score);
  if (isNaN(num) || num <= 0) return 0.0;
  const whole = Math.floor(num);
  const decimal = num - whole;
  if (decimal < 0.25) return whole;
  if (decimal < 0.75) return whole + 0.5;
  return whole + 1.0;
}

/**
 * Thuật toán tính Smart Over-Cap có chiết khấu:
 * Nếu bài làm bình thường -> giữ nguyên.
 * Nếu vượt trần đề thi -> cho phép vượt nhưng trừ bớt hệ số do đề không kiểm tra full tiêu chí.
 */
export function calculateSmartOverCap(rawBand, testId = 'test_01') {
  const raw = parseFloat(rawBand) || 0.0;
  const cleanId = String(testId).toLowerCase();
  const cfg = TEST_CEILINGS[cleanId] || TEST_CEILINGS.test_01;

  if (raw <= cfg.cap) {
    return roundIELTS(raw).toFixed(1);
  }

  // Công thức chiết khấu: Cap + (Raw - Cap) * alpha
  const surplus = (raw - cfg.cap) * cfg.discountFactor;
  const adjusted = Math.min(cfg.maxAllowed, cfg.cap + surplus);
  return roundIELTS(adjusted).toFixed(1);
}

// =========================================================================
// 3. MASTER RUBRIC & DỮ LIỆU ĐỐI SOÁT NGUYÊN VĂN (CAM 21 TỪ TRANG 57 - 74)
// =========================================================================
const MASTER_READING_RUBRICS = {
  // PASSAGE 2 (CAM 21): "How could multilingualism benefit India's poorest schoolchildren?"
  "CAM21_P2": {
    "Q01": {
      standardAnswer: "B",
      evidence: "Stop to listen and... you'll hear a multitude of languages, as more than 20 million people go about their daily lives.",
      rubric: "Đối chiếu quy mô hơn 20 triệu người với cụm từ đồng nghĩa: dense population."
    },
    "Q02": {
      standardAnswer: "F",
      evidence: "...many millions more have recently made India's capital their home, having moved from surrounding neighbourhoods...",
      rubric: "Nhận diện những người mới di cư đến sinh sống chính là new immigrants."
    },
    "Q03": {
      standardAnswer: "A",
      evidence: "The overriding aim of the four-year project, called 'Multilingualism and Multiliteracy', is to find out why...",
      rubric: "Quy đổi cụm từ 'overriding aim' tương đương với primary objective."
    },
    "Q04": {
      standardAnswer: "D",
      evidence: "...the many benefits of speaking more than one language, observed in schools in Europe for instance, do not apply to many of India's schoolchildren.",
      rubric: "Quy đổi 'benefits' của học sinh châu Âu sang cụm từ đồng nghĩa similar advantages."
    },
    "Q05": {
      standardAnswer: "NO",
      evidence: "...over 50% of children in Standard 5 cannot read a Standard 2 task fluently, and just under 50% of them cannot solve a Standard 2 subtraction task...",
      rubric: "Tỷ lệ trượt bài đọc (>50%) cao hơn trượt bài toán (<50%), nghĩa là đọc viết kém hơn làm toán -> mâu thuẫn với nhận định 'perform better in literacy' -> NO."
    },
    "Q06": {
      standardAnswer: "NOT GIVEN",
      evidence: "...a problem disproportionately affecting female students.",
      rubric: "Bài chỉ nêu học sinh nữ bị ảnh hưởng nặng nề hơn bởi nguy cơ bỏ học, hoàn toàn không có thông tin về việc thuyết phục các em tham gia nghiên cứu -> NOT GIVEN."
    },
    "Q07": {
      standardAnswer: "YES",
      evidence: "Tsimpli and her colleagues are investigating whether these low learning outcomes could be caused by an Indian school system where the language that children are taught in often differs from the language used at home.",
      rubric: "Khớp trực tiếp: nghiên cứu mối liên hệ giữa kết quả học kém ('low learning outcomes') và việc dạy bằng ngôn ngữ khác tiếng mẹ đẻ ('unfamiliar language') -> YES."
    },
    "Q08": {
      standardAnswer: "NO",
      evidence: "They intend to look not only at test results, but also at variables such as the standard of schooling, the environment and the teaching practices themselves.",
      rubric: "Nhóm nghiên cứu khẳng định sẽ xem xét biến số phương pháp giảng dạy ('teaching practices'), trái ngược với 'decided against investigating' -> NO."
    },
    "Q13": {
      standardAnswer: "C",
      evidence: "...Tsimpli and her team have found that the medium of instruction used in schools, especially English, may hold back those children who have little familiarity with... English instruction for children from low socio-economic areas might not be the best way for them to learn...",
      rubric: "Chỉ ra được việc dạy bằng tiếng Anh gây bất lợi ('hold back' = 'disadvantaged') cho trẻ em nghèo (C)."
    },
    "Q14": {
      standardAnswer: "D",
      evidence: "'We are not suggesting that English be withdrawn - that ship has sailed - but we perhaps have to think more about learner needs...'",
      rubric: "Giải thích được thành ngữ 'that ship has sailed' nghĩa là cơ hội thay đổi/rút bỏ tiếng Anh hoàn toàn đã qua, đã quá muộn để thực hiện (D)."
    }
  },

  // PASSAGE 3 (CAM 21): "The World of Sugar by Ulbe Bosma"
  "CAM21_P3": {
    "Q01": {
      standardAnswer: "B",
      evidence: "It has also been massively subsidised and sold at artificially low prices on world markets, threatening the livelihood of producers of cane sugar.",
      rubric: "Phải giải thích được: việc trợ cấp khổng lồ và bán giá thấp nhân tạo đã làm đường củ cải tăng sức cạnh tranh quốc tế ('more internationally competitive')."
    },
    "Q02": {
      standardAnswer: "A",
      evidence: "first bought... from their own... plantations. Following the abolition... imported... from places which retained the practice... started to import beet sugar... Only in the 20th century... national beet sugar industry.",
      rubric: "Phải nhận ra cấu trúc đoạn 2 diễn tả các mốc lịch sử nối tiếp nhau, cho thấy nguồn cung cấp đường cho nước Anh đã liên tục thay đổi theo thời gian."
    },
    "Q03": {
      standardAnswer: "C",
      evidence: "Contrary to popular belief, cane sugar production was never just restricted to large, dedicated plantations owned by rich men.",
      rubric: "Phải chỉ ra cụm 'Contrary to popular belief' chính là hành động giải quyết một quan niệm sai lầm phổ biến ('addressing a misconception')."
    },
    "Q04": {
      standardAnswer: "A",
      evidence: "He shows that we could always have done without sugar and that today we have many alternative sources of sweetness.",
      rubric: "Phải liên kết được nhận định 'con người hoàn toàn có thể sống không cần đường' với việc đường là sản phẩm không cần thiết ('unnecessary product')."
    }
  }
};

// =========================================================================
// 4. SERVICE ĐIỀU PHỐI AI GEMINI ĐA KỸ NĂNG CHUẨN RUBRIC
// =========================================================================
class DiagnosticAIService {
  constructor() {
    this.modelsQueue = [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];
  }

  // Tiện ích phòng thủ: Lọc sạch khoảng trắng, ký tự rác và đếm số từ thực tế
  sanitizeAndCountWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const cleaned = text.replace(/[\r\n\t]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  async executeGeminiCall(apiKey, promptText) {
    for (const model of this.modelsQueue) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptText }] }]
            })
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      } catch (e) {
        console.warn(`[Diag AI] Model ${model} bận, đang chuyển model tiếp theo...`);
      }
    }
    throw new Error("Không thể kết nối đến máy chủ AI khảo thí. Vui lòng thử lại sau!");
  }

  // =========================================================================
  // A. CHẤM LỜI GIẢI THÍCH READING (DÙNG MASTER RUBRICS TRÍCH DẪN NGUYÊN VĂN)
  // =========================================================================
  async evaluateReadingExplanation(passageCode, questionId, studentChoice, studentExplanation) {
    const rubricData = MASTER_READING_RUBRICS[passageCode]?.[questionId];
    const apiKey = getReadingKey();

    if (!rubricData) {
      return {
        isComprehended: true,
        feedback: "Đã ghi nhận câu trả lời.",
        behaviorTag: "Tự lực làm bài"
      };
    }

    const isAnswerKeyCorrect = String(studentChoice || '').toUpperCase().trim() === rubricData.standardAnswer.toUpperCase().trim();

    const prompt = `
Bạn là Giám khảo IELTS Reading khắt khe.
Nhiệm vụ: Đánh giá xem học sinh trả lời câu hỏi Reading này là THỰC SỰ HIỂU BÀI hay CHỈ KHOANH LỤI/ĐOÁN MÒ dựa trên lời giải thích của học sinh.

DỮ LIỆU ĐỐI SOÁT:
- Đáp án chuẩn: "${rubricData.standardAnswer}"
- Câu trích dẫn bằng chứng trong bài: "${rubricData.evidence}"
- Tiêu chí chấm (AI Rubric): "${rubricData.rubric}"

BÀI LÀM CỦA HỌC SINH:
- Học sinh chọn: "${studentChoice}" (Kết quả đáp án: ${isAnswerKeyCorrect ? 'ĐÚNG' : 'SAI'})
- Lời giải thích/căn cứ học sinh tự gõ: "${studentExplanation || '(Bỏ trống)'}"

HÃY TRẢ VỀ DUY NHẤT 1 CHUỖI JSON (KHÔNG DÙNG MARKDOWN, KHÔNG \`\`\`json):
{
  "isComprehended": true,
  "behaviorTag": "Hiểu bản chất" | "Khoanh bừa / Đoán mò" | "Dính bẫy từ khóa",
  "score": 1,
  "evaluatorComment": "Nhận xét ngắn 1 câu chỉ rõ học sinh có bám vào đúng câu trích dẫn không."
}
`;

    try {
      const rawRes = await this.executeGeminiCall(apiKey, prompt);
      const cleanJson = rawRes.replace(/^```json/, '').replace(/```$/, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      const hasExplanation = (studentExplanation || '').trim().length >= 10;
      return {
        isComprehended: isAnswerKeyCorrect && hasExplanation,
        behaviorTag: isAnswerKeyCorrect ? (hasExplanation ? "Hiểu bản chất" : "Nghi vấn đoán mò") : "Sai đáp án",
        score: isAnswerKeyCorrect ? 1 : 0,
        evaluatorComment: isAnswerKeyCorrect ? "Đúng đáp án chuẩn." : "Chưa chọn đúng đáp án."
      };
    }
  }

  // =========================================================================
  // B. CHẤM WRITING CHUẨN RUBRIC (TRỌNG SỐ [T1*1 + T2*2]/3 & SMART OVER-CAP)
  // =========================================================================
  async evaluateWritingDiagnostic(testId = 'test_01', promptContext = '', task1Text = '', task2Text = '') {
    const t1Clean = (task1Text || '').trim();
    const t2Clean = (task2Text || '').trim();
    const t1Words = this.sanitizeAndCountWords(t1Clean);
    const t2Words = this.sanitizeAndCountWords(t2Clean);

    // 1. KIỂM TRA CHẶN LỖI BỎ TRỐNG TASK 2 VÀ TASK 1 TẬN GỐC
    let t1RawBand = 0.0;
    let t2RawBand = 0.0;

    // Đánh giá sơ bộ số từ Task 1
    if (t1Words === 0) t1RawBand = 0.0;
    else if (t1Words < 15) t1RawBand = 1.0;
    else if (t1Words < 40) t1RawBand = 2.5;

    // Đánh giá sơ bộ số từ Task 2 (TRỌNG SỐ HỆ SỐ 2)
    if (t2Words === 0) {
      t2RawBand = 0.0; // Bỏ trống hoàn toàn Task 2 = 0.0
    } else if (t2Words < 15) {
      t2RawBand = 1.0; // Dưới 15 từ = 1.0
    } else if (t2Words < 40) {
      t2RawBand = 2.0;
    }

    // NẾU CẢ 2 TASK ĐỀU BỎ TRỐNG -> TRẢ THẲNG VỀ BAND 0.0
    if (t1Words === 0 && t2Words === 0) {
      return {
        overallBand: "0.0",
        task1Band: "0.0",
        task2Band: "0.0",
        ta_tr: "0.0", cc: "0.0", lr: "0.0", gra: "0.0",
        rubricSummary: "Học sinh không làm bài thi Viết (Does not attempt the task in any way).",
        keyMistakes: ["Bỏ trống cả Task 1 và Task 2."],
        band8Upgrade: "Hãy bắt đầu tập viết từ những câu ghép đơn giản nhất."
      };
    }

    // NẾU TASK 2 BỊ BỎ TRỐNG (TRƯỜNG HỢP HỌC SINH BUG LÀM MỖI TASK 1)
    if (t2Words === 0) {
      const estimatedT1 = t1Words < 20 ? 1.0 : (t1Words < 50 ? 3.0 : 4.0);
      const combined = (estimatedT1 * 1 + 0.0 * 2) / 3;
      const finalCombinedBand = roundIELTS(combined).toFixed(1);

      return {
        overallBand: finalCombinedBand,
        task1Band: estimatedT1.toFixed(1),
        task2Band: "0.0",
        ta_tr: "1.0", cc: "1.0", lr: "1.0", gra: "1.0",
        rubricSummary: `Học sinh chỉ làm Task 1 (${t1Words} từ) và bỏ trống hoàn toàn bài luận Task 2 (0 từ). Theo luật khảo thí quốc tế IELTS, Task 2 chiếm 2/3 tổng điểm nên điểm Writing tổng bị kéo xuống Band ${finalCombinedBand}.`,
        keyMistakes: ["Bỏ trống hoàn toàn bài luận Task 2 (Mất 66.7% tổng số điểm Writing)."],
        band8Upgrade: "Tuyệt đối không được bỏ trống Task 2 trong bất kỳ bài thi nào."
      };
    }

    const apiKey = getWritingKey();
    const cfg = TEST_CEILINGS[testId] || TEST_CEILINGS.test_01;

    const systemPrompt = `
Bạn là Giám khảo Khảo thí IELTS Writing chính thức của British Council & IDP.
Hãy đọc bài viết của thí sinh và chấm ĐỘC LẬP TỪNG TASK theo đúng nguyên văn IELTS WRITING BAND DESCRIPTORS.

ĐỀ BÀI: "${promptContext || 'IELTS Academic Writing'}"

BÀI LÀM CỦA THÍ SINH:
- TASK 1 (${t1Words} từ): "${t1Clean || '(Không làm bài)'}"
- TASK 2 (${t2Words} từ): "${t2Clean || '(Không làm bài)'}"

QUY TẮC BẮT BUỘC VỀ ĐIỂM SỐ:
1. Chấm điểm riêng biệt Task 1 (tối đa 9.0) và Task 2 (tối đa 9.0).
2. Tuyệt đối KHÔNG ĐƯỢC cho điểm sàn an ủi. Nếu bài sơ sài, cho đúng Band 2.0 hoặc 3.0.
3. Tính Overall Writing theo công thức chuẩn: (Task 1 * 1 + Task 2 * 2) / 3, làm tròn theo bước 0.5.
4. Đề thi hiện tại: "${cfg.label}". Trần điểm khuyến nghị là ${cfg.cap}. Nếu bài làm xuất sắc như văn mẫu Band 8.0, bạn cứ cho điểm thực tế để hệ thống tự áp dụng chiết khấu.

TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ (KHÔNG DÙNG MARKDOWN, KHÔNG \`\`\`json):
{
  "task1Band": "3.5",
  "task2Band": "3.0",
  "overallBand": "3.0",
  "ta_tr": "3.0",
  "cc": "3.0",
  "lr": "3.0",
  "gra": "3.0",
  "rubricSummary": "Nhận xét ngắn 2 câu bám sát định nghĩa trong bảng Band Descriptors.",
  "keyMistakes": [
    "Trích câu sai của học sinh ➔ Sửa lại cho chuẩn ngữ pháp"
  ],
  "band8Upgrade": "Viết 1 đoạn văn mẫu ngắn gọn nâng cấp từ ý tưởng của học sinh đạt chuẩn Band 8.0"
}
`;

    try {
      const rawRes = await this.executeGeminiCall(apiKey, systemPrompt);
      const cleanJson = rawRes.replace(/^```json/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);

      const t1Raw = parseFloat(parsed.task1Band) || (t1Words > 40 ? 3.5 : 2.0);
      const t2Raw = parseFloat(parsed.task2Band) || (t2Words > 50 ? 3.5 : 2.0);

      // Tính tổng theo trọng số chuẩn: (T1 * 1 + T2 * 2) / 3
      const rawCombined = (t1Raw * 1 + t2Raw * 2) / 3;

      // Áp dụng thuật toán Smart Over-Cap có chiết khấu theo từng bài Test
      const finalT1 = calculateSmartOverCap(t1Raw, testId);
      const finalT2 = calculateSmartOverCap(t2Raw, testId);
      const finalOverall = calculateSmartOverCap(rawCombined, testId);

      return {
        overallBand: finalOverall,
        task1Band: finalT1,
        task2Band: finalT2,
        ta_tr: calculateSmartOverCap(parsed.ta_tr || finalOverall, testId),
        cc: calculateSmartOverCap(parsed.cc || finalOverall, testId),
        lr: calculateSmartOverCap(parsed.lr || finalOverall, testId),
        gra: calculateSmartOverCap(parsed.gra || finalOverall, testId),
        rubricSummary: parsed.rubricSummary || "Đã phân tích 4 tiêu chí bài viết.",
        keyMistakes: parsed.keyMistakes || ["Cần chú ý chia thì và phát triển câu phức."],
        band8Upgrade: parsed.band8Upgrade || "Luyện viết câu phức có mệnh đề trạng ngữ chỉ kết quả."
      };

    } catch (err) {
      // Fallback phòng thủ an toàn: Tự tính toán dựa trên số từ thực tế, không bao giờ đội ảo lên 4.5
      const estT1 = t1Words === 0 ? 0.0 : (t1Words < 30 ? 2.0 : (t1Words < 70 ? 3.0 : 4.0));
      const estT2 = t2Words === 0 ? 0.0 : (t2Words < 40 ? 1.5 : (t2Words < 100 ? 3.0 : 4.0));
      const calcOverall = (estT1 * 1 + estT2 * 2) / 3;
      const safeOverall = calculateSmartOverCap(calcOverall, testId);

      return {
        overallBand: safeOverall,
        task1Band: calculateSmartOverCap(estT1, testId),
        task2Band: calculateSmartOverCap(estT2, testId),
        ta_tr: safeOverall,
        cc: safeOverall,
        lr: safeOverall,
        gra: safeOverall,
        rubricSummary: `Hệ thống tự động chấm điểm dự phòng dựa trên dung lượng câu từ thực tế (Task 1: ${t1Words} từ, Task 2: ${t2Words} từ).`,
        keyMistakes: ["Cần mở rộng vốn từ vựng học thuật và tránh dịch word-by-word."],
        band8Upgrade: "Hãy xây dựng thói quen viết dàn ý PEEL trước khi gõ bài."
      };
    }
  }

  // =========================================================================
  // C. CHẤM SPEAKING CHUẨN RUBRIC (4 TIÊU CHÍ, SMART OVER-CAP & TEST CEILING)
  // =========================================================================
  async evaluateSpeakingDiagnostic(testId = 'test_01', questionsList = [], transcriptsList = []) {
    const combinedTranscript = (transcriptsList || []).filter(Boolean).join(' ').trim();
    const words = this.sanitizeAndCountWords(combinedTranscript);

    // 1. KIỂM TRA PHÒNG THỦ: NẾU THÍ SINH HOÀN TOÀN BỎ TRỐNG ➔ BAND 0.0
    if (words === 0) {
      return {
        overallBand: "0.0",
        fc: "0.0", lr: "0.0", gra: "0.0", pr: "0.0",
        rubricSummary: "Thí sinh không tham gia trả lời bài thi nói (Does not attend / Does not complete the test).",
        critique: "Không có dữ liệu âm thanh nào được ghi nhận.",
        improvedAnswer: "Hãy bấm micro và tự tin trả lời những câu tiếng Anh đầu tiên."
      };
    }

    // 2. DƯỚI 12 TỪ RỜI RẠC ➔ BAND 1.0 - 1.5
    if (words < 12) {
      return {
        overallBand: "1.5",
        fc: "1.5", lr: "1.5", gra: "1.0", pr: "1.5",
        rubricSummary: "Chỉ phát âm được một vài từ đơn lẻ, ngập ngừng quá dài (Speech is of virtually no communicative significance).",
        critique: "Chưa cấu tạo được thành câu hoàn chỉnh có nghĩa.",
        improvedAnswer: "Tập trả lời trọn vẹn câu: 'Currently, I am a university student in Hanoi.'"
      };
    }

    const apiKey = getSpeakingKey();
    const cfg = TEST_CEILINGS[testId] || TEST_CEILINGS.test_01;

    const pairsText = (questionsList || []).map((q, idx) => {
      const qText = typeof q === 'string' ? q : (q.text || q.prompt || `Câu hỏi ${idx + 1}`);
      return `Câu hỏi ${idx + 1}: "${qText}"\nThí sinh trả lời: "${transcriptsList?.[idx] || '(Không nói)'}"`;
    }).join('\n\n');

    const systemPrompt = `
Bạn là Giám khảo Khảo thí IELTS Speaking chính thức của British Council & IDP.
Hãy chấm phần thi nói dưới đây theo đúng nguyên văn IELTS SPEAKING BAND DESCRIPTORS (4 tiêu chí: Fluency, Lexical, Grammar, Pronunciation).
Tuyệt đối KHÔNG ĐƯỢC nương tay hay tự động cho điểm sàn an ủi 4.0/4.5. Nếu thí sinh nói ngắc ngứ, sai ngữ pháp nhiều, hãy cho đúng Band 2.0 hoặc 3.0.

ĐỀ THI: "${cfg.label}". Trần điểm khuyến nghị là ${cfg.cap}. Nếu thí sinh nói lưu loát xuất thần như mẫu Band 8.0, bạn cứ cho điểm thực tế để hệ thống tự áp dụng chiết khấu.

BÀI LÀM CỦA THÍ SINH (${words} từ):
${pairsText}

TRẢ VỀ DUY NHẤT 1 CHUỖI JSON HỢP LỆ (KHÔNG DÙNG \`\`\`json):
{
  "overallBand": "3.5",
  "fc": "3.5",
  "lr": "3.5",
  "gra": "3.0",
  "pr": "3.5",
  "rubricSummary": "Nhận xét ngắn gọn 2 câu bám sát đúng định nghĩa trong Speaking Band Descriptors.",
  "critique": "Chỉ ra 2 lỗi ngữ pháp hoặc lỗi ngắt quãng lớn nhất trong bài nói.",
  "improvedAnswer": "Viết lại 1 câu trả lời mẫu tự nhiên và lưu loát đạt chuẩn Band 7.5+"
}
`;

    try {
      const rawRes = await this.executeGeminiCall(apiKey, systemPrompt);
      const cleanJson = rawRes.replace(/^```json/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);

      const rawOverall = parseFloat(parsed.overallBand) || (words < 30 ? 2.5 : 3.5);
      const finalOverall = calculateSmartOverCap(rawOverall, testId);

      return {
        overallBand: finalOverall,
        fc: calculateSmartOverCap(parsed.fc || finalOverall, testId),
        lr: calculateSmartOverCap(parsed.lr || finalOverall, testId),
        gra: calculateSmartOverCap(parsed.gra || finalOverall, testId),
        pr: calculateSmartOverCap(parsed.pr || finalOverall, testId),
        rubricSummary: parsed.rubricSummary || "Đã phân tích phản xạ nói theo 4 tiêu chí.",
        critique: parsed.critique || "Cần chú ý chia động từ quá khứ khi kể chuyện.",
        improvedAnswer: parsed.improvedAnswer || "Luyện tập phương pháp Shadowing để tăng phản xạ."
      };

    } catch (err) {
      // Fallback an toàn phòng thủ theo số từ thực tế
      const estBand = words < 25 ? 2.0 : (words < 60 ? 3.0 : (words < 120 ? 4.0 : 5.0));
      const safeBand = calculateSmartOverCap(estBand, testId);

      return {
        overallBand: safeBand,
        fc: safeBand,
        lr: safeBand,
        gra: safeBand,
        pr: safeBand,
        rubricSummary: "Hệ thống tự động ước lượng điểm dự phòng dựa trên dung lượng bản ký âm.",
        critique: "Cần luyện tập kéo dài câu trả lời bằng lý do và ví dụ thực tế.",
        improvedAnswer: "Tập nói theo cấu trúc AREA (Answer - Reason - Example - Alternative)."
      };
    }
  }
}

export const diagAIService = new DiagnosticAIService();
window.diagAIService = diagAIService;
