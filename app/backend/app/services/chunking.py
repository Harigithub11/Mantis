"""Sentence-aware chunking. Adapted from the MOSS reference app
(moss/apps/moss-llamaindex/backend/main.py): ~400 words per chunk with a small
sentence overlap. Falls back to a regex splitter if NLTK punkt is unavailable.
"""
import logging
import re

logger = logging.getLogger(__name__)

# Best-effort: make sure the NLTK sentence tokenizer data is present.
try:
    import nltk

    for pkg in ("punkt_tab", "punkt"):
        try:
            nltk.data.find(f"tokenizers/{pkg}")
        except LookupError:
            try:
                nltk.download(pkg, quiet=True)
            except Exception:
                pass
except Exception:  # pragma: no cover
    nltk = None


def _split_sentences(text: str):
    if nltk is not None:
        try:
            from nltk.tokenize import sent_tokenize

            return sent_tokenize(text)
        except Exception as e:
            logger.warning(f"nltk sent_tokenize failed ({e}); using regex fallback")
    return re.split(r"(?<=[.!?])\s+", text)


def chunk_text(text: str, chunk_size_words: int = 400, overlap_sentences: int = 2):
    """Accumulate sentences up to ~chunk_size_words; carry overlap_sentences forward."""
    if chunk_size_words < 1:
        raise ValueError("chunk_size_words must be >= 1")
    overlap_sentences = max(0, min(overlap_sentences, max(1, chunk_size_words // 100)))

    sentences = [s.strip() for s in _split_sentences(text) if s.strip()]
    if not sentences:
        return []

    chunks = []
    i = 0
    while i < len(sentences):
        chunk_sentences = []
        word_count = 0
        start_idx = i
        while i < len(sentences):
            words = len(sentences[i].split())
            if not chunk_sentences:
                chunk_sentences.append(sentences[i])
                word_count += words
                i += 1
            elif word_count + words > chunk_size_words:
                break
            else:
                chunk_sentences.append(sentences[i])
                word_count += words
                i += 1
        chunks.append(" ".join(chunk_sentences))
        if i < len(sentences):
            i = max(i - overlap_sentences, start_idx + 1)
    return chunks
