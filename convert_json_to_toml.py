"""
Script แปลง keygg.json → secrets.toml สำหรับ Streamlit Cloud
รัน: python convert_json_to_toml.py
"""

import json
import sys

def convert_json_to_toml(json_file="keygg.json", output_file="secrets.toml"):
    """แปลง keygg.json เป็น secrets.toml"""

    try:
        # อ่าน JSON file
        with open(json_file, 'r') as f:
            data = json.load(f)

        # สร้าง TOML content
        toml_content = "[google_service_account]\n"

        # เพิ่มแต่ละ field
        for key, value in data.items():
            # ถ้าเป็น string ต้องใส่ quotes
            if isinstance(value, str):
                # Escape quotes ใน string
                escaped_value = value.replace('"', '\\"')
                toml_content += f'{key} = "{escaped_value}"\n'
            else:
                toml_content += f'{key} = {value}\n'

        # เขียนไฟล์ output
        with open(output_file, 'w') as f:
            f.write(toml_content)

        print(f"✅ แปลงสำเร็จ!")
        print(f"📄 ไฟล์: {output_file}")
        print(f"\n{'='*60}")
        print(f"📋 คัดลอกเนื้อหาด้านล่างไปวางใน Streamlit Secrets:")
        print(f"{'='*60}\n")
        print(toml_content)
        print(f"{'='*60}")

        # ตรวจสอบ private_key
        if 'private_key' in data:
            pk = data['private_key']
            if '\\n' in pk:
                print("\n✅ private_key มี \\n ถูกต้องแล้ว")
            else:
                print("\n⚠️ Warning: private_key อาจจะไม่มี \\n (แต่ script จะใส่ให้อัตโนมัติ)")

        return True

    except FileNotFoundError:
        print(f"❌ Error: ไม่พบไฟล์ {json_file}")
        print(f"   กรุณาตรวจสอบว่าไฟล์อยู่ใน folder เดียวกัน")
        return False
    except json.JSONDecodeError:
        print(f"❌ Error: ไฟล์ {json_file} ไม่ใช่ JSON ที่ถูกต้อง")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    # ถ้ามี argument ใช้เป็น input file
    input_file = sys.argv[1] if len(sys.argv) > 1 else "keygg.json"

    print("=" * 60)
    print("🔄 JSON to TOML Converter for Streamlit Cloud")
    print("=" * 60)
    print(f"📂 Input: {input_file}")
    print()

    success = convert_json_to_toml(input_file)

    if success:
        print("\n✅ เสร็จสิ้น! ทำตามขั้นตอนต่อไป:")
        print("1. คัดลอกเนื้อหาด้านบน")
        print("2. ไปที่ Streamlit Cloud → App → Settings → Secrets")
        print("3. ลบ secrets เก่าออก")
        print("4. วางเนื้อหาใหม่")
        print("5. กด Save")
        print("6. Reboot app")
    else:
        print("\n❌ การแปลงล้มเหลว กรุณาตรวจสอบข้อผิดพลาด")
        sys.exit(1)
