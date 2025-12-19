"""
CT Studio - Authentication Module
จัดการ Login และ Role-based Access Control
"""

import streamlit as st
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader
from pathlib import Path

# Path to config file
CONFIG_FILE = Path(__file__).parent / "config.yaml"


def load_config():
    """โหลด config file"""
    with open(CONFIG_FILE) as file:
        config = yaml.load(file, Loader=SafeLoader)
    return config


def init_authenticator():
    """
    สร้าง Authenticator object
    Returns: authenticator object
    """
    config = load_config()

    authenticator = stauth.Authenticate(
        config['credentials'],
        config['cookie']['name'],
        config['cookie']['key'],
        config['cookie']['expiry_days']
    )

    return authenticator


def check_authentication():
    """
    ตรวจสอบ authentication และแสดงหน้า login ถ้ายังไม่ได้ login

    Returns:
        tuple: (name, authentication_status, username, authenticator)
    """
    authenticator = init_authenticator()

    # แสดง login widget ใน sidebar
    authenticator.login(location='sidebar')

    # ดึงค่า authentication status จาก session state (API ใหม่)
    import streamlit as st
    name = st.session_state.get("name")
    authentication_status = st.session_state.get("authentication_status")
    username = st.session_state.get("username")

    return name, authentication_status, username, authenticator


def get_user_role(username: str) -> str:
    """
    ดึง role ของ user

    Args:
        username: username ของผู้ใช้

    Returns:
        str: role ('admin' หรือ 'sales')
    """
    config = load_config()
    user_data = config['credentials']['usernames'].get(username, {})
    return user_data.get('role', 'sales')


def is_admin(username: str) -> bool:
    """
    ตรวจสอบว่า user เป็น admin หรือไม่

    Args:
        username: username ของผู้ใช้

    Returns:
        bool: True ถ้าเป็น admin
    """
    return get_user_role(username) == 'admin'


def require_admin(username: str):
    """
    บังคับให้ต้องเป็น admin ถึงจะเข้าถึงได้
    ถ้าไม่ใช่จะแสดง error และ stop

    Args:
        username: username ของผู้ใช้
    """
    if not is_admin(username):
        st.error("🚫 คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (Admin only)")
        st.stop()


def show_user_info(name: str, username: str):
    """แสดงข้อมูลผู้ใช้ใน sidebar"""
    role = get_user_role(username)
    role_emoji = "👑" if role == "admin" else "👤"

    st.sidebar.markdown("---")
    st.sidebar.markdown(f"""
    ### {role_emoji} ผู้ใช้งาน
    - **ชื่อ:** {name}
    - **Username:** {username}
    - **Role:** {role.upper()}
    """)


def logout_button(authenticator):
    """แสดงปุ่ม logout"""
    st.sidebar.markdown("---")
    authenticator.logout(location='sidebar')
