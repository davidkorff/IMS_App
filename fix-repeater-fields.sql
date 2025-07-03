-- Fix repeater fields by converting them to simple field groups
-- This makes them compatible with the current renderer

-- Update job classifications section
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{pages,1,sections,1}',
    '{
        "id": "section_job_classifications",
        "type": "fieldset",
        "title": "Job Classifications",
        "layout": "1-column",
        "items": [
            {"type": "field", "fieldId": "num_job_classes"},
            {"type": "field", "fieldId": "job_class_1_code"},
            {"type": "field", "fieldId": "job_class_1_description"},
            {"type": "field", "fieldId": "job_class_1_employees"},
            {"type": "field", "fieldId": "job_class_1_payroll"}
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Add the job classification fields
UPDATE form_schemas 
SET form_schema = form_schema || jsonb_build_object(
    'fields', 
    form_schema->'fields' || 
    '{
        "num_job_classes": {
            "id": "num_job_classes",
            "name": "num_job_classes",
            "type": "select",
            "label": "How many job classifications do you have?",
            "required": true,
            "options": [
                {"value": "1", "label": "1 classification"},
                {"value": "2", "label": "2 classifications"},
                {"value": "3", "label": "3 classifications"},
                {"value": "4", "label": "4 classifications"},
                {"value": "5", "label": "5 or more classifications"}
            ]
        },
        "job_class_1_code": {
            "id": "job_class_1_code",
            "name": "job_class_1_code",
            "type": "text",
            "label": "Classification 1 - Class Code",
            "placeholder": "e.g., 5403",
            "helpText": "Enter the workers comp class code if known"
        },
        "job_class_1_description": {
            "id": "job_class_1_description",
            "name": "job_class_1_description",
            "type": "text",
            "label": "Classification 1 - Job Description",
            "placeholder": "e.g., Carpentry",
            "required": true
        },
        "job_class_1_employees": {
            "id": "job_class_1_employees",
            "name": "job_class_1_employees",
            "type": "number",
            "label": "Classification 1 - Number of Employees",
            "required": true,
            "validation": {"min": 1}
        },
        "job_class_1_payroll": {
            "id": "job_class_1_payroll",
            "name": "job_class_1_payroll",
            "type": "number",
            "label": "Classification 1 - Annual Payroll",
            "required": true,
            "placeholder": "0.00",
            "display": {"prefix": "$"}
        }
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Update claims details section
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{pages,4,sections,1}',
    '{
        "id": "section_claims_details",
        "type": "fieldset",
        "title": "Claims Details",
        "layout": "1-column",
        "items": [
            {"type": "field", "fieldId": "claim_1_date"},
            {"type": "field", "fieldId": "claim_1_description"},
            {"type": "field", "fieldId": "claim_1_amount"},
            {"type": "field", "fieldId": "claim_1_status"}
        ],
        "visibility": {
            "condition": "any",
            "rules": [
                {
                    "field": "claims_past_5_years",
                    "operator": "greaterThan",
                    "value": 0
                }
            ]
        }
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Add the claims fields
UPDATE form_schemas 
SET form_schema = form_schema || jsonb_build_object(
    'fields', 
    form_schema->'fields' || 
    '{
        "claim_1_date": {
            "id": "claim_1_date",
            "name": "claim_1_date",
            "type": "date",
            "label": "Claim 1 - Date of Claim"
        },
        "claim_1_description": {
            "id": "claim_1_description",
            "name": "claim_1_description",
            "type": "textarea",
            "label": "Claim 1 - Description",
            "placeholder": "Describe what happened",
            "display": {"rows": 3}
        },
        "claim_1_amount": {
            "id": "claim_1_amount",
            "name": "claim_1_amount",
            "type": "number",
            "label": "Claim 1 - Amount",
            "placeholder": "0.00",
            "display": {"prefix": "$"}
        },
        "claim_1_status": {
            "id": "claim_1_status",
            "name": "claim_1_status",
            "type": "select",
            "label": "Claim 1 - Status",
            "options": [
                {"value": "", "label": "Select status"},
                {"value": "open", "label": "Open"},
                {"value": "closed", "label": "Closed"},
                {"value": "litigation", "label": "In Litigation"}
            ]
        }
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Remove the old repeater fields
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields}',
    (form_schema->'fields') - 'job_classifications' - 'claims_details' - 'authorization_info'
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Final verification
SELECT 
    'Repeater fields fixed' as status,
    COUNT(*) FILTER (WHERE fields LIKE 'vehicle_%') as vehicle_fields,
    COUNT(*) FILTER (WHERE fields LIKE 'job_class_%') as job_class_fields,
    COUNT(*) FILTER (WHERE fields LIKE 'claim_%') as claim_fields
FROM form_schemas, 
     jsonb_object_keys(form_schema -> 'fields') as fields
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';