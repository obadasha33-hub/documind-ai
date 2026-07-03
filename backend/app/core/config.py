"""Application configuration using pydantic-settings."""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Sentinel default; must be overridden in production or startup fails.
_DEFAULT_SECRET_KEY = "change-me-in-production-use-openssl-rand-hex-32"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        # "ignore" (not "allow") so typo'd env vars are dropped instead of
        # silently becoming attributes that mask real misconfiguration.
        extra="ignore",
    )

    # App
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = _DEFAULT_SECRET_KEY
    API_V1_PREFIX: str = "/api/v1"

    # Shared secret for the trusted server-to-server NextAuth bridge.
    # The Next.js server holds this and sends it as `X-Internal-Secret`;
    # the browser never sees it. Empty is allowed only outside production.
    INTERNAL_AUTH_SECRET: str = ""

    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 10

    # Database (Neon Postgres or local Docker)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/documind"

    # Redis (Upstash or local Docker) – disabled for native setup
    # REDIS_URL: str = "redis://localhost:***@documind.ai"

    # Gemini API (primary LLM + embeddings)
    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-2.0-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMENSIONS: int = 768  # Truncated from 3072

    # Groq API (fallback LLM)
    GROQ_API_KEY: str = ""
    GROQ_CHAT_MODEL: str = "llama-3.1-8b-instant"

    # Cloudflare R2 (document storage)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "documind-docs"
    R2_ENDPOINT_URL: str = ""  # https://{account_id}.r2.cloudflarestorage.com

    # Local filesystem storage (fallback when R2 not configured)
    LOCAL_UPLOAD_DIR: str = "uploads"

    # Resend (email) – optional
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@documind.ai"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",  # Next.js dev server
    ]

    # Auth
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Rate limits
    FREE_QUERIES_PER_DAY: int = 20
    PRO_QUERIES_PER_DAY: int = 500
    FREE_DOCUMENTS_LIMIT: int = 5
    PRO_DOCUMENTS_LIMIT: int = 50

    @property
    def r2_endpoint(self) -> str:
        """Return the R2 endpoint URL, either overridden via R2_ENDPOINT_URL or constructed from ACCOUNT_ID."""
        if self.R2_ENDPOINT_URL:
            return self.R2_ENDPOINT_URL
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    @model_validator(mode="after")
    def _enforce_production_safety(self) -> "Settings":
        """Fail fast if the app is booted in production with insecure defaults."""
        if self.ENVIRONMENT == "production":
            problems: list[str] = []
            # Reject the known sentinel AND anything too short/low-entropy to be
            # a real `openssl rand -hex 32` output (64 chars) — a placeholder
            # like "local-dev-secret-change-in-prod" (31 chars) would otherwise
            # slip past an exact-match-only check.
            if self.SECRET_KEY == _DEFAULT_SECRET_KEY or len(self.SECRET_KEY) < 32:
                problems.append(
                    "SECRET_KEY must be a real random value, >=32 chars "
                    "(run `openssl rand -hex 32`)"
                )
            if not self.INTERNAL_AUTH_SECRET or len(self.INTERNAL_AUTH_SECRET) < 32:
                problems.append(
                    "INTERNAL_AUTH_SECRET must be a real random value, >=32 chars "
                    "(run `openssl rand -hex 32`)"
                )
            if self.DEBUG:
                problems.append("DEBUG must be False in production")
            if problems:
                raise ValueError(
                    "Insecure production configuration: " + "; ".join(problems)
                )
        return self


settings = Settings()
