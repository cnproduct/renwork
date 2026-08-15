import streamlit as st
import pandas as pd
import numpy as np
import os
import re

# Set page config
st.set_page_config(
    page_title="OKKI Leads Contacts Extraction Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom premium styling (Zinc / Dark Theme aesthetics)
st.markdown("""
<style>
    /* Main body background */
    .stApp {
        background-color: #09090b;
        color: #fafafa;
        font-family: 'DM Sans', sans-serif;
    }
    
    /* Header styling */
    h1, h2, h3 {
        color: #ffffff !important;
        font-weight: 700 !important;
    }
    
    /* KPI Card styling */
    .kpi-card {
        background-color: #18181b;
        border: 1px solid #27272a;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .kpi-card:hover {
        transform: translateY(-2px);
        border-color: #3f3f46;
    }
    .kpi-label {
        color: #a1a1aa;
        font-size: 0.875rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .kpi-value {
        color: #ffffff;
        font-size: 2.25rem;
        font-weight: 700;
        margin-top: 8px;
        font-family: 'JetBrains Mono', monospace;
    }
    .kpi-subtext {
        color: #71717a;
        font-size: 0.75rem;
        margin-top: 4px;
    }
    
    /* Progress bar styling */
    .stProgress > div > div > div > div {
        background-color: #3b82f6;
    }
    
    /* Custom Sidebar styling */
    .css-1d391kg {
        background-color: #18181b;
    }
    
    /* Metric widget overwrite */
    div[data-testid="stMetricValue"] {
        font-family: 'JetBrains Mono', monospace;
        color: #ffffff !important;
    }
</style>
""", unsafe_allow_html=True)

import sys
import argparse

DEFAULT_PATH = "全球客户列表/okki_keyword_sourcing_leads_unique.xlsx"
EXCEL_PATH = DEFAULT_PATH

# Parse arguments passed after "--"
if "--" in sys.argv:
    idx = sys.argv.index("--")
    args_to_parse = sys.argv[idx+1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--excel", "-e", default=DEFAULT_PATH)
    parsed_args, _ = parser.parse_known_args(args_to_parse)
    EXCEL_PATH = parsed_args.excel
else:
    parser = argparse.ArgumentParser()
    parser.add_argument("--excel", "-e", default=DEFAULT_PATH)
    parsed_args, _ = parser.parse_known_args()
    EXCEL_PATH = parsed_args.excel

if not os.path.isabs(EXCEL_PATH):
    EXCEL_PATH = os.path.abspath(EXCEL_PATH)

@st.cache_data(ttl=5) # Cache data for 5 seconds to support near real-time updates
def load_data():
    if not os.path.exists(EXCEL_PATH):
        return pd.DataFrame()
    df = pd.read_excel(EXCEL_PATH)
    return df

df = load_data()

if df.empty:
    st.error(f"Could not load Excel file at path: {EXCEL_PATH}. Please make sure the path is correct and the file exists.")
    st.stop()

# Helper statistics computation
total_companies = len(df)

# Define statuses
def get_status(row):
    email = str(row.get('验证过的邮箱', '')).strip()
    contacts = row.get('联系人数量')
    
    if pd.isna(contacts) or str(contacts) == "" or contacts == "nan":
        if "未在搜索结果中找到" in email or "抽屉未打开" in email or "匹配错误" in email:
            return "Failed/No Match"
        return "Pending"
    
    try:
        contacts_val = float(contacts)
        if contacts_val > 0:
            return "Success (With Contacts)"
        else:
            return "Success (0 Contacts)"
    except:
        return "Failed/No Match"

df['Status'] = df.apply(get_status, axis=1)

# Stats calculation
processed_df = df[df['Status'] != "Pending"]
processed_count = len(processed_df)
pending_count = total_companies - processed_count

success_with_contacts = len(df[df['Status'] == "Success (With Contacts)"])
success_zero_contacts = len(df[df['Status'] == "Success (0 Contacts)"])
failed_no_match = len(df[df['Status'] == "Failed/No Match"])

# Total contacts sum
def safe_sum_contacts(val):
    try:
        return int(float(val)) if pd.notna(val) else 0
    except:
        return 0
df['ContactsVal'] = df['联系人数量'].apply(safe_sum_contacts)
total_contacts = df['ContactsVal'].sum()

# Emails and Phones calculation
total_emails = 0
total_phones = 0

all_emails = set()
all_phones = set()

for idx, row in df.iterrows():
    emails_text = str(row.get('验证过的邮箱', ''))
    phones_text = str(row.get('联系电话', ''))
    
    # Extract emails
    parsed_emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', emails_text)
    for e in parsed_emails:
        all_emails.add(e.lower().strip())
        
    # Extract phones
    if pd.notna(row.get('联系电话')) and phones_text.strip() not in ["", "nan", "无电话", "--"]:
        parts = [p.strip() for p in phones_text.split(',') if p.strip()]
        for p in parts:
            all_phones.add(p)

total_emails = len(all_emails)
total_phones = len(all_phones)

# Progress Percent
progress_percent = (processed_count / total_companies) if total_companies > 0 else 0

# --- Dashboard Layout ---

st.title("📊 OKKI Leads Contacts RPA Extractor Dashboard")
st.markdown("Real-time monitoring and reporting of OKKI client data extraction progress.")

# KPI Row
col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.markdown(f"""
    <div class="kpi-card">
        <div class="kpi-label">Total Companies</div>
        <div class="kpi-value">{total_companies}</div>
        <div class="kpi-subtext">Unique leads list</div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"""
    <div class="kpi-card">
        <div class="kpi-label">Progress</div>
        <div class="kpi-value">{progress_percent:.1%}</div>
        <div class="kpi-subtext">{processed_count} processed, {pending_count} pending</div>
    </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown(f"""
    <div class="kpi-card">
        <div class="kpi-label">Total Contacts</div>
        <div class="kpi-value">{total_contacts:,}</div>
        <div class="kpi-subtext">Across processed leads</div>
    </div>
    """, unsafe_allow_html=True)

with col4:
    st.markdown(f"""
    <div class="kpi-card">
        <div class="kpi-label">Unique Emails</div>
        <div class="kpi-value">{total_emails}</div>
        <div class="kpi-subtext">Valid emails extracted</div>
    </div>
    """, unsafe_allow_html=True)

with col5:
    st.markdown(f"""
    <div class="kpi-card">
        <div class="kpi-label">Unique Phones</div>
        <div class="kpi-value">{total_phones}</div>
        <div class="kpi-subtext">Direct phone numbers</div>
    </div>
    """, unsafe_allow_html=True)

# Progress bar
st.markdown("### Execution Progress")
st.progress(progress_percent)

# Side-by-side Charts
chart_col1, chart_col2 = st.columns(2)

with chart_col1:
    st.markdown("### Lead Processing Status Breakdown")
    status_df = pd.DataFrame({
        "Status": ["Success (With Contacts)", "Success (0 Contacts)", "Failed/No Match", "Pending"],
        "Count": [success_with_contacts, success_zero_contacts, failed_no_match, pending_count]
    })
    st.bar_chart(status_df.set_index("Status"))

with chart_col2:
    st.markdown("### Top Countries by Extracted Leads")
    country_counts = df[df['国家/地区'].notna() & (df['国家/地区'] != "")]['国家/地区'].value_counts().head(10)
    if not country_counts.empty:
        st.bar_chart(country_counts)
    else:
        st.info("No country data available yet.")

# Data Filter and Table section
st.markdown("---")
st.markdown("### 🔍 Search & Filter Leads Data")

# Filters in row
filter_row1, filter_row2 = st.columns(2)

with filter_row1:
    search_query = st.text_input("Search by Company Name or Matched Reason:", "")
with filter_row2:
    status_filter = st.multiselect(
        "Filter by Status:", 
        options=["Pending", "Success (With Contacts)", "Success (0 Contacts)", "Failed/No Match"],
        default=["Success (With Contacts)", "Success (0 Contacts)", "Failed/No Match", "Pending"]
    )

# Filter logic
filtered_df = df.copy()
if search_query:
    filtered_df = filtered_df[
        filtered_df['公司名称'].astype(str).str.contains(search_query, case=False, na=False) |
        filtered_df['匹配原因/描述'].astype(str).str.contains(search_query, case=False, na=False)
    ]
if status_filter:
    filtered_df = filtered_df[filtered_df['Status'].isin(status_filter)]

# Display table
st.markdown(f"Showing **{len(filtered_df)}** matching rows out of **{len(df)}** total rows.")
display_cols = ["序号", "公司名称", "国家/地区", "公司官网", "联系人数量", "验证过的邮箱", "联系电话", "Status", "匹配原因/描述"]
st.dataframe(filtered_df[display_cols], use_container_width=True)

# Export option
st.markdown("### 💾 Export Data")
csv = filtered_df.to_csv(index=False).encode('utf-8')
st.download_button(
    label="Download filtered data as CSV",
    data=csv,
    file_name="okki_extracted_leads_filtered.csv",
    mime="text/csv"
)

# Footer controls
st.sidebar.markdown("### Dashboard Controls")
if st.sidebar.button("🔄 Refresh Data"):
    st.cache_data.clear()
    st.rerun()

st.sidebar.markdown("""
**Data File Location:**  
`okki_keyword_sourcing_leads_unique.xlsx`  
*Google Drive sync folder*
""")
