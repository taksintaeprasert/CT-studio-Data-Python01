import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import os
import base64

# Scopes สำหรับการเข้าถึง Google Sheets และ Drive
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# ตรวจสอบว่ารันบน Streamlit Cloud หรือ Local
def get_credentials():
    """
    โหลด credentials จาก Streamlit Secrets (Cloud) หรือ keygg.json (Local)
    รองรับทั้ง private_key ปกติและ private_key_base64
    """
    try:
        # ลองโหลดจาก Streamlit secrets ก่อน (สำหรับ Cloud)
        import streamlit as st
        if "google_service_account" in st.secrets:
            # รันบน Streamlit Cloud
            creds_dict = dict(st.secrets["google_service_account"])

            # ถ้ามี private_key_base64 ให้ decode กลับมาเป็น private_key
            if "private_key_base64" in creds_dict and "private_key" not in creds_dict:
                encoded_key = creds_dict.pop("private_key_base64")
                creds_dict["private_key"] = base64.b64decode(encoded_key).decode('utf-8')

            return Credentials.from_service_account_info(
                creds_dict,
                scopes=SCOPES
            )
    except (ImportError, FileNotFoundError, KeyError):
        pass

    # ถ้าไม่ได้รันบน Cloud หรือไม่มี secrets ให้ใช้ keygg.json
    KEY_FILE = "keygg.json"
    if os.path.exists(KEY_FILE):
        print(f"✅ Found {KEY_FILE}, loading credentials...")
        try:
            creds = Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
            print(f"✅ Service Account: {creds.service_account_email}")
            return creds
        except Exception as e:
            print(f"❌ Error loading {KEY_FILE}: {e}")
            raise
    else:
        print(f"❌ {KEY_FILE} not found in current directory: {os.getcwd()}")
        print(f"Files in directory: {os.listdir('.')}")
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
