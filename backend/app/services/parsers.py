"""Document parsers — extract text from PDF, DOCX, and Markdown files."""

from dataclasses import dataclass


@dataclass
class ParsedPage:
    """A single page/section extracted from a document."""
    page_number: int
    content: str
    metadata: dict | None = None


def parse_pdf(file_content: bytes) -> list[ParsedPage]:
    """Extract text from a PDF file using PyMuPDF."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_content, filetype="pdf")
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        if text.strip():
            pages.append(ParsedPage(
                page_number=page_num + 1,
                content=text,
                metadata={"page": page_num + 1, "total_pages": len(doc)},
            ))
    doc.close()
    return pages


def parse_docx(file_content: bytes) -> list[ParsedPage]:
    """Extract text from a DOCX file."""
    import io
    from docx import Document

    doc = Document(io.BytesIO(file_content))
    full_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

    if full_text.strip():
        return [ParsedPage(page_number=1, content=full_text, metadata={"type": "docx"})]
    return []


def parse_markdown(file_content: bytes) -> list[ParsedPage]:
    """Parse a Markdown file (treat as single page)."""
    text = file_content.decode("utf-8")
    if text.strip():
        return [ParsedPage(page_number=1, content=text, metadata={"type": "markdown"})]
    return []


def parse_document(file_content: bytes, file_type: str) -> list[ParsedPage]:
    """Route to the appropriate parser based on file type."""
    parsers = {
        "pdf": parse_pdf,
        "docx": parse_docx,
        "md": parse_markdown,
    }
    parser = parsers.get(file_type)
    if not parser:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser(file_content)
