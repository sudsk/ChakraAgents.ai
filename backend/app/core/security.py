# app/core/security.py
from datetime import datetime, timedelta
from typing import Any, Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User
from app.db.session import get_db

# Add this for development
import uuid
from app.db.models import User

# Create a dummy admin user for development
BYPASS_AUTH = True
DEV_USER = User(
    id=uuid.uuid4(),
    username="dev_user",
    email="dev@example.com",
    is_active=True,
    is_admin=True
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for token handling
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")
# Replace OAuth2 scheme with a dummy implementation
class DummyOAuth2Scheme:
    async def __call__(self, request):
        return "dummy_token_for_development"

oauth2_scheme = DummyOAuth2Scheme()

# Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Security functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate a password hash."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """Authenticate a user."""
    """Always return a dev user, completely bypassing authentication"""
    return DEV_USER   
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """Always return a dev user, completely bypassing authentication"""
    return DEV_USER  
    
    """Get the current user from the request token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

# Create a dummy user for development
def get_dummy_user():
    from app.db.models import User
    import uuid
    
    return User(
        id=uuid.uuid4(),
        username="dev_user",
        email="dev@example.com",
        is_active=True,
        is_admin=True,
        # Add any other required fields
    )
# Development implementation that completely bypasses authentication
async def get_current_active_user(token: str = Depends(oauth2_scheme), db = None):
    """Development version that always returns a dummy admin user"""
    return get_dummy_user()
    
#def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
#    """Check if the current user is active."""
#    """Always return a dev user, completely bypassing authentication"""
#    return DEV_USER  
    
#    if not current_user.is_active:
#        raise HTTPException(status_code=400, detail="Inactive user")
#    return current_user 

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Check if the current user is an admin."""
    """Always return a dev user, completely bypassing authentication"""
    return DEV_USER  
    
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return current_user
