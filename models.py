from sqlalchemy import Column, Integer, Text, JSON, TIMESTAMP
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class RawOSINT(Base):
    __tablename__ = "raw_osint"

    id = Column(Integer, primary_key=True, index=True)

    source = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    url = Column(Text)

    # Proper duplicate handling column
    content_hash = Column(Text, unique=True, index=True)

    # JSON metadata column (DB column name remains "metadata")
    extra_metadata = Column("metadata", JSON)

    collected_at = Column(TIMESTAMP, server_default=func.now())

