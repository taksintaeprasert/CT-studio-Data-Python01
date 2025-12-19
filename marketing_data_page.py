"""
CT Studio - Marketing Data Entry
กรอกข้อมูล Chats และ Ad Budget
"""

import streamlit as st
from datetime import datetime, date, timedelta
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

from sheets import ws_chats, ws_ads_budget
from sheets_helper import safe_get_chats, safe_get_ads_budget


def add_chat_record(chat_date: date, chat_count: int, note: str = ""):
    """เพิ่มข้อมูล chat count"""
    try:
        # Check if date already exists
        all_chats = safe_get_chats()
        date_str = chat_date.isoformat()

        # Find existing record
        existing_row = None
        for idx, chat in enumerate(all_chats, start=2):
            if chat.get('chat_date') == date_str:
                existing_row = idx
                break

        if existing_row:
            # Update existing record
            ws_chats.update_cell(existing_row, 2, chat_count)  # chat_count
            ws_chats.update_cell(existing_row, 3, note)  # note
            logger.info(f"Updated chat record for {date_str}: {chat_count} chats")
            return "updated"
        else:
            # Add new record
            row = [date_str, chat_count, note]
            ws_chats.append_row(row)
            logger.info(f"Added chat record for {date_str}: {chat_count} chats")
            return "added"
    except Exception as e:
        logger.error(f"Failed to add/update chat record: {e}")
        raise


def add_ads_budget_record(
    week_start_date: date,
    week_end_date: date,
    budget_amount: float,
    platform: str,
    note: str = ""
):
    """เพิ่มข้อมูล ads budget"""
    try:
        # Check if week already exists
        all_budgets = safe_get_ads_budget()
        start_str = week_start_date.isoformat()

        # Find existing record
        existing_row = None
        for idx, budget in enumerate(all_budgets, start=2):
            if budget.get('week_start_date') == start_str and budget.get('platform') == platform:
                existing_row = idx
                break

        if existing_row:
            # Update existing record
            ws_ads_budget.update_cell(existing_row, 2, week_end_date.isoformat())
            ws_ads_budget.update_cell(existing_row, 3, budget_amount)
            ws_ads_budget.update_cell(existing_row, 4, platform)
            ws_ads_budget.update_cell(existing_row, 5, note)
            logger.info(f"Updated ads budget for week {start_str}: {budget_amount}")
            return "updated"
        else:
            # Add new record
            row = [
                start_str,
                week_end_date.isoformat(),
                budget_amount,
                platform,
                note
            ]
            ws_ads_budget.append_row(row)
            logger.info(f"Added ads budget for week {start_str}: {budget_amount}")
            return "added"
    except Exception as e:
        logger.error(f"Failed to add/update ads budget: {e}")
        raise


def render_chat_input():
    """Render chat count input form"""
    st.subheader("💬 กรอกจำนวน Chat (รายวัน)")

    with st.form("chat_form"):
        col1, col2 = st.columns([2, 1])

        with col1:
            chat_date = st.date_input(
                "วันที่",
                value=date.today(),
                key="chat_date"
            )

        with col2:
            chat_count = st.number_input(
                "จำนวน Chat",
                min_value=0,
                value=0,
                step=1,
                key="chat_count"
            )

        note = st.text_area(
            "หมายเหตุ (ถ้ามี)",
            key="chat_note",
            height=80
        )

        submitted = st.form_submit_button("💾 บันทึก Chat Count")

        if submitted:
            if chat_count <= 0:
                st.error("กรุณากรอกจำนวน chat ที่มากกว่า 0")
            else:
                try:
                    result = add_chat_record(chat_date, chat_count, note)
                    if result == "updated":
                        st.success(f"✅ อัพเดทข้อมูล chat วันที่ {chat_date} แล้ว")
                    else:
                        st.success(f"✅ เพิ่มข้อมูล chat วันที่ {chat_date} แล้ว")
                    st.rerun()
                except Exception as e:
                    st.error(f"เกิดข้อผิดพลาด: {e}")


