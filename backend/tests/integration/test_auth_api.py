"""Integration tests for authentication API endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock
from io import BytesIO

from app.main import app
from app.models.user import User
from app.models.tenant import Tenant


@pytest.mark.asyncio
class TestAuthAPI:
    """Tests for auth endpoints."""

    async def test_nextauth_bridge_new_user(self, async_client: AsyncClient):
        """Test NextAuth bridge creates new user and tenant."""
        response = await async_client.post(
            "/api/v1/auth/nextauth",
            json={
                "email": "newuser@example.com",
                "name": "New User",
                "avatar_url": "https://example.com/avatar.png"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["name"] == "New User"
        assert "tenant" in data
        assert data["tenant"]["name"] == "New User's Workspace"

    async def test_nextauth_bridge_existing_user(self, async_client: AsyncClient, test_user):
        """Test NextAuth bridge returns existing user."""
        response = await async_client.post(
            "/api/v1/auth/nextauth",
            json={
                "email": test_user.email,
                "name": "Existing User",
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == test_user.email

    async def test_nextauth_bridge_missing_email(self, async_client: AsyncClient):
        """Test NextAuth bridge fails without email."""
        response = await async_client.post(
            "/api/v1/auth/nextauth",
            json={"name": "Test User"}
        )
        assert response.status_code == 422

    async def test_nextauth_bridge_rejected_without_secret(self, async_client: AsyncClient, monkeypatch):
        """When an internal secret is configured, callers without it are rejected.

        Regression test for the auth-bypass fix: an attacker must not be able to
        mint a JWT for an arbitrary email by hitting the backend directly.
        """
        from app.api import auth as auth_module
        monkeypatch.setattr(auth_module.settings, "INTERNAL_AUTH_SECRET", "top-secret")

        response = await async_client.post(
            "/api/v1/auth/nextauth",
            json={"email": "victim@example.com", "name": "Victim"},
        )
        assert response.status_code == 401

    async def test_nextauth_bridge_accepts_valid_secret(self, async_client: AsyncClient, monkeypatch):
        """A caller presenting the correct internal secret is allowed through."""
        from app.api import auth as auth_module
        monkeypatch.setattr(auth_module.settings, "INTERNAL_AUTH_SECRET", "top-secret")

        response = await async_client.post(
            "/api/v1/auth/nextauth",
            json={"email": "trusted@example.com", "name": "Trusted"},
            headers={"X-Internal-Secret": "top-secret"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "trusted@example.com"

    async def test_get_current_user(self, async_client: AsyncClient, auth_headers):
        """Test getting current user info."""
        response = await async_client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "id" in data
        assert "role" in data

    async def test_get_current_user_unauthorized(self, async_client: AsyncClient):
        """Test getting current user without auth fails."""
        response = await async_client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_get_current_tenant(self, async_client: AsyncClient, auth_headers, test_tenant):
        """Test getting current tenant info."""
        response = await async_client.get(
            "/api/v1/auth/tenant",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_tenant.name
        assert data["slug"] == test_tenant.slug
        assert data["plan"] == test_tenant.plan.value