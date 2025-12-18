import os
import time
import streamlit as st
from datetime import datetime, date

from sheets import ws_orders, ws_order_items, ws_master_item, ws_staff, ws_customers
from orders import create_order_with_items, ValidationError
from ct_logger import get_logger
from customer_page import render_customer_page
from order_edit_page import render_order_edit_page

# Initialize logger
logger = get_logger()
logger.info("=" * 60)
logger.info("Application started")
logger.info("=" * 60)

# =========================
# CONFIG
# =========================
CAT_PATH = os.path.join(os.path.dirname(__file__), "cat.png")

def norm(x):
    return str(x).strip().lower()

def is_true(x):
    return norm(x) in {"true", "1", "yes", "y"}

def phone_str(v):
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s

# =========================
# PAGE CONFIG
# =========================
st.set_page_config(
    page_title="CT Studio - ระบบจัดการ",
    page_icon="💄",
    layout="wide"
)

st.title("💄 CT Studio - ระบบจัดการ")
st.markdown("---")

# -------------------------
# LOAD DATA WITH CACHING
# -------------------------
@st.cache_data(ttl=300)
def load_master_items():
    """โหลดรายการสินค้า/บริการ"""
    try:
        logger.info("Loading master items...")
        items = ws_master_item.get_all_records()
        logger.info(f"Loaded {len(items)} master items")
        return items
    except Exception as e:
        logger.error(f"Failed to load master items: {e}")
        st.error("❌ ไม่สามารถโหลดข้อมูลรายการสินค้าได้")
        st.stop()

@st.cache_data(ttl=300)
def load_staff():
    """โหลดข้อมูลพนักงาน"""
    try:
        logger.info("Loading staff data...")
        staff = ws_staff.get_all_records()
        logger.info(f"Loaded {len(staff)} staff records")
        return staff
    except Exception as e:
        logger.error(f"Failed to load staff: {e}")
        st.error("❌ ไม่สามารถโหลดข้อมูลพนักงานได้")
        st.stop()

@st.cache_data(ttl=60)
def load_customers():
    """โหลดข้อมูลลูกค้า"""
    try:
        logger.info("Loading customers...")
        rows = ws_customers.get_all_values()
        headers = rows[0] if rows else []
        customers = [dict(zip(headers, r)) for r in rows[1:]] if len(rows) > 1 else []
        logger.info(f"Loaded {len(customers)} customers")
        return customers
    except Exception as e:
        logger.error(f"Failed to load customers: {e}")
        st.error("❌ ไม่สามารถโหลดข้อมูลลูกค้าได้")
        st.stop()

# -------------------------
# SYSTEM STATUS CHECK
# -------------------------
with st.sidebar:
    st.markdown("### 🏥 สถานะระบบ")

    try:
        # Test connection
        ws_orders.get_all_records()
        st.success("✅ เชื่อมต่อ Google Sheets สำเร็จ")

        # Load data
        master_items = load_master_items()
        staff = load_staff()
        customers = load_customers()

        # Show stats
        sales_count = len([s for s in staff if norm(s.get("role")) == "sales" and is_true(s.get("is_active"))])
        artist_count = len([s for s in staff if norm(s.get("role")) == "artist" and is_true(s.get("is_active"))])

        st.info(f"""
📊 **ข้อมูลในระบบ:**
- รายการสินค้า/บริการ: {len(master_items)} รายการ
- พนักงานขาย: {sales_count} คน
- ช่างทำ: {artist_count} คน
- ลูกค้า: {len(customers)} คน
        """)

    except Exception as e:
        st.error("❌ ไม่สามารถเชื่อมต่อ Google Sheets")
        st.error("กรุณาตรวจสอบ Internet หรือติดต่อ Admin")
        logger.critical(f"Cannot connect to Google Sheets: {e}")
        st.stop()

    st.markdown("---")
    st.caption("💡 Tips: ถ้าเจอปัญหา ลองกด Ctrl+R รีเฟรชหน้า")

# =========================
# TABS
# =========================
tab1, tab2, tab3 = st.tabs(["📝 รับ Order", "✏️ แก้ไข Order", "👥 จัดการข้อมูลลูกค้า"])

