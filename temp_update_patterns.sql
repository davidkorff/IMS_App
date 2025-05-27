
-- Update existing configurations to use new ID: patterns
UPDATE email_configurations 
SET control_number_patterns = ARRAY[
    'ID:\s*(\d{1,9})\b',           -- Primary: Look for "ID:" followed by control number
    '^(?:RE:\s*)?ID:\s*(\d{1,9})\b', -- Secondary: "RE: ID:10000" at start of subject  
    '\bID:\s*(\d{1,9})\b'          -- Fallback: "ID:" pattern anywhere in content
] 
WHERE control_number_patterns IS NULL OR array_length(control_number_patterns, 1) = 0;

