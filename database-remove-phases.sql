-- Database cleanup script to remove phase functionality
-- Run this to completely remove phases table and phase columns from SOPs

-- Step 1: Remove foreign key constraints
ALTER TABLE human_sops DROP CONSTRAINT IF EXISTS fk_human_sops_phase;
ALTER TABLE agent_sops DROP CONSTRAINT IF EXISTS fk_agent_sops_phase;

-- Step 2: Remove phase-related indexes
DROP INDEX IF EXISTS idx_phases_number;
DROP INDEX IF EXISTS idx_phases_active;
DROP INDEX IF EXISTS idx_phases_order;
DROP INDEX IF EXISTS idx_human_sops_phase;
DROP INDEX IF EXISTS idx_agent_sops_phase;

-- Step 3: Drop the phases table entirely
DROP TABLE IF EXISTS phases CASCADE;

-- Step 4: Remove phase columns from SOP tables
ALTER TABLE human_sops DROP COLUMN IF EXISTS phase;
ALTER TABLE agent_sops DROP COLUMN IF EXISTS phase;

-- Step 5: Remove old phase constraints (if they exist)
ALTER TABLE human_sops DROP CONSTRAINT IF EXISTS check_phase_positive;
ALTER TABLE agent_sops DROP CONSTRAINT IF EXISTS check_phase_positive;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Phase functionality completely removed!';
    RAISE NOTICE 'Removed: phases table, phase columns, constraints, and indexes';
    RAISE NOTICE 'SOPs now operate without phase organization';
END $$;