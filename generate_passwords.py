"""
Script สำหรับ generate password hash สำหรับ config.yaml
รันครั้งเดียวเพื่อสร้าง password hash

วิธีใช้:
1. pip install bcrypt
2. python generate_passwords.py
3. คัดลอก hashed password ไปใส่ใน config.yaml
"""

import bcrypt

def hash_password(password: str) -> str:
    """Hash password ด้วย bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

if __name__ == "__main__":
    print("=" * 60)
    print("CT Studio - Password Hash Generator")
    print("=" * 60)

    # Default passwords
    passwords = {
        "admin": "admin123",
        "sales": "sales123"
    }

    print("\n🔐 Generating password hashes...\n")

    for username, password in passwords.items():
        hashed = hash_password(password)
        print(f"Username: {username}")
        print(f"Password: {password}")
        print(f"Hashed:   {hashed}")
        print("-" * 60)

    print("\n✅ Done! Copy the hashed passwords to config.yaml")
    print("\n💡 To generate custom password:")
    print("   python -c \"import bcrypt; print(bcrypt.hashpw(b'YOUR_PASSWORD', bcrypt.gensalt()).decode())\"")
