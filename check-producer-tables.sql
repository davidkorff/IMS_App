-- Check if producer portal tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'producers',
    'producer_configurations', 
    'producer_submissions',
    'producer_lob_access',
    'portal_lines_of_business',
    'portal_configurations'
)
ORDER BY table_name;

-- Check if permissions table has producer_portal permissions
SELECT * FROM permissions WHERE resource LIKE 'producer_portal%';

-- Check if your portal_lines_of_business table has the new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'portal_lines_of_business' 
AND column_name IN ('ims_rating_type_id', 'ims_rating_type_name', 'rater_file_name', 'rater_file_data')
ORDER BY column_name;