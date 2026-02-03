# แก้ไขปัญหาการคำนวณ Commission สำหรับบริการ FREE

## ปัญหาเดิม
เมื่อลูกค้าซื้อบริการที่มีบริการ FREE แถม (เช่น BROW3900 + BROW3900FREE):
- บริการ FREE มี `item_price = 0`
- ทำให้เมื่อช่างทำบริการ FREE เสร็จ commission ที่คำนวณได้จะเป็น 0 บาท
- แต่จริงๆ แล้วควรได้รับ commission เท่ากับบริการหลัก

**ตัวอย่าง:**
- BROW3900 = 3900 บาท → Commission 5% = 195 บาท
- BROW3900FREE = 0 บาท → Commission 5% = **0 บาท** (❌ ผิด!)
- ที่ถูกต้องคือ BROW3900FREE ควรได้ **195 บาท** เช่นกัน

## วิธีแก้ไข

### 1. เพิ่มฟิลด์ `commission_base_price` ในตาราง `order_items`
ฟิลด์นี้เก็บราคาที่ใช้สำหรับคำนวณ commission:
- สำหรับบริการปกติ: `commission_base_price = item_price`
- สำหรับบริการ FREE: `commission_base_price = ราคาของบริการหลักที่จับคู่`

### 2. ไฟล์ที่แก้ไข

#### 📁 Database Migration
- **`database/migration_v19_commission_base_price.sql`** - เพิ่มฟิลด์ใหม่
- **`database/backfill_commission_base_price.sql`** - อัปเดตข้อมูลเก่าให้ถูกต้อง

#### 📁 Backend/Frontend
- **`lib/supabase/types.ts`** - เพิ่ม type สำหรับฟิลด์ใหม่
- **`app/(dashboard)/orders/new/page.tsx`** - แก้ไขการสร้าง order ใหม่
- **`app/(dashboard)/artist/page.tsx`** - แก้ไขการคำนวณ commission
- **`app/(dashboard)/artist-performance/page.tsx`** - แก้ไขการคำนวณ commission

## วิธีการติดตั้ง

### Step 1: Run Migration (Supabase SQL Editor)

```sql
-- 1. Run migration to add commission_base_price field
-- Copy and paste content from: database/migration_v19_commission_base_price.sql
```

### Step 2: Backfill Existing Data (Supabase SQL Editor)

```sql
-- 2. Run backfill script to update existing FREE services
-- Copy and paste content from: database/backfill_commission_base_price.sql
```

### Step 3: Deploy Code Changes

การแก้ไขโค้ดได้ทำเสร็จแล้ว - เพียงแค่ push และ deploy

```bash
git add .
git commit -m "fix: Fix commission calculation for FREE services"
git push
```

## การทำงานหลังแก้ไข

### เมื่อสร้าง Order ใหม่
1. เพิ่มบริการหลัก (เช่น BROW3900):
   ```
   item_price = 3900
   commission_base_price = 3900
   ```

2. เพิ่มบริการ FREE (เช่น BROW3900FREE):
   ```
   item_price = 0  (ลูกค้าไม่ต้องจ่าย)
   commission_base_price = 3900  (ใช้สำหรับคำนวณ commission)
   ```

### เมื่อคำนวณ Commission
```typescript
// เก่า (ผิด)
const commission = item_price * (commissionPercent / 100)

// ใหม่ (ถูก)
const commissionBasePrice = item.commission_base_price || item.item_price || 0
const commission = commissionBasePrice * (commissionPercent / 100)
```

### ตัวอย่างผลลัพธ์
**กรณี: ช่าง A มี commission = 10% (5% ต่อครั้ง)**

| บริการ | ราคา (item_price) | Commission Base Price | Commission ที่ได้ |
|---------|-------------------|----------------------|------------------|
| BROW3900 | 3,900 | 3,900 | 195 บาท (5%) |
| BROW3900FREE | 0 | 3,900 | 195 บาท (5%) |
| **รวม** | **3,900** | - | **390 บาท (10%)** ✓ |

## การทดสอบ

### Test Case 1: Order ใหม่
1. สร้าง order ใหม่ที่มีบริการ + FREE
2. ให้ช่างทำบริการทั้งสองอันเสร็จ
3. ตรวจสอบ commission ในหน้า Artist Home และ Artist Performance
4. **Expected:** Commission ต้องเท่ากับ % เต็มของราคาบริการ

### Test Case 2: Order เก่า (หลัง Backfill)
1. ดู order เก่าที่มีบริการ FREE ที่เสร็จแล้ว
2. ตรวจสอบ commission ในหน้า Artist Home และ Artist Performance
3. **Expected:** Commission ต้องถูกแก้ไขให้ถูกต้องแล้ว

### Test Case 3: Order 50%
1. สร้าง order ที่เป็นบริการ 50% (เช่น BROW50%)
2. ตรวจสอบว่าใช้ commission_50_percent ถูกต้อง
3. **Expected:** Commission คำนวณจากราคาที่ลดแล้ว ใช้ % 50% ที่ตั้งไว้

## Verification Queries

```sql
-- ตรวจสอบว่า migration สำเร็จ
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'order_items' AND column_name = 'commission_base_price';

-- ตรวจสอบบริการ FREE ที่ถูก update แล้ว
SELECT
  oi.id,
  p.product_code,
  p.product_name,
  oi.item_price,
  oi.commission_base_price,
  CASE
    WHEN oi.commission_base_price > 0 THEN '✓ OK'
    ELSE '✗ Not updated'
  END as status
FROM order_items oi
JOIN products p ON oi.product_id = p.id
WHERE (p.is_free = true OR p.product_code ILIKE '%FREE%' OR p.list_price = 0)
ORDER BY oi.id DESC
LIMIT 20;

-- สรุปจำนวนบริการ FREE ทั้งหมด
SELECT
  COUNT(*) as total_free_services,
  COUNT(CASE WHEN commission_base_price > 0 THEN 1 END) as updated_count,
  COUNT(CASE WHEN commission_base_price = 0 THEN 1 END) as pending_count
FROM order_items oi
JOIN products p ON oi.product_id = p.id
WHERE (p.is_free = true OR p.product_code ILIKE '%FREE%' OR p.list_price = 0);
```

## หมายเหตุ

### การทำงานของ Backfill Script
Script จะพยายามหาราคาของบริการหลักโดย:
1. หาบริการที่จับคู่กันใน order เดียวกัน (preferred)
2. ถ้าไม่เจอ จะหาจากตาราง products โดยจับคู่ base code และ price code
3. ถ้ายังไม่เจอ จะคงค่าเดิมไว้

### กรณีพิเศษ
- **Order 50%**: บริการ 50% จะมีแค่บริการเดียว ราคาถูกลดแล้ว ช่างได้ commission % เต็ม
- **Upsell**: บริการ upsell จะใช้ราคาตามที่บันทึกไว้ใน item_price

### ข้อควรระวัง
- ฟิลด์ `commission_base_price` จะถูกตั้งค่าเมื่อสร้าง order เท่านั้น
- ถ้ามีการแก้ไขราคาภายหลัง จะต้องแก้ไข `commission_base_price` ด้วยตนเอง
- การเปลี่ยนบริการหลังจากสร้าง order แล้ว อาจทำให้ commission_base_price ไม่ตรงกับบริการที่เปลี่ยนใหม่
