-- CT Studio ERP Sample Data
-- Run this after schema.sql

-- =============================================
-- SAMPLE STAFF
-- =============================================
INSERT INTO staff (staff_name, email, role) VALUES
('Admin CT', 'admin@ctstudio.com', 'admin'),
('Sales 01', 'sale01@ctstudio.com', 'sales'),
('Sales 02', 'sale02@ctstudio.com', 'sales'),
('Artist 01', 'artist01@ctstudio.com', 'artist'),
('Artist 02', 'artist02@ctstudio.com', 'artist');

-- =============================================
-- SAMPLE CUSTOMERS
-- =============================================
INSERT INTO customers (full_name, phone, contact_channel, note) VALUES
('คุณสมหญิง', '081-234-5678', 'LINE', 'ลูกค้าประจำ'),
('คุณสมชาย', '089-876-5432', 'Facebook', NULL),
('คุณมานี', '092-111-2222', 'Instagram', 'ชอบแนว minimal'),
('คุณมานะ', '083-333-4444', 'LINE', NULL),
('คุณปิติ', '084-555-6666', 'Walk-in', 'แนะนำจากเพื่อน');

-- =============================================
-- SAMPLE PRODUCTS
-- =============================================
INSERT INTO products (product_code, product_name, category, list_price, is_free) VALUES
('TAT-001', 'รอยสักขนาดเล็ก (1-3 นิ้ว)', 'Tattoo', 1500, false),
('TAT-002', 'รอยสักขนาดกลาง (3-5 นิ้ว)', 'Tattoo', 3000, false),
('TAT-003', 'รอยสักขนาดใหญ่ (5-8 นิ้ว)', 'Tattoo', 5000, false),
('TAT-004', 'รอยสักเต็มแขน', 'Tattoo', 15000, false),
('PIE-001', 'เจาะหู (ต่างหู)', 'Piercing', 500, false),
('PIE-002', 'เจาะจมูก', 'Piercing', 800, false),
('PIE-003', 'เจาะสะดือ', 'Piercing', 1000, false),
('SPA-001', 'สปาผิว', 'Spa', 1500, false),
('FREE-001', 'ปรึกษาฟรี', 'Consultation', 0, true),
('FREE-002', 'ดูแลหลังทำ', 'Aftercare', 0, true);

-- =============================================
-- SAMPLE ORDERS
-- =============================================
INSERT INTO orders (customer_id, sales_id, artist_id, order_date, appointment_date, appointment_time, order_status, total_income, deposit, payment_method, note) VALUES
(1, 2, 4, '2024-01-15', '2024-01-20', '14:00', 'done', 3500, 1000, 'โอนเงิน', 'รอยสักกลางแขน'),
(2, 2, 5, '2024-01-16', '2024-01-22', '10:00', 'done', 1500, 500, 'เงินสด', NULL),
(3, 3, 4, '2024-01-18', '2024-01-25', '15:00', 'active', 5000, 1500, 'โอนเงิน', 'รอยสักหลัง'),
(4, 2, 5, '2024-01-20', '2024-01-28', '11:00', 'booking', 3000, 1000, 'โอนเงิน', NULL),
(5, 3, 4, '2024-01-22', '2024-02-01', '14:00', 'booking', 500, 0, 'เงินสด', 'เจาะหูครั้งแรก');

-- =============================================
-- SAMPLE ORDER ITEMS
-- =============================================
INSERT INTO order_items (order_id, product_id, is_upsell) VALUES
(1, 2, false),
(1, 9, true),
(2, 1, false),
(3, 3, false),
(4, 2, false),
(5, 5, false);

-- =============================================
-- SAMPLE PAYMENTS
-- =============================================
INSERT INTO payments (order_id, payment_date, amount, payment_method, note) VALUES
(1, '2024-01-15', 1000, 'โอนเงิน', 'มัดจำ'),
(1, '2024-01-20', 2500, 'เงินสด', 'ชำระส่วนที่เหลือ'),
(2, '2024-01-16', 500, 'เงินสด', 'มัดจำ'),
(2, '2024-01-22', 1000, 'เงินสด', 'ชำระส่วนที่เหลือ'),
(3, '2024-01-18', 1500, 'โอนเงิน', 'มัดจำ'),
(4, '2024-01-20', 1000, 'โอนเงิน', 'มัดจำ');

-- =============================================
-- SAMPLE MARKETING DATA
-- =============================================
INSERT INTO chats (chat_date, total_chats) VALUES
('2024-01-15', 25),
('2024-01-16', 30),
('2024-01-17', 22),
('2024-01-18', 35),
('2024-01-19', 40);

INSERT INTO ads_budget (week_start_date, platform, budget, income) VALUES
('2024-01-08', 'Facebook', 2000, 8500),
('2024-01-08', 'Instagram', 1500, 6000),
('2024-01-15', 'Facebook', 2500, 10000),
('2024-01-15', 'Instagram', 1800, 7500);
