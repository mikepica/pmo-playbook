# SOP Slug-based URL Migration

This document explains the implementation of slug-based URLs for SOPs, changing from ID-based URLs like `/sop/SOP-002` to readable URLs like `/sop/initiation-phase`. 

**Note: The system now prioritizes slug-based URLs by default and only shows SOPs that have slugs.**

## What's Changed

### 1. Database Schema
- Added `slug` column to `human_sops` table
- Added unique index for fast lookups
- Added constraint to ensure active SOPs have slugs

### 2. Backend Changes
- **HumanSOPModel** (`src/models/HumanSOP.ts`):
  - Added `findBySlug()` and `findBySopIdOrSlug()` methods
  - Added automatic slug generation from SOP titles
  - Updated create/update operations to generate slugs
- **API Endpoints**:
  - Updated `/api/files-db` to include slug information
  - Created `/api/sop/[identifier]` for slug/ID-based lookups

### 3. Frontend Changes
- **SOP Page** (`src/app/sop/[sopId]/page.tsx`):
  - Support both slug and ID parameters
  - Updated validation logic
- **SOPTabs Component** (`src/components/SOPTabs.tsx`):
  - Use slugs in URL navigation
  - Improved selection logic for both formats

## Running the Migration

### Step 1: Run Database Migration
```bash
npx tsx scripts/migrate-add-slugs.ts
```

This will:
- Add the `slug` column to the `human_sops` table
- Generate slugs for all existing SOPs based on their titles
- Show a summary of the URL changes

### Step 2: Example URL Changes
After migration, URLs will change as follows:
- `/sop/SOP-001` → `/sop/pre-initiation-phase`
- `/sop/SOP-002` → `/sop/initiation-phase`
- `/sop/SOP-003` → `/sop/design-and-plan`
- `/sop/SOP-004` → `/sop/implement-and-control`
- `/sop/SOP-005` → `/sop/close-and-realize-benefits`

## Testing

### Manual Testing
1. Start the development server: `npm run dev`
2. Navigate to SOPs using slug-based URLs:
   - New format: `http://localhost:3000/sop/initiation-phase`
   - All tabs should show slug-based URLs
3. Verify all SOPs display correctly
4. Test navigation between SOPs uses only slug-based URLs
5. Check that SOP tabs show correct selection state
6. Verify only SOPs with slugs are displayed in the interface

### API Testing
Test the API endpoints:
```bash
# Primary API with slug
curl http://localhost:3000/api/content-db?slug=initiation-phase

# Files API includes slug info
curl http://localhost:3000/api/files-db?type=markdown

# Individual SOP by slug
curl http://localhost:3000/api/sop/initiation-phase
```

## Slug-First Approach

The system now prioritizes slugs:
- **UI shows only SOPs with slugs** - SOPs without slugs won't appear in tabs
- **All navigation uses slugs** - clicking SOPs always navigates to slug URLs
- **APIs prefer slugs** but still support ID lookups for data integrity
- **Database migration is required** to generate slugs for existing SOPs

## Slug Generation Rules

Slugs are generated using these rules:
1. Convert to lowercase
2. Remove special characters
3. Replace spaces with hyphens
4. Remove multiple consecutive hyphens
5. Handle duplicates by appending numbers (`-1`, `-2`, etc.)

Examples:
- "Initiation Phase" → "initiation-phase"
- "Design & Plan" → "design-plan"
- "Close and Realize Benefits" → "close-and-realize-benefits"

## Files Modified

### Database
- `database-add-slug-migration.sql` - Migration script
- `scripts/migrate-add-slugs.ts` - TypeScript migration runner

### Backend
- `src/models/HumanSOP.ts` - Model with slug support
- `src/app/api/files-db/route.ts` - Include slug in responses
- `src/app/api/sop/[identifier]/route.ts` - New API endpoint

### Frontend
- `src/app/sop/[sopId]/page.tsx` - Support slug parameters
- `src/components/SOPTabs.tsx` - Use slugs in navigation

## Next Steps

After testing and verification:
1. Update any hardcoded SOP URLs in documentation
2. Consider redirecting old URLs to new slug-based URLs for SEO
3. Update any external integrations that reference SOP URLs