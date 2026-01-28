# Migration Instructions

## Common Problems

### Problem 1: Missing Health Columns
Cannot create new customers due to missing columns: `color_allergy`, `drug_allergy`, `medical_condition`

Error: `Could not find the 'color_allergy' column of 'customers' in the schema cache`

### Problem 2: Missing Face Photo Column
Cannot create new customers due to missing column: `face_photo_url`

Error: `Could not find the 'face_photo_url' column of 'customers' in the schema cache`
Error (Thai): `ไม่สามารถสร้างลูกค้าใหม่: Could not find the 'face_photo_url' column of 'customers' in the schema cache`

## Solution
Run ALL migrations below in your Supabase SQL Editor in order:

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query

### Step 2: Run Migration v16 - Health Columns

```sql
-- Migration v16: Add customer health and travel information
-- Add province, medical_condition, color_allergy, drug_allergy to customers table

-- Add new columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS province VARCHAR(100),
ADD COLUMN IF NOT EXISTS medical_condition TEXT,
ADD COLUMN IF NOT EXISTS color_allergy TEXT,
ADD COLUMN IF NOT EXISTS drug_allergy TEXT;

-- Add comments for documentation
COMMENT ON COLUMN customers.province IS 'Province where customer is traveling from (เดินทางมาจากจังหวัด)';
COMMENT ON COLUMN customers.medical_condition IS 'Customer medical conditions (มีโรคประจำตัวไหม)';
COMMENT ON COLUMN customers.color_allergy IS 'Color allergy history (มีประวัติแพ้สีไหม)';
COMMENT ON COLUMN customers.drug_allergy IS 'Drug allergy history (มีประวัติแพ้ยาไหม)';
```

### Step 3: Run Migration - Face Photo Column

Run this SQL in the same SQL Editor:

```sql
-- Add face_photo_url column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS face_photo_url TEXT;

-- Add comment to column for documentation
COMMENT ON COLUMN customers.face_photo_url IS 'URL to customer face photo stored in service-photos bucket';
```

**What this does:**
- Adds `face_photo_url` column to store customer face photos
- Photos are displayed in booking chat for artist reference
- Different from `customer_photos` table (which stores before/after photos)

### Step 4: Verify All Migrations
After running the SQL, verify that all columns were added:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

You should see ALL these columns:
- `province` (character varying)
- `medical_condition` (text)
- `color_allergy` (text)
- `drug_allergy` (text)
- `face_photo_url` (text)

### Step 5: Test
Try creating a new customer in your application. All errors should be resolved.

---

## Alternative: Using Supabase CLI (if installed)

If you have Supabase CLI installed, you can also run:

```bash
supabase migration new add_customer_health_info
# Then copy the SQL from database/migration_v16_add_customer_health_info.sql
# And run:
supabase db push
```

---

## Files Affected by These Migrations

### Health Columns (v16)
- `app/focus/components/create-order-step.tsx` - Uses these columns when creating orders
- `app/focus/components/booking-modal.tsx` - Displays this info in booking chat
- `app/(dashboard)/customers/page.tsx` - Customer management page

### Face Photo Column
- `app/(dashboard)/orders/new/page.tsx` - Uploads and saves face photo when creating customers
- `app/focus/components/booking-modal.tsx` - Displays face photo in booking chat
- `app/focus/components/booking-queue-step.tsx` - Fetches face photo for display
- `app/(dashboard)/orders/[id]/page.tsx` - Shows face photo in order details

## What These Columns Store

### Health & Travel Information
- **province**: Customer's province (where they're traveling from)
- **medical_condition**: Any medical conditions the customer has
- **color_allergy**: History of allergic reactions to colors/dyes
- **drug_allergy**: History of drug allergies

### Customer Photo
- **face_photo_url**: URL of customer's face photo stored in 'service-photos' bucket
  - Displayed in booking chat for artist reference
  - Different from `customer_photos` table (before/after photos)
  - Helps artists identify customers

These are important for artist safety, service quality, and customer identification.
