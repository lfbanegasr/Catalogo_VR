from pydantic import BaseModel, EmailStr, Field

from schemas.tenant_schema import UsuarioOut


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioOut


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ForgotPasswordOut(BaseModel):
    ok: bool = True
    message: str
    reset_url: str | None = None
    reset_token: str | None = None


class ResetPasswordIn(BaseModel):
    token: str = Field(..., min_length=20)
    new_password: str = Field(..., min_length=6)


class MessageOut(BaseModel):
    ok: bool = True
    message: str
