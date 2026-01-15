// e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\modules\ai.js

import { AI_MODELS, WEBSOCKET_URL, MODEL_NAME } from './constants.js';
import { downsampleBuffer, floatTo16BitPCM, base64ToArrayBuffer } from './utils.js';
import { db, doc, updateDoc, setDoc, increment } from './firebase.js';

// URL Backend Python của bạn (Thay đổi khi deploy)
const PYTHON_BACKEND_URL = "https://bvmt-a5gi.onrender.com/api/chat";

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
    try {
        // Chuẩn bị payload gửi sang Python
        const payload = {
            prompt: prompt || null,
            imageBase64: imageBase64 || null,
            history: useHistory ? chatHistory : [], // Gửi history hiện tại sang Python
            modelType: modelType,
            keys: aiKeys.map(k => k.val) // Gửi danh sách Key từ Admin Panel sang
        };

        // Nếu dùng history và có prompt mới, ta tạm thời push vào mảng local để UI hiển thị đúng
        // (Logic thực tế Python sẽ xử lý việc ghép prompt vào context)
        if (useHistory && prompt) {
             // Lưu ý: Việc push vào chatHistory ở đây chỉ để đồng bộ UI client, 
             // Server Python sẽ tự xử lý logic gọi AI.
             // Tuy nhiên, để tránh duplicate khi Python trả về, ta không cần push ở đây 
             // vì script.js đã push user turn vào chatHistory TRƯỚC khi gọi hàm này.
        }

        const response = await fetch(PYTHON_BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Cố gắng đọc lỗi chi tiết từ Server Python gửi về
            let errorMsg = `Server Error: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMsg = errorData.detail;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        
        const data = await response.json();
        const aiText = data.text || "AI không phản hồi.";
                
        if (useHistory) {
            chatHistory.push({ role: "model", parts: [{ text: aiText }] });
            // Giữ lịch sử không quá 30 tin nhắn
            while (chatHistory.length > 30) chatHistory.shift();
        }

        // THỐNG KÊ: Ghi nhận thành công
        updateDoc(doc(db, "stats", "ai"), { success: increment(1) }).catch(() => setDoc(doc(db, "stats", "ai"), { success: 1, fail: 0 }));

        return aiText;

    } catch (e) {
        console.error("Lỗi gọi Python Backend:", e);
        // THỐNG KÊ: Ghi nhận thất bại
        updateDoc(doc(db, "stats", "ai"), { fail: increment(1) })
            .catch(() => setDoc(doc(db, "stats", "ai"), { success: 0, fail: 1 }));
        
        return `⚠️ Lỗi hệ thống: ${e.message}`;
    }
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

// --- GEMINI LIVE (WEBSOCKET) ---
let audioContext = null;
let mediaStream = null;
let processor = null;

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

export function stopRecording() {
    if (processor) { processor.disconnect(); processor = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
}
