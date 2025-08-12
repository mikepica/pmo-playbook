-- Remove Agent SOPs Migration Script
-- This script removes all agent_sops functionality from the database

-- Drop indexes first
DROP INDEX IF EXISTS idx_agent_sops_sop_id;
DROP INDEX IF EXISTS idx_agent_sops_is_active;
DROP INDEX IF EXISTS idx_agent_sops_human_sop_id;
DROP INDEX IF EXISTS idx_agent_sops_searchable;
DROP INDEX IF EXISTS idx_agent_sops_keywords;

-- Drop trigger
DROP TRIGGER IF EXISTS update_agent_sops_updated_at ON agent_sops;

-- Drop the agent_sops table
DROP TABLE IF EXISTS agent_sops;

-- Note: The human_sops table is preserved as it contains the original SOP data