from fastapi import APIRouter
from database import SessionLocal
from models import RawOSINT

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("/")
def get_all_incidents(
    source: str = None,
    limit: int = 10,
    skip: int = 0
):
    db = SessionLocal()
    try:
        query = db.query(RawOSINT)

        if source:
            query = query.filter(RawOSINT.source == source)

        incidents = (
            query
            .order_by(RawOSINT.collected_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return [
            {
                "id": i.id,
                "source": i.source,
                "content": i.content,
                "url": i.url,
                "metadata": i.extra_metadata,
                "collected_at": i.collected_at
            }
            for i in incidents
        ]

    finally:
        db.close()

@router.get("/stats")
def get_stats():
    db = SessionLocal()
    try:
        total = db.query(RawOSINT).count()

        news_count = db.query(RawOSINT).filter(
            RawOSINT.source == "newsapi"
        ).count()

        return {
            "total_incidents": total,
            "newsapi_incidents": news_count
        }

    finally:
        db.close()
@router.get("/map")
def map_data():
    db = SessionLocal()
    try:
        records = db.query(RawOSINT)\
            .filter(
                RawOSINT.latitude != None,
                RawOSINT.longitude != None
            ).all()

        return {
            "incidents": [
                {
                    "id": r.id,
                    "incident_type": r.incident_type,
                    "risk_score": r.risk_score,
                    "latitude": r.latitude,
                    "longitude": r.longitude
                }
                for r in records
            ]
        }

    finally:
        db.close()

