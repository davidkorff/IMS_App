-- Manual update to add repeater fields support
-- Run this in your PostgreSQL client (pgAdmin or psql)

-- 1. Update vehicles field to fieldset-repeater
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields,vehicles}',
    '{
        "id": "vehicles",
        "type": "fieldset-repeater",
        "name": "vehicles",
        "label": "Vehicle Information",
        "minItems": 0,
        "maxItems": 5,
        "defaultItems": 0,
        "addButtonText": "+ Add Vehicle",
        "removeButtonText": "Remove",
        "itemLabel": "Vehicle #{index}",
        "fields": [
            {
                "id": "year",
                "type": "number",
                "name": "year",
                "label": "Year",
                "required": true,
                "placeholder": "e.g., 2020"
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
                "placeholder": "Vehicle Identification Number"
            }
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- 2. Update job_classifications to fieldset-repeater
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields,job_classifications}',
    '{
        "id": "job_classifications",
        "type": "fieldset-repeater",
        "name": "job_classifications",
        "label": "Job Classifications",
        "helpText": "Add each job classification in your business",
        "minItems": 1,
        "maxItems": 10,
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
                "placeholder": "e.g., 5403"
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
                "required": true
            },
            {
                "id": "annual_payroll",
                "type": "number",
                "name": "annual_payroll",
                "label": "Annual Payroll",
                "required": true,
                "placeholder": "0.00"
            }
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- 3. Add locations repeater field
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields,locations}',
    '{
        "id": "locations",
        "type": "fieldset-repeater",
        "name": "locations",
        "label": "Additional Locations",
        "minItems": 0,
        "maxItems": 10,
        "defaultItems": 0,
        "addButtonText": "+ Add Location",
        "removeButtonText": "Remove",
        "itemLabel": "Location #{index}",
        "fields": [
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
                    {"value": "AK", "label": "Alaska"},
                    {"value": "AZ", "label": "Arizona"},
                    {"value": "AR", "label": "Arkansas"},
                    {"value": "CA", "label": "California"}
                ]
            },
            {
                "id": "zip",
                "type": "text",
                "name": "zip",
                "label": "ZIP Code",
                "required": true
            }
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- 4. Clean up old individual fields
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields}',
    (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(form_schema->'fields')
        WHERE key NOT LIKE 'vehicle_1_%' 
        AND key NOT LIKE 'job_class_%'
        AND key NOT LIKE 'claim_%'
        AND key != 'num_vehicles'
        AND key != 'num_job_classes'
        AND key != 'vehicle_add_button'
    )
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- 5. Add locations section to page 1 (Business Information)
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

-- Verify the changes
SELECT 
    'Update complete' as status,
    (SELECT COUNT(*) FROM jsonb_object_keys(form_schema->'fields') WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1') as total_fields,
    form_schema->'fields'->'vehicles'->>'type' as vehicles_type,
    form_schema->'fields'->'job_classifications'->>'type' as job_classifications_type,
    form_schema->'fields'->'locations'->>'type' as locations_type
FROM form_schemas
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';