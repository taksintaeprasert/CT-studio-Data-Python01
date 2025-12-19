"""
Helper functions สำหรับ Google Sheets
รองรับกรณีที่มี empty headers
"""

from sheets import ws_orders, ws_order_items, ws_master_item, ws_staff, ws_customers, ws_payments


# กำหนด expected headers สำหรับแต่ละ sheet
EXPECTED_HEADERS = {
    'orders': [
        'order_id',
        'created_at',
        'customer_id',
        'appointment_date',
        'appointment_time',
        'sales_id',
        'artist_id',
        'channel',
        'order_status',
        'total_price',  # เปลี่ยนจาก total_income
        'note',
        'total_paid'  # เพิ่ม column ใหม่
    ],
    'order_items': [
        'order_item_id',
        'order_id',
        'item_code',
        'item_name',
        'list_price',
        'is_upsell'
    ],
    'master_item': [
        'item_code',
        'item_name',
        'category',
        'list_price',
        'is_free'
    ],
    'staff': [
        'staff_id',
        'staff_name',
        'role',
        'is_active'
    ],
    'customers': [
        'customer_id',
        'created_at',
        'full_name',
        'phone',
        'contact_channel',
        'note'
    ],
    'payments': [
        'payment_id',
        'order_id',
        'payment_date',
        'amount',
        'net_amount',
        'payment_method',
        'note'
    ]
}


def get_all_records_safe(worksheet, sheet_name):
    """
    โหลดข้อมูลจาก worksheet โดยรองรับ empty headers

    Args:
        worksheet: worksheet object จาก gspread
        sheet_name: ชื่อ sheet ('orders', 'order_items', etc.)

    Returns:
        list of dict
    """
    try:
        expected_headers = EXPECTED_HEADERS.get(sheet_name, None)

        if expected_headers:
            # ใช้ expected_headers เพื่อป้องกัน duplicate header error
            return worksheet.get_all_records(expected_headers=expected_headers)
        else:
            # fallback ถ้าไม่มี expected_headers
            return worksheet.get_all_records()
    except Exception as e:
        print(f"Error loading {sheet_name}: {e}")
        raise


def safe_get_orders():
    """โหลดข้อมูล orders ทั้งหมด"""
    return get_all_records_safe(ws_orders, 'orders')


def safe_get_order_items():
    """โหลดข้อมูล order_items ทั้งหมด"""
    return get_all_records_safe(ws_order_items, 'order_items')


def safe_get_master_items():
    """โหลดข้อมูล master_item ทั้งหมด"""
    return get_all_records_safe(ws_master_item, 'master_item')


def safe_get_staff():
    """โหลดข้อมูล staff ทั้งหมด"""
    return get_all_records_safe(ws_staff, 'staff')


def safe_get_customers():
    """โหลดข้อมูล customers ทั้งหมด"""
    return get_all_records_safe(ws_customers, 'customers')


def safe_get_payments():
    """โหลดข้อมูล payments ทั้งหมด"""
    if ws_payments is None:
        print("Warning: payments worksheet not available")
        return []
    return get_all_records_safe(ws_payments, 'payments')
