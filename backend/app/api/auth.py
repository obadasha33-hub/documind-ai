"""Auth API endpoints — NextAuth bridge, token verification and user info."""

import hmac
import re
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.config import settings
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.security import create_access_token
from ..models.tenant import Tenant
from ..models.user import User, UserRole
from ..schemas.auth import (
    AuthCallbackResponse,
    NextAuthRegisterRequest,
    TenantResponse,
    UserResponse,
)

router = APIRouter()


async def require_internal_secret(
    x_internal_secret: str | None = Header(default=None),
) -> None:
    """
    Guard the NextAuth bridge so only the trusted Next.js server can mint tokens.

    Without this, any unauthenticated caller could POST an arbitrary email and
    receive a valid JWT for that user/tenant — a full multi-tenant auth bypass.
    """
    expected = settings.INTERNAL_AUTH_SECRET
    if not expected:
        # No secret configured. Allowed only outside production (dev convenience);
        # production boot is already blocked by Settings validation.
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Auth bridge is not configured",
            )
        return
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal secret",
        )


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from a name."""
    slug = re.sub(r"[^\w\s-]", "", name.lower())
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug[:80] or f"workspace-{uuid.uuid4().hex[:8]}"


@router.post("/nextauth", response_model=AuthCallbackResponse)
async def nextauth_bridge(
    body: NextAuthRegisterRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_internal_secret),
) -> AuthCallbackResponse:
    """
    Bridge endpoint for NextAuth v5.
    Called by the frontend after a user authenticates via OAuth or email.
    - If user exists (by email): returns JWT + user info
    - If new user: creates tenant + user, returns JWT + user info
    """
    # Check if user already exists
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant))
        .where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # ── Create new tenant + user ──
        tenant_name = f"{body.name or body.email.split('@')[0]}'s Workspace"
        tenant_slug = _slugify(tenant_name)

        # Ensure slug uniqueness
        existing_slug = await db.execute(
            select(Tenant).where(Tenant.slug == tenant_slug)
        )
        if existing_slug.scalar_one_or_none():
            tenant_slug = f"{tenant_slug}-{uuid.uuid4().hex[:6]}"

        tenant = Tenant(
            id=str(uuid.uuid4()),
            name=tenant_name,
            slug=tenant_slug,
        )
        db.add(tenant)
        await db.flush()

        user = User(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            email=body.email,
            name=body.name,
            avatar_url=body.avatar_url,
            role=UserRole.OWNER,
        )
        db.add(user)
        await db.flush()

        # Reload with tenant relationship
        result = await db.execute(
            select(User)
            .options(selectinload(User.tenant))
            .where(User.id == user.id)
        )
        user = result.scalar_one()
    else:
        # Update avatar/name if changed
        if body.avatar_url and not user.avatar_url:
            user.avatar_url = body.avatar_url
        if body.name and not user.name:
            user.name = body.name
        await db.flush()

    # Generate FastAPI JWT
    token = create_access_token(
        data={"sub": user.id, "email": user.email, "tenant_id": user.tenant_id}
    )

    return AuthCallbackResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role.value,
            tenant_id=user.tenant_id,
            avatar_url=user.avatar_url,
        ),
        tenant=TenantResponse(
            id=user.tenant.id,
            name=user.tenant.name,
            slug=user.tenant.slug,
            plan=user.tenant.plan.value,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current authenticated user info."""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        tenant_id=user.tenant_id,
        avatar_url=user.avatar_url,
    )


@router.get("/tenant", response_model=TenantResponse)
async def get_current_tenant(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantResponse:
    """Get current user's tenant/workspace info."""
    # Load tenant relationship
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant))
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    tenant = user.tenant
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan=tenant.plan.value,
    )
