# 🚀 คู่มือ Deploy CT Studio บน Streamlit Cloud

## ภาพรวม

คู่มือนี้จะแนะนำวิธี Deploy ระบบ CT Studio บน Streamlit Cloud (ฟรี) เพื่อให้ทีมสามารถใช้งานออนไลน์ได้จากทุกที่

---

## 📋 สิ่งที่ต้องเตรียม

### 1. GitHub Account
- ✅ มี GitHub Account (ถ้ายังไม่มีสมัครที่ github.com)
- ✅ Repository นี้ต้องอยู่บน GitHub

### 2. Streamlit Cloud Account
- ✅ สมัครที่ https://streamlit.io/cloud (ใช้ GitHub login)
- ✅ ฟรี! ไม่ต้องใส่บัตรเครดิต

### 3. Google Sheets & Service Account
- ✅ ไฟล์ `keygg.json` (service account key)
- ✅ Google Sheets ที่ตั้งค่าเรียบร้อยแล้ว

---

## 🎯 ขั้นตอนการ Deploy

### Step 1: เตรียม Repository

1. **Push code ทั้งหมดไป GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **ตรวจสอบไฟล์สำคัญ** ต้องมีครบ:
   - ✅ `app.py`
   - ✅ `requirements.txt`
   - ✅ `config.yaml`
   - ✅ `auth.py`
   - ✅ ไฟล์อื่นๆ (.py ทั้งหมด)
   - ⚠️ **ห้าม push** `keygg.json` (ใช้ secrets แทน)

### Step 2: Login Streamlit Cloud

1. เปิด https://streamlit.io/cloud
2. กด **Sign in with GitHub**
3. Authorize Streamlit เข้าถึง GitHub repos

### Step 3: Deploy App

1. กด **"New app"** หรือ **"Deploy an app"**

2. เลือก Repository:
   - **Repository:** `taksintaeprasert/CT-studio-Data-Python01`
   - **Branch:** `main` (หรือ branch ที่คุณใช้)
   - **Main file path:** `app.py`

3. กด **Advanced settings** (สำคัญ!)

### Step 4: ตั้งค่า Secrets

ใน Advanced settings → Secrets:

**สร้าง Streamlit secrets** โดยคัดลอกเนื้อหาจาก `keygg.json` ไปวาง:

```toml
# .streamlit/secrets.toml format

[google_service_account]
type = "service_account"
project_id = "YOUR_PROJECT_ID"
private_key_id = "YOUR_PRIVATE_KEY_ID"
private_key = "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
client_email = "YOUR_SERVICE_ACCOUNT_EMAIL"
client_id = "YOUR_CLIENT_ID"
auth_uri = "https://accounts.google.com/o/oauth2/auth"
token_uri = "https://oauth2.googleapis.com/token"
auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
client_x509_cert_url = "YOUR_CERT_URL"
```

**วิธีแปลง keygg.json:**
1. เปิดไฟล์ `keygg.json`
2. คัดลอกค่าแต่ละ field
3. วางในรูปแบบ TOML ตามด้านบน
4. **สำคัญ:** `private_key` ต้องใส่ `\n` ให้ถูกต้อง

### Step 5: Deploy!

1. กด **"Deploy!"**
2. รอ 2-5 นาที (ครั้งแรกจะนานหน่อย)
3. เมื่อเสร็จจะได้ URL เช่น: `https://your-app-name.streamlit.app`

---

## 🔧 แก้ไขไฟล์ sheets.py

**สำคัญ!** ต้องแก้ไขวิธีโหลด credentials สำหรับ Streamlit Cloud:

```python
# sheets.py

import gspread
from google.oauth2 import service_account
import streamlit as st
import json

# ตรวจสอบว่ารันบน Streamlit Cloud หรือ local
if "google_service_account" in st.secrets:
    # รันบน Streamlit Cloud - ใช้ secrets
    credentials = service_account.Credentials.from_service_account_info(
        st.secrets["google_service_account"],
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
    )
else:
    # รันบน local - ใช้ keygg.json
    credentials = service_account.Credentials.from_service_account_file(
        "keygg.json",
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
    )

gc = gspread.authorize(credentials)
# ... ส่วนที่เหลือเหมือนเดิม
```

---

## ✅ ตรวจสอบการ Deploy

### 1. ตรวจสอบ Logs
- ใน Streamlit Cloud dashboard → คลิกที่ app → ดู logs
- ตรวจสอบ error (ถ้ามี)

### 2. ทดสอบ Login
- เปิด URL ที่ได้
- ลอง login ด้วย:
  - Username: `admin`, Password: `admin123`
  - Username: `sales1`, Password: `sales123`

