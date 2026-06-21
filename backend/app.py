from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.event_routes import router as event_router
from routes.route_routes import router as route_router

app = FastAPI(
    title="Smart Traffic Diversion System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://trafficiq-dusky.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(event_router)
app.include_router(route_router)


@app.get("/")
async def root():
    return {
        "message": "Smart Traffic Diversion System API running"
    }
