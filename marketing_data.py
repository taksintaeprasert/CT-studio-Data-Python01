"""
CT Studio - Marketing & Business Data Analytics
คำนวณ metrics ต่างๆ สำหรับ Dashboard
"""

from datetime import datetime, date, timedelta
from typing import List, Dict, Tuple
import pandas as pd

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


def filter_by_date_range(data: List[Dict], date_field: str, start_date: date, end_date: date) -> List[Dict]:
    """
    กรองข้อมูลตามช่วงวันที่

    Args:
        data: list of dict
        date_field: ชื่อ field ที่เก็บวันที่ (เช่น 'created_at', 'payment_date')
        start_date: วันที่เริ่มต้น
        end_date: วันที่สิ้นสุด

    Returns:
        filtered data
    """
    filtered = []
    for item in data:
        date_str = item.get(date_field, '')
        if not date_str:
            continue

        try:
            # แปลง ISO format หรือ YYYY-MM-DD
            item_date = datetime.fromisoformat(date_str.split('T')[0]).date()

            if start_date <= item_date <= end_date:
                filtered.append(item)
        except:
            continue

    return filtered


def calculate_sales(orders: List[Dict], start_date: date, end_date: date) -> float:
    """
    คำนวณยอด Sales (total_price รวมของ orders ที่สร้างในช่วงเวลา)

    Args:
        orders: list of orders
        start_date, end_date: ช่วงเวลา

    Returns:
        ยอด sales
    """
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)
    total_sales = sum(float(o.get('total_price', 0) or 0) for o in filtered_orders)
    return total_sales


def calculate_income(payments: List[Dict], start_date: date, end_date: date) -> float:
    """
    คำนวณยอด Income จริง (เงินที่รับในช่วงเวลา)

    Args:
        payments: list of payments
        start_date, end_date: ช่วงเวลา

    Returns:
        ยอด income
    """
    filtered_payments = filter_by_date_range(payments, 'payment_date', start_date, end_date)
    total_income = sum(float(p.get('net_amount', 0) or 0) for p in filtered_payments)
    return total_income


def count_orders(orders: List[Dict], start_date: date, end_date: date) -> int:
    """นับจำนวน orders"""
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)
    return len(filtered_orders)


def count_items_sold(order_items: List[Dict], orders: List[Dict], start_date: date, end_date: date) -> int:
    """
    นับจำนวนสินค้าที่ขาย (ไม่รวมของฟรี)

    Args:
        order_items: list of order items
        orders: list of orders (เพื่อ filter ตาม created_at)
        start_date, end_date: ช่วงเวลา

    Returns:
        จำนวนสินค้า
    """
    # หา order_ids ในช่วงเวลา
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)
    order_ids = {o.get('order_id') for o in filtered_orders}

    # นับสินค้าที่ไม่ฟรี
    count = 0
    for item in order_items:
        if item.get('order_id') in order_ids:
            # ตรวจสอบว่าไม่ใช่ของฟรี (list_price > 0)
            price = float(item.get('list_price', 0) or 0)
            if price > 0:
                count += 1

    return count


def calculate_aov(orders: List[Dict], start_date: date, end_date: date) -> float:
    """
    คำนวณ AOV (Average Order Value)

    Returns:
        AOV
    """
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)

    if not filtered_orders:
        return 0.0

    total_sales = sum(float(o.get('total_price', 0) or 0) for o in filtered_orders)
    return total_sales / len(filtered_orders)


def calculate_revenue_per_customer(orders: List[Dict], start_date: date, end_date: date) -> float:
    """
    คำนวณ Revenue per Customer

    Returns:
        revenue per customer
    """
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)

    if not filtered_orders:
        return 0.0

    # นับจำนวน unique customers
    unique_customers = {o.get('customer_id') for o in filtered_orders if o.get('customer_id')}

    if not unique_customers:
        return 0.0

    total_sales = sum(float(o.get('total_price', 0) or 0) for o in filtered_orders)
    return total_sales / len(unique_customers)


