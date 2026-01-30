// Import các hằng số và hàm tiện ích cần thiết
import { PERSONAS, WEBSOCKET_URL, AI_MODELS } from './constants.js';
import { base64ToArrayBuffer, floatTo16BitPCM, downsampleBuffer, speakText } from './utils.js';
import { callGeminiAPI } from './ai.js';

/**
 * Class quản lý kết nối Gemini Live (Multimodal WebSocket)
 * Tách biệt hoàn toàn với logic cũ để tránh xung đột.
 */
class GreenBotLive {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.inputSampleRate = 16000; // Gemini hỗ trợ tốt 16kHz
        this.audioQueue = [];
        this.isPlaying = false;
        this.isConnected = false;
        this.currentSource = null;
        this.connectionError = null; // Lưu lỗi kết nối để hiển thị chính xác hơn
        this.aiKeys = []; // Lưu keys để dùng cho việc diễn giải lệnh
    }

    /**
     * Bắt đầu kết nối WebSocket và Audio
     */
    async connect(aiKeys, systemInstruction) {
        this.aiKeys = aiKeys;
        const apiKey = aiKeys[0].val;
        this.connectionError = null; // Reset lỗi khi kết nối lại
        try {
            // 1. Khởi tạo AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // 2. Kết nối WebSocket
            const url = `${WEBSOCKET_URL}?key=${apiKey}`;
            this.ws = new WebSocket(url);

            this.ws.onopen = () => this.handleOpen(systemInstruction);
            this.ws.onmessage = (e) => this.handleMessage(e);
            this.ws.onerror = (e) => {
                console.error("WebSocket Error:", e);
                this.connectionError = new Error("Kết nối WebSocket thất bại. Vui lòng kiểm tra API Key hoặc kết nối mạng.");
                this.disconnect();
            };
            this.ws.onclose = () => {
                console.log("WebSocket Closed");
                this.disconnect();
            };

            // 3. Bắt đầu thu âm
            await this.startAudioInput();
            this.isConnected = true;
            console.log("✅ Đã kết nối Gemini Live");

        } catch (error) {
            console.error("Lỗi kết nối Live:", error);
            this.disconnect();
            // Bắt lỗi từ chối quyền micro để hiển thị thông báo thân thiện hơn
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error("Bạn đã từ chối quyền truy cập Micro.");
            }
            throw error; // Ném lại các lỗi khác (bao gồm cả lỗi custom từ race condition)
        }
    }

    /**
     * Ngắt kết nối và dọn dẹp tài nguyên
     */
    disconnect() {
        this.isConnected = false;
        this.stopAudio(); // Dừng phát loa

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    // Gửi tin nhắn cấu hình ban đầu (Setup) cho Gemini qua WebSocket
    handleOpen(systemInstruction) {
        const setupMsg = {
            setup: {
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: "Orus" // Giọng nữ (hoặc Fenrir, Puck...)
                            }
                        }
                    },
                    // Kích hoạt tính năng nhận diện văn bản (Transcription) để xử lý lệnh
                    input_audio_transcription: { model: "google_default_dt" },
                    output_audio_transcription: { model: "google_default_dt" }
                },
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                }
            }
        };
        this.ws.send(JSON.stringify(setupMsg));
    }

    // Xử lý tin nhắn nhận được từ Gemini (Audio hoặc Text)
    async handleMessage(event) {
        try {
            let data;
            if (event.data instanceof Blob) {
                data = JSON.parse(await event.data.text());
            } else {
                data = JSON.parse(event.data);
            }

            // 1. Nhận dữ liệu âm thanh (Audio PCM) từ Server để phát ra loa
            if (data.serverContent?.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
                        const pcmData = base64ToArrayBuffer(part.inlineData.data);
                        this.queueAudio(pcmData);
                    }
                }
            }

            // 2. Nhận văn bản (Transcription) từ lời nói của người dùng -> Dùng để điều khiển web
            if (data.serverContent?.inputTranscription) {
                const userText = data.serverContent.inputTranscription.text;
                console.log("User said:", userText);
                
                // Hiển thị text lên UI (nếu có input)
                const inputEl = document.getElementById('ai-input');
                if(inputEl) inputEl.value = userText;

                // Gọi hàm diễn giải lệnh
                this.interpretAndExecute(userText);
            }
            
            // 3. Xử lý sự kiện ngắt lời (Interruption) - Khi người dùng nói chen vào
            if (data.serverContent?.interrupted) {
                console.log("⚠️ Bot bị ngắt lời");
                this.stopAudio();
                this.audioQueue = [];
            }

        } catch (e) {
            console.error("Lỗi xử lý tin nhắn:", e);
        }
    }

    /**
     * Diễn giải lệnh giọng nói thành hành động trên Website
     * (Tương tự interpretWorkoutCommand trong mẫu tham khảo)
     */
    async interpretAndExecute(transcript) {
        if (!transcript || !transcript.trim()) return;

        const prompt = `
        Bạn là trợ lý AI điều khiển website Green School. Phân tích câu lệnh của người dùng và tạo một phản hồi ngắn gọn.
        Câu lệnh: "${transcript}"

        Trả về một đối tượng JSON duy nhất (không có markdown) với cấu trúc sau:
        {
          "command": "navigate" | "scroll" | "action" | "chat",
          "data": { "page": "..." } | { "dir": "..." } | { "type": "..." } | null,
          "response": "Một câu trả lời ngắn gọn, thân thiện để xác nhận hành động. Nếu là 'chat', hãy để trống chuỗi này."
        }

        CÁC LỆNH:
        1. 'navigate': Chuyển trang. Các page hợp lệ: 'home', 'greenclass', 'contest', 'archive', 'profile', 'guide'.
        2. 'scroll': Cuộn trang. Các hướng hợp lệ: 'up', 'down', 'top', 'bottom'.
        3. 'action': Hành động đặc biệt. Các type hợp lệ: 'music' (bật/tắt nhạc), 'dark_mode' (bật/tắt nền tối), 'upload' (mở cửa sổ tải file).
        4. 'chat': Nếu không phải là lệnh điều khiển, phân loại là 'chat'.

        VÍ DỤ:
        - Input: "Mở trang thi đua"
        - Output: {"command":"navigate","data":{"page":"contest"},"response":"Okie, tớ đang mở trang Thi Đua cho cậu đây! 🏆"}

        - Input: "Kéo xuống dưới đi"
        - Output: {"command":"scroll","data":{"dir":"down"},"response":"Tớ kéo xuống cho cậu xem nhé! 👇"}
        
        - Input: "Bật nhạc lên"
        - Output: {"command":"action","data":{"type":"music"},"response":"Nhạc lên nào! 🎶"}

        - Input: "Chào Green Bot"
        - Output: {"command":"chat","data":null,"response":""}
        `;

        try {
            // Gọi model Flash Lite cho nhanh để phân tích lệnh
            const res = await callGeminiAPI(prompt, null, false, 'backup', this.aiKeys, []);
            
            // Dùng Regex để tìm chuỗi JSON chính xác (tránh lỗi do text dẫn dắt của AI)
            const jsonMatch = res.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : res.replace(/```json|```/g, '').trim();
            const cmd = JSON.parse(jsonStr);

            console.log("Command Interpreted:", cmd);

            // Chỉ thực thi nếu đó là một lệnh điều khiển, không phải 'chat'
            if (cmd.command !== 'chat') {
                // Ngắt lời bot chính đang phát audio (nếu có) và ngăn nó trả lời
                this.stopAudio();
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ interrupt: {} }));
                }

                // Thực thi lệnh
                if (cmd.command === 'navigate' && cmd.data?.page) { if (window.showPage) { window.showPage(cmd.data.page); window.location.hash = cmd.data.page; } } 
                else if (cmd.command === 'scroll') { if (cmd.data.dir === 'down') window.scrollBy({ top: 500, behavior: 'smooth' }); if (cmd.data.dir === 'up') window.scrollBy({ top: -500, behavior: 'smooth' }); if (cmd.data.dir === 'top') window.scrollTo({ top: 0, behavior: 'smooth' }); if (cmd.data.dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } 
                else if (cmd.command === 'action') { if (cmd.data.type === 'music' && window.toggleMusic) window.toggleMusic(); if (cmd.data.type === 'dark_mode' && window.toggleDarkMode) window.toggleDarkMode(); if (cmd.data.type === 'upload') document.getElementById('file-input')?.click(); }

                // Dùng TTS của trình duyệt để đọc câu phản hồi xác nhận
                if (cmd.response) {
                    speakText(cmd.response, null);
                }
            }
        } catch (e) {
            console.warn("Lỗi diễn giải lệnh:", e);
        }
    }

    // Khởi động Micro và xử lý luồng âm thanh đầu vào
    async startAudioInput() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: this.inputSampleRate
            }
        });

        if (!this.audioContext) {
            stream.getTracks().forEach(track => track.stop());
            throw this.connectionError || new Error("Kết nối bị ngắt hoặc lỗi trước khi Micro khởi động.");
        }
        this.mediaStream = stream;

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        // Xử lý từng chunk âm thanh thu được từ Micro
        this.processor.onaudioprocess = (e) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            
            // Downsample về 16kHz và chuyển sang PCM 16-bit
            const downsampled = downsampleBuffer(inputData, this.audioContext.sampleRate, 16000);
            const pcm16 = floatTo16BitPCM(downsampled);
            
            // Chuyển ArrayBuffer sang Base64
            let binary = '';
            const bytes = new Uint8Array(pcm16.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = window.btoa(binary);

            // Gửi dữ liệu Audio lên Server
            const msg = {
                realtime_input: {
                    media_chunks: [{
                        mime_type: "audio/pcm",
                        data: base64Audio
                    }]
                }
            };
            this.ws.send(JSON.stringify(msg));
        };

        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    // Thêm chunk âm thanh vào hàng đợi để phát
    queueAudio(pcmData) {
        this.audioQueue.push(pcmData);
        if (!this.isPlaying) {
            this.playNextChunk();
        }
    }

    // Phát chunk âm thanh tiếp theo trong hàng đợi
    playNextChunk() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const pcmData = this.audioQueue.shift();
        
        // Convert PCM16 to Float32
        const int16 = new Int16Array(pcmData);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
        }

        // Gemini output thường là 24kHz
        const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.onended = () => this.playNextChunk();
        source.start();
        this.currentSource = source;
    }

    // Dừng phát âm thanh ngay lập tức
    stopAudio() {
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch(e) {}
        }
        this.isPlaying = false;
        this.audioQueue = [];
    }
}

