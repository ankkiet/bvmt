export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ⚠️ QUAN TRỌNG: TẠO KEY MỚI VÀ DÁN VÀO ĐÂY (VÌ KEY CŨ ĐÃ LỘ TRONG ẢNH)
    const MY_API_KEY = "AIzaSyDbCJ4TdZgzuAAp6r3M9V_R24amSTr4uPA"; 
    
    // --- SỬA LỖI 404 TẠI ĐÂY ---
    // Dùng tên cụ thể: gemini-1.5-flash-001 (Thay vì tên chung chung)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${MY_API_KEY}`;

    const body = await context.request.json();
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
        // In lỗi chi tiết ra để xem nếu vẫn không được
        throw new Error(`Google Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}
