import hashlib
from sqlalchemy import cast, String

from datetime import datetime
from database import SessionLocal
from models import RawOSINT
import logging

def generate_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()


def insert_record(source, content, url=None, metadata=None):
    db = SessionLocal()

    try:
        content_hash = generate_hash(content)

        # Duplicate check
        existing = db.query(RawOSINT).filter(
            RawOSINT.extra_metadata["content_hash"].astext == content_hash
        ).first()

        if existing:
            return False

        new_record = RawOSINT(
            source=source,
            content=content,
            url=url,
            extra_metadata={
                **(metadata or {}),
                "content_hash": content_hash,
                "collected_at": datetime.utcnow().isoformat()
            }
        )

        db.add(new_record)
        db.commit()
        return True

    except Exception as e:
        db.rollback()
        logging.error(f"Insertion error: {e}")
        return False

    finally:
        db.close()
