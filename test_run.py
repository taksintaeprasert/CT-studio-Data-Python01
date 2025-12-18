from sheets import ws_orders, ws_order_items, ws_master_item
from orders import create_order_with_items

order_id, total = create_order_with_items(
    ws_orders=ws_orders,
    ws_order_items=ws_order_items,
    ws_master_item=ws_master_item,
    customer_id="CUST001",
    appointment_date="2025-12-18",
    appointment_time="11:30",
    sales_id="mo",
    artist_id="tsboss",
    channel="facebook",
    order_status="booking",
    item_codes=["lip3500", "lip3500free"],
    upsell_flags=[False, False],
    note="1-click flow test",
)

print(order_id, total)
