const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * LibreOffice Headless Calculator
 * Uses LibreOffice in headless mode to calculate Excel formulas
 * Works on Linux, macOS, and Windows (with LibreOffice installed)
 */
class LibreOfficeCalculator {
    constructor() {
        // Common LibreOffice executable names on different platforms
        this.libreOfficePaths = [
            'libreoffice',  // Linux
            'soffice',      // Generic
            '/usr/bin/libreoffice',  // Linux full path
            '/usr/bin/soffice',      // Linux full path
            'C:\\Program Files\\LibreOffice\\program\\soffice.exe',  // Windows
            'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',  // Windows 32-bit
            '/Applications/LibreOffice.app/Contents/MacOS/soffice'  // macOS
        ];
    }

    /**
     * Find LibreOffice executable
     */
    async findLibreOffice() {
        for (const path of this.libreOfficePaths) {
            const exists = await new Promise(resolve => {
                exec(`"${path}" --version`, (error) => {
                    resolve(!error);
                });
            });
            
            if (exists) {
                console.log(`Found LibreOffice at: ${path}`);
                return path;
            }
        }
        
        // Try which command on Unix-like systems
        if (process.platform !== 'win32') {
            const whichResult = await new Promise(resolve => {
                exec('which libreoffice || which soffice', (error, stdout) => {
                    resolve(error ? null : stdout.trim());
                });
            });
            
            if (whichResult) {
                console.log(`Found LibreOffice via which: ${whichResult}`);
                return whichResult;
            }
        }
        
        return null;
    }

    /**
     * Check if LibreOffice is available
     */
    async checkAvailability() {
        const libreOfficePath = await this.findLibreOffice();
        return !!libreOfficePath;
    }

    /**
     * Calculate formulas using LibreOffice
     * @param {Buffer} excelBuffer - Excel file buffer with populated data
     * @param {Object} cellMapping - Cell mappings (for logging)
     * @returns {Promise<Buffer>} - Excel file buffer with calculated formulas
     */
    async calculateFormulas(excelBuffer, cellMapping = {}) {
        const libreOfficePath = await this.findLibreOffice();
        if (!libreOfficePath) {
            throw new Error('LibreOffice not found. Please install LibreOffice.');
        }

        console.log('Using LibreOffice headless mode for formula calculation...');

        // Create temp directory
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'libreoffice-'));
        const inputPath = path.join(tempDir, 'input.xlsx');
        const outputPath = path.join(tempDir, 'output.xlsx');

        try {
            // Write buffer to temp file
            await fs.writeFile(inputPath, excelBuffer);

            // Use a more robust approach with LibreOffice
            // Create a macro to force calculation
            const macroContent = `
Sub CalcFormulas
    ThisComponent.calculateAll()
    ThisComponent.store()
End Sub
            `;
            const macroPath = path.join(tempDir, 'calc_formulas.bas');
            await fs.writeFile(macroPath, macroContent);
            
            // Convert to ODS first (LibreOffice native format)
            const odsPath = path.join(tempDir, 'temp.ods');
            await new Promise((resolve, reject) => {
                const convertCmd = `"${libreOfficePath}" --headless --convert-to ods:"calc8" --outdir "${tempDir}" "${inputPath}"`;
                
                console.log('Converting to ODS:', convertCmd);
                exec(convertCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('LibreOffice ODS conversion error:', stderr);
                        reject(new Error(`LibreOffice ODS conversion failed: ${error.message}`));
                        return;
                    }
                    console.log('Converted to ODS format');
                    resolve();
                });
            });

            // Force recalculation using a macro
            await new Promise((resolve, reject) => {
                // Use a Python script to force calculation
                const calcCmd = `"${libreOfficePath}" --headless --norestore --invisible "macro:///Standard.Module1.CalcFormulas" "${odsPath}"`;
                
                console.log('Forcing calculation:', calcCmd);
                exec(calcCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    // This might error but still work, so we continue
                    console.log('Calculation attempt output:', stdout);
                    if (stderr) console.log('Calculation stderr:', stderr);
                    resolve();
                });
            });

            // Convert back to XLSX with filter options to ensure values are exported
            await new Promise((resolve, reject) => {
                // Use specific filter options to export calculated values
                const convertBackCmd = `"${libreOfficePath}" --headless --convert-to xlsx:"Calc MS Excel 2007 XML" --outdir "${tempDir}" "${odsPath}"`;
                
                console.log('Converting back to XLSX:', convertBackCmd);
                exec(convertBackCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error('LibreOffice XLSX conversion error:', stderr);
                        reject(new Error(`LibreOffice XLSX conversion failed: ${error.message}`));
                        return;
                    }
                    console.log('Converted back to XLSX format');
                    resolve();
                });
            });

            // The output file will be named temp.xlsx
            const finalPath = path.join(tempDir, 'temp.xlsx');
            
            // Read the calculated file
            const resultBuffer = await fs.readFile(finalPath);
            
            // Cleanup
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(odsPath).catch(() => {});
            await fs.unlink(finalPath).catch(() => {});
            await fs.unlink(macroPath).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});

            console.log('LibreOffice calculation completed successfully');
            return resultBuffer;

        } catch (error) {
            // Cleanup on error
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(path.join(tempDir, 'temp.ods')).catch(() => {});
            await fs.unlink(path.join(tempDir, 'temp.xlsx')).catch(() => {});
            await fs.unlink(path.join(tempDir, 'recalc.bas')).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
            
            throw error;
        }
    }

    /**
     * Install instructions for different platforms
     */
    getInstallInstructions() {
        const platform = process.platform;
        
        if (platform === 'linux') {
            return `
To install LibreOffice on Linux:
- Ubuntu/Debian: sudo apt-get install libreoffice
- RHEL/CentOS: sudo yum install libreoffice
- Fedora: sudo dnf install libreoffice
- Docker: Use a base image with LibreOffice pre-installed
            `;
        } else if (platform === 'darwin') {
            return `
To install LibreOffice on macOS:
- Using Homebrew: brew install --cask libreoffice
- Or download from: https://www.libreoffice.org/download/download/
            `;
        } else if (platform === 'win32') {
            return `
To install LibreOffice on Windows:
- Download from: https://www.libreoffice.org/download/download/
- Run the installer and use default settings
            `;
        }
        
        return 'Please visit https://www.libreoffice.org/download/download/ to install LibreOffice';
    }
}

module.exports = LibreOfficeCalculator;