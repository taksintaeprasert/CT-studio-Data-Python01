"""
Script สร้าง Streamlit Secrets โดยใช้ Base64 สำหรับ private_key
แก้ปัญหา TOML newline formatting

รัน: python generate_base64_secrets.py
"""

import json
import base64

def generate_secrets(json_file="keygg.json"):
    """สร้าง TOML secrets โดย encode private_key เป็น base64"""

    try:
        # อ่าน JSON file
        with open(json_file, 'r') as f:
            data = json.load(f)

        print("=" * 70)
        print("🔐 Base64 Secrets Generator for Streamlit Cloud")
        print("=" * 70)

        # Encode private_key เป็น base64
        if 'private_key' in data:
            private_key = data['private_key']
            # Encode เป็น base64 string
            private_key_base64 = base64.b64encode(private_key.encode('utf-8')).decode('utf-8')

            print("\n✅ Encode private_key เป็น base64 สำเร็จ")
            print(f"   ความยาว: {len(private_key_base64)} ตัวอักษร")
        else:
            print("\n❌ Error: ไม่พบ private_key ใน JSON")
            return False

        # สร้าง TOML content (private_key เป็น base64 บรรทัดเดียว)
        toml_content = "[google_service_account]\n"

        for key, value in data.items():
            if key == 'private_key':
                # ใช้ base64 string แทน
                toml_content += f'private_key_base64 = "{private_key_base64}"\n'
            elif isinstance(value, str):
                escaped_value = value.replace('"', '\\"')
                toml_content += f'{key} = "{escaped_value}"\n'
            else:
                toml_content += f'{key} = {value}\n'

        # บันทึกไฟล์
        output_file = "secrets_base64.toml"
        with open(output_file, 'w') as f:
            f.write(toml_content)

        print(f"\n📄 บันทึกไฟล์: {output_file}")
        print("\n" + "=" * 70)
        print("📋 คัดลอกเนื้อหาด้านล่างไปวาง Streamlit Cloud Secrets:")
        print("=" * 70)
        print()
        print(toml_content)
        print("=" * 70)

        print("\n✅ ขั้นตอนต่อไป:")
        print("1. คัดลอก TOML ด้านบน")
        print("2. Streamlit Cloud → Settings → Secrets → ลบเก่า → วางใหม่ → Save")
        print("3. ไม่ต้องแก้ code เพิ่ม (config.py จะ auto-detect)")
        print("4. Reboot app")

        return True

    except FileNotFoundError:
        print(f"❌ Error: ไม่พบไฟล์ {json_file}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    generate_secrets()
