import os
from pydantic import BaseModel

class AppSettings(BaseModel):
    app_name: str = "RenWork Buyer Intent 360 Cloud API"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    environment: str = os.getenv("RENWORK_ENV", "local_development")
    debug: bool = True
    forwarder_database_size: int = 120540  # 120,000+ 货代物流服务商特征库基准

settings = AppSettings()
