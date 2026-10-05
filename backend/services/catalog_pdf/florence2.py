from __future__ import annotations

import importlib.util
import logging
from threading import Lock

from PIL import Image

from core.config import settings


logger = logging.getLogger("catalog_pdf.ai")
_LOCK = Lock()
_MODEL = None
_PROCESSOR = None
_DEVICE = "cpu"


def florence_status() -> dict:
    packages = all(importlib.util.find_spec(name) is not None for name in ("torch", "transformers"))
    enabled = bool(getattr(settings, "CATALOG_AI_ENABLED", False))
    return {
        "enabled": enabled,
        "packages_installed": packages,
        "available": enabled and packages,
        "model": getattr(settings, "CATALOG_AI_MODEL", "microsoft/Florence-2-base"),
        "allow_download": bool(getattr(settings, "CATALOG_AI_ALLOW_DOWNLOAD", False)),
        "loaded": _MODEL is not None,
    }


def _load_model():
    global _MODEL, _PROCESSOR, _DEVICE
    if _MODEL is not None and _PROCESSOR is not None:
        return _MODEL, _PROCESSOR, _DEVICE
    status = florence_status()
    if not status["available"]:
        raise RuntimeError("Florence-2 no esta disponible en este servidor")
    with _LOCK:
        if _MODEL is not None and _PROCESSOR is not None:
            return _MODEL, _PROCESSOR, _DEVICE
        import torch
        from transformers import AutoModelForCausalLM, AutoProcessor

        model_name = status["model"]
        local_only = not status["allow_download"]
        _PROCESSOR = AutoProcessor.from_pretrained(
            model_name,
            trust_remote_code=True,
            local_files_only=local_only,
        )
        _MODEL = AutoModelForCausalLM.from_pretrained(
            model_name,
            trust_remote_code=True,
            local_files_only=local_only,
        )
        _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        _MODEL = _MODEL.to(_DEVICE).eval()
        return _MODEL, _PROCESSOR, _DEVICE


def _run_task(image: Image.Image, task: str) -> object:
    import torch

    model, processor, device = _load_model()
    inputs = processor(text=task, images=image, return_tensors="pt")
    inputs = {key: value.to(device) for key, value in inputs.items()}
    with torch.inference_mode():
        generated = model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=512,
            num_beams=3,
            do_sample=False,
        )
    text = processor.batch_decode(generated, skip_special_tokens=False)[0]
    return processor.post_process_generation(text, task=task, image_size=image.size)


def analyze_with_florence(image: Image.Image) -> dict:
    try:
        caption = _run_task(image, "<DETAILED_CAPTION>")
        ocr = _run_task(image, "<OCR_WITH_REGION>")
        return {"available": True, "caption": caption, "ocr": ocr}
    except Exception as exc:
        logger.warning("Florence-2 no pudo analizar una imagen: %s", exc)
        return {"available": False, "error": str(exc)}
