"""Retired public RenCredit compatibility routes.

The authenticated Den API and its persistent tenant ledger are the only source
of truth for RenCredit. These legacy routes previously returned an in-memory
default workspace balance, which could be mistaken for a real customer wallet.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse


router = APIRouter(prefix="/credits", tags=["Retired RenCredit Compatibility"])


@router.api_route(
    "/{legacy_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
    include_in_schema=False,
)
async def retire_legacy_credits_endpoint(legacy_path: str) -> JSONResponse:
    """Reject every legacy public credits route without returning wallet data."""
    return JSONResponse(
        status_code=410,
        headers={"Cache-Control": "no-store"},
        content={
            "error": {
                "code": "LEGACY_RENCREDIT_ENDPOINT_RETIRED",
                "message": (
                    "This public compatibility endpoint is retired and does not "
                    "represent an authenticated RenCredit balance."
                ),
                "replacement": {
                    "wallet": "/api/den/v1/rencredit/wallet",
                    "ledger": "/api/den/v1/rencredit/ledger",
                    "receipts": "/api/den/v1/rencredit/receipts",
                },
                "authentication_required": True,
            }
        },
    )
