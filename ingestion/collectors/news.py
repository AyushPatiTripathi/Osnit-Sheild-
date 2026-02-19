import requests
import logging
import os
import hashlib
from dotenv import load_dotenv

from database import SessionLocal
from models import RawOSINT

load_dotenv()

logging.basicConfig(level=logging.INFO)

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

SEARCH_QUERY = "cyberattack OR fraud OR protest OR data breach"


def generate_hash(source, content, url=""):
    """
    Generate a unique SHA256 hash for duplicate prevention.
    """
    raw_string = f"{source}|{content}|{url}"
    return hashlib.sha256(raw_string.encode()).hexdigest()


def collect_news():
    logging.info("Starting News API ingestion...")

    if not NEWS_API_KEY:
        logging.error("NEWS_API_KEY not found in environment.")
        return

    params = {
        "q": SEARCH_QUERY,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 10,
        "apiKey": NEWS_API_KEY
    }

    response = requests.get(
        "https://newsapi.org/v2/everything",
        params=params
    )

    print("Status Code:", response.status_code)

    if response.status_code != 200:
        print("Error Response:", response.text)
        return

    data = response.json()
    print("Total Results:", data.get("totalResults"))

    articles = data.get("articles", [])
    print("Articles Length:", len(articles))

    if not articles:
        print("No articles returned.")
        return

    db = SessionLocal()
    inserted_count = 0

    try:
        for article in articles:
            content = article.get("description") or article.get("title")

            if not content:
                continue

            content_hash = generate_hash(
                "newsapi",
                content,
                article.get("url")
            )

            # Duplicate pre-check
            existing = db.query(RawOSINT).filter(
                RawOSINT.content_hash == content_hash
            ).first()

            if existing:
                continue

            new_record = RawOSINT(
                source="newsapi",
                content=content,
                url=article.get("url"),
                content_hash=content_hash,
                extra_metadata={
                    "author": article.get("author"),
                    "published_at": article.get("publishedAt"),
                    "source_name": article.get("source", {}).get("name")
                }
            )

            db.add(new_record)
            inserted_count += 1

        db.commit()
        print(f"Inserted {inserted_count} records successfully.")

    except Exception as e:
        db.rollback()
        print("Unexpected insertion error:", e)

    finally:
        db.close()


if __name__ == "__main__":
    collect_news()

