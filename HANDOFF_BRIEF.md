# CT Studio ERP - Project Handoff Brief

> Last Updated: 2026-01-20
> Branch: `claude/ct-studio-erp-handoff-2DECw`

---

## 1. Project Overview

**CT Studio ERP** เป็นระบบจัดการธุรกิจสำหรับร้านบริการความงาม (Beauty Salon) พัฒนาด้วย Next.js 14 + Supabase

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Chart.js (react-chartjs-2) |
| Notifications | LINE Messaging API |
| Hosting | Vercel |

### Directory Structure
```
/app
  /(dashboard)
    /page.tsx          # Dashboard with Alerts
    /orders/           # Order management
    /service/          # Appointment/Service management
    /sales/            # Sales Performance & Reports
    /calendar/         # Calendar view
    /customers/        # Customer management
    /products/         # Product/Service catalog
    /staff/            # Staff management
    /artist/           # Artist home page
  /api
    /daily-report/     # Manual daily report trigger
    /cron/daily-report # Auto daily report (Vercel Cron)
    /line-notify/      # LINE notification endpoint
    /line/webhook/     # LINE webhook for receiving messages

/lib
  /line/client.ts      # LINE Messaging API client
  /supabase/           # Supabase client config

/database
  /migration_v*.sql    # Database migrations
```

---

## 2. Core Features

### 2.1 Order Management (`/orders`)
- สร้าง Order ใหม่พร้อมเลือกลูกค้า/บริการ
- ระบบแนะนำบริการ FREE อัตโนมัติ
- **Order Status**: คำนวณจาก service completion
  - `Ongoing` = มีบริการที่ยังไม่ completed
  - `Done` = ทุกบริการ completed แล้ว

### 2.2 Appointment/Service (`/service`)
- จัดการนัดหมายและสถานะบริการ
- **Service Status**: `pending` → `scheduled` → `completed`
- **Filters** (พร้อม OR/AND toggle):
  - บริการ Completed
  - มีค้างชำระ
  - ใกล้หมดอายุ (2 เดือน)
  - บริการ 50%
  - บริการ FREE
- รับชำระเงินได้จากหน้านี้

### 2.3 Dashboard Alerts (`/`)
แสดงการแจ้งเตือน 2 ประเภท:
1. **ยังไม่นัด** - บริการปกติที่ยังไม่ได้นัดหมาย
2. **ใกล้หมดอายุ** - บริการ FREE/50% ที่เหลือ ≤14 วัน

> Note: แจ้งเตือนค้างชำระถูกลบออกแล้วตามความต้องการ

### 2.4 Sales Performance (`/sales`)
- **Pie Charts**: Booking/Income/Orders ตาม Staff
- **Line Charts**: Booking/Income ตามเวลา
- บันทึกจำนวนแชทและข้อมูลรายวัน
- ส่ง Daily Report ไป LINE

### 2.5 LINE Integration
- **LINE Messaging API** (ไม่ใช่ LINE Notify)
- ส่งแจ้งเตือน New Order
- ส่ง Daily Report (manual & auto cron)
- Webhook รับ Group ID

---

## 3. Database Schema (Key Tables)

### orders
```sql
id, customer_id, sales_id, order_status, total_income, deposit, created_at
```

### order_items
```sql
id, order_id, product_id, item_status, item_price, appointment_date, artist_id
```

### chat_counts
```sql
id, staff_id, date, chat_count,
walk_in_count, google_review_count, follow_up_closed  -- NEW (Migration V8)
```

### products
```sql
id, product_code, product_name, category, list_price, is_free, validity_months
```

### customers, staff, payments, etc.

---

## 4. Environment Variables (Vercel)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=xxx    # From LINE Developers Console
LINE_CHANNEL_SECRET=xxx          # For webhook verification
LINE_NOTIFY_USER_ID=Cxxx         # Group ID (starts with C) or User ID (starts with U)
```

---

## 5. Daily Report Format

```
📊 DAILY REPORT
วันจันทร์ที่ 20 มกราคม 2569

