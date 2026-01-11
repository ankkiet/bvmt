/* --- 1. CORE STYLES & VARIABLES --- */
:root { 
    /* Giao diện Sáng (Mặc định) */
    --primary: #2e7d32; 
    --primary-dark: #1b5e20;
    --accent: #ffca28; 
    --danger: #d32f2f; 
    --info: #0288d1;
    --bg: #f8f9fa; 
    --text: #333; 
    --text-sec: #666;
    --white: #ffffff;
    --card-bg: #ffffff;
    --border: #e0e0e0;
    --input-bg: #fafafa;
    --admin-color: #c62828; 
    --archive-color: #4e342e;
    --nav-height: 65px;
    --ai-color: #6200ea;
    --shadow: rgba(0,0,0,0.05);
}

/* Giao diện Tối (Dark Mode) */
body.dark-mode {
    --primary: #66bb6a; /* Xanh sáng hơn cho nền tối */
    --primary-dark: #81c784;
    --bg: #121212;
    --text: #e0e0e0;
    --text-sec: #b0b0b0;
    --white: #1e1e1e;
    --card-bg: #1e1e1e;
    --border: #333333;
    --input-bg: #2c2c2c;
    --shadow: rgba(0,0,0,0.5);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

body { 
    font-family: 'Nunito', sans-serif; margin: 0; padding: 0; 
    background-color: var(--bg); color: var(--text); padding-bottom: 90px;
    overscroll-behavior-y: contain; 
    transition: background-color 0.3s, color 0.3s; /* Hiệu ứng chuyển màu mượt */
}

/* --- SEASONAL EFFECT --- */
#seasonal-canvas {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; /* Cho phép click xuyên qua */
    z-index: 999; /* Nằm trên nội dung nền nhưng dưới các popup */
}
.effect-toggle { position: fixed; bottom: 25px; left: 25px; width: 45px; height: 45px; border-radius: 50%; background: var(--card-bg); box-shadow: 0 5px 15px var(--shadow); z-index: 2000; cursor: pointer; display: flex; align-items: center; justify-content: center; border: 2px solid var(--primary); transition: 0.3s; color: var(--primary); font-size: 1.2rem; }
.effect-toggle:hover { transform: scale(1.1); }

.effect-menu {
    position: fixed; bottom: 80px; left: 25px;
    background: var(--card-bg); border-radius: 12px;
    box-shadow: 0 5px 20px var(--shadow);
    border: 1px solid var(--border);
    z-index: 2000; display: none; overflow: hidden;
    animation: slideUp 0.3s ease-out;
    min-width: 140px;
}
.effect-menu.active { display: block; }
.effect-menu div { padding: 10px 15px; cursor: pointer; font-size: 0.9rem; color: var(--text); border-bottom: 1px solid var(--border); transition: 0.2s; }
.effect-menu div:last-child { border-bottom: none; }
.effect-menu div:hover { background: var(--input-bg); color: var(--primary); }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* --- WEBVIEW WARNING --- */
#webview-warning {
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: var(--bg); 
    z-index: 999999;
    flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 30px;
}
.wv-icon { font-size: 5rem; color: #ff9800; margin-bottom: 20px; animation: float 2s infinite ease-in-out; }
.wv-title { font-size: 1.6rem; color: var(--text); margin-bottom: 15px; font-weight: 800; font-family: 'Quicksand', sans-serif; }
.wv-desc { color: var(--text-sec); margin-bottom: 30px; font-size: 1.1rem; line-height: 1.6; max-width: 500px; }
.wv-arrow { font-size: 3rem; color: var(--primary); animation: bounce 1.5s infinite; position: absolute; top: 20px; right: 20px; }
@keyframes float { 0%, 100% {transform: translateY(0);} 50% {transform: translateY(-10px);} }
@keyframes bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(20px);} 60% {transform: translateY(10px);} }

