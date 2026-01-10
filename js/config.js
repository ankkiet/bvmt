/* FILE: js/config.js
   CHỨC NĂNG: Chứa các cài đặt, cấu hình, văn bản mà bạn có thể tự chỉnh sửa dễ dàng.
   LƯU Ý: Không đổi tên biến (các chữ viết hoa), chỉ đổi nội dung bên trong dấu ngoặc kép.
*/

export const CONFIG = {
    // 1. CẤU HÌNH FIREBASE & CLOUDINARY (Giữ nguyên từ code cũ)
    firebase: {
        apiKey: "AIzaSyCJ_XI_fq-yJC909jb9KLIKg3AfGdm6hNs",
        authDomain: "a2k41nvc-36b0b.firebaseapp.com",
        projectId: "a2k41nvc-36b0b",
        storageBucket: "a2k41nvc-36b0b.firebasestorage.app",
        messagingSenderId: "279516631226",
        appId: "1:279516631226:web:99012883ed7923ab5c3283"
    },
    cloudName: "dekxvneap",
    uploadPreset: "a2k41nvc_upload",
    
    // 2. DANH SÁCH ADMIN & GOOGLE SHEET
    adminEmails: ["kiet0905478167@gmail.com", "anhkiet119209@gmail.com"],
    googleSheetUrl: "https://script.google.com/macros/s/AKfycbzilw2SHG74sfCGNktGLuo46xkLNzVSVl6T3HbjXoWAsm9_CmXmuZQmbDxIOJ5cRhyX/exec",

    // 3. CẤU HÌNH AI (GEMINI) - Fail-over
    defaultAIKeys: [{name: "Mặc định", val: "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc"}],
    
    // 4. LỜI NHẮC HỆ THỐNG CHO BOT (SYSTEM PROMPT)
    systemPrompt: `
Bạn là Green Bot - Trợ lý ảo AI thân thiện của lớp A2K41 và trường Green School.
Bạn xưng là 'Tớ' và gọi người dùng là 'Cậu'. Dùng nhiều emoji dễ thương (🌱, 🤖, ✨).

HÃY GHI NHỚ THÔNG TIN VỀ WEBSITE NÀY ĐỂ HỖ TRỢ:
1. Trang Chủ (Home): Xem thông báo, tin tức nổi bật và ảnh 'Top 1 yêu thích'.
2. Góc Xanh (Green Class): Nơi upload ảnh hoạt động môi trường. Có tính năng 'AI Soi Rác' để nhận diện rác thải.
3. Thi Đua (Contest): Nơi các tổ/cá nhân upload báo cáo thành tích để cộng điểm thi đua.
4. Lưu Trữ (Archive): Xem lại các ảnh cũ từ các đợt trước.
5. Hoạt Động (Activities): Xem lịch 'Đổi giấy lấy cây' và các tin tức tình nguyện.
6. Tra Cứu (Guide): Từ điển phân loại rác (Vỏ sữa, pin, lá cây...).
7. Tài Khoản (Profile): Chỉnh sửa tên, avatar và xem lớp của mình.

Nếu người dùng hỏi làm sao để đăng ảnh? -> Hướng dẫn vào mục 'Góc Xanh' hoặc 'Thi Đua'.
Nếu người dùng hỏi về rác? -> Hướng dẫn dùng tính năng 'AI Soi Rác' ở Góc Xanh.
Hãy luôn trả lời ngắn gọn, vui vẻ và hướng dẫn cụ thể vào đúng mục trên web.
`,

    // 5. DANH SÁCH RÁC (Dùng cho mục Tra Cứu)
    trashDB: [ 
        {n:"Vỏ sữa",t:"Tái chế",c:"bin-recycle"}, 
        {n:"Chai nhựa",t:"Tái chế",c:"bin-recycle"}, 
        {n:"Giấy vụn",t:"Tái chế",c:"bin-recycle"}, 
        {n:"Vỏ trái cây",t:"Hữu cơ",c:"bin-organic"}, 
        {n:"Lá cây",t:"Hữu cơ",c:"bin-organic"}, 
        {n:"Túi nilon",t:"Rác khác",c:"bin-other"} 
    ],

    // 6. NHẠC NỀN MẶC ĐỊNH
    defaultMusicId: 'jfKfPfyJRdk'
};
