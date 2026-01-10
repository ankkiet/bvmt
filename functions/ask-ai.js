export async function onRequest(context) {
  // Cấu hình CORS (Để trình duyệt không chặn)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // 1. Xử lý Request OPTIONS (Kiểm tra kết nối)
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. Chỉ nhận method POST
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // --- KHU VỰC NHẬP KEY (SỬA Ở ĐÂY) ---
    // Bạn hãy dán key của bạn vào giữa hai dấu ngoặc kép bên dưới
    const MY_API_KEY = "AIzaSyCsuqU1zliMVcikvw7Pcm-JWrcn_HE2Vu0"; 
    
    // Kiểm tra xem đã nhập key chưa
    if (!MY_API_KEY || MY_API_KEY.includes("DÁN_KEY")) {
       throw new Error("Quên nhập Key vào code rồi bạn ơi!");
    }
    // ------------------------------------

    // 3. Đọc dữ liệu gửi lên
    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        throw new Error("Dữ liệu gửi lên không đúng định dạng JSON.");
    }

    const { prompt, imageBase64, history } = body;

    // 4. Chuẩn bị dữ liệu gửi Google
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${MY_API_KEY}`;
    
    let contents = [];
    if (imageBase64) {
        contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }];
    } else if (history && history.length > 0) {
        // Copy lịch sử cũ và thêm câu mới
        const newHistory = history.map(item => ({
            role: item.role,
            parts: item.parts
        }));
        newHistory.push({ role: "user", parts: [{ text: prompt }] });
        contents = newHistory;
    } else {
        contents = [{ parts: [{ text: prompt }] }];
    }

    // 5. Gọi sang Google
    const googleResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents })
    });

    // 6. Kiểm tra kết quả từ Google
    if (!googleResponse.ok) {
        const errText = await googleResponse.text();
        // Ném lỗi ra để Catch bên dưới bắt được
        throw new Error(`Google từ chối: ${googleResponse.status} - ${errText}`);
    }

    const data = await googleResponse.json();

    // 7. Trả về kết quả thành công
    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    // 8. BẮT LỖI VÀ IN RA MÀN HÌNH (Thay vì lỗi 500)
    return new Response(JSON.stringify({ 
        error: `LỖI SERVER: ${err.message}` 
    }), {
        status: 200, // Trả về 200 để Client đọc được nội dung lỗi
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
