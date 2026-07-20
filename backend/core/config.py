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

    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 dia

    # Storage / assets
    # Dev: vacio para usar rutas relativas /uploads/...
    # Prod: ejemplo https://cdn.tudominio.com/products
    PRODUCT_IMAGE_BASE_URL: str = ""
    UPLOADS_DIR: str = "uploads"
    PUBLIC_ASSET_BASE_URL: str = ""

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


settings = Settings()

# Compatibilidad con imports directos existentes
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
