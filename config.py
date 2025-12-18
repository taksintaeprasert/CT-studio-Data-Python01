import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

KEY_FILE = "keygg.json"

creds = Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
gc = gspread.authorize(creds)
