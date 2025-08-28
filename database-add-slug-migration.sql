-- Migration: Add slug column to human_sops table
-- This migration adds a slug field to support URL-friendly SOP slugs

-- Add the slug column to human_sops table
ALTER TABLE human_sops ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;

-- Create an index for the slug column for fast lookups
CREATE INDEX IF NOT EXISTS idx_human_sops_slug ON human_sops(slug);

-- Function to generate a URL-friendly slug from text
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(text_input, '[^\w\s-]', '', 'g'),  -- Remove special chars
                '\s+', '-', 'g'                                   -- Replace spaces with hyphens
            ),
            '-+', '-', 'g'                                        -- Replace multiple hyphens with single
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Generate slugs for existing SOPs based on their titles
UPDATE human_sops 
SET slug = generate_slug(data->>'title')
WHERE slug IS NULL 
  AND data->>'title' IS NOT NULL
  AND is_active = true;

-- Handle potential duplicates by appending numbers
DO $$
DECLARE
    rec RECORD;
    new_slug TEXT;
    counter INTEGER;
BEGIN
    -- Find any remaining records without slugs or with duplicate slugs
    FOR rec IN 
        SELECT id, data->>'title' as title 
        FROM human_sops 
        WHERE slug IS NULL OR slug IN (
            SELECT slug 
            FROM human_sops 
            WHERE slug IS NOT NULL 
            GROUP BY slug 
            HAVING COUNT(*) > 1
        )
    LOOP
        new_slug := generate_slug(rec.title);
        counter := 1;
        
        -- Check if slug exists and increment counter until unique
        WHILE EXISTS(SELECT 1 FROM human_sops WHERE slug = new_slug) LOOP
            new_slug := generate_slug(rec.title) || '-' || counter;
            counter := counter + 1;
        END LOOP;
        
        -- Update the record with the unique slug
        UPDATE human_sops SET slug = new_slug WHERE id = rec.id;
    END LOOP;
END $$;

-- Add a constraint to ensure slug is not null for active SOPs
ALTER TABLE human_sops ADD CONSTRAINT check_active_sops_have_slug 
    CHECK (is_active = false OR slug IS NOT NULL);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added slug column to human_sops table';
    RAISE NOTICE 'Generated slugs for existing SOPs based on their titles';
END $$;