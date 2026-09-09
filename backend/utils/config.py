import os
from typing import List
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(".env")
    load_dotenv("backend/.env")
except ImportError:
    pass



class Settings(BaseModel):
    PROJECT_NAME: str = "quantum_route_ai"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Database: Default to local SQLite fallback if PostgreSQL is not specified
    DATABASE_URL: str = Field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./quantum_route_ai.db")
    )

    # Redis: Fallback to in-memory mock if Redis is unavailable
    REDIS_URL: str = Field(
        default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0")
    )
    USE_IN_MEMORY_REDIS_FALLBACK: bool = True

    # Security & JWT
    SECRET_KEY: str = Field(
        default_factory=lambda: os.getenv("SECRET_KEY", "quantum_super_secure_secret_key_2026_qaoa_vrp")
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Celery
    CELERY_BROKER_URL: str = Field(
        default_factory=lambda: os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    )
    CELERY_RESULT_BACKEND: str = Field(
        default_factory=lambda: os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
    )
    CELERY_ALWAYS_EAGER: bool = Field(
        default_factory=lambda: os.getenv("CELERY_ALWAYS_EAGER", "True").lower() in ("true", "1", "yes")
    )

    # Cloud Quantum Provider Tokens (IBM Quantum, AWS Braket)
    QISKIT_IBM_TOKEN: str = Field(
        default_factory=lambda: os.getenv("QISKIT_IBM_TOKEN", "your_ibm_quantum_token")
    )
    AWS_BRAKET_BUCKET: str = Field(
        default_factory=lambda: os.getenv("AWS_BRAKET_BUCKET", "your_aws_braket_bucket")
    )

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ]


settings = Settings()
