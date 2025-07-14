const XLSX = require('xlsx');
const XLSX_CALC = require('xlsx-calc');

/**
 * Wrapper for xlsx-calc to handle Excel formula calculation
 * This is a pure JavaScript alternative to the Python approach
 */
class XLSXCalcWrapper {
    /**
     * Calculate formulas in Excel workbook using xlsx-calc
     * @param {Buffer} excelBuffer - Excel file buffer
     * @returns {Promise<Buffer>} - Excel file buffer with calculated formulas
     */
    async calculateFormulas(excelBuffer) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Using xlsx-calc for formula calculation...');
                
                // Read workbook using xlsx
                const workbook = XLSX.read(excelBuffer, {
                    type: 'buffer',
                    cellFormula: true,
                    cellNF: true,
                    cellStyles: true
                });
                
                // Log sheets and formulas before calculation
                console.log('\nSheets in workbook:');
                for (const sheetName of workbook.SheetNames) {
                    console.log(`- ${sheetName}`);
                    const sheet = workbook.Sheets[sheetName];
                    
                    // Count formulas
                    let formulaCount = 0;
                    Object.keys(sheet).forEach(cellRef => {
                        if (cellRef[0] !== '!' && sheet[cellRef].f) {
                            formulaCount++;
                        }
                    });
                    
                    if (formulaCount > 0) {
                        console.log(`  Found ${formulaCount} formulas`);
                    }
                }
                
                // Calculate formulas using xlsx-calc
                try {
                    XLSX_CALC(workbook);
                    console.log('Formulas calculated successfully');
                } catch (calcError) {
                    console.warn('Some formulas could not be calculated:', calcError.message);
                    // Continue even if some formulas fail
                }
                
                // Check for premium values in common locations
                console.log('\nChecking for calculated values:');
                const premiumLocations = [
                    { sheet: 'IMS_TAGS', cells: ['B6', 'B7', 'B8', 'B9', 'B10'] },
                    { sheet: 'Summary', cells: ['B6', 'B10', 'C6', 'C10'] },
                    { sheet: 'Premium', cells: ['B10', 'B15', 'C10', 'C15'] }
                ];
                
                for (const location of premiumLocations) {
                    if (workbook.Sheets[location.sheet]) {
                        const sheet = workbook.Sheets[location.sheet];
                        console.log(`\n${location.sheet}:`);
                        for (const cellRef of location.cells) {
                            if (sheet[cellRef] && sheet[cellRef].v !== undefined) {
                                console.log(`  ${cellRef}: ${sheet[cellRef].v}`);
                            }
                        }
                    }
                }
                
                // Write back to buffer
                const resultBuffer = XLSX.write(workbook, {
                    type: 'buffer',
                    bookType: 'xlsx',
                    cellFormula: true
                });
                
                resolve(resultBuffer);
                
            } catch (error) {
                console.error('xlsx-calc error:', error);
                reject(error);
            }
        });
    }
    
    /**
     * Extract premium value from calculated workbook
     * @param {Buffer} excelBuffer - Excel file buffer with calculated formulas
     * @param {Array} premiumMappings - Optional array of {sheet_name, cell_reference} objects
     * @returns {number|null} - Premium value or null if not found
     */
    async extractPremium(excelBuffer, premiumMappings = null) {
        try {
            const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
            
            // Use provided mappings or default locations
            const locations = premiumMappings || [
                { sheet_name: 'IMS_TAGS', cell_reference: 'B6' },
                { sheet_name: 'Summary', cell_reference: 'B6' },
                { sheet_name: 'Premium', cell_reference: 'B10' },
                { sheet_name: 'Rating', cell_reference: 'E15' },
                { sheet_name: 'submission_data', cell_reference: 'B50' }
            ];
            
            // Convert to format expected by this method
            const premiumLocations = locations.map(loc => ({
                sheet: loc.sheet_name || loc.sheet,
                cell: loc.cell_reference || loc.cell
            }));
            
            for (const location of premiumLocations) {
                if (workbook.Sheets[location.sheet]) {
                    const sheet = workbook.Sheets[location.sheet];
                    const cell = sheet[location.cell];
                    if (cell && cell.v !== undefined) {
                        const value = parseFloat(cell.v);
                        if (!isNaN(value) && value > 0) {
                            console.log(`Found premium ${value} in ${location.sheet}!${location.cell}`);
                            return value;
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting premium:', error);
            return null;
        }
    }
}

module.exports = XLSXCalcWrapper;