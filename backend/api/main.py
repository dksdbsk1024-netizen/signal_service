"""FastAPI 진입점.

core 로직을 HTTP로 노출한다(MockProvider 데이터). 프론트 개발서버가 붙을 수 있게
CORS를 localhost로 연다. 실 데이터 연동은 deps.PROVIDER 교체만으로 이뤄진다.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import flow, macro, screener, signal, technical

app = FastAPI(title="signal-service API", version="0.1.0")

# 프론트 개발서버(Vite 5173 / CRA 3000 등) 허용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"http://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signal.router)
app.include_router(technical.router)
app.include_router(flow.router)
app.include_router(macro.router)
app.include_router(screener.router)


@app.get("/health")
def health():
    return {"status": "ok", "provider": "mock"}