/* --- MAINTENANCE OVERLAY --- */
#maintenance-overlay {
    display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: var(--bg);
    z-index: 99999;
    flex-direction: column; justify-content: center; align-items: center;
    text-align: center; padding: 20px;
}
#maintenance-overlay h1 { font-size: 2.2rem; margin-bottom: 10px; color: var(--primary); border: none; }
#maintenance-overlay p { font-size: 1.1rem; color: var(--text-sec); margin-bottom: 30px; max-width: 600px; }
#maintenance-overlay i.fa-hammer { font-size: 6rem; color: #ffa000; margin-bottom: 20px; animation: hammer 2s infinite; }
@keyframes hammer { 0% {transform: rotate(0);} 20% {transform: rotate(-15deg);} 40% {transform: rotate(10deg);} 60% {transform: rotate(-5deg);} 100% {transform: rotate(0);} }

/* --- NOTIFICATION POPUP (GLOBAL ADMIN) --- */
#notification-popup {
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: var(--card-bg); width: 300px; padding: 15px;
    border-radius: 12px;
    box-shadow: 0 10px 30px var(--shadow);
    border-left: 5px solid var(--primary);
    display: flex; align-items: flex-start; gap: 12px;
    transform: translateX(150%); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: 0; visibility: hidden; border: 1px solid var(--border);
}
#notification-popup.show { transform: translateX(0); opacity: 1; visibility: visible; }
.notif-icon { color: var(--primary); font-size: 1.5rem; margin-top: 2px; }
.notif-content h4 { margin: 0 0 5px 0; font-size: 1rem; color: var(--text); }
.notif-content p { margin: 0; font-size: 0.9rem; color: var(--text-sec); line-height: 1.4; }
.notif-close { position: absolute; top: 5px; right: 10px; cursor: pointer; color: var(--text-sec); font-size: 0.8rem; }

/* --- BELL & DROPDOWN (PERSONAL) --- */
.header-bell {
    position: fixed; top: 15px; right: 15px; z-index: 1001;
    width: 42px; height: 42px; 
    background: var(--card-bg); backdrop-filter: blur(5px);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 15px var(--shadow); border: 1px solid var(--border);
    cursor: pointer; transition: all 0.3s; color: var(--text);
}
.header-bell:hover { transform: scale(1.1); }
.bell-dot { position: absolute; top: 10px; right: 10px; width: 10px; height: 10px; background: #ff1744; border-radius: 50%; border: 2px solid var(--card-bg); display: none; }

/* DARK MODE TOGGLE BTN */
.dark-mode-toggle {
    position: fixed; top: 15px; right: 70px; z-index: 1001;
    width: 42px; height: 42px;
    background: var(--card-bg);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 15px var(--shadow); border: 1px solid var(--border);
    cursor: pointer; transition: all 0.3s; color: var(--text);
}
.dark-mode-toggle:hover { transform: scale(1.1); }

.notif-dropdown {
    position: fixed; top: 70px; right: 20px; width: 320px;
    background: var(--card-bg); border-radius: 12px;
    box-shadow: 0 10px 40px var(--shadow);
    z-index: 1002; display: none; overflow: hidden;
    border: 1px solid var(--border);
    animation: slideDown 0.3s ease-out;
}
.notif-dropdown.active { display: block; }
.notif-header {
    padding: 12px 15px; border-bottom: 1px solid var(--border);
    font-weight: bold; color: var(--primary);
    display: flex; justify-content: space-between; align-items: center; background: var(--card-bg);
}
.notif-list { max-height: 350px; overflow-y: auto; background: var(--card-bg); }
.notif-item {
    padding: 12px 15px; border-bottom: 1px solid var(--border);
    display: flex; gap: 10px; align-items: flex-start;
    cursor: pointer; transition: 0.2s; position: relative;
}
.notif-item:hover { background: var(--input-bg); }
.notif-item.unread { background: rgba(46, 125, 50, 0.1); } 
.notif-item.unread::after {
    content: ''; position: absolute; top: 15px; right: 10px;
    width: 8px; height: 8px; background: var(--accent); border-radius: 50%;
}
.notif-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); }
.notif-body { flex: 1; }
.notif-body p { margin: 0; font-size: 0.9rem; color: var(--text); line-height: 1.3; }
.notif-time { font-size: 0.75rem; color: var(--text-sec); margin-top: 4px; display: block; }
.empty-notif { text-align: center; padding: 20px; color: var(--text-sec); font-size: 0.9rem; }

