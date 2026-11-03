/**
 * grammar/js/exercise-engine-g.js
 * ENGINE CHẤM ĐIỂM NGỮ PHÁP ĐA TẦNG THÔNG MINH (HYBRID ULTRA-ENGINE)
 * BẢN FULL ĐẦY ĐỦ 100% - KHÔNG CẮT BỚT BẤT KỲ DÒNG NÀO
 * - Chống chấm oan do dấu cách ẩn, nháy cong iPhone, khoảng trắng Unicode
 * - Tự động đối chiếu 360 độ (Cả câu, Nửa câu, Ghép tiền tố targetStart)
 * - Tự động bóc tách các đáp án chứa dấu gạch chéo '/' hoặc '|'
 * - Bảng quy chuẩn từ viết tắt & Anh-Anh / Anh-Mỹ toàn diện
 */

export class ExerciseEngine {
  /**
   * 1. HÀM THOÁT KÝ TỰ ĐẶC BIỆT DÀNH CHO REGEX
   */
  static escapeRegex(str) {
    if (!str) return "";
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 2. BẢNG QUY ĐỔI TỪ VIẾT TẮT VỀ DẠNG ĐẦY ĐỦ (CONTRACTION EXPANDER)
   * Đồng bộ hai chiều giữa thể rút gọn và thể chuẩn
   */
  static expandContractions(text) {
    if (!text) return "";
    return text
      // Các trường hợp đặc biệt
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bcan not\b/gi, "cannot")
      .replace(/\bshan't\b/gi, "shall not")
      .replace(/\bain't\b/gi, "am not")
      // Đuôi n't phủ định
      .replace(/n't\b/gi, " not")
      // Viết tắt của Will / Shall
      .replace(/'ll\b/gi, " will")
      // Viết tắt của Are
      .replace(/'re\b/gi, " are")
      // Viết tắt của Have
      .replace(/'ve\b/gi, " have")
      // Viết tắt của Am
      .replace(/'m\b/gi, " am")
      // Viết tắt của Let's
      .replace(/\blet's\b/gi, "let us")
      // Viết tắt phổ biến của Is / Has
      .replace(/\bit's\b/gi, "it is")
      .replace(/\bthere's\b/gi, "there is")
      .replace(/\bthat's\b/gi, "that is")
      .replace(/\bhe's\b/gi, "he is")
      .replace(/\bshe's\b/gi, "she is")
      .replace(/\bwho's\b/gi, "who is")
      .replace(/\bwhat's\b/gi, "what is")
      // Quy chuẩn chính tả UK vs US phổ biến
      .replace(/\bpractise\b/gi, "practice");
  }

  /**
   * 3. BỘ CHUẨN HÓA SIÊU CẤP (SUPER NORMALIZER)
   * Khử khoảng trắng Unicode vô hình, dấu nháy cong, dấu câu thừa, ép về cùng một định dạng chuẩn
   */
  static clean(text) {
    if (!text && text !== 0) return "";

    let cleaned = String(text)
      // Ép về bảng mã Unicode chuẩn NFKC
      .normalize("NFKC")
      // Xóa bỏ tất cả các loại khoảng trắng vô hình, Non-breaking space (\u00A0), zero-width space (\uFEFF, \u200B)
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
      // Đổi tất cả dấu nháy cong của iPhone/Mac/Word thành dấu nháy thẳng chuẩn (')
      .replace(/[‘’`´′]/g, "'")
      // Đổi tất cả dấu ngoặc kép cong thành ngoặc kép chuẩn
      .replace(/[“”]/g, '"')
      // Đổi chữ thường
      .toLowerCase();

    // Bung các từ viết tắt về dạng đầy đủ
    cleaned = this.expandContractions(cleaned);

    // Gọt bỏ dấu chấm, dấu phẩy, dấu hỏi, dấu chấm than ở cuối câu
    cleaned = cleaned.replace(/[.,?!:;]+$/g, "");

    // Thay thế toàn bộ dấu câu bên trong thành khoảng trắng để so khớp từ vựng thuần túy
    cleaned = cleaned
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned;
  }

  /**
   * 4. BÓC TÁCH MỌI PHƯƠNG ÁN ĐÁP ÁN (SPLIT MULTI-ANSWER)
   * Tự động nhận diện nếu giáo viên lưu đáp án có dấu / hoặc | trong file JSON
   */
  static expandAnswerVariants(rawAnswers) {
    const results = [];
    const list = Array.isArray(rawAnswers) ? rawAnswers : [rawAnswers];

    list.forEach(ans => {
      if (!ans && ans !== 0) return;
      const str = String(ans).trim();

      // Nếu chứa dấu gạch chéo ngăn cách nhiều đáp án (vd: "is watered / was watered")
      if (str.includes("/") || str.includes("|")) {
        const parts = str.split(/[\/|]/).map(p => p.trim()).filter(Boolean);
        results.push(...parts);
      } else {
        results.push(str);
      }
    });

    return results.length > 0 ? results : [""];
  }

  /**
   * 5. GỌT BỎ PHẦN TIỀN TỐ (TARGETSTART) AN TOÀN TUYỆT ĐỐI
   */
  static stripTargetStart(text, targetStart) {
    if (!text) return "";
    if (!targetStart) return String(text).trim();

    const cleanInput = String(text).trim();
    // Gọt bỏ dấu câu ở đuôi targetStart để tránh việc học sinh quên gõ dấu phẩy
    const rawStart = String(targetStart).trim().replace(/[,.:;?!]+$/g, "");
    const escapedStart = this.escapeRegex(rawStart);

    // Xóa tiền tố nếu học sinh lỡ tay gõ lại ở đầu ô input
    const regex = new RegExp(`^${escapedStart}[,.:;?!]?\\s*`, "i");
    if (regex.test(cleanInput)) {
      return cleanInput.replace(regex, "").trim();
    }

    return cleanInput;
  }

  /**
   * 6. HÀM CHẤM ĐIỂM CHÍNH (GRADE QUESTION)
   * Thực hiện so khớp 360 độ: Nguyên bản, Cắt tiền tố, và Ghép thành câu đầy đủ
   */
  static gradeQuestion(q, userVal) {
    // =========================================================================
    // TRƯỜNG HỢP A: DẠNG TRẮC NGHIỆM CHỌN (CHOICE)
    // =========================================================================
    if (q.type === "choice") {
      const selectedIndex = parseInt(userVal, 10);
      const isCorrect = selectedIndex === q.correctIndex;
      return {
        isCorrect,
        correctDisplay: q.options ? q.options[q.correctIndex] : ""
      };
    }

    // =========================================================================
    // TRƯỜNG HỢP B: DẠNG ĐIỀN TỪ (BLANK) HOẶC VIẾT LẠI CÂU (REWRITE)
    // =========================================================================
    if (q.type === "blank" || q.type === "rewrite") {
      // 1. Chuẩn hóa giá trị học sinh nhập (hỗ trợ cả trường hợp mảng nhiều ô blank)
      let rawUser = "";
      if (Array.isArray(userVal)) {
        rawUser = userVal.map(v => (v || "").trim()).join(", ");
      } else {
        rawUser = (userVal || "").trim();
      }

      // 2. Lấy danh sách đáp án chuẩn và bung các đáp án có dấu / hoặc |
      const baseAnswers = q.answers || (q.answer ? [q.answer] : []);
      const answersList = this.expandAnswerVariants(baseAnswers);

      const targetStart = (q.targetStart || "").trim();

      // 3. TẠO TẬP HỢP TẤT CẢ CÁC BIẾN THỂ TỪ BÀI LÀM CỦA HỌC SINH
      const userVariants = new Set();

      // Dạng 1: Học sinh gõ gì so sánh trực tiếp cái đó
      userVariants.add(this.clean(rawUser));

      // Dạng 2: Nếu học sinh gõ cả câu dính targetStart, ta gọt bỏ targetStart
      const strippedUser = this.stripTargetStart(rawUser, targetStart);
      userVariants.add(this.clean(strippedUser));

      // Dạng 3: Nếu học sinh chỉ gõ vế sau, ta giả lập câu hoàn chỉnh (targetStart + rawUser)
      if (targetStart) {
        userVariants.add(this.clean(`${targetStart} ${strippedUser}`));
        userVariants.add(this.clean(`${targetStart} ${rawUser}`));
      }

      // Xóa các chuỗi rỗng không hợp lệ
      userVariants.delete("");

      // 4. TIẾN HÀNH SO KHỚP VỚI DANH SÁCH ĐÁP ÁN CHUẨN
      let isCorrect = false;
      let matchedExpected = "";

      for (const ans of answersList) {
        // Tạo các biến thể của đáp án chuẩn
        const ansVariants = new Set();

        ansVariants.add(this.clean(ans));

        const strippedAns = this.stripTargetStart(ans, targetStart);
        ansVariants.add(this.clean(strippedAns));

        if (targetStart) {
          ansVariants.add(this.clean(`${targetStart} ${strippedAns}`));
          ansVariants.add(this.clean(`${targetStart} ${ans}`));
        }
        ansVariants.delete("");

        // Đối chiếu xem có điểm giao nào giữa bài làm của học sinh và đáp án chuẩn không
        for (const uVar of userVariants) {
          if (ansVariants.has(uVar)) {
            isCorrect = true;
            matchedExpected = ans;
            break;
          }
        }

        if (isCorrect) break;
      }

      // 5. IN RA CONSOLE ĐỂ ADMIN KIỂM TRA TRỰC QUAN (NHẤN F12)
      if (window && window.console) {
        console.groupCollapsed(
          `%c[Chấm Ngữ Pháp] ${q.id}: ${isCorrect ? 'ĐÚNG ✅' : 'CHƯA ĐÚNG ❌'}`,
          `color: ${isCorrect ? '#166534; font-weight:bold;' : '#991B1B; font-weight:bold;'}`
        );
        console.log("Học sinh gõ (raw):", rawUser);
        console.log("Các biến thể của học sinh (đã clean):", Array.from(userVariants));
        console.log("Danh sách đáp án hợp lệ:", answersList);
        if (isCorrect) {
          console.log("%cKhớp thành công với đáp án mẫu:", "color:#15803d; font-weight:bold;", matchedExpected);
        }
        console.groupEnd();
      }

      return {
        isCorrect,
        correctDisplay: answersList.join(" <br>HOẶC: "),
        rawUser: rawUser,
        needsAiReview: !isCorrect
      };
    }

    return { isCorrect: false, correctDisplay: "" };
  }

  /**
   * 7. VÒNG BẢO VỆ PHÚC KHẢO BẰNG AI (DÀNH CHO CÂU TỰ LUẬN VIẾT KHÁC MẪU NHƯNG ĐÚNG)
   */
  static async verifyWithAI(promptQuestion, studentAnswer, standardAnswersList, apiKey) {
    if (!studentAnswer || studentAnswer.trim().length === 0) return false;
    if (!apiKey) return false;

    const promptText = `
Bạn là Giám khảo Khảo thí Ngữ pháp tiếng Anh chuẩn Cambridge.
Nhiệm vụ: Thẩm định xem câu trả lời của học sinh có ĐÚNG NGỮ PHÁP và GIỮ NGUYÊN NGHĨA so với các đáp án mẫu hay không.

- Đề bài / Câu gốc: "${promptQuestion}"
- Đáp án mẫu chuẩn: ${JSON.stringify(standardAnswersList)}
- Câu trả lời của học sinh: "${studentAnswer}"

YÊU CẦU:
1. Chấp nhận các cách đảo ngữ, từ đồng nghĩa hợp lệ, hoặc đảo trật tự trạng từ nếu đúng ngữ pháp.
2. Trả về DUY NHẤT 1 từ: "CORRECT" nếu đúng, hoặc "INCORRECT" nếu sai ngữ pháp/sai nghĩa. Không giải thích thêm.
`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: promptText }] }] })
        }
      );
      if (!res.ok) return false;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      return text.toUpperCase().includes("CORRECT") && !text.toUpperCase().includes("INCORRECT");
    } catch (e) {
      console.warn("[ExerciseEngine] Lỗi gọi AI phúc khảo ngầm:", e);
      return false;
    }
  }
}
