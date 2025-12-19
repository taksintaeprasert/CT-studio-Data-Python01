"""
CT Studio - หน้าแก้ไข Order
"""

import streamlit as st
from typing import List, Dict
import time
from datetime import datetime, date

from sheets import ws_orders, ws_order_items, ws_master_item, ws_staff, ws_customers
from sheets_helper import safe_get_orders, safe_get_order_items
from orders import ValidationError
from ct_logger import get_logger

# Initialize
logger = get_logger()


def phone_str(v):
    """แปลงเบอร์โทรให้เป็น string ที่ถูกต้อง"""
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


def to_float(x):
    """แปลงราคาเป็น float (รองรับ ฿ และ comma)"""
    if not x:
        return 0.0
    try:
        # ลบ comma, ฿, และช่องว่างออก
        clean = str(x).replace(",", "").replace("฿", "").strip()
        return float(clean)
    except (ValueError, AttributeError):
        return 0.0


@st.cache_data(ttl=300)  # เพิ่ม cache เป็น 5 นาที
def load_orders() -> List[Dict]:
    """โหลดข้อมูล Orders ทั้งหมด"""
    try:
        logger.info("Loading orders for edit page")
        orders = safe_get_orders()
        logger.info(f"Loaded {len(orders)} orders")
        return orders
    except Exception as e:
        logger.error(f"Failed to load orders: {e}")
        st.error("❌ ไม่สามารถโหลดข้อมูล Orders ได้")
        return []


@st.cache_data(ttl=300)  # เพิ่ม cache เป็น 5 นาที
def load_order_items(order_id: str) -> List[Dict]:
    """โหลดรายการสินค้าของ Order"""
    try:
        logger.info(f"Loading order items for: {order_id}")
        all_items = safe_get_order_items()
        order_items = [item for item in all_items if str(item.get('order_id')) == str(order_id)]
        logger.info(f"Loaded {len(order_items)} items for order {order_id}")
        return order_items
    except Exception as e:
        logger.error(f"Failed to load order items: {e}")
        return []


def update_order(order_id: str, row_index: int, updated_data: Dict):
    """
    อัพเดทข้อมูล Order ใน Google Sheets

    Args:
        order_id: รหัส Order
        row_index: แถวใน Google Sheets (เริ่มจาก 1 = header, 2 = data แถวแรก)
        updated_data: ข้อมูลที่ต้องการอัพเดท
    """
    try:
        logger.info(f"Updating order {order_id} at row {row_index}")

        # อัพเดทแต่ละ column
        # สมมติโครงสร้าง: order_id, created_at, customer_id, appointment_date, appointment_time, sales_id, artist_id, channel, order_status, total_income, note

        if 'appointment_date' in updated_data:
            ws_orders.update_cell(row_index, 4, updated_data['appointment_date'])

        if 'appointment_time' in updated_data:
            ws_orders.update_cell(row_index, 5, updated_data['appointment_time'])

        if 'sales_id' in updated_data:
            ws_orders.update_cell(row_index, 6, updated_data['sales_id'])

        if 'artist_id' in updated_data:
            ws_orders.update_cell(row_index, 7, updated_data['artist_id'])

        if 'channel' in updated_data:
            ws_orders.update_cell(row_index, 8, updated_data['channel'])

        if 'order_status' in updated_data:
            ws_orders.update_cell(row_index, 9, updated_data['order_status'])

        if 'note' in updated_data:
            ws_orders.update_cell(row_index, 11, updated_data['note'])

        logger.info(f"Order {order_id} updated successfully")

        # Clear cache
        st.cache_data.clear()

    except Exception as e:
        logger.error(f"Failed to update order: {e}")
        raise Exception(f"ไม่สามารถอัพเดท Order ได้: {str(e)}")