@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

/* --- PULL TO REFRESH --- */
#ptr-loader {
    position: fixed; top: -70px; left: 0; width: 100%; height: 70px;
    display: flex; justify-content: center; align-items: flex-end; padding-bottom: 15px;
    z-index: 9998; transition: top 0.2s ease-out; pointer-events: none;
}
.ptr-icon {
    font-size: 20px; color: var(--primary); background: var(--card-bg); 
    width: 45px; height: 45px; border-radius: 50%; 
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 15px var(--shadow); transition: transform 0.2s;
    border: 2px solid var(--primary);
}

/* --- NAVIGATION --- */
nav.pc-nav { background: linear-gradient(to right, var(--primary), var(--primary-dark)); padding: 15px 0; position: sticky; top: 0; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block; padding-right: 60px; }
nav.pc-nav ul { list-style: none; margin: 0; padding: 0; display: flex; justify-content: center; gap: 10px; }
nav.pc-nav ul li a { color: #ffffff; text-decoration: none; font-weight: 700; text-transform: uppercase; padding: 10px 20px; font-size: 0.9rem; border-radius: 30px; transition: 0.3s; cursor: pointer; }
nav.pc-nav ul li a:hover, nav.pc-nav ul li a.active-menu { background-color: rgba(255,255,255,0.2); color: var(--accent); transform: translateY(-2px); }

nav.mobile-nav { display: none; position: fixed; bottom: 0; left: 0; width: 100%; background: var(--card-bg); border-top: 1px solid var(--border); z-index: 1000; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -5px 20px rgba(0,0,0,0.05); }
.mobile-nav-inner { display: flex; justify-content: space-around; align-items: center; height: var(--nav-height); }
.nav-item { flex: 1; text-align: center; color: var(--text-sec); text-decoration: none; font-size: 0.7rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; transition: 0.2s; cursor: pointer; }
.nav-item i { font-size: 1.4rem; margin-bottom: 2px; }
.nav-item.active-menu { color: var(--primary); font-weight: 800; }
.nav-item.active-menu i { color: var(--primary); transform: translateY(-3px); }

/* --- LAYOUT --- */
.container { max-width: 1200px; width: 95%; margin: 25px auto; background: var(--card-bg); padding: 30px; border-radius: 20px; box-shadow: 0 10px 40px var(--shadow); min-height: 80vh; border: 1px solid var(--border); }
.page-section { display: none; animation: fadeIn 0.4s ease-out; }
.page-section.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
.locked-overlay { text-align: center; padding: 60px 20px; background: rgba(255, 253, 231, 0.1); border: 2px dashed var(--accent); border-radius: 15px; color: var(--accent); margin-bottom: 30px; }
h1 { font-family: 'Quicksand', sans-serif; color: var(--primary); text-align: center; border-bottom: 4px solid var(--accent); display: inline-block; padding-bottom: 8px; margin-bottom: 35px; position: relative; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 2rem; }
h2 { color: var(--primary-dark); margin-top: 0; font-size: 1.4rem; border-left: 5px solid var(--accent); padding-left: 15px; margin-bottom: 20px; }
.card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 4px 15px var(--shadow); transition: 0.3s; }

/* --- BUTTONS & INPUTS --- */
.btn { background: var(--primary); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.btn:hover { background: var(--primary-dark); transform: translateY(-2px); }
.btn-danger { background: var(--danger); } 
.btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); }
.btn-sm { padding: 6px 14px; font-size: 0.85rem; border-radius: 6px; }
.btn-ghost-danger { background: transparent; color: var(--text-sec); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; transition: 0.3s; }
.btn-ghost-danger:hover { background: rgba(211, 47, 47, 0.1); color: var(--danger); border-color: var(--danger); }
.btn-ai { background: linear-gradient(135deg, #6200ea, #b388ff); color: white; border: none; box-shadow: 0 4px 10px rgba(98, 0, 234, 0.3); }
.btn-ai:hover { transform: scale(1.05); }

input, textarea, select { width: 100%; padding: 14px; margin: 10px 0; border: 1px solid var(--border); border-radius: 10px; font-family: inherit; font-size: 1rem; transition: 0.3s; background: var(--input-bg); color: var(--text); }
input:focus, textarea:focus, select:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1); }

