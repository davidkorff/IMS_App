-- First, let's check if the producer was created
SELECT 
    p.producer_id,
    p.email,
    p.agency_name,
    p.verification_token,
    p.is_verified,
    p.is_approved,
    p.status
FROM producers p
WHERE p.email = 'john.producer@example.com'
AND p.instance_id = 4;

-- Verify the email (simulate clicking verification link)
UPDATE producers 
SET is_verified = true,
    verification_token = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'john.producer@example.com'
AND instance_id = 4;

-- Approve the producer account
UPDATE producers 
SET is_approved = true,
    status = 'active',
    approved_at = CURRENT_TIMESTAMP,
    approved_by = 0, -- System admin
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'john.producer@example.com'
AND instance_id = 4;

-- Grant access to the Line of Business (LOB ID 8)
INSERT INTO producer_lob_access (
    producer_id,
    lob_id,
    can_quote,
    can_bind,
    can_issue,
    granted_at,
    granted_by
)
SELECT 
    p.producer_id,
    8, -- The LOB we created earlier
    true, -- can_quote
    false, -- can_bind
    false, -- can_issue
    CURRENT_TIMESTAMP,
    0 -- System admin
FROM producers p
WHERE p.email = 'john.producer@example.com'
AND p.instance_id = 4
ON CONFLICT (producer_id, lob_id) DO UPDATE
SET can_quote = true,
    updated_at = CURRENT_TIMESTAMP;

-- Verify the setup
SELECT 
    p.producer_id,
    p.email,
    p.agency_name,
    p.is_verified,
    p.is_approved,
    p.status,
    pla.lob_id,
    lob.line_name,
    pla.can_quote
FROM producers p
LEFT JOIN producer_lob_access pla ON p.producer_id = pla.producer_id
LEFT JOIN portal_lines_of_business lob ON pla.lob_id = lob.lob_id
WHERE p.email = 'john.producer@example.com'
AND p.instance_id = 4;