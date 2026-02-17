from apscheduler.schedulers.blocking import BlockingScheduler
from ingestion.collectors.news import collect_news
import logging

logging.basicConfig(level=logging.INFO)

scheduler = BlockingScheduler()

# Run every 15 minutes
scheduler.add_job(collect_news, 'interval', minutes=15)

if __name__ == "__main__":
    logging.info("🚀 OSNIT Ingestion Scheduler Started...")
    scheduler.start()
