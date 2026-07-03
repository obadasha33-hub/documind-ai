"""LLM client service — Gemini (primary) + Groq (fallback) for text generation."""

import json
from typing import AsyncGenerator

import httpx
import structlog

from ..core.config import settings
from ._retry import with_retries

logger = structlog.get_logger()

GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


async def generate_with_gemini(
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """Generate text using Gemini 2.0 Flash."""
    url = GEMINI_CHAT_URL.format(model=settings.GEMINI_CHAT_MODEL)

    # Build Gemini content parts
    parts = []
    if system_prompt:
        parts.append({"text": f"System: {system_prompt}\n\n"})

    for msg in messages:
        role_prefix = "User" if msg["role"] == "user" else "Assistant"
        parts.append({"text": f"{role_prefix}: {msg['content']}\n\n"})

    async def _call() -> dict:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "contents": [{"parts": parts}],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_tokens,
                    },
                },
            )
            response.raise_for_status()
            return response.json()

    data = await with_retries(_call, op_name="gemini_generate")
    return data["candidates"][0]["content"]["parts"][0]["text"]


async def generate_with_groq(
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """Generate text using Groq Llama 3.1 8B (fallback)."""
    api_messages = []
    if system_prompt:
        api_messages.append({"role": "system", "content": system_prompt})
    api_messages.extend(messages)

    async def _call() -> dict:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROQ_CHAT_MODEL,
                    "messages": api_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            return response.json()

    data = await with_retries(_call, op_name="groq_generate")
    return data["choices"][0]["message"]["content"]


async def generate(
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> tuple[str, str]:
    """
    Generate text with automatic fallback.

    Returns (generated_text, model_used).
    """
    # Try Gemini first
    try:
        result = await generate_with_gemini(messages, system_prompt, temperature, max_tokens)
        return result, "gemini-2.0-flash"
    except Exception as e:
        logger.warning("Gemini generation failed, falling back to Groq", error=str(e))

    # Fallback to Groq
    try:
        result = await generate_with_groq(messages, system_prompt, temperature, max_tokens)
        return result, "groq-llama-3.1-8b"
    except Exception as e:
        logger.error("Groq generation also failed", error=str(e))
        raise RuntimeError(f"All LLM providers failed. Gemini error: {e}")


async def _stream_gemini(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    """Yield text deltas from Gemini's SSE streaming endpoint."""
    url = GEMINI_STREAM_URL.format(model=settings.GEMINI_CHAT_MODEL)

    parts = []
    if system_prompt:
        parts.append({"text": f"System: {system_prompt}\n\n"})
    for msg in messages:
        role_prefix = "User" if msg["role"] == "user" else "Assistant"
        parts.append({"text": f"{role_prefix}: {msg['content']}\n\n"})

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            url,
            params={"key": settings.GEMINI_API_KEY, "alt": "sse"},
            json={
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                },
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[len("data: "):].strip()
                if not payload:
                    continue
                event = json.loads(payload)
                candidates = event.get("candidates") or []
                if not candidates:
                    continue
                for part in candidates[0].get("content", {}).get("parts", []):
                    text = part.get("text")
                    if text:
                        yield text


async def _stream_groq(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    """Yield text deltas from Groq's OpenAI-compatible SSE streaming endpoint."""
    api_messages = []
    if system_prompt:
        api_messages.append({"role": "system", "content": system_prompt})
    api_messages.extend(messages)

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.GROQ_CHAT_MODEL,
                "messages": api_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[len("data: "):].strip()
                if not payload or payload == "[DONE]":
                    continue
                event = json.loads(payload)
                delta = event.get("choices", [{}])[0].get("delta", {})
                text = delta.get("content")
                if text:
                    yield text


async def generate_stream(
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> AsyncGenerator[tuple[str, str], None]:
    """
    Stream text deltas with automatic provider fallback.

    Yields (delta_text, model_used) tuples. Falls back from Gemini to Groq only
    if the failure happens before any tokens were yielded — once a provider has
    started streaming, we commit to it rather than risk an incoherent answer
    stitched from two different models.
    """
    started = False
    try:
        async for delta in _stream_gemini(messages, system_prompt, temperature, max_tokens):
            started = True
            yield delta, "gemini-2.0-flash"
        return
    except Exception as e:
        if started:
            logger.error("Gemini stream failed mid-response", error=str(e))
            raise
        logger.warning("Gemini stream failed to start, falling back to Groq", error=str(e))

    try:
        async for delta in _stream_groq(messages, system_prompt, temperature, max_tokens):
            yield delta, "groq-llama-3.1-8b"
    except Exception as e:
        logger.error("Groq stream also failed", error=str(e))
        raise RuntimeError(f"All streaming LLM providers failed: {e}")
