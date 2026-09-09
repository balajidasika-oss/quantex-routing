import bcrypt


class Hasher:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifies a plain password against a bcrypt hash."""
        if not plain_password or not hashed_password:
            return False
        try:
            password_bytes = plain_password.encode("utf-8")[:72]
            hashed_bytes = hashed_password.encode("utf-8")
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception:
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hashes a password with bcrypt (salting automatically handled)."""
        password_bytes = password.encode("utf-8")[:72]
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password_bytes, salt).decode("utf-8")
