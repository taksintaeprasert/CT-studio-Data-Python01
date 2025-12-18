import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Scopes สำหรับการเข้าถึง Google Sheets และ Drive
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

KEY_FILE = "keygg.json"

# สร้าง credentials จากไฟล์ service account
creds = Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)

# Google Sheets client
gc = gspread.authorize(creds)

# Google Drive client
drive_service = build('drive', 'v3', credentials=creds)
