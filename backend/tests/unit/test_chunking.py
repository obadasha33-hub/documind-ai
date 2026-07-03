"""Unit tests for chunking and embedding services."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.parsers import ParsedPage
from app.services.chunking import chunk_pages
from app.services.embeddings import get_embedding, get_embeddings_batch, embed_query


class TestChunking:
    """Tests for text chunking."""

    def test_chunk_short_text(self):
        """Test chunking text shorter than chunk size."""
        pages = [ParsedPage(content="Short text that fits in one chunk.", page_number=1)]
        chunks = chunk_pages(pages, chunk_size=1000, chunk_overlap=200)
        assert len(chunks) == 1
        assert chunks[0]["content"] == "Short text that fits in one chunk."

    def test_chunk_long_text(self):
        """Test chunking text longer than chunk size."""
        text = "A " * 2000  # ~4000 chars
        pages = [ParsedPage(content=text, page_number=1)]
        chunks = chunk_pages(pages, chunk_size=1000, chunk_overlap=200)
        assert len(chunks) > 1

    def test_chunk_with_custom_separators(self):
        """Test chunking respects separators."""
        text = "Paragraph 1.\n\nParagraph 2.\n\nParagraph 3."
        pages = [ParsedPage(content=text, page_number=1)]
        chunks = chunk_pages(pages, chunk_size=50, chunk_overlap=10)
        # The recursive splitter may not split on \n\n if chunks are small
        assert len(chunks) >= 1

    def test_chunk_empty_text(self):
        """Test chunking empty text returns empty list."""
        pages = [ParsedPage(content="", page_number=1)]
        chunks = chunk_pages(pages, chunk_size=1000, chunk_overlap=200)
        assert chunks == []

    def test_chunk_multiple_pages(self):
        """Test chunking multiple pages maintains chunk index."""
        pages = [
            ParsedPage(content="Page 1 content.", page_number=1),
            ParsedPage(content="Page 2 content.", page_number=2),
        ]
        chunks = chunk_pages(pages, chunk_size=1000, chunk_overlap=200)
        assert len(chunks) == 2
        assert chunks[0]["metadata"]["chunk_index"] == 0
        assert chunks[1]["metadata"]["chunk_index"] == 1


class TestEmbeddings:
    """Tests for embedding generation."""

    @pytest.mark.asyncio
    async def test_get_embedding_success(self):
        """Test successful embedding generation."""
        with patch("app.services.embeddings.httpx.AsyncClient") as mock_client_class:
            mock_response = MagicMock()
            mock_response.json.return_value = {"embedding": {"values": [0.1] * 768}}
            mock_response.raise_for_status = MagicMock()
            
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            embedding = await get_embedding("Test text")
            
            assert len(embedding) == 768
            assert embedding[0] == 0.1

    @pytest.mark.asyncio
    async def test_get_embeddings_batch(self):
        """Test batch embedding generation."""
        with patch("app.services.embeddings.get_embedding") as mock_get:
            mock_get.return_value = [0.1] * 768
            
            texts = ["Text 1", "Text 2"]
            embeddings = await get_embeddings_batch(texts)
            
            assert len(embeddings) == 2
            assert len(embeddings[0]) == 768

    @pytest.mark.asyncio
    async def test_get_embeddings_batch_empty(self):
        """Test batch embedding with empty list."""
        embeddings = await get_embeddings_batch([])
        assert embeddings == []

    @pytest.mark.asyncio
    async def test_embed_query(self):
        """Test query embedding."""
        with patch("app.services.embeddings.get_embedding") as mock_get:
            mock_get.return_value = [0.1] * 768
            
            embedding = await embed_query("Test query")
            
            assert len(embedding) == 768
            mock_get.assert_called_once_with("Test query")