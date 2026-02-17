import requests
import logging
import hashlib
from datetime import datetime
from database import SessionLocal
from models import RawOSINT
from dotenv import load_dotenv
import os

load_dotenv()

logging.basicConfig(level=logging.INFO)

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

SEARCH_QUERY = "cyberattack OR fraud OR protest OR data breach"


def generate_hash(text):
    """
    Generates SHA256 hash for duplicate detection
    """
    return hashlib.sha256(text.encode()).hexdigest()


def is_duplicate(db, content_hash):
    """
    Checks if content already exists
    """
    return db.query(RawOSINT).filter(
        RawOSINT.extra_metadata["content_hash"].astext == content_hash
    ).first()


def collect_news():
    logging.info("Starting News API ingestion...")

    url = (
        f"https://newsapi.org/v2/everything?"
        f"q={SEARCH_QUERY}&"
        f"language=en&"
        f"sortBy=publishedAt&"
        f"apiKey={NEWS_API_KEY}"
    )

    response = requests.get(url)

    if response.status_code != 200:
        logging.error(f"Status Code: {response.status_code}")
        logging.error(f"Response: {response.text}")
    return


    articles = response.json().get("articles", [])
    db = SessionLocal()

    inserted_count = 0

    try:
        for article in articles:
            content = article.get("description") or article.get("title")

            if not content:
                continue

            content_hash = generate_hash(content)

            # Duplicate check
            if is_duplicate(db, content_hash):
                continue

            new_record = RawOSINT(
                source="newsapi",
                content=content,
                url=article.get("url"),
                extra_metadata={
                    "author": article.get("author"),
                    "published_at": article.get("publishedAt"),
                    "source_name": article.get("source", {}).get("name"),
                    "content_hash": content_hash,
                    "collected_at": datetime.utcnow().isoformat()
                }
            )

            db.add(new_record)
            inserted_count += 1

        db.commit()
        logging.info(f"Inserted {inserted_count} new records.")

    except Exception as e:
        db.rollback()
        logging.error(f"Error during ingestion: {e}")

    finally:
        db.close()
