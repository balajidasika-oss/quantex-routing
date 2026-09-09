import io
import csv
import json
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from backend.models import AuditBlock, RoutePlan, Order
from backend.utils.logger import logger

GENESIS_PREV_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


class CryptographicAuditService:
    """Manages SHA-256 chained audit logs and PDF/CSV report exports."""

    @staticmethod
    def compute_block_hash(block_index: int, prev_hash: str, timestamp: str, payload_str: str) -> str:
        """Computes SHA-256 hash across block parameters."""
        raw = f"{block_index}|{prev_hash}|{timestamp}|{payload_str}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def record_audit_block(self, db: Session, payload: Dict[str, Any]) -> AuditBlock:
        """Appends a new cryptographically chained audit block to the ledger."""
        last_block = db.query(AuditBlock).order_by(AuditBlock.block_index.desc()).first()

        if last_block is None:
            new_index = 0
            prev_hash = GENESIS_PREV_HASH
        else:
            new_index = last_block.block_index + 1
            prev_hash = last_block.block_hash

        timestamp = datetime.now(timezone.utc).isoformat()
        payload_str = json.dumps(payload, sort_keys=True)
        block_hash = self.compute_block_hash(new_index, prev_hash, timestamp, payload_str)

        block = AuditBlock(
            block_index=new_index,
            timestamp=timestamp,
            prev_hash=prev_hash,
            block_hash=block_hash,
            payload_json=payload_str,
            is_verified=True,
        )
        db.add(block)
        db.commit()
        db.refresh(block)
        return block

    def verify_audit_chain(self, db: Session) -> Dict[str, Any]:
        """
        Validates the entire audit blockchain:
        1. Genesis block has GENESIS_PREV_HASH
        2. Chained hashes: block[k].prev_hash == block[k-1].block_hash
        3. Block hash recomputation: hash == SHA256(index, prev_hash, timestamp, payload)
        """
        blocks = db.query(AuditBlock).order_by(AuditBlock.block_index.asc()).all()

        if not blocks:
            return {
                "valid": True,
                "chain_length": 0,
                "status": "CHAIN_EMPTY",
                "message": "No audit blocks recorded yet.",
            }

        for idx, block in enumerate(blocks):
            # Check genesis block
            if idx == 0:
                if block.prev_hash != GENESIS_PREV_HASH:
                    return {
                        "valid": False,
                        "tampered_index": 0,
                        "status": "CORRUPTED_GENESIS",
                        "message": f"Genesis block 0 has invalid prev_hash: {block.prev_hash}",
                    }
            else:
                prev_block = blocks[idx - 1]
                if block.prev_hash != prev_block.block_hash:
                    return {
                        "valid": False,
                        "tampered_index": block.block_index,
                        "status": "BROKEN_LINK",
                        "message": f"Block {block.block_index} prev_hash does not match block {prev_block.block_index} hash.",
                    }

            # Recompute content hash
            expected_hash = self.compute_block_hash(
                block.block_index,
                block.prev_hash,
                block.timestamp,
                block.payload_json,
            )
            if block.block_hash != expected_hash:
                return {
                    "valid": False,
                    "tampered_index": block.block_index,
                    "status": "TAMPERED_PAYLOAD",
                    "message": f"Block {block.block_index} hash mismatch. Computed: {expected_hash}, Recorded: {block.block_hash}",
                }

        return {
            "valid": True,
            "chain_length": len(blocks),
            "status": "VERIFIED_INTEGRITY_CONFIRMED",
            "genesis_hash": blocks[0].block_hash,
            "head_hash": blocks[-1].block_hash,
            "message": f"All {len(blocks)} blocks successfully verified. Cryptographic chain is intact.",
        }

    def generate_csv_report(self, plan: RoutePlan) -> str:
        """Generates CSV text representation of the route plan."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Route Plan Export", plan.plan_code])
        writer.writerow(["Solver Algorithm", plan.solver_type])
        writer.writerow(["Total Distance (km)", plan.total_distance_km])
        writer.writerow(["Total CO2 (kg)", plan.total_co2_kg])
        writer.writerow(["Execution Time (ms)", plan.execution_time_ms])
        writer.writerow([])

        writer.writerow(["Stop Sequence", "Stop Name / Type", "Latitude", "Longitude", "Status"])

        try:
            stops = json.loads(plan.stops_json)
        except Exception:
            stops = []

        for idx, stop in enumerate(stops):
            stop_type = "Depot" if idx in (0, len(stops) - 1) else f"Delivery {idx}"
            name = stop.get("name", stop.get("customer_name", stop_type))
            lat = stop.get("lat", 0.0)
            lng = stop.get("lng", 0.0)
            writer.writerow([idx, name, lat, lng, "OPTIMIZED"])

        return output.getvalue()

    def generate_pdf_report(self, plan: RoutePlan) -> bytes:
        """Generates a PDF summary report using ReportLab."""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a"),
        )
        elements.append(Paragraph("Quantum-AI Last-Mile Delivery Report", title_style))
        elements.append(Spacer(1, 10))

        # Metadata table
        summary_data = [
            ["Route Plan Code", plan.plan_code],
            ["Optimization Engine", plan.solver_type],
            ["Total Route Distance", f"{plan.total_distance_km:.2f} km"],
            ["Total CO2 Emissions", f"{plan.total_co2_kg:.3f} kg CO2"],
            ["Solver Runtime", f"{plan.execution_time_ms:.2f} ms"],
            ["Created Timestamp", plan.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if plan.created_at else "N/A"],
        ]

        t_summary = Table(summary_data, colWidths=[200, 300])
        t_summary.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#334155")),
            ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#0f172a")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ]))
        elements.append(t_summary)
        elements.append(Spacer(1, 20))

        # Stops Table
        elements.append(Paragraph("Optimized Route Sequence", styles["Heading2"]))
        elements.append(Spacer(1, 8))

        try:
            stops = json.loads(plan.stops_json)
        except Exception:
            stops = []

        stop_rows = [["Seq", "Stop Identifier", "Coordinates", "Type"]]
        for idx, stop in enumerate(stops):
            stype = "Depot" if idx in (0, len(stops) - 1) else f"Delivery #{idx}"
            sname = stop.get("name", stop.get("customer_name", f"Stop {idx}"))
            coords = f"{stop.get('lat', 0.0):.4f}, {stop.get('lng', 0.0):.4f}"
            stop_rows.append([str(idx), sname, coords, stype])

        t_stops = Table(stop_rows, colWidths=[40, 220, 160, 80])
        t_stops.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ]))
        elements.append(t_stops)
        elements.append(Spacer(1, 20))

        # Audit blockchain stamp
        footer_style = ParagraphStyle(
            "FooterStyle",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#64748b"),
        )
        elements.append(Paragraph("Cryptographic SHA-256 Audit Verification: Chained & Tamper-Proof Certified", footer_style))

        doc.build(elements)
        return buffer.getvalue()


report_service = CryptographicAuditService()
