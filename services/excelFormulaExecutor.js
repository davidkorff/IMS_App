const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute Excel formulas using Python/openpyxl
 * This is a workaround for ExcelJS's lack of formula calculation
 */
class ExcelFormulaExecutor {
    constructor() {
        // Try different Python scripts in order of preference
        this.pythonScripts = [
            path.join(__dirname, 'pythonExcelCalculator.py'),  // Best - uses COM/xlwings
            path.join(__dirname, 'simpleFormulaCalculator.py'), // Good - uses formulas package
            path.join(__dirname, 'excelFormulaCalculator.py')   // Fallback - basic openpyxl
        ];
        this.pythonScriptPath = this.pythonScripts[0]; // Default to best option
    }

    /**
     * Calculate formulas in Excel file
     * @param {Buffer} excelBuffer - Excel file buffer
     * @param {Object} dataMapping - Data to populate in Excel
     * @returns {Promise<Buffer>} - Excel file buffer with calculated formulas
     */
    async calculateFormulas(excelBuffer, dataMapping) {
        const fs = require('fs').promises;
        const os = require('os');
        const path = require('path');
        
        return new Promise(async (resolve, reject) => {
            let tempExcelPath = null;
            let tempDataPath = null;
            
            try {
                // Create temp files instead of passing large data as arguments
                const tempDir = os.tmpdir();
                tempExcelPath = path.join(tempDir, `excel_${Date.now()}.xlsx`);
                tempDataPath = path.join(tempDir, `data_${Date.now()}.json`);
                
                // Write Excel buffer to temp file
                await fs.writeFile(tempExcelPath, excelBuffer);
                
                // Write data mapping to temp file
                await fs.writeFile(tempDataPath, JSON.stringify(dataMapping));
                
                console.log('Executing Python script for formula calculation...');
                console.log('Temp Excel path:', tempExcelPath);
                console.log('Temp data path:', tempDataPath);
                
                // Spawn Python process with file paths instead of data
                const pythonProcess = spawn('python', [
                    this.pythonScriptPath,
                    tempExcelPath,
                    tempDataPath
                ]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log('Python stderr:', data.toString());
            });
            
            pythonProcess.on('close', async (code) => {
                    // Cleanup temp files
                    if (tempExcelPath) await fs.unlink(tempExcelPath).catch(() => {});
                    if (tempDataPath) await fs.unlink(tempDataPath).catch(() => {});
                    
                    if (code !== 0) {
                        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
                        return;
                    }
                    
                    try {
                        // stdout should contain base64 encoded Excel file
                        const resultBuffer = Buffer.from(stdout.trim(), 'base64');
                        resolve(resultBuffer);
                    } catch (error) {
                        reject(new Error(`Failed to decode Python output: ${error.message}`));
                    }
                });
                
                pythonProcess.on('error', async (error) => {
                    // Cleanup temp files on error
                    if (tempExcelPath) await fs.unlink(tempExcelPath).catch(() => {});
                    if (tempDataPath) await fs.unlink(tempDataPath).catch(() => {});
                    
                    reject(new Error(`Failed to execute Python script: ${error.message}`));
                });
                
            } catch (error) {
                // Cleanup temp files if setup fails
                if (tempExcelPath) await fs.unlink(tempExcelPath).catch(() => {});
                if (tempDataPath) await fs.unlink(tempDataPath).catch(() => {});
                
                reject(error);
            }
        });
    }

    /**
     * Check if Python and required packages are available
     */
    async checkDependencies() {
        return new Promise((resolve) => {
            const checkProcess = spawn('python', ['-c', 'import openpyxl; print("OK")']);
            
            checkProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('Python formula calculator is available');
                    resolve(true);
                } else {
                    console.warn('Python formula calculator not available. Install Python and run: pip install openpyxl');
                    resolve(false);
                }
            });
            
            checkProcess.on('error', () => {
                console.warn('Python not found. Formula calculation will not be available.');
                resolve(false);
            });
        });
    }
}

module.exports = ExcelFormulaExecutor;