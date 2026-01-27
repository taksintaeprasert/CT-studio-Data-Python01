# Migration Instructions

## Problem
Cannot create new customers due to missing columns: `color_allergy`, `drug_allergy`, `medical_condition`

Error: `Could not find the 'color_allergy' column of 'customers' in the schema cache`

## Solution
Run the migration SQL below in your Supabase SQL Editor:

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query

### Step 2: Run This SQL

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

### Step 3: Verify the Migration
After running the SQL, verify that the columns were added:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

You should see the new columns:
- `province` (character varying)
- `medical_condition` (text)
- `color_allergy` (text)
- `drug_allergy` (text)

### Step 4: Test
Try creating a new customer in your application. The error should be resolved.

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

## Files Affected by This Migration
- `app/focus/components/create-order-step.tsx` - Uses these columns when creating orders
- `app/focus/components/booking-modal.tsx` - Displays this info in booking chat
- `app/(dashboard)/customers/page.tsx` - Customer management page

## What These Columns Store
- **province**: Customer's province (where they're traveling from)
- **medical_condition**: Any medical conditions the customer has
- **color_allergy**: History of allergic reactions to colors/dyes
- **drug_allergy**: History of drug allergies

These are important for artist safety and service quality.