// Singleton Instance
const bot = new GreenBotLive();

/**
 * Hàm Toggle bật/tắt Live Chat (Export ra ngoài)
 * @param {string} btnId - ID của nút bấm trong DOM
 * @param {Array} aiKeys - Danh sách API Key từ script.js
 */
export function toggleLiveChat(btnId, aiKeys) {
    const btn = document.getElementById(btnId);
    
    if (!bot.isConnected) {
        if (!aiKeys || aiKeys.length === 0) {
            alert("Chưa cấu hình API Key!");
            return;
        }

        // Bật Live
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Loading
            btn.disabled = true;
        }
        
        const systemPrompt = PERSONAS.green_bot.prompt;

        bot.connect(aiKeys, systemPrompt)
            .then(() => {
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-ear-listen fa-beat" style="color: #d32f2f;"></i>'; // Icon đang nghe
                    btn.classList.add('active-live');
                    btn.title = "Đang nghe... (Nhấn để tắt)";
                    btn.disabled = false;
                }
            })
            .catch((err) => {
                alert("Không thể kết nối Micro: " + err.message);
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-microphone-lines"></i>';
                    btn.disabled = false;
                }
            });
    } else {
        // Tắt Live
        bot.disconnect();
        if (btn) {
            btn.innerHTML = '<i class="fas fa-microphone-lines"></i>'; // Icon mặc định
            btn.classList.remove('active-live');
            btn.title = "Chat Live (Realtime)";
        }
    }
}