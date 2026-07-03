"""Integration tests for chat API endpoints."""

import json

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.main import app
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.document import Document


@pytest.mark.asyncio
class TestChatAPI:
    """Tests for chat endpoints."""

    @staticmethod
    def _mock_rag_result():
        return {
            "answer": "DocuMind is a multi-tenant RAG platform. [Source: test.pdf, page 1]",
            "sources": [
                {
                    "chunk_id": "chunk-1",
                    "document_id": "doc-1",
                    "document_name": "test.pdf",
                    "content": "DocuMind is a multi-tenant RAG platform.",
                    "score": 0.91,
                    "page": 1,
                }
            ],
            "confidence_score": 1.0,
            "model_used": "gemini-2.0-flash",
        }

    async def test_send_message_new_conversation(self, async_client: AsyncClient, auth_headers):
        """Test sending a message creates a new conversation and runs RAG."""
        with patch("app.api.chat.rag_query", new_callable=AsyncMock) as mock_rag:
            mock_rag.return_value = self._mock_rag_result()
            response = await async_client.post(
                "/api/v1/chat/query",
                json={"message": "What is DocuMind?"},
                headers=auth_headers
            )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["conversation_id"]  # frontend needs this to continue the thread
        # The real RAG answer is returned (not a placeholder), with citations.
        assert data["content"] == self._mock_rag_result()["answer"]
        assert data["sources"] and data["sources"][0]["document_name"] == "test.pdf"
        assert data["model_used"] == "gemini-2.0-flash"
        mock_rag.assert_awaited_once()

    async def test_send_message_existing_conversation(self, async_client: AsyncClient, auth_headers, test_chat_session):
        """Test sending a message to an existing conversation."""
        with patch("app.api.chat.rag_query", new_callable=AsyncMock) as mock_rag:
            mock_rag.return_value = self._mock_rag_result()
            response = await async_client.post(
                "/api/v1/chat/query",
                json={"message": "Follow up question", "conversation_id": test_chat_session.id},
                headers=auth_headers
            )
        assert response.status_code == 200
        data = response.json()
        assert "content" in data

    async def test_stream_message(self, async_client: AsyncClient, auth_headers, db_engine):
        """Test streaming a chat response emits delta + done SSE events and
        persists the assistant message via the generator's own DB session."""

        async def fake_rag_query_stream(query, tenant_id, db, top_k=5):
            yield {"type": "delta", "text": "DocuMind "}
            yield {"type": "delta", "text": "is a RAG platform."}
            yield {
                "type": "done",
                "answer": "DocuMind is a RAG platform.",
                "sources": [self._mock_rag_result()["sources"][0]],
                "confidence_score": 0.95,
                "model_used": "gemini-2.0-flash",
            }

        # The streaming endpoint deliberately opens its own DB session (see
        # chat.py comment) instead of reusing the request-scoped one, so we
        # point it at the same in-memory test engine to verify persistence.
        test_session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

        with patch("app.api.chat.rag_query_stream", new=fake_rag_query_stream), \
             patch("app.api.chat.async_session_factory", test_session_factory):
            async with async_client.stream(
                "POST",
                "/api/v1/chat/stream",
                json={"message": "What is DocuMind?"},
                headers=auth_headers,
            ) as response:
                assert response.status_code == 200
                body = ""
                async for chunk in response.aiter_text():
                    body += chunk

        assert "event: delta" in body
        assert "DocuMind " in body
        assert "is a RAG platform." in body
        assert "event: done" in body
        assert "gemini-2.0-flash" in body

        # Extract the final `done` payload and confirm the assistant message
        # was actually persisted (not just streamed).
        done_line = [ln for ln in body.splitlines() if ln.startswith("data:") and "gemini" in ln][0]
        done_payload = json.loads(done_line[len("data:"):].strip())
        assert done_payload["confidence_score"] == 0.95
        assert done_payload["conversation_id"]  # frontend needs this to continue the thread

        async with test_session_factory() as verify_session:
            from sqlalchemy import select
            result = await verify_session.execute(
                select(Message).where(Message.id == done_payload["id"])
            )
            saved = result.scalar_one()
            assert saved.content == "DocuMind is a RAG platform."
            assert saved.model_used == "gemini-2.0-flash"

    async def test_stream_message_error_event_on_failure(self, async_client: AsyncClient, auth_headers, db_engine):
        """If the RAG stream raises, the client gets an `error` SSE event, not a hang or 500."""

        async def failing_stream(query, tenant_id, db, top_k=5):
            yield {"type": "delta", "text": "partial..."}
            raise RuntimeError("upstream LLM exploded")

        test_session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

        with patch("app.api.chat.rag_query_stream", new=failing_stream), \
             patch("app.api.chat.async_session_factory", test_session_factory):
            async with async_client.stream(
                "POST",
                "/api/v1/chat/stream",
                json={"message": "Trigger failure"},
                headers=auth_headers,
            ) as response:
                assert response.status_code == 200
                body = "".join([chunk async for chunk in response.aiter_text()])

        assert "event: error" in body

    async def test_list_conversations(self, async_client: AsyncClient, auth_headers, test_chat_sessions):
        """Test listing conversations."""
        response = await async_client.get(
            "/api/v1/chat/conversations",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert "total" in data

    async def test_get_conversation_messages(self, async_client: AsyncClient, auth_headers, test_chat_session, test_chat_messages):
        """Test getting messages for a conversation."""
        response = await async_client.get(
            f"/api/v1/chat/conversations/{test_chat_session.id}/messages",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert all(m["conversation_id"] == test_chat_session.id for m in data)

    async def test_delete_conversation(self, async_client: AsyncClient, auth_headers, test_chat_session):
        """Test deleting a conversation."""
        response = await async_client.delete(
            f"/api/v1/chat/conversations/{test_chat_session.id}",
            headers=auth_headers
        )
        assert response.status_code == 204

    async def test_conversation_not_found(self, async_client: AsyncClient, auth_headers):
        """Test accessing non-existent conversation returns 404."""
        response = await async_client.get(
            "/api/v1/chat/conversations/00000000-0000-0000-0000-000000000000/messages",
            headers=auth_headers
        )
        assert response.status_code == 404