from datetime import datetime
import uuid

# Import logger - ถ้าไม่มีก็ใช้ print ธรรมดา
try:
    from ct_logger import get_logger
    logger = get_logger()
except ImportError:
    class SimpleLogger:
        def info(self, msg, **kwargs): print(f"INFO: {msg}")
        def debug(self, msg, **kwargs): print(f"DEBUG: {msg}")
        def warning(self, msg, **kwargs): print(f"WARNING: {msg}")
        def error(self, msg, **kwargs): print(f"ERROR: {msg}")
        def log_error(self, e, **kwargs): print(f"ERROR: {e}")
    logger = SimpleLogger()


# Custom Exception
class ValidationError(Exception):
    """Exception สำหรับ validation errors"""
    pass


def validate_order_data(
    customer_id: str,
    appointment_date: str,
    appointment_time: str,
    sales_id: str,
    artist_id: str,
    channel: str,
    order_status: str
):
    """ตรวจสอบข้อมูล order ก่อนบันทึก"""
    errors = []
    
    if not customer_id or not customer_id.strip():
        errors.append("ไม่พบรหัสลูกค้า (customer_id)")
    
    if not appointment_date or not appointment_date.strip():
        errors.append("ไม่ระบุวันที่นัด")
    
    # ตรวจสอบรูปแบบวันที่
    try:
        datetime.strptime(str(appointment_date), "%Y-%m-%d")
    except ValueError:
        errors.append(f"รูปแบบวันที่ไม่ถูกต้อง: {appointment_date} (ต้องเป็น YYYY-MM-DD)")
    
    # ตรวจสอบรูปแบบเวลา ถ้ามีระบุ
    if appointment_time and appointment_time.strip():
        try:
            datetime.strptime(appointment_time, "%H:%M")
        except ValueError:
            errors.append(f"รูปแบบเวลาไม่ถูกต้อง: {appointment_time} (ต้องเป็น HH:MM เช่น 14:30)")
    
    # ตรวจสอบฟิลด์ที่จำเป็น
    if not sales_id or not sales_id.strip():
        errors.append("ไม่ระบุพนักงานขาย (sales_id)")
    
    if not artist_id or not artist_id.strip():
        errors.append("ไม่ระบุช่างทำ (artist_id)")
    
    # ตรวจสอบค่าที่อนุญาต
    valid_channels = ["facebook", "line", "walkin", "other", ""]
    if channel and channel.lower() not in valid_channels:
        errors.append(f"ช่องทางไม่ถูกต้อง: {channel} (ต้องเป็น: {', '.join(valid_channels)})")
    
    valid_statuses = ["booking", "active", "cancel", "done", ""]
    if order_status and order_status.lower() not in valid_statuses:
        errors.append(f"สถานะไม่ถูกต้อง: {order_status} (ต้องเป็น: {', '.join(valid_statuses)})")
    
    if errors:
        error_msg = "\n".join([f"- {err}" for err in errors])
        logger.error(f"Validation failed:\n{error_msg}")
        raise ValidationError(f"ข้อมูลไม่ถูกต้อง:\n{error_msg}")


def create_order(
    ws_orders,
    customer_id: str,
    appointment_date: str,
    appointment_time: str,
    sales_id: str,
    artist_id: str,
    channel: str,
    order_status: str,
    note: str = "",
    deposit: float = 0.0
) -> str:
    """สร้าง order ใหม่ (รองรับเงินมัดจำ)"""

    logger.info(f"Creating order for customer: {customer_id} with deposit: {deposit}")

    # Validate
    try:
        validate_order_data(
            customer_id, appointment_date, appointment_time,
            sales_id, artist_id, channel, order_status
        )
    except ValidationError:
        raise

    try:
        order_id = f"TEST-{datetime.now().strftime('%d%m%y%H%M%S')}"
        created_at = datetime.now().isoformat()
        # total_income เริ่มต้นเป็น 0 (จะอัพเดทหลังเพิ่ม items)
        total_income = 0

        row = [
            order_id,
            created_at,
            customer_id,
            appointment_date,
            appointment_time,
            sales_id,
            artist_id,
            channel,
            order_status,
            total_income,
            deposit,  # เงินมัดจำ (แยกจาก total_income)
            note
        ]

        logger.debug(f"Appending row to orders sheet: {order_id}")
        ws_orders.append_row(row)

        logger.info(f"Order created successfully: {order_id} (deposit: {deposit})")
        return order_id

    except Exception as e:
        logger.error(f"Failed to create order: {e}")
        raise


