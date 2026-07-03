"""Text chunking service — split documents into overlapping chunks."""

from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..services.parsers import ParsedPage


def chunk_pages(
    pages: list[ParsedPage],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[dict]:
    """
    Split document pages into chunks.

    Returns a list of dicts: {content, chunk_index, metadata}
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = []
    chunk_index = 0

    for page in pages:
        page_chunks = splitter.split_text(page.content)
        for text in page_chunks:
            chunks.append({
                "content": text,
                "chunk_index": chunk_index,
                "metadata": {
                    **(page.metadata or {}),
                    "chunk_index": chunk_index,
                },
            })
            chunk_index += 1

    return chunks
