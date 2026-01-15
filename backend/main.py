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
    keys: Optional[List[str]] = None # Nhận danh sách Key từ Admin Panel

# Mapping model name từ frontend sang tên thật của Google
MODEL_MAP = {
    "main": "gemini-2.0-flash",
    "voice": "gemini-2.0-flash",
    "backup": "gemini-1.5-flash",
    "main": "gemini-1.5-flash",
    "voice": "gemini-1.5-flash",
    "backup": "gemini-1.5-flash-8b",
    "advanced": "gemini-1.5-pro"
}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # Ưu tiên dùng Key từ Frontend gửi lên, nếu không có thì dùng Key mặc định của Server
    keys_to_try = req.keys if req.keys and len(req.keys) > 0 else [GOOGLE_API_KEY]
    
    last_error = None

    for api_key in keys_to_try:
        try:
            # Cấu hình Key cho lần thử này
            genai.configure(api_key=api_key)

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

            # Xử lý Chat History
            formatted_history = []
            for msg in req.history:
                parts = []
                for p in msg.parts:
                    if p.text:
                        parts.append(p.text)
                    if p.inline_data:
                        parts.append({"mime_type": p.inline_data.get('mime_type'), "data": p.inline_data.get('data')})
                formatted_history.append({"role": msg.role, "parts": parts})

            # Xử lý tin nhắn mới nhất
            current_parts = []
            if req.prompt:
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
            print(f"Key ...{api_key[-5:]} lỗi: {str(e)}")
            last_error = e
            continue # Thử key tiếp theo trong danh sách

    # Nếu thử hết key mà vẫn lỗi
    raise HTTPException(status_code=500, detail=f"Tất cả Key đều lỗi. Lỗi cuối: {str(last_error)}")

# Để chạy server: uvicorn main:app --reload --port 8000
