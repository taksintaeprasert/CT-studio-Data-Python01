from config import gc

SHEET_NAME = "ct data"

sh = gc.open(SHEET_NAME)

ws_orders = sh.worksheet("orders")
ws_order_items = sh.worksheet("order_items")
ws_master_item = sh.worksheet("master_item")
ws_staff = sh.worksheet("staff")
ws_customers = sh.worksheet("customers")

print("sheets.py loaded, ws_orders =", ws_orders)
print("orders sheet:", ws_orders.title)
print("order_items sheet:", ws_order_items.title)