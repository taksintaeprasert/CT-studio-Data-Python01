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
