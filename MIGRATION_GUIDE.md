# Database Migration Guide

## Issue: Missing `face_photo_url` Column

If you encounter the error:
```
ไม่สามารถสร้างลูกค้าใหม่: Could not find the 'face_photo_url' column of 'customers' in the schema cache
```

This means the `face_photo_url` column hasn't been added to your database yet.

## How to Fix

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** (in the left sidebar)
3. Click **+ New query**
4. Copy and paste the contents of `sql/add-customer-face-photo.sql`:

```sql
-- Add face_photo_url column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS face_photo_url TEXT;

-- Add comment to column for documentation
COMMENT ON COLUMN customers.face_photo_url IS 'URL to customer face photo stored in service-photos bucket';
```

5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
6. Verify the migration succeeded (you should see a success message)

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db execute -f sql/add-customer-face-photo.sql
```

### Option 3: Using psql (for advanced users)

If you have direct PostgreSQL access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f sql/add-customer-face-photo.sql
```

## Verification

After running the migration, verify it worked:

1. Go to **Table Editor** in Supabase Dashboard
2. Select the **customers** table
3. Check that the **face_photo_url** column appears in the column list

## What This Migration Does

- Adds a `face_photo_url` TEXT column to the `customers` table
- This column stores the URL of customer face photos uploaded to the 'service-photos' bucket
- The face photo is displayed in booking chat for artist reference
- This is separate from the `customer_photos` table which stores before/after photos

## Troubleshooting

### "Column already exists" error
If you get an error saying the column already exists, the migration has already been run. Try restarting your Next.js development server:

```bash
npm run dev
```

### Schema cache not updated
If the error persists after running the migration:

1. Restart your Next.js dev server
2. Clear your browser cache
3. Check that you're connected to the correct Supabase project (check `.env.local`)

### Still having issues?
Make sure your `.env.local` file has the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
