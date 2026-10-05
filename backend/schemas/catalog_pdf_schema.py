from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from schemas.catalog_pdf_edit_schema import CatalogPdfPageOverride, CatalogPdfProductOverride


HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class CatalogPdfRequest(BaseModel):
    category_ids: list[UUID] = Field(default_factory=list)
    include_descendants: bool = True
    include_uncategorized: bool = True
    only_active_products: bool = True
    show_cover: bool = True
    show_description: bool = False
    show_attributes: bool = False
    template: Literal["minimal", "organic", "editorial", "photographic"] = "minimal"
    products_per_page: Literal[2, 3, 4] = 4
    sort_by: Literal["name", "price_asc", "price_desc", "newest"] = "name"
    title: str | None = Field(default=None, max_length=100)
    subtitle: str | None = Field(default=None, max_length=180)
    primary_color: str = Field(default="#9E4B63", pattern=HEX_COLOR_PATTERN)
    secondary_color: str = Field(default="#D8A9B6", pattern=HEX_COLOR_PATTERN)
    background_color: str = Field(default="#F8F5F2", pattern=HEX_COLOR_PATTERN)
    gradient_end_color: str = Field(default="#F1E4E8", pattern=HEX_COLOR_PATTERN)
    text_color: str = Field(default="#2D2630", pattern=HEX_COLOR_PATTERN)
    muted_color: str = Field(default="#746A75", pattern=HEX_COLOR_PATTERN)
    price_color: str = Field(default="#9E4B63", pattern=HEX_COLOR_PATTERN)
    background_style: Literal["solid", "gradient", "organic", "editorial"] = "gradient"
    decorative_intensity: Literal["subtle", "balanced"] = "balanced"
    price_style: Literal["circle", "pill", "block"] = "pill"
    image_shape: Literal["auto", "square", "rounded", "circle"] = "auto"
    image_fit: Literal["auto", "contain", "cover"] = "auto"
    cover_url: str | None = Field(default=None, max_length=1000)
    cover_fit: Literal["contain", "cover"] = "cover"
    cover_text_overlay: bool = False
    smart_layout: bool = True
    smart_image_analysis: bool = True
    use_florence: bool = False
    enable_background_removal: bool = False
    product_overrides: list[CatalogPdfProductOverride] = Field(default_factory=list, max_length=250)
    page_overrides: list[CatalogPdfPageOverride] = Field(default_factory=list, max_length=250)

    @field_validator("title", "subtitle")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None
