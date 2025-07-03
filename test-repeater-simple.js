const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    host: '172.20.128.1', // Windows host IP from WSL
    port: 5432,
    database: 'ims_app',
    user: 'postgres',
    password: 'Jennie123!'
});

async function testRepeater() {
    try {
        console.log('Testing repeater field update...');
        
        // Just check current field types
        const result = await pool.query(`
            SELECT 
                jsonb_object_keys(form_schema->'fields') as field_name
            FROM form_schemas
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
            AND jsonb_object_keys(form_schema->'fields') = 'vehicles'
        `);
        
        console.log('Current vehicles field exists:', result.rowCount > 0);
        
        // Check the type of vehicles field
        const typeResult = await pool.query(`
            SELECT 
                form_schema->'fields'->'vehicles'->>'type' as vehicles_type
            FROM form_schemas
            WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
        `);
        
        console.log('Vehicles field type:', typeResult.rows[0]?.vehicles_type);
        
        // If not a repeater, update it
        if (typeResult.rows[0]?.vehicles_type !== 'fieldset-repeater') {
            console.log('Updating vehicles to fieldset-repeater...');
            
            const updateResult = await pool.query(`
                UPDATE form_schemas 
                SET form_schema = jsonb_set(
                    form_schema,
                    '{fields,vehicles}',
                    '{"id": "vehicles", "type": "fieldset-repeater", "name": "vehicles", "label": "Vehicle Information", "minItems": 0, "maxItems": 5, "defaultItems": 0, "addButtonText": "+ Add Vehicle", "fields": [{"id": "make", "type": "text", "name": "make", "label": "Make"}, {"id": "model", "type": "text", "name": "model", "label": "Model"}]}'::jsonb
                )
                WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
            `);
            
            console.log('Update complete:', updateResult.rowCount, 'rows updated');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
        console.log('Done');
    }
}

testRepeater();