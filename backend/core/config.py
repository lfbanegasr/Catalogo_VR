from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Backend Tienda SaaS"
    PROJECT_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_POOL_RECYCLE_SECONDS: int = 1800

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 dia

    # HTTP / reverse proxy security
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )
    CORS_ALLOW_ORIGIN_REGEX: str = ""
    ALLOWED_HOSTS: str = "localhost,127.0.0.1,testserver"
    TRUST_PROXY_HEADERS: bool = False
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_AUTH_PER_MINUTE: int = 8
    RATE_LIMIT_CHECKOUT_PER_MINUTE: int = 20
    RATE_LIMIT_EVENTS_PER_MINUTE: int = 120
    RATE_LIMIT_PUBLIC_PER_MINUTE: int = 180

    # Storage / assets
    # Dev: vacio para usar rutas relativas /uploads/...
    # Prod: ejemplo https://cdn.tudominio.com/products
    PRODUCT_IMAGE_BASE_URL: str = ""
    UPLOADS_DIR: str = "uploads"
    PUBLIC_ASSET_BASE_URL: str = ""
    STORAGE_BACKEND: str = "local"
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ENDPOINT_URL: str = ""
    R2_PUBLIC_BASE_URL: str = ""

    @property
    def UPLOADS_PATH(self) -> Path:
        p = Path(self.UPLOADS_DIR)
        if not p.is_absolute():
            # Resolve relative to the backend root directory (parent of core/)
            p = Path(__file__).resolve().parents[1] / p
        return p.expanduser().resolve()

    @property
    def PRODUCTS_UPLOAD_PATH(self) -> Path:
        return self.UPLOADS_PATH / "products"

    @property
    def OFFERS_UPLOAD_PATH(self) -> Path:
        return self.UPLOADS_PATH / "offers"

    @property
    def THEME_UPLOAD_PATH(self) -> Path:
        return self.UPLOADS_PATH / "theme"

    # Password reset
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    PASSWORD_RESET_URL_BASE: str = "http://localhost:5174/admin/reset-password"
    PASSWORD_RESET_DEBUG_RETURN_TOKEN: bool = False

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip().rstrip("/") for item in self.CORS_ORIGINS.split(",") if item.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return [item.strip() for item in self.ALLOWED_HOSTS.split(",") if item.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    def validate_runtime_security(self) -> None:
        if not self.is_production:
            return
        problems: list[str] = []
        if len(self.SECRET_KEY) < 32 or self.SECRET_KEY.lower() in {"change_me", "secret", "changeme"}:
            problems.append("SECRET_KEY debe ser aleatoria y tener al menos 32 caracteres")
        if not self.cors_origins:
            problems.append("CORS_ORIGINS debe declarar los frontends permitidos")
        if any(origin == "*" or not origin.startswith("https://") for origin in self.cors_origins):
            problems.append("CORS_ORIGINS de producci?n solo admite or?genes HTTPS expl?citos")
        if self.CORS_ALLOW_ORIGIN_REGEX:
            problems.append("CORS_ALLOW_ORIGIN_REGEX debe quedar vac?o en producci?n")
        if not self.allowed_hosts or "*" in self.allowed_hosts:
            problems.append("ALLOWED_HOSTS debe declarar hosts expl?citos en producci?n")
        if self.PASSWORD_RESET_DEBUG_RETURN_TOKEN:
            problems.append("PASSWORD_RESET_DEBUG_RETURN_TOKEN debe ser false en producci?n")
        if problems:
            raise RuntimeError("Configuraci?n insegura de producci?n: " + "; ".join(problems))


settings = Settings()

# Compatibilidad con imports directos existentes
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
