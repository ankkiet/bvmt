import { PERSONAS } from './constants.js';
import { base64ToArrayBuffer, floatTo16BitPCM, downsampleBuffer } from './utils.js';

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
    }

    /**
     * Bắt đầu kết nối WebSocket và Audio
     */
    async connect(apiKey, systemInstruction) {
        try {
            // 1. Khởi tạo AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // 2. Kết nối WebSocket
            const url = `wss://generativelanguage.googleapis.com/v1alpha/model/gemini-2.0-flash-exp:live?key=${apiKey}`;
            this.ws = new WebSocket(url);

            this.ws.onopen = () => this.handleOpen(systemInstruction);
            this.ws.onmessage = (e) => this.handleMessage(e);
            this.ws.onerror = (e) => {
                console.error("WebSocket Error:", e);
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
            throw error;
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

    handleOpen(systemInstruction) {
        const setupMsg = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: "Kore" // Giọng nữ (hoặc Fenrir, Puck...)
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                }
            }
        };
        this.ws.send(JSON.stringify(setupMsg));
    }

    async handleMessage(event) {
        try {
            let data;
            if (event.data instanceof Blob) {
                data = JSON.parse(await event.data.text());
            } else {
                data = JSON.parse(event.data);
            }

            // Nhận Audio PCM từ Server
            if (data.serverContent?.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
                        const pcmData = base64ToArrayBuffer(part.inlineData.data);
                        this.queueAudio(pcmData);
                    }
                }
            }
            
            // Xử lý sự kiện ngắt lời (Interruption) từ Server
            if (data.serverContent?.interrupted) {
                console.log("⚠️ Bot bị ngắt lời");
                this.stopAudio();
                this.audioQueue = [];
            }

        } catch (e) {
            console.error("Lỗi xử lý tin nhắn:", e);
        }
    }

    async startAudioInput() {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: this.inputSampleRate
            }
        });

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

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

    queueAudio(pcmData) {
        this.audioQueue.push(pcmData);
        if (!this.isPlaying) {
            this.playNextChunk();
        }
    }

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
        
        const apiKey = aiKeys[0].val;
        const systemPrompt = PERSONAS.green_bot.prompt;

        bot.connect(apiKey, systemPrompt)
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