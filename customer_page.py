"""
CT Studio - หน้าจัดการข้อมูลลูกค้าและรูปภาพ
"""

import streamlit as st
from typing import List, Dict
import time
from datetime import datetime

from sheets import ws_customers
from drive_manager import get_drive_manager
from ct_logger import get_logger

# Initialize
logger = get_logger()
drive_manager = get_drive_manager()


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


def update_customer_drive_info(customer_id: str, folder_id: str, folder_url: str, row_index: int):
    """
    อัพเดทข้อมูล Drive folder ของลูกค้าใน Google Sheets

    Args:
        customer_id: รหัสลูกค้า
        folder_id: ID ของโฟลเดอร์ใน Drive
        folder_url: URL ของโฟลเดอร์
        row_index: แถวที่ต้องอัพเดท (เริ่มจาก 1 = header, 2 = แถวแรก)
    """
    try:
        logger.info(f"Updating Drive info for customer {customer_id} at row {row_index}")

        # อัพเดท column 7 (drive_folder_id) และ column 8 (folder_url)
        ws_customers.update_cell(row_index, 7, folder_id)
        ws_customers.update_cell(row_index, 8, folder_url)

        logger.info(f"Drive info updated successfully for {customer_id}")

        # Clear cache เพื่อให้โหลดข้อมูลใหม่
        st.cache_data.clear()

    except Exception as e:
        logger.error(f"Failed to update Drive info: {e}")
        raise Exception(f"ไม่สามารถอัพเดทข้อมูล Drive ได้: {str(e)}")


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
        # สมมติโครงสร้าง: customer_id, full_name, phone, contact_channel, ...

        if 'full_name' in updated_data:
            ws_customers.update_cell(row_index, 2, updated_data['full_name'])

        if 'phone' in updated_data:
            ws_customers.update_cell(row_index, 3, updated_data['phone'])

        if 'contact_channel' in updated_data:
            ws_customers.update_cell(row_index, 4, updated_data['contact_channel'])

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
        drive_folder_id = customer.get('drive_folder_id', '')
        folder_url = customer.get('folder_url', '')

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

            # ปุ่มจัดการรูปภาพ และปุ่มลบ (ใช้ row_index เป็น key)
            col_photo, col_delete = st.columns(2)

            with col_photo:
                if st.button(
                    "📸 จัดการรูปภาพ",
                    key=f"manage_photos_{row_index}",
                    use_container_width=True
                ):
                    # เก็บข้อมูลลูกค้าใน session state
                    st.session_state.selected_customer_id = customer_id
                    st.session_state.selected_customer_name = full_name
                    st.session_state.selected_customer_phone = phone  # เพิ่มเบอร์โทร
                    st.session_state.selected_customer_folder_id = drive_folder_id
                    st.session_state.selected_customer_folder_url = folder_url
                    st.session_state.selected_customer_row = row_index
                    st.session_state.show_photo_manager = True
                    st.rerun()

            with col_delete:
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


