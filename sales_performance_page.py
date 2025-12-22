"""
CT Studio - Sales Performance Dashboard
แสดงสถิติและผลงานของ Sales แต่ละคน
"""

import streamlit as st
from datetime import datetime, date
import pandas as pd
from typing import Dict, List

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

from sheets_helper import (
    safe_get_orders,
    safe_get_order_items,
    safe_get_staff
)


def format_currency(amount: float) -> str:
    """Format currency with Thai Baht symbol"""
    return f"฿{amount:,.2f}"


def format_number(value: int) -> str:
    """Format number with commas"""
    return f"{value:,}"


def to_float(x):
    """แปลงเป็น float"""
    if not x:
        return 0.0
    try:
        clean = str(x).replace(",", "").replace("฿", "").strip()
        return float(clean)
    except:
        return 0.0


def filter_by_date_range(data: List[Dict], date_field: str, start_date: date, end_date: date) -> List[Dict]:
    """กรองข้อมูลตามช่วงวันที่"""
    filtered = []
    for item in data:
        date_str = item.get(date_field, '')
        if not date_str:
            continue

        try:
            item_date = datetime.fromisoformat(date_str.split('T')[0]).date()
            if start_date <= item_date <= end_date:
                filtered.append(item)
        except:
            continue

    return filtered


def calculate_sales_metrics(
    sales_id: str,
    orders: List[Dict],
    order_items: List[Dict],
    start_date: date,
    end_date: date
) -> Dict:
    """คำนวณ metrics ของ Sales คนนั้น"""

    # กรอง orders ของ Sales นี้ในช่วงเวลาที่เลือก
    filtered_orders = filter_by_date_range(orders, 'created_at', start_date, end_date)
    sales_orders = [o for o in filtered_orders if str(o.get('sales_id')) == str(sales_id)]

    # คำนวณจำนวน orders และยอด sales
    order_count = len(sales_orders)
    total_sales = sum(to_float(o.get('total_income', 0)) for o in sales_orders)

    # คำนวณ upsell
    order_ids = {o.get('order_id') for o in sales_orders}

    upsell_count = 0
    upsell_value = 0.0

    for item in order_items:
        if item.get('order_id') in order_ids:
            is_upsell = str(item.get('is_upsell', '')).upper() in ['TRUE', '1', 'YES']

            if is_upsell:
                upsell_count += 1
                upsell_value += to_float(item.get('list_price', 0))

    return {
        'order_count': order_count,
        'total_sales': total_sales,
        'upsell_count': upsell_count,
        'upsell_value': upsell_value,
        'orders': sales_orders
    }


def render_sales_performance():
    """Render Sales Performance Dashboard"""
    st.title("📊 Sales Performance Dashboard")
    st.markdown("แสดงสถิติและผลงานของ Sales แต่ละคน")
    st.markdown("---")

    # Load data
    try:
        with st.spinner("กำลังโหลดข้อมูล..."):
            orders = safe_get_orders()
            order_items = safe_get_order_items()
            staff = safe_get_staff()
    except Exception as e:
        st.error(f"เกิดข้อผิดพลาดในการโหลดข้อมูล: {e}")
        logger.error(f"Sales Performance error: {e}")
        return

    # Filter: เลือก Sales
    st.subheader("🎯 เลือก Sales และช่วงเวลา")

    col1, col2, col3 = st.columns(3)

    with col1:
        # สร้างรายการ sales จาก staff ที่มี role = 'sales'
        sales_list = [s for s in staff if str(s.get('role', '')).lower() == 'sales']

        if not sales_list:
            st.warning("ไม่พบ Sales ในระบบ")
            return

        sales_options = {s['staff_id']: f"{s.get('staff_name', s['staff_id'])} ({s['staff_id']})" for s in sales_list}

        selected_sales = st.selectbox(
            "เลือก Sales",
            options=list(sales_options.keys()),
            format_func=lambda x: sales_options[x],
            key="selected_sales"
        )

    with col2:
        # Default to current month
        today = date.today()
        first_day_of_month = date(today.year, today.month, 1)
        start_date = st.date_input(
            "วันที่เริ่มต้น",
            value=first_day_of_month,
            key="sales_start_date"
        )

    with col3:
        end_date = st.date_input(
            "วันที่สิ้นสุด",
            value=today,
            key="sales_end_date"
        )

    # Validate date range
    if start_date > end_date:
        st.error("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด")
        return

    st.markdown("---")

    # คำนวณ metrics
    metrics = calculate_sales_metrics(
        sales_id=selected_sales,
        orders=orders,
        order_items=order_items,
        start_date=start_date,
        end_date=end_date
    )

    # แสดง Sales info
    sales_info = next((s for s in sales_list if s['staff_id'] == selected_sales), None)
    if sales_info:
        st.markdown(f"### 💼 {sales_info.get('staff_name', selected_sales)} ({selected_sales})")
    else:
        st.markdown(f"### 💼 Sales: {selected_sales}")

    st.markdown("---")

    # แสดง Main Metrics
    st.subheader("📈 Performance Metrics")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label="📦 Orders",
            value=format_number(metrics['order_count'])
        )

    with col2:
        st.metric(
            label="💰 Total Sales",
            value=format_currency(metrics['total_sales'])
        )

    with col3:
        st.metric(
            label="🎁 Upsell Count",
            value=format_number(metrics['upsell_count'])
        )

    with col4:
        st.metric(
            label="💎 Upsell Value",
            value=format_currency(metrics['upsell_value'])
        )

    st.markdown("---")

    # แสดงตาราง Orders
    st.subheader("📋 Orders List")

    if not metrics['orders']:
        st.info(f"ไม่พบ orders ของ {sales_options[selected_sales]} ในช่วงเวลาที่เลือก")
        return

    # สร้าง DataFrame สำหรับแสดง
    orders_data = []
    for order in metrics['orders']:
        orders_data.append({
            'Order ID': order.get('order_id', 'N/A'),
            'Customer': order.get('customer_id', 'N/A'),
            'Date': order.get('appointment_date', 'N/A'),
            'Status': order.get('order_status', 'N/A'),
            'Total (฿)': to_float(order.get('total_income', 0))
        })

    df = pd.DataFrame(orders_data)

    # จัดรูปแบบ column Total
    df['Total (฿)'] = df['Total (฿)'].apply(lambda x: f"{x:,.2f}")

    st.dataframe(df, use_container_width=True, hide_index=True)

    # Export button
    st.markdown("---")
    csv = df.to_csv(index=False).encode('utf-8-sig')
    st.download_button(
        label="📥 Export to CSV",
        data=csv,
        file_name=f"sales_performance_{selected_sales}_{start_date}_{end_date}.csv",
        mime="text/csv"
    )


if __name__ == "__main__":
    render_sales_performance()