def delete_order_item(item_id: str):
    """ลบรายการสินค้าจาก Order"""
    try:
        logger.info(f"Deleting order item: {item_id}")

        # หาแถวที่ต้องลบ
        all_items = safe_get_order_items()
        row_index = None

        for idx, item in enumerate(all_items, start=2):  # start=2 เพราะ row 1 = header
            if str(item.get('order_item_id')) == str(item_id):
                row_index = idx
                break

        if row_index:
            ws_order_items.delete_rows(row_index)
            logger.info(f"Order item {item_id} deleted from row {row_index}")
            st.cache_data.clear()
            return True
        else:
            logger.warning(f"Order item {item_id} not found")
            return False

    except Exception as e:
        logger.error(f"Failed to delete order item: {e}")
        raise Exception(f"ไม่สามารถลบรายการสินค้าได้: {str(e)}")


def add_order_item(order_id: str, item_code: str):
    """เพิ่มรายการสินค้าลง Order"""
    try:
        import uuid
        from orders import add_order_item as add_item_func, update_order_total

        logger.info(f"Adding item {item_code} to order {order_id}")

        # เพิ่มรายการใหม่
        add_item_func(
            ws_order_items=ws_order_items,
            ws_master_item=ws_master_item,
            order_id=order_id,
            item_code=item_code,
            is_upsell=False
        )

        # อัพเดทยอดรวม
        update_order_total(ws_orders, ws_order_items, order_id)

        logger.info(f"Item {item_code} added to order {order_id}")
        st.cache_data.clear()
        return True

    except Exception as e:
        logger.error(f"Failed to add order item: {e}")
        raise Exception(f"ไม่สามารถเพิ่มรายการสินค้าได้: {str(e)}")


def delete_order(order_id: str):
    """ลบ Order และรายการสินค้าทั้งหมด"""
    try:
        logger.info(f"Deleting order: {order_id}")

        # ลบรายการสินค้าทั้งหมดใน order ก่อน
        all_items = safe_get_order_items()
        for idx, item in enumerate(all_items, start=2):
            if str(item.get('order_id')) == str(order_id):
                ws_order_items.delete_rows(idx)
                logger.info(f"Deleted item row {idx}")

        # ลบ order
        all_orders = safe_get_orders()
        for idx, order in enumerate(all_orders, start=2):
            if str(order.get('order_id')) == str(order_id):
                ws_orders.delete_rows(idx)
                logger.info(f"Deleted order row {idx}")
                break

        st.cache_data.clear()
        return True

    except Exception as e:
        logger.error(f"Failed to delete order: {e}")
        raise Exception(f"ไม่สามารถลบ Order ได้: {str(e)}")


