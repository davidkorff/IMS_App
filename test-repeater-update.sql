-- Quick test to verify the repeater fields update works
-- This adds just the vehicles repeater field to test

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
        "collapsible": true,
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
            }
        ]
    }'::jsonb
)
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Verify the update
SELECT 
    'Test update completed' as status,
    form_schema->'fields'->'vehicles'->>'type' as vehicle_field_type
FROM form_schemas
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';