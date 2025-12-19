"""
CT Studio - Payment Management System
จัดการการรับชำระเงิน รองรับการจ่ายมัดจำและจ่ายเต็มจำนวน
"""

from datetime import datetime
import uuid
from typing import List, Dict, Tuple

try:
    from ct_logger import get_logger
    logger = get_logger()
except ImportError:
    class SimpleLogger:
        def info(self, msg, **kwargs): print(f"INFO: {msg}")
        def debug(self, msg, **kwargs): print(f"DEBUG: {msg}")
        def warning(self, msg, **kwargs): print(f"WARNING: {msg}")
        def error(self, msg, **kwargs): print(f"ERROR: {msg}")
    logger = SimpleLogger()


def calculate_payment_amount(amount: float, payment_method: str) -> float:
    """
    คำนวณจำนวนเงินสุทธิหลังหักค่าธรรมเนียม

    Args:
        amount: จำนวนเงินที่ลูกค้าจ่าย
        payment_method: วิธีการชำระเงิน (cash, transfer, credit_card_3%)

    Returns:
        จำนวนเงินสุทธิที่ได้รับ
    """
    if payment_method == "credit_card_3%":
        # หักค่าธรรมเนียม 3%
        net_amount = amount * 0.97
        logger.debug(f"Credit card fee 3%: {amount} -> {net_amount}")
        return net_amount
    else:
        return amount


def add_payment(
    ws_payments,
    order_id: str,
    amount: float,
    payment_method: str,
    note: str = ""
) -> str:
    """
    เพิ่มรายการชำระเงิน

    Args:
        ws_payments: worksheet object สำหรับ payments
        order_id: รหัส order
        amount: จำนวนเงินที่รับ
        payment_method: วิธีชำระ (cash, transfer, credit_card_3%)
        note: หมายเหตุ

    Returns:
        payment_id
    """
    try:
        payment_id = f"PAY-{uuid.uuid4().hex[:8]}"
        payment_date = datetime.now().isoformat()

        # คำนวณเงินสุทธิ
        net_amount = calculate_payment_amount(amount, payment_method)

        row = [
            payment_id,
            order_id,
            payment_date,
            amount,
            net_amount,
            payment_method,
            note
        ]

        logger.info(f"Adding payment: {payment_id} for order {order_id}, amount: {net_amount}")
        ws_payments.append_row(row)

        return payment_id
    except Exception as e:
        logger.error(f"Failed to add payment: {e}")
        raise


def get_payments_by_order(ws_payments, order_id: str) -> List[Dict]:
    """
    ดึงรายการชำระเงินทั้งหมดของ order

    Args:
        ws_payments: worksheet object
        order_id: รหัส order

    Returns:
        list of payment records
    """
    try:
        all_payments = ws_payments.get_all_records()
        order_payments = [p for p in all_payments if str(p.get('order_id')) == str(order_id)]
        return order_payments
    except Exception as e:
        logger.error(f"Failed to get payments for order {order_id}: {e}")
        return []


def calculate_total_paid(ws_payments, order_id: str) -> float:
    """
    คำนวณยอดเงินที่ชำระแล้วทั้งหมด (ใช้ net_amount)

    Args:
        ws_payments: worksheet object
        order_id: รหัส order

    Returns:
        ยอดเงินที่ชำระแล้วรวม
    """
    try:
        payments = get_payments_by_order(ws_payments, order_id)
        total = sum(float(p.get('net_amount', 0)) for p in payments)
        logger.debug(f"Total paid for order {order_id}: {total}")
        return total
    except Exception as e:
        logger.error(f"Failed to calculate total paid: {e}")
        return 0.0


def calculate_balance(total_price: float, total_paid: float) -> float:
    """
    คำนวณยอดค้างชำระ

    Args:
        total_price: ราคารวม
        total_paid: เงินที่ชำระแล้ว

    Returns:
        ยอดค้างชำระ
    """
    balance = total_price - total_paid
    return max(0, balance)  # ไม่ให้เป็นลบ


def update_order_payment_info(ws_orders, order_id: str, total_price: float, total_paid: float):
    """
    อัพเดทข้อมูล total_price และ total_paid ใน orders sheet

    Args:
        ws_orders: worksheet object
        order_id: รหัส order
        total_price: ราคารวม
        total_paid: เงินที่ชำระแล้ว
    """
    try:
        all_orders = ws_orders.get_all_records()

        for idx, order in enumerate(all_orders, start=2):  # start=2 เพราะ row 1 = header
            if str(order.get('order_id')) == str(order_id):
                # อัพเดท column 10 (total_income -> total_price) และ column 11 (total_paid ใหม่)
                ws_orders.update_cell(idx, 10, total_price)
                ws_orders.update_cell(idx, 12, total_paid)  # สมมติว่า total_paid อยู่ column 12
                logger.info(f"Updated payment info for order {order_id}: price={total_price}, paid={total_paid}")
                break
    except Exception as e:
        logger.error(f"Failed to update order payment info: {e}")
        raise


def get_payment_summary(ws_payments, order_id: str, total_price: float) -> Dict:
    """
    สรุปข้อมูลการชำระเงิน

    Args:
        ws_payments: worksheet object
        order_id: รหัส order
        total_price: ราคารวม

    Returns:
        dict ที่มี total_price, total_paid, balance, payment_count
    """
    try:
        total_paid = calculate_total_paid(ws_payments, order_id)
        balance = calculate_balance(total_price, total_paid)
        payments = get_payments_by_order(ws_payments, order_id)

        return {
            'total_price': total_price,
            'total_paid': total_paid,
            'balance': balance,
            'payment_count': len(payments),
            'payments': payments
        }
    except Exception as e:
        logger.error(f"Failed to get payment summary: {e}")
        return {
            'total_price': total_price,
            'total_paid': 0,
            'balance': total_price,
            'payment_count': 0,
            'payments': []
        }
