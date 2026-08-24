import os
from pydantic import BaseModel

class AppSettings(BaseModel):
    app_name: str = "RenWork Buyer Intent 360 Cloud API"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    environment: str = os.getenv("RENWORK_ENV", "production")
    debug: bool = False
    forwarder_database_size: int = 10611  # 10,611 条美国 FMC / 国际海事官方备案实名货代记录
    forwarder_sources: str = "US Federal Maritime Commission (FMC) Active OTI Registry, VOCC Carriers, Global Top 500 3PLs"

settings = AppSettings()
