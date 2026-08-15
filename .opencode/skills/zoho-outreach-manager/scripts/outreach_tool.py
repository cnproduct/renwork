#!/usr/bin/env python3
import argparse
import os
import sys
import json
import time
import random
import re
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.header import Header
from email.utils import parseaddr
from collections import defaultdict

# ----------------- Helper Functions -----------------

def load_db(db_path):
    if os.path.exists(db_path):
        try:
            with open(db_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading database {db_path}: {e}", file=sys.stderr)
            sys.exit(1)
    return []

def save_db(db_path, data):
    try:
        with open(db_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving database {db_path}: {e}", file=sys.stderr)

def load_config(config_path):
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading config {config_path}: {e}", file=sys.stderr)
            sys.exit(1)
    return {}

def find_drafts_folder(mail):
    status, folder_list = mail.list()
    if status == 'OK':
        for folder in folder_list:
            folder_str = folder.decode('utf-8')
            if '\\drafts' in folder_str.lower() or 'drafts' in folder_str.lower() or '草稿' in folder_str:
                matches = re.findall(r'"([^"]*)"', folder_str)
                if matches:
                    return matches[-1]
                else:
                    parts = folder_str.split()
                    if parts:
                        return parts[-1]
    return "Drafts"

def validate_email(email_str):
    if not email_str or not isinstance(email_str, str):
        return False
    # Simple regex for email validation
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return bool(re.match(pattern, email_str.strip()))

# ----------------- Command: Prepare -----------------

def cmd_prepare(args):
    print("Loading pandas and processing Excel leads...")
    try:
        import pandas as pd
    except ImportError:
        print("Error: pandas is required for the prepare command. Please run inside the project environment.", file=sys.stderr)
        sys.exit(1)

    excel_path = args.excel
    db_path = args.db

    if not os.path.exists(excel_path):
        print(f"Error: Excel file '{excel_path}' not found.", file=sys.stderr)
        sys.exit(1)

    df = pd.read_excel(excel_path)
    
    # Clean rows
    df = df[df['公司名'].notna()]
    df = df[~df['公司名'].astype(str).str.contains('内容由AI生成', na=False)]
    df = df[df['邮箱'].notna()]

    signature = """Warm Regards,
Philip Chan
Sales Director
Cosine Nanoelectronics
WhatsApp: +8615959543210
philip@cosinechips.com
www.cosinechips.com
www.cosine-ic.com"""

    outreach_data = []
    seen_emails = set()
    skipped_duplicates = 0
    skipped_invalids = 0

    for idx, row in df.iterrows():
        company = str(row['公司名']).strip()
        position = str(row['职位']).strip() if pd.notna(row['职位']) else "Staff"
        name = str(row['姓名']).strip() if pd.notna(row['姓名']) else ""
        raw_email = str(row['邮箱']).strip()
        phone = row.get('电话', '')
        phone_str = str(int(phone)) if pd.notna(phone) and isinstance(phone, (int, float)) else str(phone) if pd.notna(phone) else ""

        # Validate format
        if not validate_email(raw_email):
            print(f"⚠️ Skipping invalid email address format: '{raw_email}' for company '{company}'")
            skipped_invalids += 1
            continue

        # Check duplicates
        email_lower = raw_email.lower()
        if email_lower in seen_emails:
            print(f"⚠️ Skipping duplicate email address: '{raw_email}' (already added)")
            skipped_duplicates += 1
            continue
        seen_emails.add(email_lower)

        # Smart salutation
        if not name or name.lower() == "nan":
            salutation = "Dear Engineering and Sourcing Team,"
        else:
            first_name = name.split()[0]
            if first_name.lower() in ['mr.', 'ms.', 'dr.', 'mrs.'] and len(name.split()) > 1:
                first_name = name.split()[1]
            salutation = f"Dear {first_name},"

        # Smart position ref
        if position.lower() in ["nan", "staff", ""]:
            pos_ref = "your hardware design/sourcing projects"
        else:
            pos_ref = f"your role as {position}"

        # Templates
        comp_lower = company.lower()
        subject = ""
        body = ""

        if "logic fruit" in comp_lower:
            subject = "Alternate Source for Interface & Analog ICs - Logic Fruit Technologies"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am reaching out regarding component sourcing and board reliability for Logic Fruit Technologies' high-speed FPGA, ASIC, and embedded hardware design projects.

For high-speed FPGA boards and interface controllers, Cosine provides high-performance, pin-compatible alternatives to TI and ADI, focusing on:
- RS485/RS422 transceivers (high ESD protection, low-power, robust communication)
- Precision analog switches & multiplexers
- Precision operational amplifiers & comparators
- Power rail supervisors and supervisor ICs

Given {pos_ref}, securing stable lead times and cost-performance without adding design risk is likely a key priority. Cosine supports engineering teams with direct factory selection assistance, comprehensive datasheets, and free evaluation samples.

Would you be open to reviewing a short cross-reference guide of our pin-compatible parts matching your current designs?

{signature}"""

        elif "teledyne" in comp_lower or "lecroy" in comp_lower:
            subject = "Precision Analog Front-Ends & Signal Chain Support - Teledyne LeCroy"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am contacting you because of Teledyne LeCroy's leadership in high-precision oscilloscopes and protocol analyzers.

In high-performance test and measurement hardware, signal path integrity, noise floor, and switching speed are critical. Cosine designs precision analog and mixed-signal components that can support your instrumentation designs:
- Precision Operational Amplifiers (low noise, low offset, low drift)
- High-Speed, Low-Leakage Analog Switches & Multiplexers
- Low-Power Comparators
- RS485/RS422 Interface ICs for system control and communication

Given {pos_ref}, you are likely focused on achieving the highest precision and reliability in your signal chains. Cosine offers robust, high-performance parts that serve as excellent second-source options for TI/ADI components, backed by direct factory engineering support and rapid sample delivery.

Could we send you a few product datasheets and test samples matched to your analog front-end or control board requirements?

{signature}"""

        elif "munich electrification" in comp_lower:
            subject = "BMS Analog ICs & Power Supervisors - Munich Electrification"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am reaching out regarding Battery Management Systems (BMS) and power electronics components for Munich Electrification's electric vehicle projects.

Automotive battery systems demand the highest levels of safety, reliability, and robust ESD protection. Cosine focuses on industrial and automotive-oriented analog and mixed-signal ICs that are highly relevant to BMS and battery control boards:
- High-reliability Analog Switches and Multiplexers for cell monitoring and diagnostics
- Power Supervisor ICs and rail monitors for safety-critical voltage monitoring
- Precision Op-Amps and Comparators for current/temperature sensing signal chains
- Robust RS485/RS422 interface ICs for robust board-to-board/system communication

We understand that in {pos_ref}, qualifying robust components with stable supply is a top priority. Cosine is a competitive and reliable partner offering pin-compatible solutions, active sample support, and direct factory-to-engineer communication.

Would it be helpful if we shared our selection guide for BMS and automotive-oriented analog solutions?

{signature}"""

        elif "radix" in comp_lower:
            subject = "Robust RS485 Transceivers & Precision Op-Amps for Radix Microsystems"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am contacting you at Radix Microsystems because of your leading position in process instrumentation, controllers, and sensors.

Industrial environments expose instrumentation to severe electrical noise, ESD, and ground surges. Cosine specializes in robust, high-protection industrial components designed specifically for these conditions:
- RS485/RS422 Transceivers (featuring up to 15kV ESD protection, fail-safe, 3.3V/5V operation)
- Precision Operational Amplifiers (low offset, low drift) for RTD, thermocouple, and pressure sensor signal conditioning
- Power supervisor ICs for reliable controller boot-up and rail monitoring

Given {pos_ref}, you know the importance of keeping system downtime to zero while managing BOM costs. Cosine provides cost-effective, pin-compatible alternatives to TI/ADI parts with stable lead times and reliable local inventory support.

Could we provide some samples of our industrial RS485 transceivers and precision op-amps for your team to evaluate?

{signature}"""

        elif "icon electromatic" in comp_lower:
            subject = "Cosine Chips Line Card Partnership - Industrial & Automotive Analog ICs"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am reaching out to discuss a potential distribution and supply partnership in India.

We are familiar with Icon Electromatic’s strength in distributing electronic components, RF modules, and PCB materials to industrial and automotive customers across India.

Cosine Nanoelectronics designs and manufactures high-quality analog and mixed-signal ICs, specializing in:
- Industrial RS485/RS422 and RS232 Interface ICs
- Precision Operational Amplifiers & Comparators
- Analog Switches & Multiplexers
- Power Management & Supervisor ICs

Given {pos_ref}, you understand the growing demand from Indian manufacturers for high-quality, competitive alternatives to TI, ADI, and Maxim. Cosine offers a strong pin-compatible portfolio, attractive distribution margins, stable lead times, and direct engineering support to help you win local customer BOMs.

Would you be open to a brief discussion on how we can collaborate and support Icon Electromatic's product line?

{signature}"""

        elif "heatcon" in comp_lower:
            subject = "Temperature Control & Sensor Signal Conditioning Solutions - Heatcon Instruments"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am contacting you at Heatcon Instruments regarding component selection for your industrial heating solutions and temperature controllers.

For temperature controllers and thermocouple/RTD sensors, accuracy, low drift, and robust remote communication are critical. Cosine provides high-performance components designed to support these requirements:
- Precision Operational Amplifiers (low offset, low drift) for high-accuracy sensor signal conditioning
- Industrial RS485/RS422 Transceivers (with high ESD protection) for reliable Modbus network communication
- Low-power Comparators and Power Supervisor ICs for system safety

Given {pos_ref}, you are likely focused on ensuring precise control and robust communication in your heating systems. Cosine offers pin-compatible alternatives to TI and ADI with stable supply and excellent cost-performance.

Would you be interested in receiving datasheets and free engineering samples for your controller designs?

{signature}"""

        elif "juniper" in comp_lower:
            subject = "Low-Power Analog Switches & Power Supervisors for Juniper Systems Rugged Devices"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am reaching out regarding component selection and supply chain stability for Juniper Systems' rugged handheld computers and tablets.

Rugged mobile electronics require exceptionally low power consumption to maximize battery life, combined with robust ESD/surge protection for outdoor reliability. Cosine offers a range of compact, high-efficiency components:
- Power Supervisor ICs (for reliable voltage monitoring and reset control)
- Low-voltage, Low-power Analog Switches & Multiplexers
- Robust RS485/RS422 Interface ICs with high ESD protection
- Low-power Op-Amps & Comparators

Given {pos_ref}, optimizing battery rail monitoring and ensuring interface port protection is critical. Cosine provides compact, pin-compatible alternatives to TI/ADI/Maxim parts, allowing you to secure your supply chain and reduce costs.

Could we send you a selection guide of our ultra-low-power analog switches and supervisor ICs for review?

{signature}"""

        elif "masibus" in comp_lower:
            subject = "Robust Modbus RS485 Communications & AFE Solutions - Masibus Automation"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am reaching out regarding component reliability for Masibus' industrial automation, SCADA systems, RTUs, and data loggers.

Industrial automation systems require communication networks that can survive high ESD, ground potential differences, and electrical noise over long distances. Cosine specializes in robust industrial-grade components:
- High-protection RS485/RS422 transceivers (up to 15kV ESD protection, fail-safe, 3.3V/5V) for robust Modbus RTU communication
- Precision Operational Amplifiers & Comparators for high-accuracy analog input cards
- Low-voltage Analog Switches and multiplexers for channel scanning in data loggers
- Power rail supervisors for reliable system boot-up

Given {pos_ref}, you understand the value of reliable components that prevent field failures. Cosine offers pin-compatible alternatives to TI and ADI with stable supply and competitive cost-performance.

Would it be useful if we sent you a few samples of our industrial RS485 transceivers and analog switches for evaluation?

{signature}"""

        elif "andurax" in comp_lower:
            subject = "Stable Component Sourcing for Embedded and Industrial Hardware - Andurax"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am contacting you at Andurax regarding component selection and sourcing for your embedded and industrial hardware projects.

Cosine Nanoelectronics designs and manufactures reliable analog and mixed-signal integrated circuits, providing pin-compatible, cost-effective alternatives to TI and ADI:
- RS485/RS422 transceivers for robust board-to-board communication
- Power supervisor ICs for system rail monitoring
- Precision op-amps, comparators, and analog switches

Given {pos_ref}, securing stable lead times and flexible sourcing is crucial for your projects. Cosine supports engineering teams with direct factory selection assistance, comprehensive datasheets, and free evaluation samples.

Would you be open to reviewing a short cross-reference guide for your active analog and interface IC requirements?

{signature}"""

        else:
            subject = "Industrial & Automotive Analog ICs - Pin-Compatible Second Source"
            body = f"""{salutation}

I am Philip Chan, Sales Director at Cosine Nanoelectronics. I am contacting you regarding analog and mixed-signal IC selection and supply chain stability for your electronic hardware designs.

Cosine Nanoelectronics designs and manufactures high-quality components, specializing in:
- Industrial RS485/RS422 and RS232 Interface ICs (with up to 15kV ESD protection)
- Precision Operational Amplifiers & Comparators (low offset, low noise, low drift)
- Low-power Analog Switches & Multiplexers
- Power Management & Supervisor ICs (voltage monitors, reset ICs)

Given {pos_ref}, we believe our portfolio could serve as an excellent second-source option for your current TI/ADI/Maxim components. We offer pin-compatible drop-in replacements, stable lead times, and direct engineering support.

Would it be helpful to receive our product catalog and free engineering samples for evaluation?

{signature}"""

        outreach_data.append({
            "id": int(idx),
            "company": company,
            "position": position,
            "name": name,
            "email": raw_email,
            "phone": phone_str,
            "subject": subject,
            "body": body,
            "status": "Pending",
            "error": "",
            "account": "",
            "timestamp": ""
        })

    save_db(db_path, outreach_data)
    print(f"\nSuccessfully generated {len(outreach_data)} outreach records and saved to {db_path}.")
    print(f"Skipped duplicates: {skipped_duplicates}, Skipped invalid formats: {skipped_invalids}")

# ----------------- Command: Upload -----------------

def cmd_upload(args):
    config = load_config(args.config)
    db_path = args.db

    password = config.get("password", "Cjj15959543210@")
    all_accounts = config.get("accounts", [])
    if not all_accounts:
        print("Error: No Zoho accounts defined in config file.", file=sys.stderr)
        sys.exit(1)

    data = load_db(db_path)
    pending_items = [x for x in data if x["status"] == "Pending"]
    
    if not pending_items:
        print("No pending emails found to upload as drafts.")
        return

    print(f"Found {len(pending_items)} pending emails. Grouping by account...")

    account_groups = defaultdict(list)
    for idx, item in enumerate(pending_items):
        acc_idx = (idx // 3) % len(all_accounts)
        sender_email = all_accounts[acc_idx]
        account_groups[sender_email].append(item)

    total_uploaded = 0
    
    for sender_email, items in account_groups.items():
        print(f"\n---> Connecting to IMAP for {sender_email} to upload {len(items)} drafts...")
        
        mail = None
        # Connect & login with up to 3 retries
        for attempt in range(3):
            try:
                mail = imaplib.IMAP4_SSL("imap.zoho.com", 993, timeout=30)
                mail.login(sender_email, password)
                break
            except Exception as e:
                print(f"⚠️ [Attempt {attempt + 1}/3] IMAP login failed for {sender_email}: {e}")
                if attempt == 2:
                    print(f"❌ Failed to connect to IMAP for {sender_email} after 3 attempts. Skipping this batch.", file=sys.stderr)
                    mail = None
                else:
                    time.sleep(5)
        
        if not mail:
            continue

        try:
            drafts_folder = find_drafts_folder(mail)
            mail.select(drafts_folder)
            
            for item in items:
                # Add individual email upload retries
                uploaded = False
                for attempt in range(3):
                    try:
                        msg = MIMEText(item["body"], 'plain', 'utf-8')
                        msg['From'] = f"Philip Chan <{sender_email}>"
                        msg['To'] = item["email"]
                        msg['Subject'] = Header(item["subject"], 'utf-8')
                        msg['X-Outreach-ID'] = str(item["id"])
                        msg_bytes = msg.as_bytes()
                        
                        mail.append(drafts_folder, '(\\Draft)', None, msg_bytes)
                        
                        # Update status in DB
                        current_db = load_db(db_path)
                        for db_item in current_db:
                            if db_item["id"] == item["id"]:
                                db_item["status"] = "Draft"
                                db_item["account"] = sender_email
                                break
                        save_db(db_path, current_db)
                        
                        total_uploaded += 1
                        print(f"Uploaded {total_uploaded}/{len(pending_items)}: {item['email']} -> {sender_email} Drafts")
                        uploaded = True
                        break
                    except Exception as e:
                        print(f"⚠️ [Attempt {attempt + 1}/3] Failed to append draft for {item['email']} to {sender_email}: {e}")
                        if attempt < 2:
                            time.sleep(3)
                if not uploaded:
                    print(f"❌ Permanent draft upload failure for {item['email']}")
            
            try:
                mail.logout()
            except:
                pass
        except Exception as e:
            print(f"❌ Error during IMAP batch operations for {sender_email}: {e}")
            
    print(f"\n=== Process finished. Total successfully uploaded: {total_uploaded} drafts. ===")

# ----------------- Command: Send -----------------

def get_draft_from_imap(sender, password, to_email, email_id):
    for attempt in range(3):
        try:
            mail = imaplib.IMAP4_SSL("imap.zoho.com", 993, timeout=20)
            mail.login(sender, password)
            drafts_folder = find_drafts_folder(mail)
            mail.select(drafts_folder)
            
            typ, data = mail.search(None, f'HEADER X-Outreach-ID "{email_id}"')
            msg_id = None
            if data[0]:
                msg_id = data[0].split()[0]
            else:
                typ, data = mail.search(None, f'TO "{to_email}"')
                if data[0]:
                    msg_id = data[0].split()[-1]
            
            raw_email = None
            if msg_id:
                typ, msg_data = mail.fetch(msg_id, '(RFC822)')
                raw_email = msg_data[0][1]
                
            mail.logout()
            return raw_email, msg_id
        except Exception as e:
            print(f"⚠️ [Attempt {attempt + 1}/3] IMAP fetch draft failed for {sender}: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(5)
    return None, None

def delete_draft_from_imap(sender, password, msg_id):
    for attempt in range(3):
        try:
            mail = imaplib.IMAP4_SSL("imap.zoho.com", 993, timeout=20)
            mail.login(sender, password)
            drafts_folder = find_drafts_folder(mail)
            mail.select(drafts_folder)
            mail.store(msg_id, '+FLAGS', '\\Deleted')
            mail.expunge()
            mail.logout()
            return True
        except Exception as e:
            print(f"⚠️ [Attempt {attempt + 1}/3] IMAP delete draft failed for {sender}: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(3)
    return False

def send_raw_smtp_email(server, port, use_ssl, sender, password, to_email, raw_email):
    # Parse raw email to extract the recipient (may have been manually edited in draft)
    try:
        msg_obj = email.message_from_bytes(raw_email)
        to_header = msg_obj.get('To')
        recipient = to_email
        if to_header:
            _, addr = parseaddr(to_header)
            if addr:
                recipient = addr
    except Exception as e:
        print(f"⚠️ Warning parsing raw email recipient: {e}", file=sys.stderr)
        recipient = to_email

    for attempt in range(3):
        try:
            if use_ssl:
                smtp = smtplib.SMTP_SSL(server, port, timeout=15)
            else:
                smtp = smtplib.SMTP(server, port, timeout=15)
                smtp.starttls()
            
            smtp.login(sender, password)
            smtp.sendmail(sender, [recipient], raw_email)
            smtp.quit()
            return True, ""
        except Exception as e:
            print(f"⚠️ [Attempt {attempt + 1}/3] SMTP raw send failed for {sender}: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(5)
    return False, "Failed after 3 attempts"

def send_smtp_email(server, port, use_ssl, sender, password, to_email, subject, body):
    for attempt in range(3):
        try:
            msg = MIMEText(body, 'plain', 'utf-8')
            msg['From'] = f"Philip Chan <{sender}>"
            msg['To'] = to_email
            msg['Subject'] = Header(subject, 'utf-8')

            if use_ssl:
                smtp = smtplib.SMTP_SSL(server, port, timeout=15)
            else:
                smtp = smtplib.SMTP(server, port, timeout=15)
                smtp.starttls()
            
            smtp.login(sender, password)
            smtp.sendmail(sender, [to_email], msg.as_string())
            smtp.quit()
            return True, ""
        except Exception as e:
            print(f"⚠️ [Attempt {attempt + 1}/3] SMTP direct send failed for {sender}: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(5)
    return False, "Failed after 3 attempts"

def cmd_send(args):
    config = load_config(args.config)
    db_path = args.db

    password = config.get("password", "Cjj15959543210@")
    all_accounts = config.get("accounts", [])
    if not all_accounts:
        print("Error: No Zoho accounts defined in config file.", file=sys.stderr)
        sys.exit(1)

    print("Starting SMTP sending engine loop...")
    
    while True:
        # Load db fresh
        data = load_db(db_path)
        next_email = None
        for item in data:
            if item["status"] in ["Pending", "Draft"]:
                next_email = item
                break

        if not next_email:
            print("\n🎉 All pending or draft emails have been successfully processed!")
            break

        # Rotate accounts based on sent_count
        sent_count = sum(1 for x in data if x["status"] == "Sent")
        idx = (sent_count // 3) % len(all_accounts)
        sender_email = all_accounts[idx]
        current_block_sent = sent_count % 3

        print(f"\n[Progress: {sent_count} Sent] Next mail target: {next_email['email']}")
        print(f"Rotating to account: {sender_email} (Sending {current_block_sent + 1} of 3 in this turn)")

        raw_email = None
        draft_msg_id = None

        if next_email["status"] == "Draft":
            print(f"--> Fetching draft from {sender_email} Drafts folder...")
            raw_email, draft_msg_id = get_draft_from_imap(sender_email, password, next_email["email"], next_email["id"])
            if not raw_email:
                print(f"⚠️ Draft not found in {sender_email} Drafts folder. Skipping.")
                current_db = load_db(db_path)
                for db_item in current_db:
                    if db_item["id"] == next_email["id"]:
                        db_item["status"] = "Skipped"
                        db_item["error"] = "Draft not found in Zoho folder."
                        break
                save_db(db_path, current_db)
                continue
            else:
                print("Draft successfully fetched.")

        # Send
        if raw_email:
            success, err_msg = send_raw_smtp_email(
                server=config["smtp_server"],
                port=config["smtp_port"],
                use_ssl=config["use_ssl"],
                sender=sender_email,
                password=password,
                to_email=next_email["email"],
                raw_email=raw_email
            )
        else:
            success, err_msg = send_smtp_email(
                server=config["smtp_server"],
                port=config["smtp_port"],
                use_ssl=config["use_ssl"],
                sender=sender_email,
                password=password,
                to_email=next_email["email"],
                subject=next_email["subject"],
                body=next_email["body"]
            )

        # Update DB
        current_db = load_db(db_path)
        for db_item in current_db:
            if db_item["id"] == next_email["id"]:
                if success:
                    db_item["status"] = "Sent"
                    db_item["account"] = sender_email
                    db_item["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
                    db_item["error"] = ""
                    print(f"✅ Successfully sent to {next_email['email']}")
                    
                    if draft_msg_id:
                        print("Deleting original draft from IMAP...")
                        delete_draft_from_imap(sender_email, password, draft_msg_id)
                else:
                    db_item["status"] = "Failed"
                    db_item["error"] = err_msg
                    print(f"❌ Failed to send to {next_email['email']}: {err_msg}")
                break
        save_db(db_path, current_db)

        # 1-5 minutes randomized delay
        delay = random.randint(60, 300)
        print(f"Waiting for {delay} seconds ({delay/60:.1f} minutes) before the next send...")
        time.sleep(delay)

# ----------------- CLI Setup -----------------

def main():
    parser = argparse.ArgumentParser(description="Zoho Email Outreach Manager Tool")
    subparsers = parser.add_subparsers(dest="command", required=True, help="Subcommands")

    # Prepare command
    parser_prep = subparsers.add_parser("prepare", help="Process Excel leads and generate JSON outreach database")
    parser_prep.add_argument("--excel", default="小满发现 - 全部公司联系人信息合并.xlsx", help="Path to input Excel leads file")
    parser_prep.add_argument("--db", default="outreach_data.json", help="Path to output JSON database")

    # Upload command
    parser_up = subparsers.add_parser("upload", help="Upload pending emails to Zoho Drafts folders via IMAP")
    parser_up.add_argument("--db", default="outreach_data.json", help="Path to JSON database")
    parser_up.add_argument("--config", default="outreach_config.json", help="Path to SMTP/IMAP config JSON")

    # Send command
    parser_send = subparsers.add_parser("send", help="Run the SMTP email sending loop with account rotation")
    parser_send.add_argument("--db", default="outreach_data.json", help="Path to JSON database")
    parser_send.add_argument("--config", default="outreach_config.json", help="Path to SMTP/IMAP config JSON")

    args = parser.parse_args()

    if args.command == "prepare":
        cmd_prepare(args)
    elif args.command == "upload":
        cmd_upload(args)
    elif args.command == "send":
        cmd_send(args)

if __name__ == "__main__":
    main()
