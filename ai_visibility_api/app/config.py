"""
Configuration objects for the AI Visibility Intelligence API.

We use a single Config class driven entirely by environment variables so that
the same codebase works identically across local dev, CI, and Docker without
code changes -- only .env / environment differs.
"""
import os


def _bool_env(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///dev.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    # --- AI provider / model selection per agent ---
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    XAI_API_KEY = os.environ.get("XAI_API_KEY")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

    DISCOVERY_AGENT_PROVIDER = os.environ.get("DISCOVERY_AGENT_PROVIDER", "anthropic")
    DISCOVERY_AGENT_MODEL = os.environ.get("DISCOVERY_AGENT_MODEL", "claude-sonnet-4-6")

    SCORING_AGENT_PROVIDER = os.environ.get("SCORING_AGENT_PROVIDER", "anthropic")
    SCORING_AGENT_MODEL = os.environ.get("SCORING_AGENT_MODEL", "claude-sonnet-4-6")

    RECOMMENDATION_AGENT_PROVIDER = os.environ.get("RECOMMENDATION_AGENT_PROVIDER", "anthropic")
    RECOMMENDATION_AGENT_MODEL = os.environ.get("RECOMMENDATION_AGENT_MODEL", "claude-sonnet-4-6")

    # --- DataForSEO ---
    DATAFORSEO_LOGIN = os.environ.get("DATAFORSEO_LOGIN")
    DATAFORSEO_PASSWORD = os.environ.get("DATAFORSEO_PASSWORD")
    DATAFORSEO_BASE_URL = os.environ.get("DATAFORSEO_BASE_URL", "https://api.dataforseo.com")
    FORCE_MOCK_DATA_PROVIDER = _bool_env("FORCE_MOCK_DATA_PROVIDER", False)

    # --- Rate limiting ---
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # --- CORS (frontend origin) ---
    # Comma-separated list, e.g. "http://localhost:5173,http://localhost:3000"
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

    # --- Pipeline tuning ---
    MIN_QUERIES_PER_RUN = int(os.environ.get("MIN_QUERIES_PER_RUN", 10))
    MAX_QUERIES_PER_RUN = int(os.environ.get("MAX_QUERIES_PER_RUN", 20))
    MAX_RECOMMENDATIONS_PER_RUN = int(os.environ.get("MAX_RECOMMENDATIONS_PER_RUN", 5))


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    FORCE_MOCK_DATA_PROVIDER = True
