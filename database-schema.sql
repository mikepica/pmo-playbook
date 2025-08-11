-- PMO Playbook Database Schema
-- PostgreSQL Database Creation Script for Enterprise Account
-- Generated for pgAdmin4

-- Create database (run this separately if needed)
-- CREATE DATABASE pmo_playbook_db;

-- Connect to the database and create tables
-- \c pmo_playbook_db;

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create human_sops table
CREATE TABLE IF NOT EXISTS human_sops (
    id SERIAL PRIMARY KEY,
    sop_id VARCHAR(50) UNIQUE NOT NULL,
    phase INTEGER NOT NULL,
    data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agent_sops table
CREATE TABLE IF NOT EXISTS agent_sops (
    id SERIAL PRIMARY KEY,
    sop_id VARCHAR(50) UNIQUE NOT NULL,
    human_sop_id INTEGER REFERENCES human_sops(id) ON DELETE SET NULL,
    phase INTEGER NOT NULL,
    data JSONB NOT NULL,
    searchable_content TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_histories table
CREATE TABLE IF NOT EXISTS chat_histories (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100),
    data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create change_proposals table
CREATE TABLE IF NOT EXISTS change_proposals (
    id SERIAL PRIMARY KEY,
    proposal_id VARCHAR(50) UNIQUE NOT NULL,
    sop_id VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
    id SERIAL PRIMARY KEY,
    feedback_id VARCHAR(50) UNIQUE NOT NULL,
    session_id VARCHAR(100),
    data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create message_feedback table
CREATE TABLE IF NOT EXISTS message_feedback (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Human SOPs indexes
CREATE INDEX IF NOT EXISTS idx_human_sops_sop_id ON human_sops(sop_id);
CREATE INDEX IF NOT EXISTS idx_human_sops_phase ON human_sops(phase);
CREATE INDEX IF NOT EXISTS idx_human_sops_is_active ON human_sops(is_active);
CREATE INDEX IF NOT EXISTS idx_human_sops_title ON human_sops USING GIN ((data->>'title'));

-- Agent SOPs indexes
CREATE INDEX IF NOT EXISTS idx_agent_sops_sop_id ON agent_sops(sop_id);
CREATE INDEX IF NOT EXISTS idx_agent_sops_phase ON agent_sops(phase);
CREATE INDEX IF NOT EXISTS idx_agent_sops_is_active ON agent_sops(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_sops_human_sop_id ON agent_sops(human_sop_id);
CREATE INDEX IF NOT EXISTS idx_agent_sops_searchable ON agent_sops USING GIN (to_tsvector('english', searchable_content));
CREATE INDEX IF NOT EXISTS idx_agent_sops_keywords ON agent_sops USING GIN ((data->'keywords'));

-- Chat histories indexes
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON chat_histories(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_histories_user_id ON chat_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_histories_status ON chat_histories(status);
CREATE INDEX IF NOT EXISTS idx_chat_histories_started_at ON chat_histories(started_at);
CREATE INDEX IF NOT EXISTS idx_chat_histories_last_active ON chat_histories(last_active);

-- Change proposals indexes
CREATE INDEX IF NOT EXISTS idx_change_proposals_proposal_id ON change_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_change_proposals_sop_id ON change_proposals(sop_id);
CREATE INDEX IF NOT EXISTS idx_change_proposals_status ON change_proposals(status);
CREATE INDEX IF NOT EXISTS idx_change_proposals_priority ON change_proposals(priority);

-- User feedback indexes
CREATE INDEX IF NOT EXISTS idx_user_feedback_feedback_id ON user_feedback(feedback_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_session_id ON user_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_priority ON user_feedback(priority);

-- Message feedback indexes
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_session_id ON message_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_created_at ON message_feedback(created_at);

-- Create trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_human_sops_updated_at BEFORE UPDATE ON human_sops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_sops_updated_at BEFORE UPDATE ON agent_sops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_histories_updated_at BEFORE UPDATE ON chat_histories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_proposals_updated_at BEFORE UPDATE ON change_proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_feedback_updated_at BEFORE UPDATE ON user_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_feedback_updated_at BEFORE UPDATE ON message_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create some sample data constraints and checks
ALTER TABLE projects ADD CONSTRAINT check_project_id_format 
    CHECK (project_id ~ '^PRO-[0-9]{3}$');

ALTER TABLE human_sops ADD CONSTRAINT check_phase_positive 
    CHECK (phase > 0);

ALTER TABLE agent_sops ADD CONSTRAINT check_phase_positive 
    CHECK (phase > 0);

ALTER TABLE chat_histories ADD CONSTRAINT check_status_valid 
    CHECK (status IN ('active', 'completed', 'abandoned'));

ALTER TABLE change_proposals ADD CONSTRAINT check_status_valid 
    CHECK (status IN ('pending', 'approved', 'rejected', 'implemented'));

ALTER TABLE change_proposals ADD CONSTRAINT check_priority_valid 
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE user_feedback ADD CONSTRAINT check_status_valid 
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

ALTER TABLE user_feedback ADD CONSTRAINT check_priority_valid 
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Create extensions for better text search and JSON handling
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create views for common queries

-- View for active projects summary
CREATE OR REPLACE VIEW active_projects_summary AS
SELECT 
    project_id,
    data->>'projectName' as project_name,
    data->>'sponsor' as sponsor,
    jsonb_array_length(COALESCE(data->'projectTeam', '[]'::jsonb)) as team_size,
    jsonb_array_length(COALESCE(data->'scopeDeliverables', '[]'::jsonb)) as deliverable_count,
    is_active,
    created_at,
    updated_at
FROM projects 
WHERE is_active = true
ORDER BY project_id;

-- View for SOP usage statistics
CREATE OR REPLACE VIEW sop_usage_stats AS
SELECT 
    usage_item->>'sopId' as sop_id,
    SUM((usage_item->>'usageCount')::int) as total_usage,
    COUNT(DISTINCT session_id) as unique_sessions,
    MAX((usage_item->>'lastUsed')::timestamp) as last_used
FROM chat_histories,
     jsonb_array_elements(data->'sopUsage') as usage_item
GROUP BY usage_item->>'sopId'
ORDER BY total_usage DESC;

-- View for recent feedback summary
CREATE OR REPLACE VIEW recent_feedback_summary AS
SELECT 
    feedback_id,
    data->>'feedbackType' as feedback_type,
    data->>'title' as title,
    data->>'rating' as rating,
    status,
    priority,
    created_at
FROM user_feedback 
ORDER BY created_at DESC
LIMIT 50;

-- Add comment metadata to tables
COMMENT ON TABLE projects IS 'Project management data with JSONB flexible schema';
COMMENT ON TABLE human_sops IS 'Human-authored Standard Operating Procedures';
COMMENT ON TABLE agent_sops IS 'AI-processed SOPs with searchable content and metadata';
COMMENT ON TABLE chat_histories IS 'Chat session data with message history and SOP usage tracking';
COMMENT ON TABLE change_proposals IS 'Proposed changes to SOPs with approval workflow';
COMMENT ON TABLE user_feedback IS 'User feedback and feature requests';
COMMENT ON TABLE message_feedback IS 'Message-level feedback for quality tracking';

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'PMO Playbook database schema created successfully!';
    RAISE NOTICE 'Tables created: projects, human_sops, agent_sops, chat_histories, change_proposals, user_feedback, message_feedback';
    RAISE NOTICE 'Indexes and triggers created for optimal performance';
    RAISE NOTICE 'Views created for common queries';
END $$;

-- NOTES FOR POSTGRESQL.CONF CONFIGURATION:
-- The following settings should be configured in postgresql.conf for optimal performance:
--
-- work_mem = 256MB
-- maintenance_work_mem = 1GB
-- shared_preload_libraries = 'pg_stat_statements'  # Requires server restart
--
-- These settings control memory usage and should be adjusted based on your server specifications.