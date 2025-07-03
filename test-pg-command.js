const { exec } = require('child_process');

// Test with psql command line
exec('psql -U postgres -d IMS_Application -h localhost -p 5432 -c "SELECT 1"', (error, stdout, stderr) => {
    if (error) {
        console.error('psql command failed:', error.message);
        console.error('stderr:', stderr);
        
        // Try different connection parameters
        console.log('\nTrying different connection methods...');
        
        // Try connecting to postgres database first
        exec('psql -U postgres -d postgres -h localhost -p 5432 -c "\\l"', (error2, stdout2, stderr2) => {
            if (error2) {
                console.error('Cannot connect to postgres database either:', error2.message);
                console.log('\nPossible issues:');
                console.log('1. PostgreSQL might be running on a different port');
                console.log('2. PostgreSQL might only accept connections via Unix socket');
                console.log('3. pg_hba.conf might need to be configured for local connections');
                console.log('4. PostgreSQL service might not be fully started');
            } else {
                console.log('Connected to postgres database. Databases available:');
                console.log(stdout2);
            }
        });
    } else {
        console.log('✅ psql command succeeded!');
        console.log(stdout);
    }
});