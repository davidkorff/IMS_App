/**
 * Migration script to add navigation properties to existing form schemas
 * This ensures all pages have proper navigation controls
 */

const pool = require('./config/db');

async function fixFormNavigation() {
    let client;
    
    try {
        console.log('Starting form navigation fix...');
        
        // Get a client from the pool
        client = await pool.connect();
        
        // Start transaction
        await client.query('BEGIN');
        
        // Get all form schemas
        const result = await client.query(`
            SELECT form_id, form_schema 
            FROM form_schemas 
            WHERE form_schema IS NOT NULL
        `);
        
        console.log(`Found ${result.rows.length} form schemas to check`);
        
        let updatedCount = 0;
        
        for (const row of result.rows) {
            const { form_id, form_schema } = row;
            let updated = false;
            
            // Check if schema has pages
            if (form_schema.pages && Array.isArray(form_schema.pages)) {
                form_schema.pages.forEach((page, index) => {
                    // Add navigation if missing
                    if (!page.navigation) {
                        page.navigation = {
                            showPrevious: index > 0,
                            showNext: index < form_schema.pages.length - 1,
                            showSave: true,
                            nextButtonText: index < form_schema.pages.length - 1 ? 'Continue' : 'Submit',
                            previousButtonText: 'Back'
                        };
                        updated = true;
                    }
                });
                
                // Update the schema if changes were made
                if (updated) {
                    await client.query(
                        'UPDATE form_schemas SET form_schema = $1, updated_at = NOW() WHERE form_id = $2',
                        [JSON.stringify(form_schema), form_id]
                    );
                    updatedCount++;
                    console.log(`Updated form ${form_id}`);
                }
            }
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`\nMigration complete!`);
        console.log(`Updated ${updatedCount} form schemas`);
        console.log(`${result.rows.length - updatedCount} forms were already correct`);
        
    } catch (error) {
        // Rollback on error
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error during migration:', error);
        process.exit(1);
    } finally {
        // Release the client back to the pool
        if (client) {
            client.release();
        }
        // Close the pool
        await pool.end();
    }
}

// Run the migration
fixFormNavigation().catch(console.error);