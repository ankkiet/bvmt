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
