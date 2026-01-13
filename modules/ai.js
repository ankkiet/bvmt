// e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\modules\ai.js

import { AI_MODELS } from './constants.js';
import { db, doc, updateDoc, setDoc, increment } from './firebase.js';

/**
 * Hàm gọi API Gemini
 * @param {string} prompt - Câu hỏi (nếu không dùng history)
 * @param {string} imageBase64 - Ảnh (nếu có)
 * @param {boolean} useHistory - Có dùng lịch sử chat không
 * @param {string} modelType - Loại model (main, voice, backup...)
 * @param {Array} aiKeys - Danh sách API Key
 * @param {Array} chatHistory - Mảng lịch sử chat (sẽ được sửa trực tiếp)
 */
export async function callGeminiAPI(prompt, imageBase64, useHistory, modelType, aiKeys, chatHistory) {
    let requestContents;

    if (useHistory) {
        requestContents = chatHistory;
    } else {
        const parts = [];
        if (prompt) parts.push({ text: prompt });
        if (imageBase64) parts.push({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
        requestContents = [{ role: "user", parts }];
    }

    // Xác định danh sách model cần thử (Ưu tiên -> Dự phòng)
    const modelsToTry = [AI_MODELS[modelType]];
    if (modelType !== 'backup') modelsToTry.push(AI_MODELS['backup']);

    for (let i = 0; i < aiKeys.length; i++) {
        const keyObj = aiKeys[i];
        
        for (const model of modelsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyObj.val}`;
                const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: requestContents }) });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI không phản hồi.";
                
                if (useHistory) {
                    chatHistory.push({ role: "model", parts: [{ text: aiText }] });
                    // Giữ lịch sử không quá 30 tin nhắn (Dùng shift để sửa mảng gốc thay vì gán lại)
                    while (chatHistory.length > 30) chatHistory.shift();
                }

                // THỐNG KÊ: Ghi nhận thành công (Chạy ngầm)
                updateDoc(doc(db, "stats", "ai"), { success: increment(1) }).catch(() => setDoc(doc(db, "stats", "ai"), { success: 1, fail: 0 }));

                return aiText;
            } catch (e) { 
                console.warn(`Key ${keyObj.name} - Model ${model} lỗi:`, e);
                // Nếu là model cuối cùng của key cuối cùng thì mới return lỗi
                if (i === aiKeys.length - 1 && model === modelsToTry[modelsToTry.length - 1]) return "Tất cả Key AI đều bận hoặc lỗi.";
            }
        }
    }
    
    // THỐNG KÊ: Ghi nhận thất bại
    updateDoc(doc(db, "stats", "ai"), { fail: increment(1) })
        .catch(() => setDoc(doc(db, "stats", "ai"), { success: 0, fail: 1 }));
    
    return "Hệ thống AI đang bận, vui lòng thử lại sau.";
}

// Hiệu ứng gõ chữ (Typewriter)
export async function typeWriterEffect(element, html, speed = 10) {
    element.innerHTML = "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const nodes = Array.from(tempDiv.childNodes);
    for (const node of nodes) await typeNode(element, node, speed);
}

async function typeNode(parent, node, speed) {
    if (node.nodeType === Node.TEXT_NODE) {
        const textNode = document.createTextNode("");
        parent.appendChild(textNode);
        const text = node.textContent;
        for (let i = 0; i < text.length; i++) {
            textNode.nodeValue += text[i];
            const list = document.getElementById('ai-messages');
            if(list) list.scrollTop = list.scrollHeight; // Auto scroll
            const randomSpeed = speed + (Math.random() * 10 - 5);
            if(text[i] !== ' ') await new Promise(r => setTimeout(r, Math.max(5, randomSpeed)));
        }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node.cloneNode(false);
        parent.appendChild(el);
        if (node.tagName === 'BR') await new Promise(r => setTimeout(r, speed));
        for (const child of Array.from(node.childNodes)) await typeNode(el, child, speed);
    }
}