### 3. ทดสอบฟังก์ชัน
- ✅ เชื่อมต่อ Google Sheets ได้
- ✅ สร้าง order ใหม่ได้
- ✅ แก้ไข order ได้
- ✅ Dashboard แสดงข้อมูลได้

---

## 🚨 แก้ปัญหา

### Problem 1: ModuleNotFoundError
**สาเหตุ:** ขาด library ใน requirements.txt

**แก้:**
1. เพิ่ม library ที่ขาดใน `requirements.txt`
2. git push
3. Streamlit จะ redeploy อัตโนมัติ

### Problem 2: Secrets ผิด
**สาเหตุ:** ตั้งค่า secrets ไม่ถูกต้อง

**แก้:**
1. ไปที่ App settings → Secrets
2. ตรวจสอบรูปแบบ TOML
3. ตรวจสอบ private_key มี `\n` ครบ
4. Save แล้ว Reboot app

### Problem 3: Google Sheets permission denied
**สาเหตุ:** Service account ไม่มีสิทธิ์เข้าถึง sheets

**แก้:**
1. เปิด Google Sheets
2. Share ให้ service account email (ดูใน keygg.json)
3. ให้สิทธิ์ Editor

### Problem 4: App ช้า/หน่วง
**สาเหตุ:** Free tier มี resource จำกัด

**แก้:**
1. เพิ่ม `@st.cache_data` ให้กับฟังก์ชันที่โหลดข้อมูล
2. ลดการ rerun ที่ไม่จำเป็น
3. พิจารณาอัพเกรดเป็น paid plan

---

## 🔐 เปลี่ยน Password

### วิธีเปลี่ยน Password ของ User

1. **Generate password hash ใหม่:**
   ```bash
   python generate_passwords.py
   # หรือ
   python -c "import bcrypt; print(bcrypt.hashpw(b'NEW_PASSWORD', bcrypt.gensalt()).decode())"
   ```

2. **อัพเดท config.yaml:**
   ```yaml
   credentials:
     usernames:
       admin:
         password: NEW_HASHED_PASSWORD_HERE
   ```

3. **Push และ Redeploy:**
   ```bash
   git add config.yaml
   git commit -m "Update password"
   git push
   ```
   Streamlit จะ redeploy อัตโนมัติ

---

## 📱 แชร์ App ให้ทีม

### URL สาธารณะ
- URL: `https://your-app-name.streamlit.app`
- แชร์ link นี้ให้ทีม
- **ทุกคนต้อง login ก่อนใช้งาน**

### การจัดการ Users

**เพิ่ม User ใหม่:**
1. แก้ไข `config.yaml`
2. เพิ่ม user ใน `credentials.usernames`
3. Generate password hash
4. git push

**ตัวอย่าง:**
```yaml
credentials:
  usernames:
    newuser:
      email: newuser@ctstudio.com
      name: New User Name
      password: $2b$12$HASHED_PASSWORD_HERE
      role: sales
```

---

## 💰 ค่าใช้จ่าย

### Streamlit Cloud Free Tier
- ✅ **ฟรี!** สำหรับ public apps
- ✅ 1 private app
- ✅ Resource: 1 GB RAM
- ✅ เหมาะกับทีม 5-10 คน

### ถ้าต้องการเพิ่ม
- **Starter:** $20/เดือน (3 apps)
- **Team:** $250/เดือน (unlimited apps)

---

## 🎓 Tips สำหรับ Production

### 1. Security
- ✅ เปลี่ยน cookie key ใน config.yaml
- ✅ เปลี่ยน password เริ่มต้น
- ✅ ห้าม push keygg.json
- ✅ ใช้ secrets บน Streamlit Cloud

### 2. Performance
- ✅ เพิ่ม cache ให้กับการโหลดข้อมูล
- ✅ ลดการ st.rerun() ที่ไม่จำเป็น
- ✅ Optimize Google Sheets queries

### 3. Monitoring
- ✅ ตรวจสอบ logs เป็นประจำ
- ✅ ดู analytics ใน Streamlit Cloud
- ✅ Test ทุกครั้งหลัง update

### 4. Backup
- ✅ Backup Google Sheets เป็นประจำ
- ✅ Export ข้อมูลสำคัญ
- ✅ เก็บ version control ด้วย git

---

## 📞 ต้องการความช่วยเหลือ?

- Streamlit Docs: https://docs.streamlit.io
- Streamlit Community: https://discuss.streamlit.io
- GitHub Issues: สร้าง issue ใน repo นี้

---

**สร้างโดย:** Claude Code
**วันที่:** 2025-12-19
**Version:** 1.0
