-- Update form to fix vehicle section and undefined fields
-- This version uses simpler field types that the renderer can handle

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
                {"type": "field", "fieldId": "num_vehicles"},
                {"type": "field", "fieldId": "vehicle_1_year"},
                {"type": "field", "fieldId": "vehicle_1_make"},
                {"type": "field", "fieldId": "vehicle_1_model"},
                {"type": "field", "fieldId": "vehicle_1_vin"},
                {"type": "field", "fieldId": "vehicle_1_use"},
                {"type": "field", "fieldId": "vehicle_1_radius"}
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

-- Now update the fields to remove the problematic ones and add simple vehicle fields
UPDATE form_schemas 
SET form_schema = form_schema || jsonb_build_object(
    'fields', 
    form_schema->'fields' || 
    '{
        "num_vehicles": {
            "id": "num_vehicles",
            "name": "num_vehicles",
            "type": "select",
            "label": "How many vehicles does this location have?",
            "required": true,
            "options": [
                {"value": "", "label": "Select number"},
                {"value": "1", "label": "1 vehicle"},
                {"value": "2", "label": "2 vehicles"},
                {"value": "3", "label": "3 vehicles"},
                {"value": "4", "label": "4 vehicles"},
                {"value": "5", "label": "5 vehicles"},
                {"value": "more", "label": "More than 5"}
            ]
        },
        "vehicle_1_year": {
            "id": "vehicle_1_year",
            "name": "vehicle_1_year",
            "type": "number",
            "label": "Vehicle 1 - Year",
            "required": true,
            "placeholder": "e.g., 2020",
            "validation": {
                "min": 1900,
                "max": 2025
            }
        },
        "vehicle_1_make": {
            "id": "vehicle_1_make",
            "name": "vehicle_1_make",
            "type": "text",
            "label": "Vehicle 1 - Make",
            "required": true,
            "placeholder": "e.g., Ford"
        },
        "vehicle_1_model": {
            "id": "vehicle_1_model",
            "name": "vehicle_1_model",
            "type": "text",
            "label": "Vehicle 1 - Model",
            "required": true,
            "placeholder": "e.g., F-150"
        },
        "vehicle_1_vin": {
            "id": "vehicle_1_vin",
            "name": "vehicle_1_vin",
            "type": "text",
            "label": "Vehicle 1 - VIN",
            "required": true,
            "placeholder": "Vehicle Identification Number"
        },
        "vehicle_1_use": {
            "id": "vehicle_1_use",
            "name": "vehicle_1_use",
            "type": "select",
            "label": "Vehicle 1 - Primary Use",
            "required": true,
            "options": [
                {"value": "", "label": "Select use"},
                {"value": "business", "label": "Business Use Only"},
                {"value": "personal", "label": "Personal Use"},
                {"value": "mixed", "label": "Mixed Business/Personal"},
                {"value": "delivery", "label": "Delivery"},
                {"value": "transport", "label": "Employee Transport"}
            ]
        },
        "vehicle_1_radius": {
            "id": "vehicle_1_radius",
            "name": "vehicle_1_radius",
            "type": "select",
            "label": "Vehicle 1 - Radius of Operation",
            "required": true,
            "options": [
                {"value": "", "label": "Select radius"},
                {"value": "local", "label": "Local (< 50 miles)"},
                {"value": "intermediate", "label": "Intermediate (50-200 miles)"},
                {"value": "long", "label": "Long Distance (> 200 miles)"}
            ]
        }
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Remove the problematic fields
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields}',
    (form_schema->'fields') - 'vehicle_add_button' - 'vehicles' - 'authorization_text'
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Also fix the authorization section to use simple fields
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{pages,5,sections,2,items}',
    '[
        {"type": "field", "fieldId": "authorization_agreement"},
        {"type": "field", "fieldId": "authorized_person"},
        {"type": "field", "fieldId": "authorized_title"},
        {"type": "field", "fieldId": "signature_pad"},
        {"type": "field", "fieldId": "signature_date"}
    ]'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Add the authorization agreement field
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{fields,authorization_agreement}',
    '{
        "id": "authorization_agreement",
        "name": "authorization_agreement",
        "type": "checkbox",
        "label": "Authorization and Agreement",
        "required": true,
        "options": [
            {
                "value": "agree",
                "label": "I certify that the information provided in this application is true and complete to the best of my knowledge. I understand that any misrepresentation or omission of facts may result in denial of coverage or cancellation of any policy issued based on this application."
            }
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Update the conditional logic to work with the new structure
UPDATE form_schemas 
SET form_schema = jsonb_set(
    form_schema,
    '{logic,1}',
    '{
        "id": "rule2",
        "name": "Show vehicle details when has vehicles",
        "trigger": {
            "type": "field",
            "conditions": [
                {
                    "field": "has_vehicles",
                    "operator": "equals",
                    "value": "yes"
                }
            ]
        },
        "actions": [
            {
                "type": "visibility",
                "action": "show",
                "target": "section_vehicles"
            }
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Verify the update
SELECT 
    'Form updated successfully' as status,
    jsonb_array_length(form_schema -> 'pages') as page_count,
    COUNT(*) as field_count
FROM form_schemas, 
     jsonb_object_keys(form_schema -> 'fields') as fields
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
GROUP BY form_id, form_schema;