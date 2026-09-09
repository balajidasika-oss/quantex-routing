import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RoutePlan, AuditBlock
from backend.services.report_service import report_service
from backend.utils.logger import logger

router = APIRouter(prefix="/reports", tags=["Reports & Cryptographic Audit Chain"])


@router.get("/verify-audit", response_model=Dict[str, Any])
def verify_audit_blockchain(db: Session = Depends(get_db)):
    """
    Cryptographically verifies the entire SHA-256 audit blockchain from genesis block
    to head. Detects any database payload or hash modifications.
    """
    return report_service.verify_audit_chain(db)


@router.get("/audit-blocks", response_model=List[Dict[str, Any]])
def list_audit_blocks(limit: int = 50, db: Session = Depends(get_db)):
    """Retrieves all cryptographic audit blocks in the chain."""
    blocks = db.query(AuditBlock).order_by(AuditBlock.block_index.asc()).limit(limit).all()
    results = []
    for b in blocks:
        try:
            payload = json.loads(b.payload_json)
        except Exception:
            payload = {}
        results.append({
            "block_index": b.block_index,
            "timestamp": b.timestamp,
            "prev_hash": b.prev_hash,
            "block_hash": b.block_hash,
            "payload": payload,
            "signature": b.signature,
            "is_verified": b.is_verified,
        })
    return results


@router.get("/{plan_id}/csv")
def download_plan_csv(plan_id: int, db: Session = Depends(get_db)):
    """Exports route stops, coordinates, and sequence to a CSV file."""
    plan = db.query(RoutePlan).filter(RoutePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")

    csv_data = report_service.generate_csv_report(plan)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={plan.plan_code}.csv"},
    )


@router.get("/{plan_id}/pdf")
def download_plan_pdf(plan_id: int, db: Session = Depends(get_db)):
    """Exports route plan summary, KPIs, and audit signature to a PDF document."""
    plan = db.query(RoutePlan).filter(RoutePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")

    pdf_bytes = report_service.generate_pdf_report(plan)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={plan.plan_code}.pdf"},
    )


@router.post("/tamper-test")
def simulate_tampering_for_testing(block_index: int = 0, db: Session = Depends(get_db)):
    """Security audit test endpoint: artificially mutates a payload to demonstrate blockchain tampering detection."""
    block = db.query(AuditBlock).filter(AuditBlock.block_index == block_index).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    # Tamper with payload
    block.payload_json = json.dumps({"tampered": True, "unauthorized_change": "HACKED_VALUE"})
    db.commit()
    logger.warning(f"Simulated tampering on audit block {block_index} for security testing.")
    return {"status": "TAMPERED", "block_index": block_index, "message": "Payload modified. Run /verify-audit to observe detection."}
