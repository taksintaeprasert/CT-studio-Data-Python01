import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import os

# Scopes สำหรับการเข้าถึง Google Sheets และ Drive
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# ตรวจสอบว่ารันบน Streamlit Cloud หรือ Local
def get_credentials():
    """
    โหลด credentials จาก Streamlit Secrets (Cloud) หรือ keygg.json (Local)
    """
    try:
        # ลองโหลดจาก Streamlit secrets ก่อน (สำหรับ Cloud)
        import streamlit as st
        if "google_service_account" in st.secrets:
            # รันบน Streamlit Cloud
            return Credentials.from_service_account_info(
                st.secrets["google_service_account"],
                scopes=SCOPES
            )
    except (ImportError, FileNotFoundError, KeyError):
        pass

    # ถ้าไม่ได้รันบน Cloud หรือไม่มี secrets ให้ใช้ keygg.json
    KEY_FILE = "keygg.json"
    if os.path.exists(KEY_FILE):
        return Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
    else:
        raise FileNotFoundError(
            f"ไม่พบไฟล์ {KEY_FILE} และไม่ได้ตั้งค่า Streamlit secrets\n"
            "กรุณาตรวจสอบการตั้งค่า credentials"
        )

# สร้าง credentials
creds = get_credentials()

# Google Sheets client
gc = gspread.authorize(creds)

# Google Drive client
drive_service = build('drive', 'v3', credentials=creds)
