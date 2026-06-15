"""Document parsing → per-page text. Citation-friendly (keeps page numbers) and
Presidio-free. Approach adapted from the PII project's DocumentProcessor:
  PDF: pdfplumber (primary) → PyPDF2 (fallback) → OCR (scanned PDFs)
  Image: Tesseract OCR
  Text: decode with encoding fallbacks
The PDF-OCR path (a stub in the original) is implemented here with pypdfium2.
"""
import io
import logging
from typing import Dict, List, Optional

import pdfplumber
import PyPDF2

logger = logging.getLogger(__name__)

try:
    import pytesseract
    from PIL import Image

    pytesseract.get_tesseract_version()
    OCR_AVAILABLE = True
except Exception as e:  # pragma: no cover
    OCR_AVAILABLE = False
    logger.warning(f"OCR unavailable: {e}")

try:
    import pypdfium2 as pdfium

    PDFIUM_AVAILABLE = True
except Exception:  # pragma: no cover
    PDFIUM_AVAILABLE = False

_IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp")


def detect_kind(file_bytes: bytes, filename: str, mime: Optional[str] = None) -> str:
    """Return 'pdf' | 'image' | 'text'."""
    name = (filename or "").lower()
    if file_bytes[:4] == b"%PDF" or name.endswith(".pdf") or mime == "application/pdf":
        return "pdf"
    if name.endswith(_IMG_EXT) or (mime or "").startswith("image/"):
        return "image"
    if file_bytes[:3] == b"\xff\xd8\xff" or file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image"
    return "text"


def _pdf_text_pages(file_bytes: bytes) -> List[Dict]:
    pages: List[Dict] = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                try:
                    # x_tolerance=1.5 restores word spacing that the default (3)
                    # drops on some fonts (e.g. words rendered glyph-by-glyph).
                    t = page.extract_text(x_tolerance=1.5) or ""
                except Exception:
                    t = ""
                pages.append({"page": i, "text": t.strip()})
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}")

    if not any(p["text"] for p in pages):
        pages = []
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for i, page in enumerate(reader.pages, start=1):
                try:
                    t = page.extract_text() or ""
                except Exception:
                    t = ""
                pages.append({"page": i, "text": t.strip()})
        except Exception as e:
            logger.warning(f"PyPDF2 failed: {e}")
    return pages


def _pdf_ocr_pages(file_bytes: bytes) -> List[Dict]:
    """Render PDF pages to images and OCR them (scanned/image-only PDFs)."""
    if not (OCR_AVAILABLE and PDFIUM_AVAILABLE):
        return []
    pages: List[Dict] = []
    try:
        pdf = pdfium.PdfDocument(file_bytes)
    except Exception as e:
        logger.warning(f"pypdfium2 open failed: {e}")
        return []
    try:
        for i in range(len(pdf)):
            try:
                pil = pdf[i].render(scale=2.0).to_pil()
                t = pytesseract.image_to_string(pil, lang="eng")
                pages.append({"page": i + 1, "text": (t or "").strip()})
            except Exception as e:
                logger.warning(f"OCR failed on page {i + 1}: {e}")
    finally:
        pdf.close()
    return pages


def extract_pages(file_bytes: bytes, filename: str, mime: Optional[str] = None) -> List[Dict]:
    """Return [{'page': int, 'text': str}] for text-bearing pages only."""
    kind = detect_kind(file_bytes, filename, mime)

    if kind == "pdf":
        pages = _pdf_text_pages(file_bytes)
        if not any(p["text"] for p in pages):
            logger.info("No text layer; attempting OCR on PDF")
            ocr = _pdf_ocr_pages(file_bytes)
            if ocr:
                pages = ocr
        return [p for p in pages if p["text"]]

    if kind == "image":
        if not OCR_AVAILABLE:
            return []
        try:
            t = pytesseract.image_to_string(Image.open(io.BytesIO(file_bytes)), lang="eng").strip()
            return [{"page": 1, "text": t}] if t else []
        except Exception as e:
            logger.warning(f"image OCR failed: {e}")
            return []

    # text
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            t = file_bytes.decode(enc).strip()
            return [{"page": 1, "text": t}] if t else []
        except UnicodeDecodeError:
            continue
    t = file_bytes.decode("utf-8", errors="replace").strip()
    return [{"page": 1, "text": t}] if t else []
