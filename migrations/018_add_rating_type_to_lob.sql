-- Migration: Add Rating Type to Lines of Business
-- Description: Adds IMS rating type support to portal lines of business
-- Date: 2025-01-08

-- For PostgreSQL
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_rating_type_id INTEGER;

ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_rating_type_name VARCHAR(255);

-- Add comment to explain the column
COMMENT ON COLUMN portal_lines_of_business.ims_rating_type_id IS 'IMS RatingTypeID from lstRatingTypes table';
COMMENT ON COLUMN portal_lines_of_business.ims_rating_type_name IS 'IMS RatingType name for display purposes';