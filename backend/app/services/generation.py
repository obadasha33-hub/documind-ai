"""RAG generation service — orchestrates retrieval + LLM generation."""

import re
from typing import AsyncGenerator

import structlog

from ..services.retrieval import hybrid_search
from ..services.llm import generate, generate_stream
from ..services.prompts import build_rag_prompt

logger = structlog.get_logger()


async def rag_query(
    query: str,
    tenant_id: str,
    db,
    top_k: int = 5,
) -> dict:
    """
    Full RAG pipeline: retrieve -> build prompt -> generate -> verify.

    Returns:
        {
            "answer": str,
            "sources": list[dict],
            "confidence_score": float,
            "model_used": str,
        }
    """
    # 1. Retrieve relevant chunks
    search_results = await hybrid_search(query, tenant_id, db, top_k=top_k)

    if not search_results:
        return {
            "answer": "I couldn't find any relevant information in your documents for this question. "
                      "Try uploading more documents or rephrasing your question.",
            "sources": [],
            "confidence_score": 0.0,
            "model_used": "none",
        }

    # 2. Build prompt with context
    system_prompt, messages = build_rag_prompt(query, search_results)

    # 3. Generate response
    answer, model_used = await generate(messages, system_prompt=system_prompt)

    # 4. Hallucination guardrail: verify cited sources exist in context
    confidence = verify_citations(answer, search_results)

    # 5. Format sources
    sources = [
        {
            "chunk_id": r["chunk_id"],
            "document_id": r["document_id"],
            "document_name": r["document_name"],
            "content": r["content"][:300] + "..." if len(r["content"]) > 300 else r["content"],
            "score": r["score"],
            "page": r.get("page"),
        }
        for r in search_results
    ]

    return {
        "answer": answer,
        "sources": sources,
        "confidence_score": confidence,
        "model_used": model_used,
    }


async def rag_query_stream(
    query: str,
    tenant_id: str,
    db,
    top_k: int = 5,
) -> AsyncGenerator[dict, None]:
    """
    Streaming RAG pipeline: retrieve -> build prompt -> stream generation -> verify.

    Yields dicts of the form:
      {"type": "delta", "text": str}                      -- zero or more
      {"type": "done", "answer": str, "sources": list[dict],
       "confidence_score": float, "model_used": str}       -- exactly one, last
    """
    search_results = await hybrid_search(query, tenant_id, db, top_k=top_k)

    if not search_results:
        answer = (
            "I couldn't find any relevant information in your documents for this question. "
            "Try uploading more documents or rephrasing your question."
        )
        yield {"type": "delta", "text": answer}
        yield {
            "type": "done",
            "answer": answer,
            "sources": [],
            "confidence_score": 0.0,
            "model_used": "none",
        }
        return

    system_prompt, messages = build_rag_prompt(query, search_results)

    full_answer_parts: list[str] = []
    model_used = "unknown"
    async for delta, model in generate_stream(messages, system_prompt=system_prompt):
        full_answer_parts.append(delta)
        model_used = model
        yield {"type": "delta", "text": delta}

    full_answer = "".join(full_answer_parts)
    confidence = verify_citations(full_answer, search_results)

    sources = [
        {
            "chunk_id": r["chunk_id"],
            "document_id": r["document_id"],
            "document_name": r["document_name"],
            "content": r["content"][:300] + "..." if len(r["content"]) > 300 else r["content"],
            "score": r["score"],
            "page": r.get("page"),
        }
        for r in search_results
    ]

    yield {
        "type": "done",
        "answer": full_answer,
        "sources": sources,
        "confidence_score": confidence,
        "model_used": model_used,
    }


def verify_citations(answer: str, sources: list[dict]) -> float:
    """
    Simple hallucination guardrail: check if cited source names exist in the provided sources.
    Returns a confidence score between 0 and 1.
    """
    if not sources:
        return 0.0

    source_names = {s["document_name"].lower() for s in sources}
    source_contents = " ".join(s["content"].lower() for s in sources)

    # Check for citation markers
    citation_pattern = r"\[Source:\s*(.+?)\]"
    citations = re.findall(citation_pattern, answer, re.IGNORECASE)

    if not citations:
        # No citations found — lower confidence
        return 0.5

    verified = 0
    for citation in citations:
        citation_lower = citation.lower()
        if any(name in citation_lower for name in source_names):
            verified += 1

    return verified / len(citations) if citations else 0.5
