from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class CatalogPdfProductOverride(BaseModel):
    product_id: UUID
    order: int = Field(default=0, ge=0, le=10000)
    image_fit: Literal["auto", "contain", "cover"] = "auto"
    image_position_x: int = Field(default=50, ge=0, le=100)
    image_position_y: int = Field(default=50, ge=0, le=100)
    image_zoom: int = Field(default=100, ge=80, le=200)
    show_name: bool = True
    show_description: bool | None = None
    show_attributes: bool | None = None
    price_display: Literal["badge", "plain", "hidden"] = "badge"
    remove_background: bool = False


class CatalogPdfPageOverride(BaseModel):
    category_id: UUID | None = None
    page_index: int = Field(default=0, ge=0, le=1000)
    background_style: Literal["solid", "gradient", "organic", "editorial"] | None = None
    background_color: str | None = Field(default=None, pattern=HEX_COLOR_PATTERN)
    gradient_end_color: str | None = Field(default=None, pattern=HEX_COLOR_PATTERN)
    primary_color: str | None = Field(default=None, pattern=HEX_COLOR_PATTERN)
    secondary_color: str | None = Field(default=None, pattern=HEX_COLOR_PATTERN)


class CatalogPdfAnalyzeRequest(BaseModel):
    product_ids: list[UUID] = Field(default_factory=list, max_length=250)
    use_florence: bool = False