# ========================
# TAB 1: รับ Order
# ========================
with tab1:
    # -------------------------
    # PROCESS DATA
    # -------------------------
    item_codes_raw = [r.get("item_code", "") for r in master_items if r.get("item_code")]
    item_codes = [""] + item_codes_raw

    sales_ids_raw = [s.get("staff_id") for s in staff if norm(s.get("role")) == "sales" and is_true(s.get("is_active"))]
    artist_ids_raw = [s.get("staff_id") for s in staff if norm(s.get("role")) == "artist" and is_true(s.get("is_active"))]
    sales_ids = [""] + [x for x in sales_ids_raw if x]
    artist_ids = [""] + [x for x in artist_ids_raw if x]

    logger.info(f"Processed data: {len(item_codes_raw)} items, {len(sales_ids_raw)} sales, {len(artist_ids_raw)} artists")

    customer_labels_raw = []
    label_to_id = {}
    for c in customers:
        full_name = (c.get("full_name") or "").strip()
        phone = phone_str(c.get("phone") or "")
        cid = (c.get("customer_id") or "").strip()
        label = f"{full_name} | {phone} | {cid}".strip(" |")
        customer_labels_raw.append(label)
        label_to_id[label] = cid

    customer_labels = [""] + customer_labels_raw

    # -------------------------
    # DEFAULTS
    # -------------------------
    FORM_DEFAULTS = {
        "mode": "select",
        "selected_customer": "",
        "full_name": "",
        "phone": "",
        "contact_channel": "",
        "appointment_date": date.today(),
        "appointment_time": "",
        "sales_id": "",
        "artist_id": "",
        "channel": "",
        "order_status": "",
        "selected_items": [],
        "note": "",
    }

    # -------------------------
    # INITIALIZE SESSION STATE
    # -------------------------
    if "_booted_order_entry" not in st.session_state:
        logger.info("Initializing session state")
        st.session_state._booted_order_entry = True
        for k, v in FORM_DEFAULTS.items():
            if k not in st.session_state:
                st.session_state[k] = v

    if st.session_state.get("_needs_reset", False):
        logger.info("Resetting form to defaults")
        for k, v in FORM_DEFAULTS.items():
            st.session_state[k] = v
        st.session_state._needs_reset = False
        st.rerun()

    # -------------------------
    # FORM UI
    # -------------------------
    st.subheader("📝 กรอกข้อมูล Order")

    # Customer Mode
    st.radio(
        "เลือกประเภทลูกค้า",
        ["select", "new"],
        format_func=lambda x: "🔍 เลือกจากลูกค้าเดิม" if x == "select" else "✨ ลูกค้าใหม่",
        horizontal=True,
        key="mode"
    )

    # ส่วนเลือกสินค้า (นอก form เพื่อให้สามารถเพิ่ม/ลบได้โดยไม่ submit)
    st.markdown("#### 💅 รายการสินค้า/บริการ")

    # แก้โครงสร้างข้อมูลให้เก็บเป็น dict พร้อม upsell
    if "selected_items" not in st.session_state:
        st.session_state.selected_items = []

    # ถ้า selected_items เป็น list ของ string (โครงสร้างเก่า) ให้แปลงเป็น dict
    if st.session_state.selected_items and isinstance(st.session_state.selected_items[0], str):
        st.session_state.selected_items = [
            {"item_code": item, "is_upsell": False}
            for item in st.session_state.selected_items
        ]

    col_select, col_add = st.columns([4, 1])
    with col_select:
        selected_item_temp = st.selectbox(
            "เลือกรายการที่ต้องการเพิ่ม",
            [""] + item_codes_raw,
            format_func=lambda x: "-- เลือกสินค้า/บริการ --" if x == "" else x,
            key="temp_item_select"
        )
    with col_add:
        st.markdown("<div style='margin-top: 25px;'></div>", unsafe_allow_html=True)
        if st.button("➕ เพิ่ม", use_container_width=True, key="add_item_btn"):
            if selected_item_temp and selected_item_temp != "":
                st.session_state.selected_items.append({
                    "item_code": selected_item_temp,
                    "is_upsell": False
                })
                # แสดง success message
                st.success(f"✅ เพิ่ม {selected_item_temp} แล้ว")
                time.sleep(0.3)
                st.rerun()

    # แสดงรายการที่เลือก
    if st.session_state.selected_items:
        st.markdown("**รายการที่เลือก:**")
        for idx, item_data in enumerate(st.session_state.selected_items):
            item_code = item_data["item_code"]
            is_upsell = item_data.get("is_upsell", False)

            col_num, col_item, col_upsell, col_remove = st.columns([0.5, 3, 1, 0.5])
            with col_num:
                st.text(f"{idx + 1}.")
            with col_item:
                st.text(item_code)
            with col_upsell:
                # Checkbox สำหรับ up-sell
                upsell_checked = st.checkbox(
                    "🎁 Up-sell",
                    value=is_upsell,
                    key=f"upsell_{idx}",
                    help="ติ๊กถ้าเป็นการขายเพิ่ม"
                )
                # อัพเดทค่าใน session state
                if upsell_checked != is_upsell:
                    st.session_state.selected_items[idx]["is_upsell"] = upsell_checked
            with col_remove:
                if st.button("🗑️", key=f"remove_item_{idx}", help="ลบรายการนี้"):
                    st.session_state.selected_items.pop(idx)
                    st.rerun()
    else:
        st.info("ยังไม่ได้เลือกรายการสินค้า/บริการ (กด ➕ เพิ่ม เพื่อเพิ่มรายการ)")

    st.markdown("---")

    # ฟอร์มหลัก
    with st.form("order_form"):
        customer_id = ""

        # Customer Section
        st.markdown("#### 👤 ข้อมูลลูกค้า")
        col1, col2 = st.columns([2, 1])

        with col1:
            if st.session_state["mode"] == "select":
                st.selectbox(
                    "เลือกลูกค้า",
                    customer_labels,
                    key="selected_customer",
                    help="เลือกจากลูกค้าที่มีในระบบ"
                )
                selected_label = st.session_state.get("selected_customer", "")
                customer_id = label_to_id.get(selected_label, "") if selected_label else ""

                if st.session_state.get("full_name"):
                    st.session_state["full_name"] = ""
                if st.session_state.get("phone"):
                    st.session_state["phone"] = ""
                if st.session_state.get("contact_channel"):
                    st.session_state["contact_channel"] = ""
            else:
                st.text_input("ชื่อ-นามสกุล *", key="full_name", placeholder="กรอกชื่อ-นามสกุล")
                st.text_input("เบอร์โทรศัพท์ *", key="phone", placeholder="08XXXXXXXX")
                st.selectbox(
                    "ช่องทางติดต่อ",
                    ["", "facebook", "line", "walkin", "other"],
                    format_func=lambda x: "-- เลือก --" if x == "" else x.title(),
                    key="contact_channel"
                )
                customer_id = f"CUST-{st.session_state['phone'].strip()}" if st.session_state["phone"].strip() else ""

        st.markdown("---")

        # Appointment Section
        st.markdown("#### 📅 นัดหมาย")
        col1, col2 = st.columns(2)

        with col1:
            st.date_input("วันที่นัด *", key="appointment_date", help="เลือกวันที่นัดหมาย")

        with col2:
            st.text_input(
                "เวลานัด *",
                key="appointment_time",
                placeholder="เช่น 14:30",
                help="รูปแบบ: ชั่วโมง:นาที (เช่น 14:30)"
            )

        st.markdown("---")

        # Staff & Channel Section
        st.markdown("#### 👥 พนักงาน & ช่องทาง")
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.selectbox(
                "พนักงานขาย *",
                sales_ids,
                format_func=lambda x: "-- เลือกพนักงานขาย --" if x == "" else x,
                key="sales_id"
            )

        with col2:
            st.selectbox(
                "ช่างทำ *",
                artist_ids,
                format_func=lambda x: "-- เลือกช่าง --" if x == "" else x,
                key="artist_id"
            )

        with col3:
            st.selectbox(
                "ช่องทาง *",
                ["", "facebook", "line", "walkin", "other"],
                format_func=lambda x: "-- เลือกช่องทาง --" if x == "" else x.title(),
                key="channel"
            )

        with col4:
            st.selectbox(
                "สถานะ *",
                ["", "booking", "active", "cancel", "done"],
                format_func=lambda x: {
                    "": "-- เลือกสถานะ --",
                    "booking": "📅 จอง",
                    "active": "✅ เข้ารับบริการ",
                    "cancel": "❌ ยกเลิก",
                    "done": "✔️ เสร็จสิ้น"
                }.get(x, x),
                key="order_status"
            )

        st.markdown("---")

        # Note
        st.text_input("หมายเหตุ", key="note", placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)")

        st.markdown("---")

        # Submit Button
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            submitted = st.form_submit_button(
                "💾 บันทึก Order",
                use_container_width=True,
                type="primary"
            )

    # -------------------------
    # SUBMIT HANDLER
    # -------------------------
    if submitted:
        logger.info("Form submitted")

        selected_items = st.session_state.get("selected_items", [])

        logger.info(
            "Processing order submission",
            extra={
                'customer_id': customer_id,
                'mode': st.session_state["mode"],
                'item_count': len(selected_items),
                'sales_id': st.session_state["sales_id"],
                'artist_id': st.session_state["artist_id"]
            }
        )

        # Validation
        validation_errors = []

        if not customer_id:
            if st.session_state["mode"] == "new":
                validation_errors.append("❌ กรุณากรอกชื่อและเบอร์โทรศัพท์ของลูกค้า")
            else:
                validation_errors.append("❌ กรุณาเลือกลูกค้า")

        if not selected_items:
            validation_errors.append("❌ กรุณาเลือกรายการสินค้า/บริการอย่างน้อย 1 รายการ")

        if not st.session_state["sales_id"]:
            validation_errors.append("❌ กรุณาเลือกพนักงานขาย")

        if not st.session_state["artist_id"]:
            validation_errors.append("❌ กรุณาเลือกช่างทำ")

        if not st.session_state["channel"]:
            validation_errors.append("❌ กรุณาเลือกช่องทาง")

        if not st.session_state["order_status"]:
            validation_errors.append("❌ กรุณาเลือกสถานะ")

        if not st.session_state["appointment_time"]:
            validation_errors.append("❌ กรุณากรอกเวลานัด (เช่น 14:30)")

        if validation_errors:
            logger.warning(f"Validation failed: {validation_errors}")
            st.error("### ⚠️ กรุณากรอกข้อมูลให้ครบถ้วน")
            for error in validation_errors:
                st.error(error)
            st.stop()

        try:
            # Create new customer
            if st.session_state["mode"] == "new":
                logger.info(f"Creating new customer: {customer_id}")
                ws_customers.append_row([
                    customer_id,
                    datetime.now().isoformat(),
                    st.session_state["full_name"],
                    st.session_state["phone"],
                    st.session_state["contact_channel"],
                    "",
                    "",  # drive_folder_id
                    ""   # folder_url
                ])
                logger.info(f"New customer created: {customer_id}")
                st.cache_data.clear()

            # Create order
            logger.info(f"Creating order for customer: {customer_id}")

            # แยก item_codes และ upsell_flags จาก selected_items
            item_codes = [item["item_code"] for item in selected_items]
            upsell_flags = [item.get("is_upsell", False) for item in selected_items]

            order_id, total = create_order_with_items(
                ws_orders=ws_orders,
                ws_order_items=ws_order_items,
                ws_master_item=ws_master_item,
                customer_id=customer_id,
                appointment_date=str(st.session_state["appointment_date"]),
                appointment_time=st.session_state["appointment_time"],
                sales_id=st.session_state["sales_id"],
                artist_id=st.session_state["artist_id"],
                channel=st.session_state["channel"],
                order_status=st.session_state["order_status"],
                item_codes=item_codes,
                upsell_flags=upsell_flags,
                note=st.session_state["note"],
            )

            logger.info(f"Order completed successfully: {order_id} (Total: {total})")

            # Success message
            msg = st.empty()
            msg.success(f"""
### ✅ บันทึกสำเร็จ!

**Order ID:** `{order_id}`
**ยอดรวม:** {total:,.2f} บาท
**จำนวนรายการ:** {len(selected_items)} รายการ
            """)
            st.balloons()

            if os.path.exists(CAT_PATH):
                st.image(CAT_PATH, caption="เรียบร้อยแล้ว 😺", width=300)

            time.sleep(3)
            msg.empty()

            st.session_state._needs_reset = True
            st.rerun()

        except ValidationError as e:
            logger.error(f"Validation error during order creation: {e}")
            st.error(f"""
### ❌ ข้อมูลไม่ถูกต้อง

{str(e)}

**วิธีแก้:**
1. ตรวจสอบข้อมูลที่กรอก
2. ลองกรอกใหม่อีกครั้ง
3. ถ้ายังไม่ได้ ติดต่อ Admin
            """)

        except Exception as e:
            logger.log_error(e, context={
                'operation': 'order_submission',
                'customer_id': customer_id,
                'items': selected_items
            })
            st.error(f"""
### ❌ เกิดข้อผิดพลาด

ไม่สามารถบันทึกข้อมูลได้

**สาเหตุที่เป็นไปได้:**
- ปัญหาการเชื่อมต่อ Internet
- Google Sheets อาจขัดข้อง
- ข้อมูลบางอย่างไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบ Internet
2. รอ 1-2 นาที แล้วลองใหม่
3. ถ้ายังไม่ได้ กด Ctrl+R รีเฟรชหน้า
4. ติดต่อ Admin หากปัญหายังคงอยู่

**รายละเอียด Error:** `{str(e)}`
            """)

    # -------------------------
    # FOOTER
    # -------------------------
    st.markdown("---")
    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("🔄 รีเฟรชข้อมูล", help="โหลดข้อมูลจาก Google Sheets ใหม่"):
            st.cache_data.clear()
            logger.info("Cache cleared by user")
            st.success("✅ รีเฟรชข้อมูลเรียบร้อย!")
            time.sleep(1)
            st.rerun()

    with col3:
        st.caption("Made with ❤️ for CT Studio")


# ========================
# TAB 2: แก้ไข Order
# ========================
with tab2:
    render_order_edit_page(master_items, staff, customers)


# ========================
# TAB 3: จัดการข้อมูลลูกค้า
# ========================
with tab3:
    render_customer_page()
