from fastapi import APIRouter
from ingestion.collectors.news import collect_news
from ai_engine.pipeline import process_unprocessed_records
from ingestion.scheduler import scheduler

router = APIRouter(prefix="/operations", tags=["Operations"])

@router.post("/run-ingestion")
def run_ingestion():
    collect_news()
    return {"status": "Ingestion started"}

@router.post("/run-ai")
def run_ai():
    process_unprocessed_records()
    return {"status": "AI processing started"}

@router.get("/status")
def scheduler_status():
    return {
        "running": scheduler.running
    }
