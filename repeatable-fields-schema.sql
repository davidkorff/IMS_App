-- Repeatable Fields Schema Update
-- This properly implements repeatable fieldsets for insurance scenarios

UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields}',
    form_schema->'fields' || 
    '{
        "vehicles": {
            "id": "vehicles",
            "type": "fieldset-repeater",
            "name": "vehicles",
            "label": "Vehicle Information",
            "minItems": 0,
            "maxItems": 50,
            "defaultItems": 0,
            "addButtonText": "+ Add Vehicle",
            "removeButtonText": "Remove",
            "itemLabel": "Vehicle #{index}",
            "collapsible": true,
            "fields": [
                {
                    "id": "year",
                    "type": "number",
                    "name": "year",
                    "label": "Year",
                    "required": true,
                    "placeholder": "e.g., 2020",
                    "validation": {
                        "min": 1900,
                        "max": 2025
                    }
                },
                {
                    "id": "make",
                    "type": "text",
                    "name": "make",
                    "label": "Make",
                    "required": true,
                    "placeholder": "e.g., Ford"
                },
                {
                    "id": "model",
                    "type": "text",
                    "name": "model",
                    "label": "Model",
                    "required": true,
                    "placeholder": "e.g., F-150"
                },
                {
                    "id": "vin",
                    "type": "text",
                    "name": "vin",
                    "label": "VIN",
                    "required": true,
                    "placeholder": "Vehicle Identification Number"
                },
                {
                    "id": "primary_use",
                    "type": "select",
                    "name": "primary_use",
                    "label": "Primary Use",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select Use"},
                        {"value": "business", "label": "Business Use Only"},
                        {"value": "personal", "label": "Personal Use"},
                        {"value": "mixed", "label": "Mixed Business/Personal"},
                        {"value": "delivery", "label": "Delivery"},
                        {"value": "transport", "label": "Employee Transport"}
                    ]
                },
                {
                    "id": "radius_operation",
                    "type": "select",
                    "name": "radius_operation",
                    "label": "Radius of Operation",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select Radius"},
                        {"value": "local", "label": "Local (< 50 miles)"},
                        {"value": "intermediate", "label": "Intermediate (50-200 miles)"},
                        {"value": "long", "label": "Long Distance (> 200 miles)"}
                    ]
                }
            ]
        },
        "job_classifications": {
            "id": "job_classifications",
            "type": "fieldset-repeater",
            "name": "job_classifications",
            "label": "Job Classifications",
            "helpText": "Add each job classification in your business",
            "minItems": 1,
            "maxItems": 20,
            "defaultItems": 1,
            "addButtonText": "+ Add Classification",
            "removeButtonText": "Remove",
            "itemLabel": "Classification #{index}",
            "fields": [
                {
                    "id": "class_code",
                    "type": "text",
                    "name": "class_code",
                    "label": "Class Code",
                    "placeholder": "e.g., 5403",
                    "helpText": "Workers comp class code if known"
                },
                {
                    "id": "description",
                    "type": "text",
                    "name": "description",
                    "label": "Job Description",
                    "placeholder": "e.g., Carpentry",
                    "required": true
                },
                {
                    "id": "num_employees",
                    "type": "number",
                    "name": "num_employees",
                    "label": "Number of Employees",
                    "required": true,
                    "validation": {"min": 1}
                },
                {
                    "id": "annual_payroll",
                    "type": "number",
                    "name": "annual_payroll",
                    "label": "Annual Payroll",
                    "required": true,
                    "placeholder": "0.00",
                    "display": {"prefix": "$", "thousandsSeparator": ","}
                }
            ]
        },
        "locations": {
            "id": "locations",
            "type": "fieldset-repeater",
            "name": "locations",
            "label": "Additional Locations",
            "minItems": 0,
            "maxItems": 100,
            "defaultItems": 0,
            "addButtonText": "+ Add Location",
            "removeButtonText": "Remove",
            "itemLabel": "Location #{index}",
            "collapsible": true,
            "fields": [
                {
                    "id": "location_type",
                    "type": "select",
                    "name": "location_type",
                    "label": "Location Type",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select Type"},
                        {"value": "owned", "label": "Owned"},
                        {"value": "leased", "label": "Leased"},
                        {"value": "client", "label": "Client Site"},
                        {"value": "temporary", "label": "Temporary"}
                    ]
                },
                {
                    "id": "street",
                    "type": "text",
                    "name": "street",
                    "label": "Street Address",
                    "required": true,
                    "placeholder": "123 Main Street"
                },
                {
                    "id": "city",
                    "type": "text",
                    "name": "city",
                    "label": "City",
                    "required": true
                },
                {
                    "id": "state",
                    "type": "select",
                    "name": "state",
                    "label": "State",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select State"},
                        {"value": "AL", "label": "Alabama"},
                        {"value": "AK", "label": "Alaska"}
                    ]
                },
                {
                    "id": "zip",
                    "type": "text",
                    "name": "zip",
                    "label": "ZIP Code",
                    "required": true,
                    "validation": {
                        "pattern": "^\\\\d{5}(-\\\\d{4})?$"
                    }
                },
                {
                    "id": "num_employees",
                    "type": "number",
                    "name": "num_employees",
                    "label": "Employees at this Location",
                    "required": true,
                    "validation": {"min": 0}
                },
                {
                    "id": "operations",
                    "type": "textarea",
                    "name": "operations",
                    "label": "Operations at this Location",
                    "placeholder": "Describe work performed at this location",
                    "display": {"rows": 2}
                }
            ]
        },
        "additional_insureds": {
            "id": "additional_insureds",
            "type": "fieldset-repeater",
            "name": "additional_insureds",
            "label": "Additional Insureds",
            "minItems": 0,
            "maxItems": 50,
            "defaultItems": 0,
            "addButtonText": "+ Add Additional Insured",
            "removeButtonText": "Remove",
            "itemLabel": "{name}",
            "fields": [
                {
                    "id": "name",
                    "type": "text",
                    "name": "name",
                    "label": "Name",
                    "required": true,
                    "placeholder": "Person or Business Name"
                },
                {
                    "id": "relationship",
                    "type": "select",
                    "name": "relationship",
                    "label": "Relationship",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select Relationship"},
                        {"value": "landlord", "label": "Landlord"},
                        {"value": "lender", "label": "Mortgage Holder/Lender"},
                        {"value": "contractor", "label": "General Contractor"},
                        {"value": "client", "label": "Client"},
                        {"value": "partner", "label": "Business Partner"},
                        {"value": "other", "label": "Other"}
                    ]
                },
                {
                    "id": "coverage_type",
                    "type": "checkbox",
                    "name": "coverage_type",
                    "label": "Coverage Types Required",
                    "options": [
                        {"value": "primary", "label": "Primary Coverage"},
                        {"value": "noncontributory", "label": "Primary & Non-Contributory"},
                        {"value": "waiver", "label": "Waiver of Subrogation"},
                        {"value": "completed_ops", "label": "Completed Operations"}
                    ]
                },
                {
                    "id": "address",
                    "type": "textarea",
                    "name": "address",
                    "label": "Address",
                    "required": true,
                    "display": {"rows": 2}
                }
            ]
        },
        "claims": {
            "id": "claims",
            "type": "fieldset-repeater",
            "name": "claims",
            "label": "Claims History",
            "helpText": "List all claims in the past 5 years",
            "minItems": 0,
            "maxItems": 100,
            "defaultItems": 0,
            "addButtonText": "+ Add Claim",
            "removeButtonText": "Remove",
            "itemLabel": "Claim #{index} - {date}",
            "fields": [
                {
                    "id": "date",
                    "type": "date",
                    "name": "date",
                    "label": "Date of Loss",
                    "required": true
                },
                {
                    "id": "description",
                    "type": "textarea",
                    "name": "description",
                    "label": "Description of Claim",
                    "required": true,
                    "placeholder": "Describe what happened",
                    "display": {"rows": 3}
                },
                {
                    "id": "amount_paid",
                    "type": "number",
                    "name": "amount_paid",
                    "label": "Amount Paid",
                    "placeholder": "0.00",
                    "display": {"prefix": "$"}
                },
                {
                    "id": "amount_reserved",
                    "type": "number",
                    "name": "amount_reserved",
                    "label": "Amount Reserved",
                    "placeholder": "0.00",
                    "display": {"prefix": "$"}
                },
                {
                    "id": "status",
                    "type": "select",
                    "name": "status",
                    "label": "Status",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select Status"},
                        {"value": "open", "label": "Open"},
                        {"value": "closed", "label": "Closed"},
                        {"value": "litigation", "label": "In Litigation"},
                        {"value": "subrogation", "label": "Subrogation"}
                    ]
                }
            ]
        }
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Update the vehicle section to use the new repeater
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{pages,2,sections}',
    '[
        {
            "id": "section_vehicle_question",
            "type": "fieldset",
            "title": "Vehicle Information",
            "layout": "1-column",
            "items": [
                {"type": "field", "fieldId": "has_vehicles"}
            ]
        },
        {
            "id": "section_vehicles",
            "type": "fieldset",
            "title": "Vehicle Details",
            "layout": "1-column",
            "items": [
                {"type": "field", "fieldId": "vehicles"}
            ],
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "has_vehicles",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            }
        }
    ]'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

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
            {"type": "field", "fieldId": "job_classifications"}
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Update claims section
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
            {"type": "field", "fieldId": "claims"}
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

-- Add locations section to Business Information page
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{pages,0,sections,3}',
    '{
        "id": "section_additional_locations",
        "type": "fieldset",
        "title": "Additional Locations",
        "layout": "1-column",
        "items": [
            {"type": "field", "fieldId": "locations"}
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Remove old individual fields that are now part of repeaters
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields}',
    (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(form_schema->'fields')
        WHERE key NOT LIKE 'vehicle_1_%' 
        AND key NOT LIKE 'job_class_1_%'
        AND key NOT LIKE 'claim_1_%'
        AND key != 'num_vehicles'
        AND key != 'num_job_classes'
    )
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Verify the update
SELECT 
    'Repeatable fields added' as status,
    jsonb_object_keys(form_schema->'fields') as field_name
FROM form_schemas
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
AND jsonb_object_keys(form_schema->'fields') IN ('vehicles', 'job_classifications', 'locations', 'additional_insureds', 'claims');