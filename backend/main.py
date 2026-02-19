from fastapi import FastAPI
from backend.routes.incidents import router as incidents_router

app = FastAPI(title="OSNIT Shield API")

app.include_router(incidents_router)


@app.get("/")
def root():
    return {"message": "OSNIT Shield Backend Running"}