/* --- EXTRAS & MUSIC --- */
.countdown-container { background: linear-gradient(135deg, #d32f2f, #c62828); color: white; padding: 15px 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 8px 20px rgba(211, 47, 47, 0.3); display: none; text-align: center; border: 1px solid rgba(255,255,255,0.2); }
.timer-display { font-size: 2rem; font-weight: 800; font-family: monospace; letter-spacing: 2px; margin-top: 5px; }

.music-fab { position: fixed; bottom: 90px; right: 25px; width: 60px; height: 60px; border-radius: 50%; background: var(--card-bg); box-shadow: 0 5px 25px var(--shadow); z-index: 2000; cursor: pointer; display: flex; align-items: center; justify-content: center; border: 3px solid var(--primary); transition: 0.3s; }
.music-fab:active { transform: scale(0.95); }
.music-icon { font-size: 35px; color: var(--text); transition: 0.5s; }
.music-icon.playing { animation: spin 3s linear infinite; color: var(--primary); }
.music-note-badge { position: absolute; top: -5px; right: -5px; background: var(--accent); color: #333; width: 20px; height: 20px; border-radius: 50%; font-size: 10px; display: flex; align-items: center; justify-content: center; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* --- AI CHATBOT UI --- */
.ai-fab { position: fixed; bottom: 160px; right: 25px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #6200ea, #b388ff); box-shadow: 0 5px 25px rgba(98, 0, 234, 0.4); z-index: 2000; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 30px; transition: 0.3s; border: 2px solid white; overflow: hidden; }
.ai-fab:hover { transform: scale(1.1); }
.ai-fab img { width: 100%; height: 100%; object-fit: cover; }

.ai-chat-window { position: fixed; bottom: 230px; right: 25px; width: 350px; height: 450px; background: var(--card-bg); border-radius: 15px; box-shadow: 0 10px 40px var(--shadow); z-index: 2001; display: none; flex-direction: column; overflow: hidden; border: 1px solid var(--border); }
.ai-header { background: linear-gradient(135deg, #6200ea, #b388ff); color: white; padding: 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
.ai-body { flex: 1; padding: 15px; overflow-y: auto; background: var(--bg); display: flex; flex-direction: column; gap: 10px; }
.ai-msg { padding: 8px 12px; border-radius: 10px; max-width: 80%; font-size: 0.9rem; line-height: 1.4; }
.ai-msg.bot { background: var(--card-bg); border: 1px solid var(--border); align-self: flex-start; color: var(--text); }
.ai-msg.user { background: #6200ea; color: white; align-self: flex-end; }
.ai-input-area { padding: 10px; border-top: 1px solid var(--border); display: flex; gap: 5px; background: var(--card-bg); }
.ai-input-area input { margin: 0; padding: 8px; font-size: 0.9rem; }
.chat-suggestions { display: flex; gap: 8px; padding: 10px; overflow-x: auto; white-space: nowrap; border-bottom: 1px solid var(--border); background: var(--card-bg); scrollbar-width: none; }
.chat-suggestions::-webkit-scrollbar { display: none; }
.chat-chip { padding: 6px 12px; background: var(--input-bg); color: #6200ea; border: 1px solid #e1bee7; border-radius: 20px; font-size: 0.85rem; cursor: pointer; transition: 0.2s; font-weight: 600; }
.chat-chip:hover { background: #6200ea; color: white; }
.ai-msg-actions { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 10px 0; padding-left: 5px; animation: fadeIn 0.5s ease-out; }
.suggestion-chip { background: var(--card-bg); border: 1px solid var(--primary); color: var(--primary); padding: 5px 10px; border-radius: 15px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; }
.suggestion-chip:hover { background: var(--primary); color: white; }

/* --- GALLERY & RANKING --- */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
.gallery-item { position: relative; border-radius: 12px; overflow: hidden; cursor: pointer; box-shadow: 0 4px 10px var(--shadow); background: var(--card-bg); border: 1px solid var(--border); transition: 0.3s; }
.gallery-item:hover { transform: translateY(-5px); box-shadow: 0 12px 30px var(--shadow); }
.gallery-img-container { width: 100%; aspect-ratio: 1/1; overflow: hidden; background: #f0f0f0; }
.gallery-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s, filter 0.3s, opacity 0.3s; opacity: 0; }
.gallery-img.loaded { opacity: 1; }
.gallery-img.lazy-blur { filter: blur(10px); }
.gallery-item:hover .gallery-img { transform: scale(1.1); }
.gallery-info { padding: 12px; background: var(--card-bg); }
.gallery-title { font-weight: bold; font-size: 0.95rem; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; }
.gallery-meta { font-size: 0.8rem; color: var(--text-sec); display: flex; justify-content: space-between; align-items: center; }
.post-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); margin-right: 6px; vertical-align: middle; }
.grid-actions { display:flex; gap:10px; margin-top:5px; padding-top:5px; border-top:1px solid var(--border); font-size:0.8rem; color:var(--text-sec); }
.grid-act-btn { cursor:pointer; background:none; border:none; color:var(--text-sec); transition:0.2s; }
.grid-act-btn:hover { color:var(--primary); }
.owner-controls { position: absolute; top: 10px; right: 10px; display: flex; gap: 8px; z-index: 10; }
.ctrl-btn { background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.9rem; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }

.featured-section { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border: 2px solid var(--primary); border-radius: 20px; padding: 25px; margin-bottom: 30px; display: flex; gap: 25px; align-items: center; position: relative; overflow: hidden; }
.featured-badge { position: absolute; top: 0; left: 0; background: var(--accent); color: #333; padding: 5px 20px; font-weight: 800; border-bottom-right-radius: 15px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1); }
.featured-img { width: 160px; height: 160px; object-fit: cover; border-radius: 15px; border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
.featured-content h3 { font-size: 1.5rem; margin: 0 0 10px 0; color: var(--primary-dark); }

/* --- ANIMATIONS FOR FEATURED POSTS --- */
/* 1. Hiệu ứng Radar Pulse cho Bài Ghim (Gây chú ý mạnh) */
@keyframes pinPulse {
    0% { box-shadow: 0 0 0 0 rgba(255, 160, 0, 0.7); transform: scale(1); }
    70% { box-shadow: 0 0 0 12px rgba(255, 160, 0, 0); transform: scale(1.01); }
    100% { box-shadow: 0 0 0 0 rgba(255, 160, 0, 0); transform: scale(1); }
}
#pinned-post { animation: pinPulse 2s infinite; }

/* 2. Hiệu ứng Breathing Glow cho Top 1 (Nhẹ nhàng, vinh danh) */
@keyframes topGlow {
    0% { box-shadow: 0 5px 15px rgba(46, 125, 50, 0.2); border-color: var(--primary); }
    50% { box-shadow: 0 10px 30px rgba(46, 125, 50, 0.6); border-color: #66bb6a; }
    100% { box-shadow: 0 5px 15px rgba(46, 125, 50, 0.2); border-color: var(--primary); }
}
#featured-post { animation: topGlow 3s infinite alternate ease-in-out; }

.ranking-wrapper { display: flex; gap: 25px; flex-wrap: wrap; margin-top: 30px; }
.ranking-card { flex: 1; min-width: 320px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 5px 15px var(--shadow); }
.ranking-header { background: var(--primary); color: white; padding: 12px; text-align: center; font-weight: bold; font-size: 1.1rem; }
.ranking-header.class-rank { background: var(--info); }
.rank-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.rank-table td { padding: 12px 15px; border-bottom: 1px solid var(--border); color: var(--text); }
.rank-top-1 { background: rgba(255, 253, 231, 0.3); font-weight: bold; color: #f9a825; }
.rank-num { display: inline-flex; width: 26px; height: 26px; background: var(--input-bg); border-radius: 50%; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; color: var(--text-sec); margin-right: 8px; }
.rank-top-1 .rank-num { background: #fbc02d; color: white; }

.archive-controls { display: flex; gap: 10px; margin-bottom: 20px; background: var(--input-bg); padding: 15px; border-radius: 10px; overflow-x: auto; }
.archive-tab { cursor: pointer; padding: 10px 20px; background: var(--border); border-radius: 20px; font-weight: bold; font-size: 0.9rem; white-space: nowrap; color: var(--text-sec); transition: 0.2s; }
.archive-tab.active { background: var(--archive-color); color: white; box-shadow: 0 4px 10px var(--shadow); }

/* --- LIGHTBOX & COMMENTS --- */
.modal { display: none; position: fixed; z-index: 9999; top:0; left:0; width:100%; height:100%; background: #000; overflow: hidden; }
.lb-container { width: 100%; height: 100%; display: flex; flex-direction: column; background: #000; position: relative; }
.lb-image-area { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #000; position: relative; cursor: grab; padding: 0; margin: 0; }
.lb-image-area img { max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.2s ease-out; transform-origin: center; }
.lb-image-area img.zoomed { cursor: grab; transform: scale(2.5); }
.lb-overlay-top { position: absolute; top: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent); display: flex; justify-content: flex-end; align-items: center; z-index: 100; pointer-events: none; }
.lb-overlay-top * { pointer-events: auto; }
.lb-close-btn { background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.4rem; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
.lb-toggle-details-btn { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; border-radius: 30px; font-weight: bold; font-size: 0.9rem; backdrop-filter: blur(5px); cursor: pointer; z-index: 50; display: flex; align-items: center; gap: 8px; transition: opacity 0.3s; }
.lb-details { position: absolute; bottom: 0; left: 0; width: 100%; background: var(--card-bg); border-top-left-radius: 20px; border-top-right-radius: 20px; padding: 20px; display: flex; flex-direction: column; height: 60vh; z-index: 60; box-shadow: 0 -5px 50px rgba(0,0,0,0.5); transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.lb-details.open { transform: translateY(0); }
.lb-drag-handle { width: 40px; height: 5px; background: var(--border); border-radius: 5px; margin: -10px auto 15px auto; }
.lb-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-shrink: 0; }
.lb-avatar { width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover; }
.lb-meta { flex: 1; }
.lb-meta h4 { margin: 0; font-size: 1rem; color: var(--text); }
.lb-meta span { font-size: 0.85rem; color: var(--text-sec); display:block; }
.lb-controls { display:flex; gap:10px; margin-left:auto; }
.lb-btn-icon { background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-sec); width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:0.2s; }
.lb-btn-icon:hover { background:var(--input-bg); }
.lb-btn-pin { color:#ffa000; }
.lb-btn-edit { color:#1976d2; }
.lb-btn-delete { color:#d32f2f; }
.lb-desc { font-size: 0.95rem; margin-bottom: 15px; max-height: 60px; overflow-y: auto; color: var(--text); flex-shrink: 0; }
.lb-stats { display: flex; gap: 20px; margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 10px; flex-shrink: 0; }
.lb-stat-item { color: var(--text-sec); font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.lb-stat-item.active { color: #e53935; }
.lb-comments-list { flex: 1; overflow-y: auto; margin-bottom: 15px; background: var(--bg); padding: 10px; border-radius: 10px; }
.lb-comment-item { margin-bottom: 10px; display: flex; align-items: flex-start; gap: 10px; }
.lb-comment-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
.lb-comment-bubble { background: var(--card-bg); padding: 8px 12px; border-radius: 15px; display: inline-block; box-shadow: 0 1px 3px var(--shadow); font-size: 0.9rem; }
.quick-replies-container { overflow-x: auto; white-space: nowrap; padding-bottom: 5px; display: flex; gap: 10px; flex-shrink: 0; -ms-overflow-style: none; scrollbar-width: none; }
.quick-replies-container::-webkit-scrollbar { display: none; }
.quick-chip { background: rgba(46, 125, 50, 0.1); color: var(--primary); border: 1px solid var(--primary); padding: 10px 18px; border-radius: 25px; font-size: 0.9rem; font-weight: bold; cursor: pointer; transition: 0.2s; }
.quick-chip:active { background: var(--primary); color: white; transform: scale(0.95); }

/* --- ADMIN & MOBILE --- */
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 10px; }
.admin-table th { text-align: left; padding: 12px; background: var(--input-bg); color: var(--text-sec); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--border); }
.switch { position: relative; display: inline-block; width: 46px; height: 24px; vertical-align: middle; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: var(--primary); }
input:checked + .slider:before { transform: translateX(22px); }

#home-login-area { margin-top: 20px; text-align: center; }
.home-login-btn { background: white; color: var(--primary); border: 2px solid var(--primary); padding: 12px 35px; border-radius: 50px; font-weight: 800; cursor: pointer; transition: 0.3s; box-shadow: 0 5px 15px rgba(0,0,0,0.1); font-size: 1.1rem; z-index: 100; position: relative; }
.home-login-btn:hover { background: var(--primary); color: white; transform: translateY(-3px); }

.key-item { display: flex; justify-content: space-between; align-items: center; background: var(--input-bg); padding: 8px 12px; border-radius: 8px; margin-bottom: 5px; border: 1px solid var(--border); }
.key-name { font-weight: bold; font-size: 0.9rem; }
.key-val { font-size: 0.8rem; color: var(--text-sec); margin-left: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* --- SETTINGS PAGE STYLES (NEW) --- */
.settings-group { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
.settings-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid var(--border); background: var(--card-bg); transition: 0.2s; }
.settings-item:last-child { border-bottom: none; }
.settings-item:hover { background: var(--input-bg); }
.settings-label { display: flex; align-items: center; gap: 15px; font-size: 1rem; color: var(--text); font-weight: 600; }
.settings-icon-box { width: 35px; height: 35px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.1rem; }
.toggle-switch { position: relative; display: inline-block; width: 50px; height: 26px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.slider-round { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
.slider-round:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider-round { background-color: var(--primary); }
input:checked + .slider-round:before { transform: translateX(24px); }

/* --- CONFESSIONS STYLE (NEW) --- */
.confession-container { max-height: 400px; overflow-y: auto; margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px; }
.confess-item { background: var(--input-bg); border-radius: 10px; padding: 12px; margin-bottom: 10px; border: 1px solid var(--border); position: relative; }
.confess-content { font-size: 0.95rem; color: var(--text); margin-bottom: 5px; font-style: italic; }
.confess-meta { font-size: 0.75rem; color: var(--text-sec); display: flex; justify-content: space-between; align-items: center; }
.confess-delete { color: var(--danger); cursor: pointer; font-weight: bold; font-size: 0.7rem; }

@media (min-width: 769px) {
    .lb-container { flex-direction: row; max-width: 1100px; height: 90vh; border-radius: 12px; margin: 5vh auto; background: black; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    .lb-image-area { flex: 2; height: 100%; border-right: 1px solid #333; border-radius: 12px 0 0 12px; }
    .lb-details { position: static; flex: 1; height: 100%; max-height: 100%; border-radius: 0 12px 12px 0; transform: none; box-shadow: none; }
    .lb-overlay-top { display: none; } 
    .lb-close-btn { position: absolute; top: 15px; right: 15px; z-index: 100; background: rgba(0,0,0,0.6); }
    .lb-toggle-details-btn { display: none; } 
    .lb-drag-handle { display: none; }
}

@media (max-width: 768px) {
    .container { margin: 0; border-radius: 0; padding: 20px 15px 100px 15px; box-shadow: none; width: 100%; border: none; }
    nav.pc-nav { display: none; }
    nav.mobile-nav { display: block; }
    .gallery-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .featured-section { flex-direction: column; text-align: center; }
    .music-fab { bottom: 80px; right: 15px; width: 50px; height: 50px; }
    .ai-fab { bottom: 140px; right: 15px; width: 50px; height: 50px; }
    .ai-chat-window { width: 90%; right: 5%; bottom: 200px; height: 400px; }
    h1 { font-size: 1.6rem; }
}
