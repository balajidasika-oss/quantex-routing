"""
Role Manager for QuantumRoute AI-VRP
Enforces role-based hierarchy, capability matrix, and governance across:
- Admin (Governance, compliance, audit blockchain, solver configs, API keys)
- Dispatcher (Operational fleet coordination, route assignment, optimization execution)
- Driver (Route execution, telemetry transmission, stop delivery completion, incident reporting)
"""
from typing import List, Dict, Set
from backend.auth.user_model import UserRole

# Capability Permissions Matrix
PERMISSIONS: Dict[UserRole, Set[str]] = {
    UserRole.ADMIN: {
        "users:read", "users:create", "users:update", "users:delete",
        "roles:assign", "roles:revoke",
        "solvers:configure", "solvers:execute", "solvers:benchmark",
        "audit:read", "audit:verify", "audit:export",
        "reports:compliance", "reports:operational",
        "apikeys:manage",
        "fleet:read", "fleet:write", "fleet:telemetry",
        "routes:create", "routes:dispatch", "routes:execute",
    },
    UserRole.DISPATCHER: {
        "solvers:execute", "solvers:benchmark",
        "routes:create", "routes:dispatch", "routes:read",
        "fleet:read", "fleet:assign",
        "alerts:read", "alerts:acknowledge",
        "reports:operational",
        "forecast:read",
    },
    UserRole.DRIVER: {
        "routes:assigned_read", "routes:status_update",
        "telemetry:send", "telemetry:read_own",
        "stops:manifest_read", "stops:complete",
        "incidents:report",
        "alerts:read_own",
    },
}

class RoleManager:
    """Manages role capabilities and validates fine-grained access permissions."""

    @staticmethod
    def get_permissions_for_role(role: UserRole) -> Set[str]:
        """Returns the set of capabilities associated with a given role."""
        return PERMISSIONS.get(role, set())

    @staticmethod
    def has_permission(role: UserRole, permission: str) -> bool:
        """Validates if a given role possesses the required permission."""
        role_perms = RoleManager.get_permissions_for_role(role)
        return permission in role_perms

    @staticmethod
    def validate_role_transition(current_role: UserRole, target_role: UserRole) -> bool:
        """Validates that a role change is structurally allowable."""
        return target_role in UserRole

role_manager = RoleManager()
