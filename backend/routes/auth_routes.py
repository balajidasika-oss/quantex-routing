from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.auth.user_model import UserCreate, UserLogin, UserResponse, Token, UserRole
from backend.auth.hashing import Hasher
from backend.auth.jwt_handler import create_access_token, get_current_user, TokenPayload
from backend.utils.config import settings
from backend.utils.logger import logger

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


def seed_demo_users_if_needed(db: Session):
    """Seeds default demo accounts (admin, dispatcher, driver) if none exist."""
    demos = [
        ("admin", "admin@quantumroute.ai", "admin123", UserRole.ADMIN.value),
        ("dispatcher", "dispatcher@quantumroute.ai", "dispatch123", UserRole.DISPATCHER.value),
        ("driver", "driver@quantumroute.ai", "driver123", UserRole.DRIVER.value),
    ]
    for username, email, pwd, role in demos:
        existing = db.query(User).filter(User.username == username).first()
        if not existing:
            new_u = User(
                username=username,
                email=email,
                hashed_password=Hasher.get_password_hash(pwd),
                role=role,
            )
            db.add(new_u)
    db.commit()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Registers a new user with chosen role (ADMIN, DISPATCHER, DRIVER)."""
    existing_user = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered.",
        )

    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=Hasher.get_password_hash(user_in.password),
        role=user_in.role.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"Registered new user '{user.username}' with role '{user.role}'")
    return user


@router.post("/login", response_model=Token)
def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticates user and issues signed JWT access token containing role claim."""
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not Hasher.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_enum = UserRole(user.role) if user.role in UserRole._value2member_map_ else UserRole.DISPATCHER
    token_data = {
        "sub": user.username,
        "role": role_enum.value,
        "email": user.email,
    }
    access_token = create_access_token(token_data)

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=role_enum,
        username=user.username,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves authenticated user details."""
    user = db.query(User).filter(User.username == current_user.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