def render_ads_budget_input():
    """Render ads budget input form"""
    st.subheader("💰 กรอกงบ Ads (รายสัปดาห์)")

    with st.form("ads_budget_form"):
        col1, col2 = st.columns(2)

        with col1:
            week_start = st.date_input(
                "วันที่เริ่มต้นสัปดาห์",
                value=date.today(),
                key="week_start"
            )

        with col2:
            # Default to 6 days later
            default_end = week_start + timedelta(days=6)
            week_end = st.date_input(
                "วันที่สิ้นสุดสัปดาห์",
                value=default_end,
                key="week_end"
            )

        col3, col4 = st.columns(2)

        with col3:
            budget_amount = st.number_input(
                "งบ Ads (฿)",
                min_value=0.0,
                value=0.0,
                step=100.0,
                key="budget_amount"
            )

        with col4:
            platform = st.selectbox(
                "Platform",
                options=["Facebook", "Google", "Instagram", "TikTok", "LINE", "Other"],
                key="platform"
            )

        note = st.text_area(
            "หมายเหตุ (ถ้ามี)",
            key="ads_note",
            height=80
        )

        submitted = st.form_submit_button("💾 บันทึก Ads Budget")

        if submitted:
            if week_start > week_end:
                st.error("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด")
            elif budget_amount <= 0:
                st.error("กรุณากรอกงบ Ads ที่มากกว่า 0")
            else:
                try:
                    result = add_ads_budget_record(
                        week_start,
                        week_end,
                        budget_amount,
                        platform,
                        note
                    )
                    if result == "updated":
                        st.success(f"✅ อัพเดทงบ Ads สัปดาห์ {week_start} - {week_end} แล้ว")
                    else:
                        st.success(f"✅ เพิ่มงบ Ads สัปดาห์ {week_start} - {week_end} แล้ว")
                    st.rerun()
                except Exception as e:
                    st.error(f"เกิดข้อผิดพลาด: {e}")


def render_chat_history():
    """Show chat history"""
    st.subheader("📊 ประวัติ Chat Count")

    try:
        chats = safe_get_chats()

        if not chats:
            st.info("ยังไม่มีข้อมูล chat")
            return

        # Convert to DataFrame
        df = pd.DataFrame(chats)

        # Sort by date descending
        if 'chat_date' in df.columns:
            df = df.sort_values('chat_date', ascending=False)

        # Display table
        st.dataframe(df, use_container_width=True, hide_index=True)

        # Show total
        total_chats = df['chat_count'].sum() if 'chat_count' in df.columns else 0
        st.metric("รวม Chats ทั้งหมด", f"{total_chats:,}")

    except Exception as e:
        st.error(f"เกิดข้อผิดพลาดในการโหลดข้อมูล: {e}")


def render_ads_budget_history():
    """Show ads budget history"""
    st.subheader("📊 ประวัติงบ Ads")

    try:
        budgets = safe_get_ads_budget()

        if not budgets:
            st.info("ยังไม่มีข้อมูลงบ Ads")
            return

        # Convert to DataFrame
        df = pd.DataFrame(budgets)

        # Sort by date descending
        if 'week_start_date' in df.columns:
            df = df.sort_values('week_start_date', ascending=False)

        # Display table
        st.dataframe(df, use_container_width=True, hide_index=True)

        # Show total by platform
        if 'budget_amount' in df.columns and 'platform' in df.columns:
            st.subheader("รวมงบแยกตาม Platform")
            platform_summary = df.groupby('platform')['budget_amount'].sum().reset_index()
            platform_summary.columns = ['Platform', 'Total Budget (฿)']
            st.dataframe(platform_summary, use_container_width=True, hide_index=True)

            # Show grand total
            total_budget = df['budget_amount'].sum()
            st.metric("รวมงบ Ads ทั้งหมด", f"฿{total_budget:,.2f}")

    except Exception as e:
        st.error(f"เกิดข้อผิดพลาดในการโหลดข้อมูล: {e}")


def render_marketing_data_page():
    """Main marketing data page"""
    st.title("📊 Marketing Data Entry")
    st.markdown("กรอกข้อมูล Chats และ Ads Budget สำหรับคำนวณ Conversion Rate และ ROAS")
    st.markdown("---")

    # Create tabs
    tab1, tab2 = st.tabs(["💬 Chat Count", "💰 Ads Budget"])

    with tab1:
        if ws_chats is None:
            st.error("⚠️ ยังไม่ได้สร้าง 'chats' sheet ใน Google Sheets กรุณาสร้างก่อนใช้งาน")
            st.info("คอลัมน์ที่ต้องมี: chat_date, chat_count, note")
        else:
            render_chat_input()
            st.markdown("---")
            render_chat_history()

    with tab2:
        if ws_ads_budget is None:
            st.error("⚠️ ยังไม่ได้สร้าง 'ads_budget' sheet ใน Google Sheets กรุณาสร้างก่อนใช้งาน")
            st.info("คอลัมน์ที่ต้องมี: week_start_date, week_end_date, budget_amount, platform, note")
        else:
            render_ads_budget_input()
            st.markdown("---")
            render_ads_budget_history()


if __name__ == "__main__":
    render_marketing_data_page()
