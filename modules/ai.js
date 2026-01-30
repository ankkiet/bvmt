// e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\modules\ai.js

// Import cấu hình và tiện ích
import { AI_MODELS, WEBSOCKET_URL, MODEL_NAME } from './constants.js';
import { downsampleBuffer, floatTo16BitPCM, base64ToArrayBuffer } from './utils.js';
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
    // Ép buộc nhắc nhở Tiếng Việt vào prompt
    if (prompt) {
        prompt = "(Trả lời bằng Tiếng Việt): " + prompt;
    }

    // Chuẩn bị nội dung gửi đi (Text hoặc Chat History)
    let requestContents;
    if (useHistory) {
        // Nếu có prompt (Live Mode), thêm vào history
        if (prompt) {
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        } 
        // Nếu prompt null (Chat Mode), chèn nhắc nhở vào tin nhắn cuối cùng trong history
        else if (chatHistory.length > 0) {
            const lastMsg = chatHistory[chatHistory.length - 1];
            if (lastMsg.role === 'user' && lastMsg.parts?.[0]?.text) {
                if (!lastMsg.parts[0].text.startsWith("(Trả lời bằng Tiếng Việt):")) {
                    lastMsg.parts[0].text = "(Trả lời bằng Tiếng Việt): " + lastMsg.parts[0].text;
                }
            }
        }
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

    // Thử lần lượt các API Key và Model để đảm bảo luôn có phản hồi (Fail-over)
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

// Hiệu ứng gõ chữ (Typewriter) để hiển thị câu trả lời của AI mượt mà
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

// --- GEMINI LIVE (WEBSOCKET) ---
let audioContext = null;
let mediaStream = null;
let processor = null;

// Hàm kết nối WebSocket cho chế độ Live cũ (Legacy)
export function connectToGemini(apiKey, onAudioReceived, onClose, onConnected) {
    const url = `${WEBSOCKET_URL}?key=${apiKey}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log("Connected to Gemini Live");
        const setupMsg = {
            setup: {
                model: MODEL_NAME,
                generation_config: { 
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: "Kore"
                            }
                        }
                    }
                    }
            }
        };
        ws.send(JSON.stringify(setupMsg));
        if (onConnected) onConnected();
    };

    ws.onmessage = async (event) => {
        try {
            let data;
            if (event.data instanceof Blob) {
                data = JSON.parse(await event.data.text());
            } else {
                data = JSON.parse(event.data);
            }

            if (data.serverContent?.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
                        const audioData = base64ToArrayBuffer(part.inlineData.data);
                        if (onAudioReceived) onAudioReceived(audioData);
                    }
                }
            }
        } catch (e) {
            console.error("Gemini WS Message Error:", e);
        }
    };

    ws.onerror = (err) => console.error("Gemini WS Error:", err);
    ws.onclose = () => {
        if (onClose) onClose();
    };

    return ws;
}

// Bắt đầu ghi âm và gửi dữ liệu qua WebSocket (Legacy)
export async function startRecording(wsInstance) {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
        if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Downsample về 16kHz
        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
        // Convert sang PCM 16-bit
        const pcm16 = floatTo16BitPCM(downsampled);
        
        // Convert sang Base64 để gửi
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        const base64Audio = window.btoa(binary);

        wsInstance.send(JSON.stringify({
            realtime_input: {
                media_chunks: [{
                    mime_type: "audio/pcm",
                    data: base64Audio
                }]
            }
        }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    return { audioContext, source, mediaStream };
}

// Dừng ghi âm và giải phóng tài nguyên
export function stopRecording() {
    if (processor) { processor.disconnect(); processor = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
}
