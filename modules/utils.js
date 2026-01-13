// e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\modules\utils.js

export const Utils = {
    loader: (show, text="Đang xử lý...") => {
        const overlay = document.getElementById('upload-overlay');
        const txt = document.getElementById('upload-loading-text');
        if(overlay) overlay.style.display = show ? 'flex' : 'none';
        if(txt) txt.innerText = text;
    },
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

export function fileToBase64(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

export const optimizeUrl = (url, width) => {
    if (url && url.includes('cloudinary.com')) {
        let params = 'f_auto,q_auto';
        if (width) params += `,w_${width}`;
        return url.replace('/upload/', `/upload/${params}/`);
    }
    return url;
};

export function getYoutubeID(url) { 
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; 
    const match = url.match(regExp); 
    return (match && match[2].length === 11) ? match[2] : url; 
}

// --- HYBRID LIVE UTILS ---

export function speakText(text, onEnd) {
    if (!window.speechSynthesis) {
        console.error("Trình duyệt không hỗ trợ đọc văn bản.");
        if (onEnd) onEnd();
        return;
    }
    
    window.speechSynthesis.cancel(); // Dừng các lượt đọc trước

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.1; // Tốc độ nhanh hơn xíu cho tự nhiên

    // Chọn giọng đọc ưu tiên: Google Tiếng Việt -> Microsoft -> Bất kỳ giọng Việt nào
    const voices = window.speechSynthesis.getVoices();
    let viVoice = voices.find(v => v.name === 'Google Tiếng Việt');
    if (!viVoice) viVoice = voices.find(v => v.name.includes('Microsoft') && v.lang.includes('vi'));
    if (!viVoice) viVoice = voices.find(v => v.lang.includes('vi'));

    if (viVoice) {
        utterance.voice = viVoice;
        console.log("Đã chọn giọng đọc:", viVoice.name);
    }

    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = (e) => { console.error("Lỗi đọc:", e); if (onEnd) onEnd(); };

    window.speechSynthesis.speak(utterance);
}

export function listenOnce(onResult, onEnd) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Trình duyệt không hỗ trợ nhận diện giọng nói.");
        if (onEnd) onEnd();
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (onResult) onResult(text);
    };

    recognition.onend = () => { if (onEnd) onEnd(); };
    recognition.onerror = (event) => { console.warn("Lỗi nhận diện:", event.error); };

    try {
        recognition.start();
    } catch (e) {
        console.error("Không thể bắt đầu thu âm:", e);
        if (onEnd) onEnd();
    }
    return recognition;
}

// --- AUDIO UTILS FOR GEMINI LIVE ---

export function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
    if (outputSampleRate === inputSampleRate) {
        return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

export function floatTo16BitPCM(float32Array) {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buffer;
}

export function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
