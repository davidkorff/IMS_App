const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    host: '172.20.128.1', // Windows host IP from WSL
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ims_app',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Jennie123!'
});

async function applyRepeaterFields() {
    try {
        console.log('Applying repeater fields update...');
        
        // First, let's add just the vehicles repeater field
        const updateResult = await pool.query(`
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
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
            RETURNING form_id
        `);
        
        console.log('Updated rows:', updateResult.rowCount);
        
        // Verify the update
        const verifyResult = await pool.query(`
            SELECT 
                form_schema->'fields'->'vehicles'->>'type' as vehicle_field_type,
                form_schema->'fields'->'vehicles'->>'label' as vehicle_field_label
            FROM form_schemas
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
        `);
        
        console.log('Verification:', verifyResult.rows[0]);
        
        // Now add job_classifications repeater
        await pool.query(`
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
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
        `);
        
        console.log('Job classifications repeater added');
        
        // Add locations repeater
        await pool.query(`
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
                            "required": true
                        }
                    ]
                }'::jsonb
            )
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
        `);
        
        console.log('Locations repeater added');
        
        // Update the sections to use these new fields
        await pool.query(`
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
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
        `);
        
        console.log('Section updated for locations');
        
        // Clean up old fields
        await pool.query(`
            UPDATE form_schemas 
            SET form_schema = jsonb_set(
                form_schema,
                '{fields}',
                (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(form_schema->'fields')
                    WHERE key NOT LIKE 'vehicle_1_%' 
                    AND key NOT LIKE 'job_class_1_%'
                    AND key != 'num_vehicles'
                    AND key != 'num_job_classes'
                    AND key != 'vehicle_add_button'
                )
            )
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
        `);
        
        console.log('Old fields cleaned up');
        console.log('Repeater fields applied successfully!');
        
    } catch (error) {
        console.error('Error applying repeater fields:', error);
    } finally {
        await pool.end();
    }
}

applyRepeaterFields();