# SQL Migrations

This folder contains SQL migration files that need to be run in your Supabase database.

## Quick Start

If you're encountering errors about missing columns in the `customers` table, you need to run these migrations.

### Migration Files

1. **add-customer-face-photo.sql** - Adds `face_photo_url` column
   - **Run this if you see:** `Could not find the 'face_photo_url' column`

### How to Run

See the detailed guide: **[MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md)** in the root folder

Or: **[database/MIGRATION_INSTRUCTIONS.md](../database/MIGRATION_INSTRUCTIONS.md)** for all migrations

### Quick Instructions

1. Open your Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy and paste the SQL from the migration file
4. Click **Run**
5. Restart your Next.js dev server

## Need Help?

- See [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) for troubleshooting
- See [database/MIGRATION_INSTRUCTIONS.md](../database/MIGRATION_INSTRUCTIONS.md) for complete migration history