def add_order_item(
    ws_order_items,
    ws_master_item,
    order_id: str,
    item_code: str,
    is_upsell: bool = False,
) -> str:
    """เพิ่มรายการสินค้า/บริการใน order"""
    
    logger.debug(f"Adding item {item_code} to order {order_id}")
    
    try:
        order_item_id = f"ITEM-{uuid.uuid4().hex[:8]}"
        
        # ดึงข้อมูลสินค้าจาก master
        master_items = ws_master_item.get_all_records()
        item = next((i for i in master_items if i["item_code"] == item_code), None)
        
        if item is None:
            error_msg = f"ไม่พบรหัสสินค้า '{item_code}' ในระบบ"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        row = [
            order_item_id,
            order_id,
            item_code,
            item["item_name"],
            item["list_price"],
            is_upsell,
        ]
        
        ws_order_items.append_row(row)
        
        logger.info(f"Order item added: {order_item_id} ({item['item_name']})")
        return order_item_id
        
    except Exception as e:
        logger.error(f"Failed to add order item: {e}")
        raise


def update_order_total(ws_orders, ws_order_items, order_id: str) -> float:
    """อัพเดทยอดรวมของ order (ราคาบริการทั้งหมด - ไม่รวมเงินมัดจำ)"""

    logger.debug(f"Updating total for order: {order_id}")

    try:
        items = ws_order_items.get_all_records()

        def to_number(x):
            """แปลงราคาเป็นตัวเลข"""
            if not x:
                return 0
            try:
                # ลบ comma และ ฿ ออก
                clean = str(x).replace(",", "").replace("฿", "").strip()
                return float(clean)
            except (ValueError, AttributeError) as e:
                logger.warning(f"Cannot convert price to number: {x}")
                return 0

        # หารายการที่อยู่ใน order นี้
        order_items = [i for i in items if str(i["order_id"]) == str(order_id)]
        items_total = sum(to_number(i["list_price"]) for i in order_items)

        # total_income = ราคาบริการทั้งหมด (ไม่บวก deposit)
        # deposit เก็บแยกใน column deposit
        total_income = items_total

        logger.debug(f"Calculated: items={items_total}, total_income={total_income}")

        # ดึงข้อมูล orders เพื่อหา row index
        orders = ws_orders.get_all_records()

        # หา row index
        row_index = next(
            (idx for idx, r in enumerate(orders, start=2) if str(r["order_id"]) == str(order_id)),
            None
        )

        if row_index is None:
            error_msg = f"ไม่พบ Order ID '{order_id}' สำหรับอัพเดทยอดรวม"
            logger.error(error_msg)
            raise ValueError(error_msg)

        # อัพเดท column 10 (total_income)
        ws_orders.update_cell(row_index, 10, total_income)

        logger.info(f"Order total updated: {order_id} = {total_income} (items: {items_total})")
        return total_income

    except Exception as e:
        logger.error(f"Failed to update order total: {e}")
        raise


def create_order_with_items(
    ws_orders,
    ws_order_items,
    ws_master_item,
    customer_id: str,
    appointment_date: str,
    appointment_time: str,
    sales_id: str,
    artist_id: str,
    channel: str,
    order_status: str,
    item_codes: list,
    upsell_flags: list = None,
    note: str = "",
    deposit: float = 0.0,
):
    """สร้าง order พร้อมรายการสินค้า - ฟังก์ชันหลัก (รองรับเงินมัดจำ)"""

    logger.info(
        f"Creating order with {len(item_codes)} items for customer {customer_id} (deposit: {deposit})"
    )

    try:
        # Validate
        if not item_codes:
            raise ValidationError("กรุณาเลือกรายการสินค้า/บริการอย่างน้อย 1 รายการ")

        if upsell_flags is None:
            upsell_flags = [False] * len(item_codes)

        if len(upsell_flags) != len(item_codes):
            raise ValidationError("จำนวน upsell_flags ไม่ตรงกับ item_codes")

        # 1. สร้าง order (พร้อม deposit)
        order_id = create_order(
            ws_orders=ws_orders,
            customer_id=customer_id,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            sales_id=sales_id,
            artist_id=artist_id,
            channel=channel,
            order_status=order_status,
            note=note,
            deposit=deposit,
        )

        # 2. เพิ่มรายการสินค้า
        for code, is_upsell in zip(item_codes, upsell_flags):
            add_order_item(
                ws_order_items=ws_order_items,
                ws_master_item=ws_master_item,
                order_id=order_id,
                item_code=code,
                is_upsell=is_upsell,
            )

        # 3. อัพเดทยอดรวม (จะนับรวม deposit + items)
        total = update_order_total(ws_orders, ws_order_items, order_id)

        logger.info(f"Order completed: {order_id} (Total: {total}, Deposit: {deposit})")

        return order_id, total

    except ValidationError:
        # ส่งต่อ ValidationError ไปให้ caller จัดการ
        raise
    except Exception as e:
        logger.error(f"Failed to create order with items: {e}")
        raise