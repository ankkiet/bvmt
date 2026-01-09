/**
 * BACKEND SERVER (Cloudflare Pages Functions)
 * Nhiệm vụ: Giấu Key, Gọi Gemini, Tự động đổi Key nếu hết hạn.
 */

export async function onRequest(context) {
  // 1. Cấu hình CORS (Để web không bị chặn khi gọi server)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Nếu là request kiểm tra (OPTIONS), trả về OK ngay
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Chỉ chấp nhận method POST
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // 2. Lấy dữ liệu từ Web gửi lên
    const { prompt, imageBase64, history } = await context.request.json();

    // 3. Lấy chuỗi Key từ "Két sắt" Cloudflare
    const RAW_KEYS = context.env.GEMINI_API_KEY; 
    
    if (!RAW_KEYS) {
      return new Response(JSON.stringify({ error: "Server chưa cấu hình API Key (Vào Cloudflare Settings -> Environment Variables để thêm)" }), { 
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Tách chuỗi thành mảng các Key (ngăn cách bởi dấu phẩy)
    // Ví dụ: "Key1,Key2,Key3" -> ["Key1", "Key2", "Key3"]
    const keys = RAW_KEYS.split(',').map(k => k.trim());

    // 4. Cơ chế Fail-over: Thử từng Key một
    let lastError = null;
    let successData = null;

    for (const apiKey of keys) {
        if (!apiKey) continue; // Bỏ qua nếu key rỗng

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            // Chuẩn bị nội dung gửi Google
            let contents = [];
            if (imageBase64) {
                contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }];
            } else if (history && history.length > 0) {
                const newHistory = [...history];
                newHistory.push({ role: "user", parts: [{ text: prompt }] });
                contents = newHistory;
            } else {
                contents = [{ parts: [{ text: prompt }] }];
            }

            // Gọi Google
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: contents })
            });

            // Nếu thành công (200 OK)
            if (response.ok) {
                successData = await response.json();
                break; // Thoát vòng lặp ngay, không cần thử key sau
            } else {
                // Nếu lỗi (429 Quota Exceeded, v.v...)
                console.log(`Key ${apiKey.slice(0,5)}... bị lỗi ${response.status}, thử key tiếp theo...`);
                throw new Error(`Google Error ${response.status}`);
            }

        } catch (err) {
            lastError = err;
            continue; // Chuyển sang key tiếp theo trong danh sách
        }
    }

    // 5. Kết thúc vòng lặp: Kiểm tra kết quả
    if (successData) {
        return new Response(JSON.stringify(successData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } else {
        // Nếu thử hết tất cả Key mà vẫn lỗi
        return new Response(JSON.stringify({ error: "Hệ thống đang bận (Hết quota tất cả Key). Vui lòng thử lại sau ít phút." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: "Lỗi Server: " + err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