def render_order_edit_page(master_items, staff, customers):
    """Render หน้าแก้ไข Order"""

    st.title("✏️ แก้ไข Order")
    st.markdown("---")

    # โหลดข้อมูล Orders
    orders = load_orders()

    if not orders:
        st.info("ยังไม่มี Order ในระบบ")
        return

    # ตั้งค่า pagination
    ITEMS_PER_PAGE = 15

    # Initialize session state สำหรับ pagination
    if 'current_page' not in st.session_state:
        st.session_state.current_page = 1

    # แสดงจำนวน Order
    st.info(f"📊 มี Order ทั้งหมด: **{len(orders)}** รายการ")

    # ฟิลเตอร์
    st.markdown("### 🔍 กรองข้อมูล")

    col1, col2, col3 = st.columns([2, 1, 1])

    with col1:
        search_term = st.text_input(
            "ค้นหา",
            placeholder="Order ID, Customer ID...",
            key="order_search",
            label_visibility="collapsed"
        )

    with col2:
        # Filter วันที่นัดหมาย (เริ่มต้น)
        date_from = st.date_input(
            "จากวันที่",
            value=None,
            key="date_from",
            help="กรองตามวันนัดหมาย (เริ่มต้น)"
        )

    with col3:
        # Filter วันที่นัดหมาย (สิ้นสุด)
        date_to = st.date_input(
            "ถึงวันที่",
            value=None,
            key="date_to",
            help="กรองตามวันนัดหมาย (สิ้นสุด)"
        )

    col4, col5 = st.columns([1, 3])

    with col4:
        # Filter สถานะ
        status_filter = st.selectbox(
            "สถานะ",
            ["ทั้งหมด", "booking", "active", "cancel", "done"],
            format_func=lambda x: {
                "ทั้งหมด": "📋 ทั้งหมด",
                "booking": "📅 จอง",
                "active": "✅ เข้ารับบริการ",
                "cancel": "❌ ยกเลิก",
                "done": "✔️ เสร็จสิ้น"
            }.get(x, x),
            key="status_filter"
        )

    # กรองข้อมูล
    filtered_orders = orders

    # Filter ตามคำค้นหา
    if search_term:
        search_lower = search_term.lower()
        filtered_orders = [
            o for o in filtered_orders
            if search_lower in str(o.get('order_id', '')).lower()
            or search_lower in str(o.get('customer_id', '')).lower()
        ]

    # Filter ตามวันที่นัดหมาย
    if date_from:
        filtered_orders = [
            o for o in filtered_orders
            if o.get('appointment_date') and str(o.get('appointment_date')) >= str(date_from)
        ]

    if date_to:
        filtered_orders = [
            o for o in filtered_orders
            if o.get('appointment_date') and str(o.get('appointment_date')) <= str(date_to)
        ]

    # Filter ตามสถานะ
    if status_filter != "ทั้งหมด":
        filtered_orders = [
            o for o in filtered_orders
            if str(o.get('order_status', '')).lower() == status_filter.lower()
        ]

    # เรียงตาม created_at ล่าสุดก่อน
    filtered_orders = sorted(filtered_orders, key=lambda x: x.get('created_at', ''), reverse=True)

    # คำนวณจำนวนหน้า
    total_filtered = len(filtered_orders)
    total_pages = (total_filtered + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE  # ปัดขึ้น

    # ตรวจสอบ current_page ไม่เกินจำนวนหน้า
    if st.session_state.current_page > total_pages and total_pages > 0:
        st.session_state.current_page = total_pages

    # คำนวณ start และ end index สำหรับหน้าปัจจุบัน
    start_idx = (st.session_state.current_page - 1) * ITEMS_PER_PAGE
    end_idx = min(start_idx + ITEMS_PER_PAGE, total_filtered)

    # แสดงข้อมูล pagination
    if total_filtered > 0:
        st.markdown(f"แสดง **{start_idx + 1}-{end_idx}** จาก **{total_filtered}** รายการ (หน้า {st.session_state.current_page}/{total_pages})")
    else:
        st.markdown(f"แสดง **0** รายการ")

    # ปุ่ม pagination
    if total_pages > 1:
        col1, col2, col3, col4, col5 = st.columns([1, 1, 2, 1, 1])

        with col1:
            if st.button("⏮️ แรก", disabled=(st.session_state.current_page == 1), use_container_width=True):
                st.session_state.current_page = 1
                st.rerun()

        with col2:
            if st.button("◀️ ก่อนหน้า", disabled=(st.session_state.current_page == 1), use_container_width=True):
                st.session_state.current_page -= 1
                st.rerun()

        with col3:
            # Page selector
            selected_page = st.selectbox(
                "เลือกหน้า",
                range(1, total_pages + 1),
                index=st.session_state.current_page - 1,
                key="page_selector",
                label_visibility="collapsed"
            )
            if selected_page != st.session_state.current_page:
                st.session_state.current_page = selected_page
                st.rerun()

        with col4:
            if st.button("▶️ ถัดไป", disabled=(st.session_state.current_page == total_pages), use_container_width=True):
                st.session_state.current_page += 1
                st.rerun()

        with col5:
            if st.button("⏭️ สุดท้าย", disabled=(st.session_state.current_page == total_pages), use_container_width=True):
                st.session_state.current_page = total_pages
                st.rerun()

    st.markdown("---")

    # แสดงรายการ Order
    if not filtered_orders:
        st.warning("ไม่พบ Order ที่ค้นหา")
        return

    # แสดงเฉพาะรายการในหน้าปัจจุบัน
    page_orders = filtered_orders[start_idx:end_idx]

    for idx, order in enumerate(page_orders):
        order_id = order.get('order_id', 'N/A')
        customer_id = order.get('customer_id', 'N/A')
        appointment_date = order.get('appointment_date', 'N/A')
        appointment_time = order.get('appointment_time', 'N/A')
        order_status = order.get('order_status', 'N/A')
        total_income = order.get('total_income', 0)

        # หาลำดับแถวใน Google Sheets
        original_idx = orders.index(order)
        row_index = original_idx + 2  # +2 เพราะ header=1, data เริ่ม=2

        status_icons = {
            "booking": "📅",
            "active": "✅",
            "cancel": "❌",
            "done": "✔️"
        }

        # ใช้ expander แทนการกดปุ่มไปหน้าใหม่
        with st.expander(
            f"📋 {order_id} | 👤 {customer_id} | 📅 {appointment_date} {appointment_time} | {status_icons.get(order_status, '')} {order_status} | 💰 {to_float(total_income):,.2f} ฿",
            expanded=False
        ):
            # แสดงฟอร์มแก้ไขใน expander
            show_order_editor_inline(order, order_id, row_index, master_items, staff)


def show_order_editor_inline(order_data, order_id, row_index, master_items, staff):
    """แสดงฟอร์มแก้ไข Order แบบ inline ใน expander"""

    # Initialize session state สำหรับเก็บรายการที่จะลบ
    delete_key = f'items_to_delete_{order_id}'
    if delete_key not in st.session_state:
        st.session_state[delete_key] = []

    # แสดงข้อมูลลูกค้า และปุ่มลบ
    col1, col2 = st.columns([4, 1])
    with col1:
        st.info(f"**ลูกค้า:** {order_data.get('customer_id', 'N/A')}")
    with col2:
        if st.button("🗑️ ลบ Order", key=f"delete_order_{order_id}", type="secondary", use_container_width=True):
            if st.session_state.get(f'confirm_delete_{order_id}', False):
                try:
                    delete_order(order_id)
                    st.success(f"✅ ลบ Order {order_id} สำเร็จ!")
                    time.sleep(1)
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ {str(e)}")
            else:
                st.session_state[f'confirm_delete_{order_id}'] = True
                st.warning("⚠️ กดอีกครั้งเพื่อยืนยันการลบ")
                st.rerun()

    # ฟอร์มแก้ไข
    with st.form(f"edit_order_form_{order_id}"):
        st.markdown("#### 📅 นัดหมาย")

        col1, col2 = st.columns(2)

        with col1:
            try:
                default_date = datetime.strptime(order_data.get('appointment_date', str(date.today())), "%Y-%m-%d").date()
            except:
                default_date = date.today()

            edit_appointment_date = st.date_input(
                "วันที่นัด *",
                value=default_date,
                key=f"edit_appointment_date_{order_id}"
            )

        with col2:
            edit_appointment_time = st.text_input(
                "เวลานัด *",
                value=order_data.get('appointment_time', ''),
                key=f"edit_appointment_time_{order_id}",
                placeholder="เช่น 14:30"
            )

        st.markdown("---")
        st.markdown("#### 👥 พนักงาน & ช่องทาง")

        sales_ids = [""] + [s.get("staff_id") for s in staff if str(s.get("role")).strip().lower() == "sales" and str(s.get("is_active")).strip().lower() in {"true", "1", "yes"}]
        artist_ids = [""] + [s.get("staff_id") for s in staff if str(s.get("role")).strip().lower() == "artist" and str(s.get("is_active")).strip().lower() in {"true", "1", "yes"}]

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            current_sales = order_data.get('sales_id', '')
            edit_sales_id = st.selectbox(
                "พนักงานขาย *",
                sales_ids,
                index=sales_ids.index(current_sales) if current_sales in sales_ids else 0,
                key=f"edit_sales_id_{order_id}"
            )

        with col2:
            current_artist = order_data.get('artist_id', '')
            edit_artist_id = st.selectbox(
                "ช่างทำ *",
                artist_ids,
                index=artist_ids.index(current_artist) if current_artist in artist_ids else 0,
                key=f"edit_artist_id_{order_id}"
            )

        with col3:
            current_channel = order_data.get('channel', '')
            edit_channel = st.selectbox(
                "ช่องทาง *",
                ["", "facebook", "line", "walkin", "other"],
                index=["", "facebook", "line", "walkin", "other"].index(current_channel) if current_channel in ["", "facebook", "line", "walkin", "other"] else 0,
                key=f"edit_channel_{order_id}"
            )

        with col4:
            current_status = order_data.get('order_status', '')
            edit_order_status = st.selectbox(
                "สถานะ *",
                ["", "booking", "active", "cancel", "done"],
                index=["", "booking", "active", "cancel", "done"].index(current_status) if current_status in ["", "booking", "active", "cancel", "done"] else 0,
                format_func=lambda x: {
                    "": "-- เลือกสถานะ --",
                    "booking": "📅 จอง",
                    "active": "✅ เข้ารับบริการ",
                    "cancel": "❌ ยกเลิก",
                    "done": "✔️ เสร็จสิ้น"
                }.get(x, x),
                key=f"edit_order_status_{order_id}"
            )

        st.markdown("---")
        st.markdown("#### 📝 หมายเหตุ")

        edit_note = st.text_input(
            "หมายเหตุ",
            value=order_data.get('note', ''),
            key=f"edit_note_{order_id}",
            placeholder="ระบุรายละเอียดเพิ่มเติม"
        )

        st.markdown("---")

        # ปุ่มบันทึก
        save_button = st.form_submit_button(
            "💾 บันทึกการแก้ไข",
            use_container_width=True,
            type="primary"
        )

    # Handle บันทึก
    if save_button:
        try:
            # อัพเดทข้อมูล Order
            updated_data = {
                'appointment_date': str(edit_appointment_date),
                'appointment_time': edit_appointment_time,
                'sales_id': edit_sales_id,
                'artist_id': edit_artist_id,
                'channel': edit_channel,
                'order_status': edit_order_status,
                'note': edit_note
            }

            update_order(order_id, row_index, updated_data)

            # ลบรายการสินค้าที่ถูกเลือก (ถ้ามี)
            if st.session_state[delete_key]:
                for item_id in st.session_state[delete_key]:
                    try:
                        delete_order_item(item_id)
                        logger.info(f"Deleted item {item_id} from order {order_id}")
                    except Exception as e:
                        logger.error(f"Failed to delete item {item_id}: {e}")

                # อัพเดทยอดรวม
                from orders import update_order_total
                update_order_total(ws_orders, ws_order_items, order_id)

                # Clear รายการที่จะลบ
                st.session_state[delete_key] = []

            st.success("✅ บันทึกการแก้ไขเรียบร้อย!")
            time.sleep(1)
            st.rerun()

        except Exception as e:
            st.error(f"❌ เกิดข้อผิดพลาด: {str(e)}")

    # ส่วนแก้ไขรายการสินค้า
    st.markdown("---")
    st.markdown("### 💅 รายการสินค้า/บริการ")

    # โหลดรายการสินค้าปัจจุบัน
    order_items = load_order_items(order_id)

    # กรองรายการที่ถูกเลือกให้ลบออก
    active_items = [item for item in order_items if item.get('order_item_id') not in st.session_state[delete_key]]

    if active_items:
        st.markdown("**รายการปัจจุบัน:**")
        for idx, item in enumerate(active_items):
            col_num, col_item, col_price, col_remove = st.columns([0.5, 3, 1.5, 0.5])

            with col_num:
                st.text(f"{idx + 1}.")

            with col_item:
                st.text(item.get('item_name', 'N/A'))

            with col_price:
                st.text(f"{to_float(item.get('list_price', 0)):,.2f} ฿")

            with col_remove:
                if st.button("🗑️", key=f"remove_item_{order_id}_{item.get('order_item_id')}_{idx}", help="ทำเครื่องหมายลบ (กดบันทึกเพื่อยืนยัน)"):
                    # เพิ่มเข้ารายการที่จะลบ
                    if item.get('order_item_id') not in st.session_state[delete_key]:
                        st.session_state[delete_key].append(item.get('order_item_id'))
                        st.rerun()

    # แสดงรายการที่จะลบ (ถ้ามี)
    if st.session_state[delete_key]:
        st.warning(f"⚠️ มี **{len(st.session_state[delete_key])}** รายการที่จะถูกลบเมื่อกดบันทึก")

        # ปุ่มยกเลิกการลบทั้งหมด
        if st.button("↩️ ยกเลิกการลบทั้งหมด", key=f"cancel_delete_{order_id}"):
            st.session_state[delete_key] = []
            st.rerun()

    if not active_items and not st.session_state[delete_key]:
        st.info("ไม่มีรายการสินค้าในคำสั่งซื้อนี้")
    elif not active_items and st.session_state[delete_key]:
        st.info("รายการสินค้าทั้งหมดถูกทำเครื่องหมายให้ลบ (กดบันทึกเพื่อยืนยัน)")

    # เพิ่มรายการใหม่
    st.markdown("**เพิ่มรายการใหม่:**")

    item_codes = [r.get("item_code", "") for r in master_items if r.get("item_code")]

    col_select, col_add = st.columns([4, 1])

    with col_select:
        new_item = st.selectbox(
            "เลือกสินค้า/บริการที่ต้องการเพิ่ม",
            [""] + item_codes,
            format_func=lambda x: "-- เลือกสินค้า/บริการ --" if x == "" else x,
            key=f"new_item_select_{order_id}"
        )

    with col_add:
        st.markdown("<div style='margin-top: 25px;'></div>", unsafe_allow_html=True)
        if st.button("➕ เพิ่ม", use_container_width=True, key=f"add_new_item_btn_{order_id}"):
            if new_item:
                try:
                    add_order_item(order_id, new_item)
                    st.success(f"✅ เพิ่ม {new_item} สำเร็จ!")
                    time.sleep(0.5)
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ ไม่สามารถเพิ่มได้: {str(e)}")


def show_order_editor_old(master_items, staff, customers):
    """แสดงหน้าแก้ไข Order"""

    order_data = st.session_state.get('selected_order_data', {})
    order_id = st.session_state.get('selected_order_id', '')
    row_index = st.session_state.get('selected_order_row', 0)

    # ปุ่มกลับ
    if st.button("⬅️ กลับไปหน้ารายการ Order"):
        st.session_state.show_order_editor = False
        st.rerun()

    st.markdown("---")

    st.subheader(f"✏️ แก้ไข Order: {order_id}")

    # แสดงข้อมูลลูกค้า
    st.info(f"**ลูกค้า:** {order_data.get('customer_id', 'N/A')}")

    # ฟอร์มแก้ไข
    with st.form("edit_order_form"):
        st.markdown("#### 📅 นัดหมาย")

        col1, col2 = st.columns(2)

        with col1:
            edit_appointment_date = st.date_input(
                "วันที่นัด *",
                value=datetime.strptime(order_data.get('appointment_date', str(date.today())), "%Y-%m-%d").date() if order_data.get('appointment_date') else date.today(),
                key="edit_appointment_date"
            )

        with col2:
            edit_appointment_time = st.text_input(
                "เวลานัด *",
                value=order_data.get('appointment_time', ''),
                key="edit_appointment_time",
                placeholder="เช่น 14:30"
            )

        st.markdown("---")
        st.markdown("#### 👥 พนักงาน & ช่องทาง")

        sales_ids = [""] + [s.get("staff_id") for s in staff if str(s.get("role")).strip().lower() == "sales" and str(s.get("is_active")).strip().lower() in {"true", "1", "yes"}]
        artist_ids = [""] + [s.get("staff_id") for s in staff if str(s.get("role")).strip().lower() == "artist" and str(s.get("is_active")).strip().lower() in {"true", "1", "yes"}]

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            current_sales = order_data.get('sales_id', '')
            edit_sales_id = st.selectbox(
                "พนักงานขาย *",
                sales_ids,
                index=sales_ids.index(current_sales) if current_sales in sales_ids else 0,
                key="edit_sales_id"
            )

        with col2:
            current_artist = order_data.get('artist_id', '')
            edit_artist_id = st.selectbox(
                "ช่างทำ *",
                artist_ids,
                index=artist_ids.index(current_artist) if current_artist in artist_ids else 0,
                key="edit_artist_id"
            )

        with col3:
            current_channel = order_data.get('channel', '')
            edit_channel = st.selectbox(
                "ช่องทาง *",
                ["", "facebook", "line", "walkin", "other"],
                index=["", "facebook", "line", "walkin", "other"].index(current_channel) if current_channel in ["", "facebook", "line", "walkin", "other"] else 0,
                key="edit_channel"
            )

        with col4:
            current_status = order_data.get('order_status', '')
            edit_order_status = st.selectbox(
                "สถานะ *",
                ["", "booking", "active", "cancel", "done"],
                index=["", "booking", "active", "cancel", "done"].index(current_status) if current_status in ["", "booking", "active", "cancel", "done"] else 0,
                format_func=lambda x: {
                    "": "-- เลือกสถานะ --",
                    "booking": "📅 จอง",
                    "active": "✅ เข้ารับบริการ",
                    "cancel": "❌ ยกเลิก",
                    "done": "✔️ เสร็จสิ้น"
                }.get(x, x),
                key="edit_order_status"
            )

        st.markdown("---")
        st.markdown("#### 📝 หมายเหตุ")

        edit_note = st.text_input(
            "หมายเหตุ",
            value=order_data.get('note', ''),
            key="edit_note",
            placeholder="ระบุรายละเอียดเพิ่มเติม"
        )

        st.markdown("---")

        # ปุ่มบันทึก
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            save_button = st.form_submit_button(
                "💾 บันทึกการแก้ไข",
                use_container_width=True,
                type="primary"
            )

    # Handle บันทึก
    if save_button:
        try:
            updated_data = {
                'appointment_date': str(edit_appointment_date),
                'appointment_time': edit_appointment_time,
                'sales_id': edit_sales_id,
                'artist_id': edit_artist_id,
                'channel': edit_channel,
                'order_status': edit_order_status,
                'note': edit_note
            }

            update_order(order_id, row_index, updated_data)

            st.success("✅ บันทึกการแก้ไขเรียบร้อย!")
            time.sleep(1)
            st.session_state.show_order_editor = False
            st.rerun()

        except Exception as e:
            st.error(f"❌ เกิดข้อผิดพลาด: {str(e)}")

    # ส่วนแก้ไขรายการสินค้า
    st.markdown("---")
    st.markdown("### 💅 รายการสินค้า/บริการ")

    # โหลดรายการสินค้าปัจจุบัน
    order_items = load_order_items(order_id)

    if order_items:
        st.markdown("**รายการปัจจุบัน:**")
        for idx, item in enumerate(order_items):
            col_num, col_item, col_price, col_remove = st.columns([0.5, 3, 1.5, 0.5])

            with col_num:
                st.text(f"{idx + 1}.")

            with col_item:
                st.text(item.get('item_name', 'N/A'))

            with col_price:
                st.text(f"{to_float(item.get('list_price', 0)):,.2f} ฿")

            with col_remove:
                if st.button("🗑️", key=f"remove_item_{item.get('order_item_id')}_{idx}", help="ลบรายการนี้"):
                    try:
                        delete_order_item(item.get('order_item_id'))
                        # อัพเดทยอดรวม
                        from orders import update_order_total
                        update_order_total(ws_orders, ws_order_items, order_id)
                        st.success("✅ ลบรายการสำเร็จ!")
                        time.sleep(0.5)
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ ไม่สามารถลบได้: {str(e)}")
    else:
        st.info("ไม่มีรายการสินค้าในคำสั่งซื้อนี้")

    # เพิ่มรายการใหม่
    st.markdown("**เพิ่มรายการใหม่:**")

    item_codes = [r.get("item_code", "") for r in master_items if r.get("item_code")]

    col_select, col_add = st.columns([4, 1])

    with col_select:
        new_item = st.selectbox(
            "เลือกสินค้า/บริการที่ต้องการเพิ่ม",
            [""] + item_codes,
            format_func=lambda x: "-- เลือกสินค้า/บริการ --" if x == "" else x,
            key="new_item_select"
        )

    with col_add:
        st.markdown("<div style='margin-top: 25px;'></div>", unsafe_allow_html=True)
        if st.button("➕ เพิ่ม", use_container_width=True, key="add_new_item_btn"):
            if new_item:
                try:
                    add_order_item(order_id, new_item)
                    st.success(f"✅ เพิ่ม {new_item} สำเร็จ!")
                    time.sleep(0.5)
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ ไม่สามารถเพิ่มได้: {str(e)}")
