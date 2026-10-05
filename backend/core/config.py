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
    CATALOG_AI_ENABLED: bool = False
    CATALOG_AI_MODEL: str = "microsoft/Florence-2-base"
    CATALOG_AI_ALLOW_DOWNLOAD: bool = False

    # ── Optimización de imágenes ──────────────────────────────────────────────
    # Tamaño máximo de archivo de entrada en bytes (por defecto 10 MB)
    IMAGE_MAX_INPUT_BYTES: int = 10 * 1024 * 1024
    # Dimensiones máximas permitidas en píxeles
    IMAGE_MAX_WIDTH: int = 4096
    IMAGE_MAX_HEIGHT: int = 4096
    # Límite total de píxeles (anti-decompression bomb). 25 MP por defecto.
    IMAGE_MAX_PIXELS: int = 25_000_000
    # Calidad WebP de salida (0-100). 82 ofrece buen equilibrio calidad/peso.
    IMAGE_WEBP_QUALITY: int = 82
    # Desactivar optimización (para tests o casos excepcionales)
    IMAGE_OPTIMIZE_ENABLED: bool = True

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
            raise RuntimeError("Configuración insegura de producción: " + "; ".join(problems))

    def validate_image_and_storage_config(self) -> None:
        problems: list[str] = []
        if self.IMAGE_MAX_INPUT_BYTES <= 0:
            problems.append("IMAGE_MAX_INPUT_BYTES debe ser mayor que 0")
        if self.IMAGE_MAX_WIDTH <= 0:
            problems.append("IMAGE_MAX_WIDTH debe ser mayor que 0")
        if self.IMAGE_MAX_HEIGHT <= 0:
            problems.append("IMAGE_MAX_HEIGHT debe ser mayor que 0")
        if self.IMAGE_MAX_PIXELS <= 0:
            problems.append("IMAGE_MAX_PIXELS debe ser mayor que 0")
        if not (1 <= self.IMAGE_WEBP_QUALITY <= 100):
            problems.append("IMAGE_WEBP_QUALITY debe estar entre 1 y 100")

        backend = (self.STORAGE_BACKEND or "").strip().lower()
        if backend not in ("local", "r2"):
            problems.append(f"STORAGE_BACKEND '{self.STORAGE_BACKEND}' no es válido. Solo se admite 'local' o 'r2'")
        elif backend == "r2":
            from urllib.parse import urlparse
            if not self.R2_ACCOUNT_ID:
                problems.append("R2_ACCOUNT_ID es obligatorio cuando STORAGE_BACKEND=r2")
            if not self.R2_ACCESS_KEY_ID:
                problems.append("R2_ACCESS_KEY_ID es obligatorio cuando STORAGE_BACKEND=r2")
            if not self.R2_SECRET_ACCESS_KEY:
                problems.append("R2_SECRET_ACCESS_KEY es obligatorio cuando STORAGE_BACKEND=r2")
            if not self.R2_BUCKET_NAME:
                problems.append("R2_BUCKET_NAME es obligatorio cuando STORAGE_BACKEND=r2")
            if not self.R2_ENDPOINT_URL:
                problems.append("R2_ENDPOINT_URL es obligatorio cuando STORAGE_BACKEND=r2")
            else:
                p_end = urlparse(self.R2_ENDPOINT_URL)
                if p_end.scheme not in ("http", "https") or not p_end.netloc:
                    problems.append("R2_ENDPOINT_URL debe ser una URL HTTP/HTTPS válida")
            if not self.R2_PUBLIC_BASE_URL:
                problems.append("R2_PUBLIC_BASE_URL es obligatorio cuando STORAGE_BACKEND=r2")
            else:
                p_pub = urlparse(self.R2_PUBLIC_BASE_URL)
                if p_pub.scheme not in ("http", "https") or not p_pub.netloc:
                    problems.append("R2_PUBLIC_BASE_URL debe ser una URL HTTP/HTTPS válida")

        if problems:
            raise ValueError("Configuración inválida de almacenamiento e imágenes: " + "; ".join(problems))


settings = Settings()

# Compatibilidad con imports directos existentes
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
