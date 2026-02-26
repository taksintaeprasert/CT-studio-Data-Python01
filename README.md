# CT Studio ERP System

A comprehensive ERP system for managing studio operations, built with Next.js, TypeScript, and Supabase.

## Tech Stack

- **Framework**: Next.js 14.0.4
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Charts**: Chart.js & react-chartjs-2
- **Icons**: Lucide React
- **Authentication**: Supabase Auth
- **APIs**: LINE Messaging API for notifications

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn
- A Supabase account
- A LINE Messaging API account (for notifications)

## Environment Variables Setup

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

### 2. Configure Environment Variables

Open `.env.local` and configure the following variables:

#### Supabase Configuration

Get these from your Supabase project dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**How to get Supabase credentials:**
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the Project URL (NEXT_PUBLIC_SUPABASE_URL)
4. Copy the anon/public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
5. Copy the service_role key (SUPABASE_SERVICE_ROLE_KEY) - **Keep this secret!**

#### LINE Messaging API Configuration

Get these from: https://developers.line.biz/console/

```env
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token-here
LINE_NOTIFY_USER_ID=your-user-id-or-group-id-here
```

**How to get LINE credentials:**
1. Go to LINE Developers Console
2. Create or select your Messaging API channel
3. Go to the "Messaging API" tab
4. Click "Issue" to get your Channel Access Token
5. For User ID: Go to "Basic Settings" tab > Copy "Your user ID"
6. For Group notifications: Add the bot to a group and use the group ID

#### Optional: Cron Secret

For securing cron endpoints (recommended for production):

```env
CRON_SECRET=your-random-secret-here
```

Generate a random string and set it in your environment variables.

## Database Configuration

This project uses Supabase as the database backend. You'll need to run migrations to set up the database schema.

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run Database Migrations

Run the migration files in the `database/` directory in order. Key migrations include:

#### Essential Migrations

1. **Customer Health Information** (`migration_v16_add_customer_health_info.sql`)
   - Adds health-related columns: `medical_condition`, `color_allergy`, `drug_allergy`
   - Adds `province` column for travel information

2. **Customer Face Photo**
   - Adds `face_photo_url` column for storing customer identification photos

3. **Authentication** (`migration_v10_staff_auth.sql`)
   - Sets up staff authentication system

4. **Focus Mode** (`migration_v11_focus_mode.sql`)
   - Adds features for focus mode operations

5. **Commission Settings** (`migration_v19_commission_base_price.sql`)
   - Configures commission calculation system

See `database/MIGRATION_INSTRUCTIONS.md` for detailed instructions and troubleshooting.

### Step 3: Verify Database Setup

After running migrations, verify the setup:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

### Database Tables Overview

The system includes the following main tables:
- `customers` - Customer information and health records
- `staff` - Staff member accounts
- `orders` - Order management
- `order_items` - Individual order items/bookings
- `products` - Service/product catalog
- `sales` - Sales transactions
- `payments` - Payment records
- `booking_messages` - Customer-artist communication
- `customer_photos` - Before/after service photos
- `customer_satisfaction` - Customer feedback
- `commission_settings` - Staff commission configuration

## Getting Started

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd CT-studio-Data-Python01
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see Environment Variables Setup above)

4. Run database migrations (see Database Configuration above)

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
CT-studio-Data-Python01/
├── app/                      # Next.js app directory
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Dashboard pages
│   ├── api/                 # API routes
│   └── focus/               # Focus mode feature
├── components/              # Reusable React components
├── database/                # Database migrations and scripts
├── lib/                     # Utility functions and configurations
└── public/                  # Static assets
```

## Key Features

- **Order Management**: Create and track customer orders
- **Customer Management**: Comprehensive customer profiles with health information
- **Staff Management**: Staff accounts with authentication
- **Booking System**: Artist booking and queue management
- **Focus Mode**: Streamlined interface for service operations
- **Chat System**: Real-time communication between customers and artists
- **Payment Tracking**: Payment records and receipt management
- **Commission System**: Automated staff commission calculation
- **Customer Satisfaction**: Feedback collection and analysis
- **LINE Integration**: Automated notifications via LINE Messaging API
- **Photo Management**: Before/after service photo storage
- **Calendar View**: Schedule and appointment management
- **Analytics**: Sales and performance reporting

## Storage Configuration

The system uses Supabase Storage with the following buckets:
- `service-photos` - Customer face photos and service images
- `payment-receipts` - Payment slip uploads

See `SUPABASE_STORAGE_SETUP.md` for storage configuration details.

## Additional Documentation

- `HANDOFF_BRIEF.md` - Project handoff information
- `MIGRATION_GUIDE.md` - Detailed migration guide
- `database/MIGRATION_INSTRUCTIONS.md` - Database setup instructions
- `database/HOW_TO_RUN_BACKFILL.md` - Data backfill procedures
- `SATISFACTION_FEATURE.md` - Customer satisfaction feature documentation
- `COMMISSION_FIX_README.md` - Commission system documentation

## Troubleshooting

### Common Issues

1. **Missing columns error**: Run all database migrations in order
2. **Authentication errors**: Verify Supabase credentials in `.env.local`
3. **LINE notification failures**: Check LINE_CHANNEL_ACCESS_TOKEN and LINE_NOTIFY_USER_ID
4. **Build errors**: Delete `.next` folder and `node_modules`, then reinstall

## Support

For issues and questions, please refer to the documentation files or contact the development team.

## License

Private project - All rights reserved
