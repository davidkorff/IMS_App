-- Add columns to store the Excel rater file
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS rater_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS rater_file_data BYTEA,
ADD COLUMN IF NOT EXISTS rater_file_uploaded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rater_file_content_type VARCHAR(100);

-- Add comment for clarity
COMMENT ON COLUMN portal_lines_of_business.rater_file_data IS 'Binary data of the Excel rater template file';
COMMENT ON COLUMN portal_lines_of_business.rater_file_name IS 'Original filename of the uploaded rater template';