# e:\A2K41_WEB\web sịn hahahhhahahaha\bvmt\backend\main.py
# (File mới hoàn toàn)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
import google.generativeai as genai
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Cấu hình CORS để Web (frontend) gọi được API này
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong thực tế nên giới hạn domain của bạn
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CẤU HÌNH API KEY TẠI SERVER (AN TOÀN) ---
# Ưu tiên lấy Key từ biến môi trường (trên Render), nếu không có thì dùng Key cứng (localhost)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyAnOwbqmpQcOu_ERINF4nSfEL4ZW95fiGc")
genai.configure(api_key=GOOGLE_API_KEY)

# Định nghĩa cấu trúc dữ liệu gửi lên từ JS
class ChatPart(BaseModel):
    text: Optional[str] = None
    inline_data: Optional[Any] = None # Cho ảnh base64

class ChatMessage(BaseModel):
    role: str
    parts: List[ChatPart]

class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    imageBase64: Optional[str] = None
    history: List[ChatMessage] = []
    modelType: str = "main"

# Mapping model name từ frontend sang tên thật của Google
MODEL_MAP = {
    "main": "gemini-2.0-flash",
    "voice": "gemini-2.0-flash",
    "backup": "gemini-1.5-flash",
    "advanced": "gemini-1.5-pro"
}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        model_name = MODEL_MAP.get(req.modelType, "gemini-2.0-flash")
        
        # Cấu hình Model
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }
        
        model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=generation_config
        )

        # Xử lý Chat History để phù hợp với Python SDK
        # Python SDK của Google hơi khác REST API JSON một chút, ta convert lại
        formatted_history = []
        for msg in req.history:
            parts = []
            for p in msg.parts:
                if p.text:
                    parts.append(p.text)
                if p.inline_data:
                    # Xử lý ảnh trong history (nếu cần)
                    parts.append({"mime_type": p.inline_data.get('mime_type'), "data": p.inline_data.get('data')})
            formatted_history.append({"role": msg.role, "parts": parts})

        # Xử lý tin nhắn mới nhất
        current_parts = []
        if req.prompt:
            # Ép buộc nhắc nhở Tiếng Việt tại Server
            prompt_text = "(Trả lời bằng Tiếng Việt): " + req.prompt
            current_parts.append(prompt_text)
        
        if req.imageBase64:
            current_parts.append({"mime_type": "image/jpeg", "data": req.imageBase64})

        # Gọi Gemini
        if formatted_history:
            chat_session = model.start_chat(history=formatted_history)
            response = chat_session.send_message(current_parts)
        else:
            response = model.generate_content(current_parts)

        return {"text": response.text}

    except Exception as e:
        print(f"Lỗi Server AI: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Để chạy server: uvicorn main:app --reload --port 8000
