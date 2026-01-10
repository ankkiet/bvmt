export async function onRequest(context) {
  // 1. Cấu hình CORS (Để trình duyệt không chặn)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. LẤY KEY TỰ ĐỘNG TỪ CLOUDFLARE (Không dán cứng nữa)
    const API_KEY = context.env.GEMINI_API_KEY;

    if (!API_KEY) {
      throw new Error("Chưa cài đặt GEMINI_API_KEY trong Cloudflare Settings!");
    }

    // 3. Cấu hình Model (Dùng bản 1.5 Flash chuẩn 001 ổn định nhất)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${API_KEY}`;

    const body = await context.request.json();
    const { prompt, imageBase64, history } = body;

    // 4. Chuẩn bị dữ liệu
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

    // 5. Gọi Google
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Google Error ${response.status}: ${txt}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    // Trả về lỗi sạch sẽ cho Client hiển thị
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}
