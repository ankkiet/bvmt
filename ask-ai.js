/**
 * Cloudflare Pages Function - Serverless Backend
 * Xử lý gọi Gemini AI an toàn, giấu API Key.
 */

export async function onRequest(context) {
  // 1. Xử lý CORS (Cho phép web của bạn gọi vào)
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 2. Lấy dữ liệu từ Client gửi lên
    const { prompt, imageBase64, history } = await context.request.json();

    // 3. Lấy API Key bí mật từ Cấu hình Cloudflare (Sẽ hướng dẫn cài đặt bên dưới)
    const API_KEY = context.env.GEMINI_API_KEY; 
    
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "Server chưa cấu hình API Key" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 4. Chuẩn bị dữ liệu gửi sang Google Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    let contents = [];

    if (imageBase64) {
      // Trường hợp có ảnh: Gửi prompt + ảnh (Không dùng history để tránh lỗi format)
      contents = [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
        ]
      }];
    } else if (history && history.length > 0) {
      // Trường hợp Chat Text: Dùng lịch sử để nhớ
      // Copy history cũ và thêm câu hỏi mới vào
      const newHistory = [...history];
      newHistory.push({ role: "user", parts: [{ text: prompt }] });
      contents = newHistory;
    } else {
      // Trường hợp chat câu đầu tiên
      contents = [{ parts: [{ text: prompt }] }];
    }

    // 5. Gọi API Google
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    const data = await response.json();

    // 6. Trả kết quả về cho Web
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Quan trọng để Web không bị chặn
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
