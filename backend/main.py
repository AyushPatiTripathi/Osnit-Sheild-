from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.incidents import router as incidents_router
from backend.routes.intelligence import router as intelligence_router
from backend.routes.operations import router as operations_router

from ingestion.collectors.news import collect_news
from ai_engine.pipeline import process_unprocessed_records

from apscheduler.schedulers.background import BackgroundScheduler
import logging


# -----------------------------------
# App Initialization
# -----------------------------------
app = FastAPI(title="OSNIT Shield API")


# -----------------------------------
# CORS Middleware (for React frontend)
# -----------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------
# Include Routers
# -----------------------------------
app.include_router(incidents_router)
app.include_router(intelligence_router)
app.include_router(operations_router)


# -----------------------------------
# Logging Setup
# -----------------------------------
logging.basicConfig(level=logging.INFO)


# -----------------------------------
# Scheduler Setup
# -----------------------------------
scheduler = BackgroundScheduler()


def ingestion_job():
    logging.info("Running ingestion job...")
    collect_news()


def ai_processing_job():
    logging.info("Running AI processing job...")
    process_unprocessed_records()


@app.on_event("startup")
def start_scheduler():
    scheduler.add_job(ingestion_job, "interval", minutes=15)
    scheduler.add_job(ai_processing_job, "interval", minutes=15)
    scheduler.start()
    logging.info("🚀 Scheduler started inside FastAPI")


# -----------------------------------
# Root Endpoint
# -----------------------------------
@app.get("/")
def root():
    return {"message": "OSNIT Shield Backend Running"}
