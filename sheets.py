from config import gc

SHEET_NAME = "ct data"

sh = gc.open(SHEET_NAME)

ws_orders = sh.worksheet("orders")
ws_order_items = sh.worksheet("order_items")
ws_master_item = sh.worksheet("master_item")
ws_staff = sh.worksheet("staff")
ws_customers = sh.worksheet("customers")

# เพิ่ม payments worksheet
try:
    ws_payments = sh.worksheet("payments")
    print("payments sheet:", ws_payments.title)
except Exception as e:
    print(f"Warning: payments sheet not found. Please create it. Error: {e}")
    ws_payments = None

# เพิ่ม chats worksheet
try:
    ws_chats = sh.worksheet("chats")
    print("chats sheet:", ws_chats.title)
except Exception as e:
    print(f"Warning: chats sheet not found. Please create it. Error: {e}")
    ws_chats = None

# เพิ่ม ads_budget worksheet
try:
    ws_ads_budget = sh.worksheet("ads_budget")
    print("ads_budget sheet:", ws_ads_budget.title)
except Exception as e:
    print(f"Warning: ads_budget sheet not found. Please create it. Error: {e}")
    ws_ads_budget = None

print("sheets.py loaded, ws_orders =", ws_orders)
print("orders sheet:", ws_orders.title)
print("order_items sheet:", ws_order_items.title)