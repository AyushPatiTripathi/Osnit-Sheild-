from fastapi import APIRouter
from database import SessionLocal
from models import RawOSINT
from sqlalchemy import desc, text
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])


# ----------------------------------
# 1️⃣ Get Alerts
# ----------------------------------
@router.get("/alerts")
def get_alerts(limit: int = 20):
    db = SessionLocal()
    try:
        results = db.execute(
            text("""
                SELECT * FROM alerts
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            {"limit": limit}
        ).fetchall()

        return {"alerts": [dict(row._mapping) for row in results]}
    finally:
        db.close()


# ----------------------------------
# 2️⃣ Top Threats
# ----------------------------------
@router.get("/top-threats")
def top_threats(limit: int = 10):
    db = SessionLocal()
    try:
        records = db.query(RawOSINT) \
            .order_by(desc(RawOSINT.risk_score)) \
            .limit(limit) \
            .all()

        return {
            "top_threats": [
                {
                    "id": r.id,
                    "incident_type": r.incident_type,
                    "risk_score": r.risk_score,
                    "cluster_id": r.cluster_id
                }
                for r in records
            ]
        }
    finally:
        db.close()


# ----------------------------------
# 3️⃣ Cluster Summary
# ----------------------------------
@router.get("/clusters")
def cluster_summary():
    db = SessionLocal()
    try:
        results = db.execute(
            text("""
                SELECT cluster_id, COUNT(*) as count
                FROM raw_osint
                GROUP BY cluster_id
                ORDER BY count DESC
            """)
        ).fetchall()

        return {
            "clusters": [
                {
                    "cluster_id": row.cluster_id,
                    "incident_count": row.count
                }
                for row in results
            ]
        }
    finally:
        db.close()


# ----------------------------------
# 4️⃣ Cluster Details
# ----------------------------------
@router.get("/clusters/{cluster_id}")
def cluster_details(cluster_id: int):
    db = SessionLocal()
    try:
        records = db.query(RawOSINT) \
            .filter(RawOSINT.cluster_id == cluster_id) \
            .all()

        return {
            "cluster_id": cluster_id,
            "incidents": [
                {
                    "id": r.id,
                    "incident_type": r.incident_type,
                    "risk_score": r.risk_score,
                    "content": r.content[:200]
                }
                for r in records
            ]
        }
    finally:
        db.close()


# ----------------------------------
# 5️⃣ Similar Incidents
# ----------------------------------
@router.get("/incident/{incident_id}/similar")
def similar_incidents(incident_id: int, top_k: int = 5):
    db = SessionLocal()
    try:
        base_record = db.get(RawOSINT, incident_id)

        if not base_record or not base_record.embedding:
            return {"error": "Incident not found or embedding missing"}

        all_records = db.query(RawOSINT).filter(
            RawOSINT.embedding != None
        ).all()

        base_vector = np.array(base_record.embedding).reshape(1, -1)

        similarities = []

        for record in all_records:
            if record.id == incident_id:
                continue

            vector = np.array(record.embedding).reshape(1, -1)
            score = cosine_similarity(base_vector, vector)[0][0]
            similarities.append((record, score))

        similarities.sort(key=lambda x: x[1], reverse=True)

        return {
            "incident_id": incident_id,
            "similar_incidents": [
                {
                    "id": r.id,
                    "similarity_score": round(score, 3),
                    "risk_score": r.risk_score
                }
                for r, score in similarities[:top_k]
            ]
        }

    finally:
        db.close()
        
from sqlalchemy import text


@router.get("/trends")
def incident_trends():
    db = SessionLocal()
    try:
        results = db.execute(
            text("""
                SELECT date_trunc('hour', collected_at) as hour,
                       COUNT(*) as count
                FROM raw_osint
                WHERE collected_at >= NOW() - INTERVAL '24 hours'
                GROUP BY hour
                ORDER BY hour
            """)
        ).fetchall()

        return {
            "hourly_trends": [
                {
                    "hour": str(row.hour),
                    "incident_count": row.count
                }
                for row in results
            ]
        }

    finally:
        db.close()
from sqlalchemy import text


@router.get("/spikes")
def detect_spikes():
    db = SessionLocal()
    try:
        # Last 1 hour count
        recent = db.execute(
            text("""
                SELECT incident_type, COUNT(*) as cnt
                FROM raw_osint
                WHERE collected_at >= NOW() - INTERVAL '1 hour'
                GROUP BY incident_type
            """)
        ).fetchall()

        # Previous 1 hour count
        previous = db.execute(
            text("""
                SELECT incident_type, COUNT(*) as cnt
                FROM raw_osint
                WHERE collected_at >= NOW() - INTERVAL '2 hour'
                  AND collected_at < NOW() - INTERVAL '1 hour'
                GROUP BY incident_type
            """)
        ).fetchall()

        prev_dict = {row.incident_type: row.cnt for row in previous}

        spikes = []

        for row in recent:
            prev_count = prev_dict.get(row.incident_type, 0)

            if prev_count > 0:
                growth = (row.cnt - prev_count) / prev_count

                if growth > 0.5:  # 50% growth threshold
                    spikes.append({
                        "incident_type": row.incident_type,
                        "previous_count": prev_count,
                        "current_count": row.cnt,
                        "growth_rate": round(growth, 2)
                    })

        return {"spikes": spikes}

    finally:
        db.close()
@router.get("/summary")
def analytics_summary():
    db = SessionLocal()
    try:
        # ---------------------------
        # 1️⃣ Total Incidents
        # ---------------------------
        total = db.execute(
            text("SELECT COUNT(*) FROM raw_osint")
        ).scalar()

        # ---------------------------
        # 2️⃣ Severity Breakdown
        # ---------------------------
        severity_counts = db.execute(
            text("""
                SELECT severity, COUNT(*) as cnt
                FROM raw_osint
                GROUP BY severity
            """)
        ).fetchall()

        severity_breakdown = {
            row.severity: row.cnt for row in severity_counts
        }

        # ---------------------------
        # 3️⃣ Top Incident Types
        # ---------------------------
        top_types = db.execute(
            text("""
                SELECT incident_type, COUNT(*) as cnt
                FROM raw_osint
                GROUP BY incident_type
                ORDER BY cnt DESC
                LIMIT 5
            """)
        ).fetchall()

        # ---------------------------
        # 4️⃣ Top Clusters
        # ---------------------------
        top_clusters = db.execute(
            text("""
                SELECT cluster_id, COUNT(*) as cnt
                FROM raw_osint
                GROUP BY cluster_id
                ORDER BY cnt DESC
                LIMIT 5
            """)
        ).fetchall()

        # ---------------------------
        # 5️⃣ Average Risk Score
        # ---------------------------
        avg_risk = db.execute(
            text("SELECT AVG(risk_score) FROM raw_osint")
        ).scalar()

        # ---------------------------
        # 6️⃣ Alerts Count
        # ---------------------------
        alert_count = db.execute(
            text("SELECT COUNT(*) FROM alerts")
        ).scalar()

        # ---------------------------
        # 7️⃣ Last 24h Incident Count
        # ---------------------------
        last_24h = db.execute(
            text("""
                SELECT COUNT(*)
                FROM raw_osint
                WHERE collected_at >= NOW() - INTERVAL '24 hours'
            """)
        ).scalar()

        return {
            "total_incidents": total,
            "severity_breakdown": severity_breakdown,
            "top_incident_types": [
                {"incident_type": row.incident_type, "count": row.cnt}
                for row in top_types
            ],
            "top_clusters": [
                {"cluster_id": row.cluster_id, "incident_count": row.cnt}
                for row in top_clusters
            ],
            "average_risk_score": round(avg_risk, 3) if avg_risk else 0,
            "total_alerts": alert_count,
            "incidents_last_24h": last_24h
        }

    finally:
        db.close()
