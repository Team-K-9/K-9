# =============================================
# parsers.py
# ---------------------------------------------
# ファイルからテキストを抽出する関数群。
# ・PDF: PyMuPDF
# ・Word: python-docx
# ・TXT/MD: そのまま読み込み
# =============================================
import os
import fitz  # PyMuPDF
import docx

SUPPORTED_EXTS = {".pdf", ".docx", ".txt", ".md"}

def load_text_from_file(path: str) -> str:
    """拡張子に応じてファイルを読み込み、プレーンテキストを返す。"""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return _read_pdf(path)
    if ext == ".docx":
        return _read_docx(path)
    if ext in {".txt", ".md"}:
        return _read_text(path)
    raise ValueError(f"Unsupported file type: {ext}")

def _read_pdf(path: str) -> str:
    doc = fitz.open(path)
    texts = []
    for page in doc:
        texts.append(page.get_text("text"))
    return "\n".join(texts)

def _read_docx(path: str) -> str:
    d = docx.Document(path)
    return "\n".join(p.text for p in d.paragraphs)

def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()
