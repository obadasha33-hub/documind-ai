"""Auth-related schemas."""

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class NextAuthRegisterRequest(BaseModel):
    """Request body from NextAuth when a user signs in via OAuth."""
    email: str
    name: str | None = None
    avatar_url: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None = None
    role: str
    tenant_id: str
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str

    class Config:
        from_attributes = True


class AuthCallbackResponse(BaseModel):
    """Response after NextAuth user registers/logs in."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    tenant: TenantResponse
