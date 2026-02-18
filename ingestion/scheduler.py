from apscheduler.schedulers.blocking import BlockingScheduler
from ingestion.collectors.news import collect_news
from ingestion.collectors.rss import collect_rss
from ingestion.collectors.reddit import collect_reddit
import logging

logging.basicConfig(level=logging.INFO)

scheduler = BlockingScheduler()

scheduler.add_job(collect_news, 'interval', minutes=15)
scheduler.add_job(collect_rss, 'interval', minutes=15)
scheduler.add_job(collect_reddit, 'interval', minutes=15)

if __name__ == "__main__":
    logging.info("🚀 OSNIT Multi-Source Scheduler Started...")
    scheduler.start()

