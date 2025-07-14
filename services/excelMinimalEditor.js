const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

/**
 * Minimal Excel editor that preserves file integrity by only modifying specific cells
 * This avoids the corruption issues caused by ExcelJS's full parse/rebuild approach
 */
class ExcelMinimalEditor {
    constructor() {
        this.parser = new xml2js.Parser({ explicitArray: false, preserveChildrenOrder: true });
        this.builder = new xml2js.Builder({ 
            renderOpts: { 'pretty': false },
            headless: true
        });
    }

    /**
     * Populate specific cells in Excel without corrupting the file
     * @param {Buffer} excelBuffer - Original Excel file
     * @param {Object} dataMapping - Map of cell references to values (e.g., {'A1': 'value'})
     * @param {string} sheetName - Name of sheet to modify (default: 'submission_data')
     * @returns {Buffer} - Modified Excel file
     */
    async populateCells(excelBuffer, dataMapping, sheetName = 'submission_data') {
        try {
            console.log(`\nUsing minimal editor to populate ${Object.keys(dataMapping).length} cells...`);
            
            // Use AdmZip to work with the Excel file (which is a ZIP)
            const zip = new AdmZip(excelBuffer);
            
            // Find the sheet relationship
            const workbookXml = zip.getEntry('xl/workbook.xml').getData().toString('utf8');
            const workbook = await this.parser.parseStringPromise(workbookXml);
            
            // Find sheet ID
            let sheetId = null;
            let sheetFileName = null;
            
            const sheets = Array.isArray(workbook.workbook.sheets.sheet) 
                ? workbook.workbook.sheets.sheet 
                : [workbook.workbook.sheets.sheet];
                
            for (const sheet of sheets) {
                if (sheet.$.name.toLowerCase() === sheetName.toLowerCase()) {
                    sheetId = sheet.$['r:id'];
                    break;
                }
            }
            
            if (!sheetId) {
                console.warn(`Sheet "${sheetName}" not found in workbook`);
                return excelBuffer;
            }
            
            // Get relationships to find sheet file
            const relsXml = zip.getEntry('xl/_rels/workbook.xml.rels').getData().toString('utf8');
            const rels = await this.parser.parseStringPromise(relsXml);
            
            const relationships = Array.isArray(rels.Relationships.Relationship) 
                ? rels.Relationships.Relationship 
                : [rels.Relationships.Relationship];
                
            for (const rel of relationships) {
                if (rel.$.Id === sheetId) {
                    sheetFileName = rel.$.Target;
                    break;
                }
            }
            
            if (!sheetFileName) {
                console.warn('Could not find sheet file');
                return excelBuffer;
            }
            
            // Get sheet data
            const sheetPath = `xl/${sheetFileName}`;
            const sheetEntry = zip.getEntry(sheetPath);
            if (!sheetEntry) {
                console.warn(`Sheet file not found: ${sheetPath}`);
                return excelBuffer;
            }
            
            const sheetXml = sheetEntry.getData().toString('utf8');
            const sheetData = await this.parser.parseStringPromise(sheetXml);
            
            // Get shared strings (Excel stores strings separately)
            let sharedStrings = [];
            const sharedStringsEntry = zip.getEntry('xl/sharedStrings.xml');
            if (sharedStringsEntry) {
                const sharedStringsXml = sharedStringsEntry.getData().toString('utf8');
                const sharedStringsData = await this.parser.parseStringPromise(sharedStringsXml);
                if (sharedStringsData.sst && sharedStringsData.sst.si) {
                    sharedStrings = Array.isArray(sharedStringsData.sst.si) 
                        ? sharedStringsData.sst.si 
                        : [sharedStringsData.sst.si];
                }
            }
            
            // Update cell values
            let modifiedCells = 0;
            for (const [cellRef, value] of Object.entries(dataMapping)) {
                if (value === null || value === undefined || value === '') continue;
                
                // Find or create row
                const rowNum = parseInt(cellRef.match(/\d+/)[0]);
                const colLetter = cellRef.match(/[A-Z]+/)[0];
                
                if (!sheetData.worksheet.sheetData) {
                    sheetData.worksheet.sheetData = { row: [] };
                }
                
                let rows = sheetData.worksheet.sheetData.row;
                if (!Array.isArray(rows)) {
                    rows = rows ? [rows] : [];
                    sheetData.worksheet.sheetData.row = rows;
                }
                
                let targetRow = rows.find(r => r.$ && r.$.r == rowNum);
                if (!targetRow) {
                    targetRow = { $: { r: rowNum }, c: [] };
                    rows.push(targetRow);
                }
                
                // Find or create cell
                if (!targetRow.c) targetRow.c = [];
                if (!Array.isArray(targetRow.c)) targetRow.c = [targetRow.c];
                
                let targetCell = targetRow.c.find(c => c.$ && c.$.r === cellRef);
                if (!targetCell) {
                    targetCell = { $: { r: cellRef } };
                    targetRow.c.push(targetCell);
                }
                
                // Set cell value (as inline string to avoid shared strings complexity)
                targetCell.$ = targetCell.$ || {};
                targetCell.$.t = 'inlineStr'; // Use inline string type
                targetCell.is = {
                    t: String(value)
                };
                
                // Remove any existing value or formula
                delete targetCell.v;
                delete targetCell.f;
                
                modifiedCells++;
            }
            
            console.log(`Modified ${modifiedCells} cells in ${sheetName}`);
            
            // Convert back to XML
            const modifiedSheetXml = this.builder.buildObject(sheetData);
            
            // Update the zip file
            zip.updateFile(sheetPath, Buffer.from(modifiedSheetXml, 'utf8'));
            
            // Return the modified Excel file
            return zip.toBuffer();
            
        } catch (error) {
            console.error('Error in minimal Excel editor:', error);
            // Return original buffer on error
            return excelBuffer;
        }
    }
    
    /**
     * Create a mapping for submission_data sheet from IMS data
     */
    createSubmissionDataMapping(imsData, customData, effectiveDate, expirationDate) {
        const mapping = {};
        
        // Standard mappings for submission_data sheet
        const standardMappings = {
            'B1': imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
            'B2': imsData.dba,
            'B3': imsData.firstName,
            'B4': imsData.lastName,
            'B5': imsData.address1,
            'B6': imsData.city,
            'B7': imsData.state,
            'B8': imsData.zip,
            'B9': imsData.phone,
            'B10': imsData.email,
            'B11': imsData.fein,
            'B12': effectiveDate,
            'B13': expirationDate,
            'B14': imsData.businessType,
            'B15': imsData.ssn
        };
        
        // Only add non-empty values
        for (const [cell, value] of Object.entries(standardMappings)) {
            if (value) {
                mapping[cell] = value;
            }
        }
        
        // Add custom data starting from row 20
        if (customData && typeof customData === 'object') {
            let row = 20;
            for (const [key, value] of Object.entries(customData)) {
                if (value) {
                    mapping[`A${row}`] = key;
                    mapping[`B${row}`] = value;
                    row++;
                }
            }
        }
        
        return mapping;
    }
}

module.exports = ExcelMinimalEditor;