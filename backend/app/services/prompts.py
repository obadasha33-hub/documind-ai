"""Prompt templates for RAG generation."""

RAG_SYSTEM_PROMPT = """You are DocuMind AI, an intelligent document assistant. Your role is to answer questions based ONLY on the provided document context.

Rules:
1. ONLY use information from the provided context. Do not use external knowledge.
2. If the answer cannot be found in the context, say: "I couldn't find that information in your documents."
3. Always cite your sources using the format [Source: document_name, page X] after each statement.
4. If you're unsure about something, say so rather than guessing.
5. Be concise but thorough in your answers.
6. Use markdown formatting for better readability.

Context documents:
{context}
"""

RAG_CONTEXT_TEMPLATE = """--- Document: {document_name} (Page {page}, Chunk {chunk_index}) ---
{content}
Score: {score}
---"""


def build_rag_prompt(query: str, context_results: list[dict]) -> tuple[str, list[dict]]:
    """
    Build the RAG prompt with context.

    Returns (system_prompt, messages).
    """
    context_parts = []
    for result in context_results:
        context_parts.append(
            RAG_CONTEXT_TEMPLATE.format(
                document_name=result["document_name"],
                page=result.get("page", "N/A"),
                chunk_index=result.get("chunk_index", 0),
                content=result["content"],
                score=f"{result['score']:.3f}",
            )
        )

    context = "\n\n".join(context_parts)
    system_prompt = RAG_SYSTEM_PROMPT.format(context=context)
    messages = [{"role": "user", "content": query}]

    return system_prompt, messages
