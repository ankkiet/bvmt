export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- DÁN KEY CỦA BẠN VÀO ĐÂY ---
    const MY_API_KEY = "AIzaSyCsuqU1zliMVcikvw7Pcm-JWrcn_HE2Vu0"; 
    // -------------------------------

    // CHÚNG TA SẼ KHÔNG CHAT, MÀ SẼ HỎI DANH SÁCH MODEL
    // Đây là lệnh: "Liệt kê tất cả người mẫu đang có sẵn"
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${MY_API_KEY}`;

    const response = await fetch(url, { method: 'GET' }); // Dùng GET để lấy danh sách
    const data = await response.json();

    // In toàn bộ danh sách ra màn hình cho bạn xem
    return new Response(JSON.stringify(data, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