def calculate_upsell_metrics(order_items: List[Dict], orders: List[Dict], start_date: date, end_date: date) -> Dict:
    """
    คำนวณ Upsell metrics

    Returns:
        dict with upsell_count, upsell_value, upsell_rate
    """
    # หา order_ids ในช่วงเวลา
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)
    order_ids = {o.get('order_id') for o in filtered_orders}

    # นับ upsell
    upsell_count = 0
    upsell_value = 0.0
    orders_with_upsell = set()

    for item in order_items:
        if item.get('order_id') in order_ids:
            is_upsell = str(item.get('is_upsell', '')).upper() in ['TRUE', '1', 'YES']

            if is_upsell:
                upsell_count += 1
                upsell_value += float(item.get('list_price', 0) or 0)
                orders_with_upsell.add(item.get('order_id'))

    # คำนวณ upsell rate
    upsell_rate = 0.0
    if filtered_orders:
        upsell_rate = (len(orders_with_upsell) / len(filtered_orders)) * 100

    return {
        'upsell_count': upsell_count,
        'upsell_value': upsell_value,
        'upsell_rate': upsell_rate,
        'orders_with_upsell': len(orders_with_upsell)
    }


def calculate_channel_performance(orders: List[Dict], start_date: date, end_date: date) -> Dict:
    """
    คำนวณ performance แยกตาม channel

    Returns:
        dict of {channel: {orders: count, sales: value}}
    """
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)

    channels = {}
    for order in filtered_orders:
        channel = order.get('channel', 'unknown')

        if channel not in channels:
            channels[channel] = {'orders': 0, 'sales': 0.0}

        channels[channel]['orders'] += 1
        channels[channel]['sales'] += float(order.get('total_price', 0) or 0)

    return channels


def calculate_conversion_rate(orders: List[Dict], chats: List[Dict], start_date: date, end_date: date) -> float:
    """
    คำนวณ Conversion Rate (Orders / Chats)

    Args:
        orders: list of orders
        chats: list of chats (from chats sheet)
        start_date, end_date: ช่วงเวลา

    Returns:
        conversion rate (%)
    """
    order_count = count_orders(orders, start_date, end_date)

    # นับ chats ในช่วงเวลา
    filtered_chats = filter_by_date_range(chats, 'chat_date', start_date, end_date)
    total_chats = sum(int(c.get('chat_count', 0) or 0) for c in filtered_chats)

    if total_chats == 0:
        return 0.0

    return (order_count / total_chats) * 100


def calculate_roas(income: float, ads_budget: List[Dict], start_date: date, end_date: date) -> float:
    """
    คำนวณ ROAS (Return on Ad Spend)

    Args:
        income: รายได้ในช่วงเวลา
        ads_budget: list of ads budget
        start_date, end_date: ช่วงเวลา

    Returns:
        ROAS
    """
    # หา ads spend ในช่วงเวลา (filter by week_start_date)
    filtered_ads = filter_by_date_range(ads_budget, 'week_start_date', start_date, end_date)
    total_ads_spend = sum(float(a.get('budget_amount', 0) or 0) for a in filtered_ads)

    if total_ads_spend == 0:
        return 0.0

    return income / total_ads_spend


def get_dashboard_summary(
    orders: List[Dict],
    order_items: List[Dict],
    payments: List[Dict],
    chats: List[Dict],
    ads_budget: List[Dict],
    start_date: date,
    end_date: date
) -> Dict:
    """
    สรุปข้อมูลทั้งหมดสำหรับ Dashboard

    Returns:
        dict with all metrics
    """
    sales = calculate_sales(orders, start_date, end_date)
    income = calculate_income(payments, start_date, end_date)
    order_count = count_orders(orders, start_date, end_date)
    items_sold = count_items_sold(order_items, orders, start_date, end_date)
    aov = calculate_aov(orders, start_date, end_date)
    revenue_per_customer = calculate_revenue_per_customer(orders, start_date, end_date)
    upsell_metrics = calculate_upsell_metrics(order_items, orders, start_date, end_date)
    channel_performance = calculate_channel_performance(orders, start_date, end_date)
    conversion_rate = calculate_conversion_rate(orders, chats, start_date, end_date)
    roas = calculate_roas(income, ads_budget, start_date, end_date)

    return {
        'sales': sales,
        'income': income,
        'order_count': order_count,
        'items_sold': items_sold,
        'aov': aov,
        'revenue_per_customer': revenue_per_customer,
        'upsell_count': upsell_metrics['upsell_count'],
        'upsell_value': upsell_metrics['upsell_value'],
        'upsell_rate': upsell_metrics['upsell_rate'],
        'orders_with_upsell': upsell_metrics['orders_with_upsell'],
        'channel_performance': channel_performance,
        'conversion_rate': conversion_rate,
        'roas': roas
    }
