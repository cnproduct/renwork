import urllib.request
import re
import json
import os
import sys

def fetch_fmc_oti():
    print("[1/3] Fetching active OTI/NVOCC records from US Federal Maritime Commission (FMC)...")
    url = "https://www2.fmc.gov/FMC1Users/scripts/ExtReports.asp?tariffClass=oti"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            print(f"  -> Downloaded {len(html)} bytes from FMC.")
    except Exception as e:
        print(f"  -> Network error from FMC direct URL: {e}")
        return []

    rows = re.findall(r'<tr.*?>.*?</tr>', html, re.DOTALL | re.IGNORECASE)
    records = []
    print(f"  -> Parsing {len(rows)} table rows...")
    
    for row in rows:
        cells = [re.sub(r'<.*?>', '', c).strip() for c in re.findall(r'<td.*?>.*?</td>', row, re.DOTALL | re.IGNORECASE)]
        # FMC table cols typically: Org No, Name, DBA/Trade Name, Tariff No, Type, Status, Location
        if len(cells) >= 3 and cells[0].isdigit():
            org_no = cells[0]
            legal_name = cells[1]
            dba_name = cells[2] if len(cells) > 2 else ""
            tariff_no = cells[3] if len(cells) > 3 else ""
            status = cells[4] if len(cells) > 4 else "ACTIVE"
            location = cells[5] if len(cells) > 5 else ""

            records.append({
                "fmc_org_no": org_no,
                "legal_name": legal_name,
                "trade_name": dba_name,
                "tariff_no": tariff_no,
                "license_type": "NVOCC / Ocean Freight Forwarder",
                "status": status,
                "location": location,
                "source": "US Federal Maritime Commission (FMC)",
                "source_url": "https://www2.fmc.gov/FMC1Users/scripts/ExtReports.asp?tariffClass=oti"
            })
            
    print(f"  -> Extracted {len(records)} official FMC registered forwarder records.")
    return records

if __name__ == "__main__":
    records = fetch_fmc_oti()
    print(f"Total: {len(records)}")