━━━━━━━━━━━━━━━━━━
📈 Daily Performance
━━━━━━━━━━━━━━━━━━
New chats: 20
Deals closed: 3
CR%: 15%

🚶 Walk-in customers: 14
⭐️ Google reviews: 0

━━━━━━━━━━━━━━━━━━
💰 Revenue
━━━━━━━━━━━━━━━━━━
Bookings today: ฿81,550
Master bookings (20k+): ฿62,700
50% customers: 3
Closed from follow-up: 0

💵 Actual revenue: ฿57,100

━━━━━━━━━━━━━━━━━━
👥 Sales Performance
━━━━━━━━━━━━━━━━━━
👤 [Sales Name]
   New chats: X
   Deals closed: X
   CR%: X%

━━━━━━━━━━━━━━━━━━
💅 Services Sold
━━━━━━━━━━━━━━━━━━
  • [Category]: X pax (฿X)
```

---

## 6. Recent Changes History

### 2026-01-20 (Latest Session)
1. **ลบแจ้งเตือนค้างชำระ** - Dashboard แสดงเฉพาะ "ยังไม่นัด" และ "ใกล้หมดอายุ"
2. **เพิ่ม OR/AND Toggle** - ตัวกรองในหน้านัดหมายรองรับ OR/AND mode
3. **เปลี่ยน Bar Charts เป็น Pie Charts** - หน้า Sales Performance
4. **เพิ่ม Line Charts** - แสดง Booking/Income ตามเวลา
5. **เปลี่ยนจาก LINE Notify เป็น LINE Messaging API** - ใช้ `LINE_CHANNEL_ACCESS_TOKEN`
6. **อัพเดท Daily Report Format** - เพิ่มข้อมูล:
   - Walk-in customers
   - Google reviews
   - Closed from follow-up
   - Master bookings (20k+)
   - 50% customers
7. **Migration V8** - เพิ่ม columns ใหม่ใน `chat_counts` table

### Previous Changes
- Order Status เปลี่ยนจาก Booking/Paid/Done/Cancelled เป็น Ongoing/Done (computed)
- Role-based access control
- Artist Home page
- Auto-fix service status
- และอื่นๆ

---

## 7. Pending Migrations

### Migration V8 (ต้องรัน!)
```sql
-- database/migration_v8_daily_metrics.sql
ALTER TABLE chat_counts
ADD COLUMN IF NOT EXISTS walk_in_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follow_up_closed INTEGER DEFAULT 0;
```

---

## 8. Known Issues / TODO

### Human Error Reduction (Planned)
1. [ ] เพิ่ม Confirmation Dialog ก่อนรับชำระ
2. [ ] Validate ยอดชำระไม่เกินยอดค้าง
3. [ ] เพิ่ม Confirmation ก่อนเปลี่ยนสถานะเป็น Completed
4. [ ] หน้าสรุป Order ก่อนสร้าง
5. [ ] เช็ค Artist Availability
6. [ ] Audit Trail

### LINE Integration Notes
- ถ้าต้องการส่งไปกลุ่ม ต้องใช้ **Group ID** (เริ่มด้วย `C`)
- พิมพ์ `groupid` ในกลุ่ม LINE เพื่อให้ Bot ตอบ Group ID
- LINE Messaging API มีโควต้า 500 ข้อความฟรี/เดือน

---

## 9. Quick Commands

```bash
# Development
npm run dev

# Build
npm run build

# Git (current branch)
git checkout claude/ct-studio-erp-handoff-2DECw
git push -u origin claude/ct-studio-erp-handoff-2DECw
```

---

## 10. Contact / Resources

- **GitHub**: taksintaeprasert/CT-studio-Data-Python01
- **Supabase Dashboard**: [Project URL]
- **Vercel Dashboard**: [Project URL]
- **LINE Developers Console**: https://developers.line.biz/console/

---

*This document should be updated after significant changes to help future sessions understand the project context.*
