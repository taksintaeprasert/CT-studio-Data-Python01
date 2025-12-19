"""
CT Studio - Marketing & Business Dashboard
แสดงภาพรวมธุรกิจและการตลาด
"""

import streamlit as st
from datetime import datetime, date, timedelta
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
    safe_get_payments,
    safe_get_chats,
    safe_get_ads_budget
)
from marketing_data import get_dashboard_summary


def format_currency(amount: float) -> str:
    """Format currency with Thai Baht symbol"""
    return f"฿{amount:,.2f}"


def format_percentage(value: float) -> str:
    """Format percentage"""
    return f"{value:.1f}%"


def format_number(value: int) -> str:
    """Format number with commas"""
    return f"{value:,}"


def show_metric_card(label: str, value: str, delta: str = None, large: bool = False):
    """Display metric card"""
    if large:
        st.markdown(f"""
        <div style="background-color: #f0f2f6; padding: 20px; border-radius: 10px; text-align: center;">
            <h4 style="color: #666; margin: 0;">{label}</h4>
            <h1 style="color: #1f77b4; margin: 10px 0; font-size: 48px;">{value}</h1>
            {f'<p style="color: #28a745; margin: 0;">{delta}</p>' if delta else ''}
        </div>
        """, unsafe_allow_html=True)
    else:
        st.metric(label=label, value=value, delta=delta)


def show_channel_performance(channel_data: Dict):
    """Show channel performance chart"""
    if not channel_data:
        st.info("ไม่มีข้อมูล channel")
        return

    # Prepare data for chart
    channels = list(channel_data.keys())
    orders = [channel_data[ch]['orders'] for ch in channels]
    sales = [channel_data[ch]['sales'] for ch in channels]

    # Create DataFrame
    df = pd.DataFrame({
        'Channel': channels,
        'Orders': orders,
        'Sales (฿)': sales
    })

    # Show bar chart
    st.subheader("📊 Performance by Channel")
    st.bar_chart(df.set_index('Channel'))

    # Show table
    st.dataframe(df, use_container_width=True)


def render_dashboard():
    """Render main dashboard page"""
    st.title("📊 Marketing & Business Dashboard")
    st.markdown("---")

    # Date range filter
    st.subheader("🗓️ เลือกช่วงเวลา")
    col1, col2 = st.columns(2)

    with col1:
        # Default to current month
        today = date.today()
        first_day_of_month = date(today.year, today.month, 1)
        start_date = st.date_input(
            "วันที่เริ่มต้น",
            value=first_day_of_month,
            key="dashboard_start_date"
        )

    with col2:
        end_date = st.date_input(
            "วันที่สิ้นสุด",
            value=today,
            key="dashboard_end_date"
        )

    # Validate date range
    if start_date > end_date:
        st.error("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด")
        return

    st.markdown("---")

    # Load data
    try:
        with st.spinner("กำลังโหลดข้อมูล..."):
            orders = safe_get_orders()
            order_items = safe_get_order_items()
            payments = safe_get_payments()
            chats = safe_get_chats()
            ads_budget = safe_get_ads_budget()

            # Calculate all metrics
            summary = get_dashboard_summary(
                orders=orders,
                order_items=order_items,
                payments=payments,
                chats=chats,
                ads_budget=ads_budget,
                start_date=start_date,
                end_date=end_date
            )
    except Exception as e:
        st.error(f"เกิดข้อผิดพลาดในการโหลดข้อมูล: {e}")
        logger.error(f"Dashboard error: {e}")
        return

    # Display main metrics
    st.subheader("💰 Main Metrics")

    # Large metrics: Sales and Income
    col1, col2 = st.columns(2)

    with col1:
        show_metric_card(
            label="🎯 Sales (ยอดจอง)",
            value=format_currency(summary['sales']),
            large=True
        )

    with col2:
        show_metric_card(
            label="💵 Income (เงินรับจริง)",
            value=format_currency(summary['income']),
            large=True
        )

    st.markdown("---")

    # Secondary metrics
    st.subheader("📈 Performance Metrics")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label="📦 Orders",
            value=format_number(summary['order_count'])
        )

    with col2:
        st.metric(
            label="🛍️ Items Sold",
            value=format_number(summary['items_sold'])
        )

    with col3:
        st.metric(
            label="💎 AOV",
            value=format_currency(summary['aov'])
        )

    with col4:
        st.metric(
            label="👤 Revenue/Customer",
            value=format_currency(summary['revenue_per_customer'])
        )

    st.markdown("---")

    # Upsell metrics
    st.subheader("🎁 Upsell Performance")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label="Upsell Count",
            value=format_number(summary['upsell_count'])
        )

    with col2:
        st.metric(
            label="Upsell Value",
            value=format_currency(summary['upsell_value'])
        )

    with col3:
        st.metric(
            label="Upsell Rate",
            value=format_percentage(summary['upsell_rate'])
        )

    with col4:
        st.metric(
            label="Orders with Upsell",
            value=format_number(summary['orders_with_upsell'])
        )

    st.markdown("---")

    # Marketing metrics
    st.subheader("📣 Marketing Metrics")

    col1, col2 = st.columns(2)

    with col1:
        st.metric(
            label="🔄 Conversion Rate",
            value=format_percentage(summary['conversion_rate']),
            help="Orders / Chats (%)"
        )

    with col2:
        st.metric(
            label="🎯 ROAS",
            value=f"{summary['roas']:.2f}x",
            help="Return on Ad Spend (Income / Ad Spend)"
        )

    st.markdown("---")

    # Channel performance
    show_channel_performance(summary['channel_performance'])

    st.markdown("---")

    # Summary table
    st.subheader("📋 Summary Details")

    summary_data = {
        'Metric': [
            'Sales (ยอดจอง)',
            'Income (เงินรับจริง)',
            'Orders',
            'Items Sold',
            'AOV',
            'Revenue per Customer',
            'Upsell Count',
            'Upsell Value',
            'Upsell Rate',
            'Conversion Rate',
            'ROAS'
        ],
        'Value': [
            format_currency(summary['sales']),
            format_currency(summary['income']),
            format_number(summary['order_count']),
            format_number(summary['items_sold']),
            format_currency(summary['aov']),
            format_currency(summary['revenue_per_customer']),
            format_number(summary['upsell_count']),
            format_currency(summary['upsell_value']),
            format_percentage(summary['upsell_rate']),
            format_percentage(summary['conversion_rate']),
            f"{summary['roas']:.2f}x"
        ]
    }

    df_summary = pd.DataFrame(summary_data)
    st.dataframe(df_summary, use_container_width=True, hide_index=True)

    # Export button
    st.markdown("---")
    csv = df_summary.to_csv(index=False).encode('utf-8-sig')
    st.download_button(
        label="📥 Export Summary (CSV)",
        data=csv,
        file_name=f"dashboard_summary_{start_date}_{end_date}.csv",
        mime="text/csv"
    )


if __name__ == "__main__":
    render_dashboard()
