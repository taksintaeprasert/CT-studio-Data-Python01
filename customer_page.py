"""
CT Studio - หน้าจัดการข้อมูลลูกค้า
"""

import streamlit as st
from typing import List, Dict
import time

from sheets import ws_customers
from ct_logger import get_logger

# Initialize
logger = get_logger()


def phone_str(v):
    """แปลงเบอร์โทรให้เป็น string ที่ถูกต้อง"""
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


@st.cache_data(ttl=300)  # เพิ่ม cache เป็น 5 นาที
def load_customers() -> List[Dict]:
    """โหลดข้อมูลลูกค้าจาก Google Sheets"""
    try:
        logger.info("Loading customers for management page")
        rows = ws_customers.get_all_values()
        headers = rows[0] if rows else []
        customers = [dict(zip(headers, r)) for r in rows[1:]] if len(rows) > 1 else []
        logger.info(f"Loaded {len(customers)} customers")
        return customers, headers
    except Exception as e:
        logger.error(f"Failed to load customers: {e}")
        st.error("❌ ไม่สามารถโหลดข้อมูลลูกค้าได้")
        return [], []


def update_customer(customer_id: str, row_index: int, updated_data: Dict):
    """
    อัพเดทข้อมูลลูกค้าใน Google Sheets

    Args:
        customer_id: รหัสลูกค้า
        row_index: แถวที่ต้องอัพเดท (เริ่มจาก 1 = header, 2 = แถวแรก)
        updated_data: ข้อมูลที่ต้องการอัพเดท (dict)
    """
    try:
        logger.info(f"Updating customer {customer_id} at row {row_index}")

        # อัพเดทแต่ละ column
        # สมมติโครงสร้าง: customer_id, created_at, full_name, phone, contact_channel

        if 'full_name' in updated_data:
            ws_customers.update_cell(row_index, 3, updated_data['full_name'])

        if 'phone' in updated_data:
            ws_customers.update_cell(row_index, 4, updated_data['phone'])

        if 'contact_channel' in updated_data:
            ws_customers.update_cell(row_index, 5, updated_data['contact_channel'])

        logger.info(f"Customer {customer_id} updated successfully")

        # Clear cache
        st.cache_data.clear()

    except Exception as e:
        logger.error(f"Failed to update customer: {e}")
        raise Exception(f"ไม่สามารถอัพเดทข้อมูลลูกค้าได้: {str(e)}")


def delete_customer(customer_id: str, row_index: int):
    """
    ลบลูกค้าจาก Google Sheets

    Args:
        customer_id: รหัสลูกค้า
        row_index: แถวที่ต้องลบ (เริ่มจาก 1 = header, 2 = แถวแรก)
    """
    try:
        logger.info(f"Deleting customer {customer_id} at row {row_index}")

        ws_customers.delete_rows(row_index)

        logger.info(f"Customer {customer_id} deleted successfully")

        # Clear cache
        st.cache_data.clear()

        return True

    except Exception as e:
        logger.error(f"Failed to delete customer: {e}")
        raise Exception(f"ไม่สามารถลบลูกค้าได้: {str(e)}")


def show_customer_list():
    """แสดงรายการลูกค้าทั้งหมด"""

    st.subheader("👥 รายการลูกค้าทั้งหมด")

    # โหลดข้อมูลลูกค้า
    customers, headers = load_customers()

    if not customers:
        st.info("ยังไม่มีข้อมูลลูกค้าในระบบ")
        return

    # แสดงจำนวนลูกค้า
    st.info(f"📊 มีลูกค้าทั้งหมด: **{len(customers)}** คน")

    # ช่องค้นหา
    search_term = st.text_input(
        "🔍 ค้นหาลูกค้า",
        placeholder="ค้นหาจากชื่อ, เบอร์โทร, หรือรหัสลูกค้า...",
        key="customer_search"
    )

    # กรองข้อมูลตามการค้นหา
    if search_term:
        search_lower = search_term.lower()
        filtered_customers = [
            c for c in customers
            if search_lower in str(c.get('full_name', '')).lower()
            or search_lower in str(c.get('phone', '')).lower()
            or search_lower in str(c.get('customer_id', '')).lower()
        ]
    else:
        filtered_customers = customers

    st.markdown(f"แสดง **{len(filtered_customers)}** คน")
    st.markdown("---")

    # แสดงรายการลูกค้า
    if not filtered_customers:
        st.warning("ไม่พบลูกค้าที่ค้นหา")
        return

    # แสดงเป็น Expander (ลด UI ให้เรียบง่าย)
    for idx, customer in enumerate(filtered_customers):
        customer_id = customer.get('customer_id', 'N/A')
        full_name = customer.get('full_name', 'N/A')
        phone = phone_str(customer.get('phone', 'N/A'))
        contact_channel = customer.get('contact_channel', 'N/A')

        # หาลำดับแถวใน Google Sheets (row_index)
        original_idx = customers.index(customer)
        row_index = original_idx + 2  # +2 เพราะ header=1, data เริ่ม=2

        # ใช้ expander แทน container
        with st.expander(
            f"👤 {full_name} | 📞 {phone} | 📋 {customer_id}",
            expanded=False
        ):
            # ฟอร์มแก้ไขข้อมูลลูกค้า (ใช้ row_index เป็น key เพื่อป้องกัน duplicate)
            with st.form(f"edit_customer_form_{row_index}"):
                st.markdown("#### ✏️ แก้ไขข้อมูลลูกค้า")

                edit_full_name = st.text_input(
                    "ชื่อ-นามสกุล *",
                    value=full_name,
                    key=f"edit_name_{row_index}"
                )

                edit_phone = st.text_input(
                    "เบอร์โทร *",
                    value=phone,
                    key=f"edit_phone_{row_index}"
                )

                edit_contact_channel = st.selectbox(
                    "ช่องทางติดต่อ *",
                    ["facebook", "line", "phone", "walkin", "other"],
                    index=["facebook", "line", "phone", "walkin", "other"].index(contact_channel) if contact_channel in ["facebook", "line", "phone", "walkin", "other"] else 0,
                    key=f"edit_channel_{row_index}"
                )

                save_button = st.form_submit_button(
                    "💾 บันทึกการแก้ไข",
                    use_container_width=True,
                    type="primary"
                )

            # Handle บันทึก
            if save_button:
                try:
                    updated_data = {
                        'full_name': edit_full_name,
                        'phone': edit_phone,
                        'contact_channel': edit_contact_channel
                    }

                    update_customer(customer_id, row_index, updated_data)

                    st.success("✅ บันทึกการแก้ไขเรียบร้อย!")
                    time.sleep(1)
                    st.rerun()

                except Exception as e:
                    st.error(f"❌ เกิดข้อผิดพลาด: {str(e)}")

            st.markdown("---")

            # ปุ่มลบลูกค้า
            if st.button(
                "🗑️ ลบลูกค้า",
                key=f"delete_customer_{row_index}",
                type="secondary",
                use_container_width=True
            ):
                confirm_key = f'confirm_delete_customer_{customer_id}'
                if st.session_state.get(confirm_key, False):
                    try:
                        delete_customer(customer_id, row_index)
                        st.success(f"✅ ลบลูกค้า {customer_id} สำเร็จ!")
                        time.sleep(1)
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ {str(e)}")
                else:
                    st.session_state[confirm_key] = True
                    st.warning("⚠️ กดอีกครั้งเพื่อยืนยันการลบ")
                    st.rerun()


def render_customer_page():
    """Render หน้าจัดการลูกค้า"""

    st.title("👥 จัดการข้อมูลลูกค้า")
    st.markdown("---")

    show_customer_list()
