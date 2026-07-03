"""Integration tests for documents API endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock
from io import BytesIO

from app.main import app
from app.models.document import Document, DocumentStatus
from app.models.tenant import Tenant


@pytest.mark.asyncio
class TestDocumentsAPI:
    """Tests for document endpoints."""

    async def test_upload_document_success(self, async_client: AsyncClient, auth_headers, test_tenant, sample_pdf_content):
        """Test successful document upload schedules background processing."""
        with patch("app.api.documents.upload_file", new_callable=AsyncMock) as mock_upload, \
             patch("app.api.documents.process_document", new_callable=AsyncMock) as mock_process:

            mock_upload.return_value = None

            files = {"file": ("test.pdf", BytesIO(sample_pdf_content), "application/pdf")}
            response = await async_client.post(
                "/api/v1/documents/upload",
                files=files,
                headers=auth_headers
            )

        assert response.status_code == 201
        data = response.json()
        assert data["filename"] == "test.pdf"
        # Upload returns immediately; processing runs in the background.
        assert data["status"] == "processing"
        mock_upload.assert_awaited_once()
        mock_process.assert_awaited_once()

    async def test_upload_document_invalid_type(self, async_client: AsyncClient, auth_headers):
        """Test upload with unsupported file type fails."""
        files = {"file": ("test.xyz", BytesIO(b"content"), "application/xyz")}
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "unsupported" in response.json()["detail"].lower()

    async def test_upload_document_too_large(self, async_client: AsyncClient, auth_headers):
        """Test upload exceeding size limit fails."""
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        files = {"file": ("large.pdf", BytesIO(large_content), "application/pdf")}
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            headers=auth_headers
        )
        assert response.status_code == 413

    async def test_list_documents(self, async_client: AsyncClient, auth_headers, test_documents):
        """Test listing documents."""
        response = await async_client.get(
            "/api/v1/documents/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "documents" in data
        assert "total" in data

    async def test_get_document(self, async_client: AsyncClient, auth_headers, test_document):
        """Test getting a specific document."""
        response = await async_client.get(
            f"/api/v1/documents/{test_document.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_document.id)

    async def test_get_document_not_found(self, async_client: AsyncClient, auth_headers):
        """Test getting non-existent document returns 404."""
        response = await async_client.get(
            "/api/v1/documents/00000000-0000-0000-0000-000000000000",
            headers=auth_headers
        )
        assert response.status_code == 404

    async def test_delete_document(self, async_client: AsyncClient, auth_headers, test_document):
        """Test deleting a document."""
        with patch("app.services.storage.delete_file") as mock_delete:
            mock_delete.return_value = None
            response = await async_client.delete(
                f"/api/v1/documents/{test_document.id}",
                headers=auth_headers
            )
        assert response.status_code == 204