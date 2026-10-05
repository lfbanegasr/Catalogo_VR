from . import adaptive_editorial, adaptive_minimal, adaptive_organic, adaptive_photographic


TEMPLATE_RENDERERS = {
    "minimal": adaptive_minimal,
    "organic": adaptive_organic,
    "editorial": adaptive_editorial,
    "photographic": adaptive_photographic,
}

__all__ = ["TEMPLATE_RENDERERS"]
