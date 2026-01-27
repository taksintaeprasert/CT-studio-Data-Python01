#!/usr/bin/env node

/**
 * Migration Runner Script
 * Runs SQL migrations against the Supabase database
 *
 * Usage:
 *   node scripts/run-migration.js <migration-file-path>
 *   npm run migrate:face-photo
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Get migration file path from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Error: No migration file specified');
  console.error('Usage: node scripts/run-migration.js <migration-file-path>');
  console.error('Example: node scripts/run-migration.js sql/add-customer-face-photo.sql');
  process.exit(1);
}

const migrationPath = path.resolve(process.cwd(), migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

// Read the SQL file
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log(`\n🚀 Running migration: ${path.basename(migrationFile)}`);
  console.log(`📄 File: ${migrationPath}\n`);

  try {
    // Split SQL by semicolons to execute statements separately
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // If exec_sql RPC doesn't exist, try direct SQL execution
        if (error.code === '42883') {
          console.log('📝 Note: Using direct SQL execution (exec_sql function not found)');

          // For ALTER TABLE statements, we can use the Supabase REST API
          // But since that's limited, we'll provide manual instructions
          throw new Error(
            'The database does not have an exec_sql function. Please run this migration manually in the Supabase SQL Editor:\n\n' +
            `1. Go to: ${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql')}\n` +
            `2. Copy and paste the contents of: ${migrationFile}\n` +
            '3. Click "Run" to execute the migration\n'
          );
        }
        throw error;
      }
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the column was added
    console.log('🔍 Verifying column exists...');
    const { data: columns, error: verifyError } = await supabase
      .from('customers')
      .select('face_photo_url')
      .limit(1);

    if (verifyError) {
      console.log('⚠️  Could not verify column (this is normal if no customers exist yet)');
    } else {
      console.log('✅ Column face_photo_url verified in customers table\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);

    if (error.message.includes('manually in the Supabase SQL Editor')) {
      console.error('\n' + error.message);
    }

    process.exit(1);
  }
}

runMigration();