def show_photo_manager():
    """หน้าจัดการรูปภาพของลูกค้า"""

    customer_id = st.session_state.get('selected_customer_id', '')
    customer_name = st.session_state.get('selected_customer_name', '')
    customer_phone = st.session_state.get('selected_customer_phone', '')  # เพิ่มเบอร์โทร
    folder_id = st.session_state.get('selected_customer_folder_id', '')
    folder_url = st.session_state.get('selected_customer_folder_url', '')
    row_index = st.session_state.get('selected_customer_row', 0)

    # ปุ่มกลับ
    if st.button("⬅️ กลับไปหน้ารายการลูกค้า"):
        st.session_state.show_photo_manager = False
        st.rerun()

    st.markdown("---")

    st.subheader(f"📸 จัดการรูปภาพ: {customer_name}")
    st.caption(f"รหัส: {customer_id} | เบอร์: {customer_phone}")

    try:
        # ตรวจสอบว่ามีโฟลเดอร์หรือยัง ถ้าไม่มีให้สร้าง
        if not folder_id:
            with st.spinner("กำลังสร้างโฟลเดอร์สำหรับลูกค้า..."):
                logger.info(f"Creating folder for customer: {customer_id} (phone: {customer_phone})")

                # สร้างโฟลเดอร์หลักก่อน (ถ้ายังไม่มี)
                drive_manager.get_or_create_main_folder()

                # สร้างโฟลเดอร์ลูกค้า (ใช้เบอร์โทรเป็นชื่อโฟลเดอร์)
                folder_id, folder_url = drive_manager.get_or_create_customer_folder(
                    customer_phone
                )

                # อัพเดทข้อมูลใน Google Sheets
                update_customer_drive_info(customer_id, folder_id, folder_url, row_index)

                # อัพเดท session state
                st.session_state.selected_customer_folder_id = folder_id
                st.session_state.selected_customer_folder_url = folder_url

                st.success("✅ สร้างโฟลเดอร์สำเร็จ!")
                time.sleep(0.5)
                st.rerun()

        # แสดงลิงค์ไปยังโฟลเดอร์
        if folder_url:
            st.markdown(f"📁 [เปิดโฟลเดอร์ใน Google Drive]({folder_url})")

        st.markdown("---")

        # ส่วนอัพโหลดรูปภาพ
        st.markdown("### 📤 อัพโหลดรูปภาพ")

        uploaded_files = st.file_uploader(
            "เลือกรูปภาพ (สามารถเลือกหลายไฟล์พร้อมกันได้)",
            type=['png', 'jpg', 'jpeg', 'gif', 'webp'],
            accept_multiple_files=True,
            key="photo_uploader"
        )

        if uploaded_files:
            if st.button("⬆️ อัพโหลดรูปภาพทั้งหมด", type="primary"):
                progress_bar = st.progress(0)
                status_text = st.empty()

                total = len(uploaded_files)
                success_count = 0

                for idx, uploaded_file in enumerate(uploaded_files):
                    try:
                        status_text.text(f"กำลังอัพโหลด: {uploaded_file.name} ({idx+1}/{total})")

                        # อัพโหลดไฟล์
                        file_content = uploaded_file.read()
                        mime_type = uploaded_file.type or 'image/jpeg'

                        # สร้างชื่อไฟล์ที่ไม่ซ้ำกัน (เพิ่ม timestamp)
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"{timestamp}_{uploaded_file.name}"

                        drive_manager.upload_image(
                            file_content=file_content,
                            filename=filename,
                            folder_id=folder_id,
                            mime_type=mime_type
                        )

                        success_count += 1
                        logger.info(f"Uploaded: {filename}")

                    except Exception as e:
                        logger.error(f"Failed to upload {uploaded_file.name}: {e}")
                        st.error(f"❌ ไม่สามารถอัพโหลด {uploaded_file.name}: {str(e)}")

                    # อัพเดท progress bar
                    progress_bar.progress((idx + 1) / total)

                status_text.text("")
                progress_bar.empty()

                if success_count > 0:
                    st.success(f"✅ อัพโหลดสำเร็จ {success_count}/{total} ไฟล์")
                    time.sleep(1)
                    st.rerun()

        st.markdown("---")

        # ส่วนแสดงรูปภาพทั้งหมด
        st.markdown("### 🖼️ รูปภาพทั้งหมด")

        col1, col2 = st.columns([4, 1])
        with col2:
            if st.button("🔄 รีเฟรช", use_container_width=True):
                st.rerun()

        with st.spinner("กำลังโหลดรูปภาพ..."):
            images = drive_manager.list_images(folder_id)

        if not images:
            st.info("ยังไม่มีรูปภาพในโฟลเดอร์นี้")
        else:
            st.markdown(f"พบ **{len(images)}** รูปภาพ")

            # แสดงรูปภาพเป็น Grid (3 คอลัมน์)
            cols_per_row = 3

            for i in range(0, len(images), cols_per_row):
                cols = st.columns(cols_per_row)

                for j in range(cols_per_row):
                    idx = i + j
                    if idx >= len(images):
                        break

                    image = images[idx]

                    with cols[j]:
                        # แสดงรูปภาพ
                        thumbnail_link = image.get('thumbnailLink', '')
                        if thumbnail_link:
                            # แสดง thumbnail
                            st.image(thumbnail_link, use_container_width=True)
                        else:
                            # ถ้าไม่มี thumbnail แสดงไอคอนแทน
                            st.markdown("🖼️")

                        # ชื่อไฟล์
                        st.caption(image.get('name', 'N/A'))

                        # ขนาดไฟล์
                        size = int(image.get('size', 0))
                        size_kb = size / 1024
                        if size_kb < 1024:
                            st.caption(f"📦 {size_kb:.1f} KB")
                        else:
                            st.caption(f"📦 {size_kb/1024:.1f} MB")

                        # ปุ่มดูและลบ
                        col_a, col_b = st.columns(2)

                        with col_a:
                            view_link = image.get('webViewLink', '')
                            if view_link:
                                st.markdown(f"[🔍 ดู]({view_link})")

                        with col_b:
                            if st.button("🗑️", key=f"delete_{image['id']}", help="ลบรูปภาพ"):
                                try:
                                    with st.spinner("กำลังลบ..."):
                                        drive_manager.delete_image(image['id'])
                                    st.success("✅ ลบสำเร็จ!")
                                    time.sleep(0.5)
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"❌ ไม่สามารถลบได้: {str(e)}")

                        st.markdown("---")

    except Exception as e:
        logger.error(f"Error in photo manager: {e}")
        st.error(f"❌ เกิดข้อผิดพลาด: {str(e)}")


def render_customer_page():
    """Render หน้าจัดการลูกค้า"""

    st.title("👥 จัดการข้อมูลลูกค้า")
    st.markdown("---")

    # ตรวจสอบว่าต้องแสดงหน้าจัดการรูปภาพหรือไม่
    if st.session_state.get('show_photo_manager', False):
        show_photo_manager()
    else:
        show_customer_list()
