export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- BƯỚC 1: DÁN KEY MỚI CỦA BẠN VÀO ĐÂY ---
    // (Nhớ xóa cái key cũ bị lộ đi nhé, tạo cái mới dán vào)
    const MY_API_KEY = "AIzaSyCsuqU1zliMVcikvw7Pcm-JWrcn_HE2Vu0"; 
    // ------------------------------------------

    // --- BƯỚC 2: URL CHUẨN DÀNH CHO GEMINI 2.0 FLASH ---
    // (Đây là dòng quan trọng nhất sửa lỗi 404)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${MY_API_KEY}`;

    let body = await context.request.json();
    const { prompt, imageBase64, history } = body;

    let contents = [];
    if (imageBase64) {
        contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }];
    } else if (history && history.length > 0) {
        const newHistory = history.map(item => ({ role: item.role, parts: item.parts }));
        newHistory.push({ role: "user", parts: [{ text: prompt }] });
        contents = newHistory;
    } else {
        contents = [{ parts: [{ text: prompt }] }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google từ chối: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `LỖI SERVER: ${err.message}` }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
