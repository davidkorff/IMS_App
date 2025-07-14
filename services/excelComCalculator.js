const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * Excel COM Automation Calculator
 * Uses Windows Excel COM automation for accurate formula calculation
 * This is the most reliable method but only works on Windows with Excel installed
 */
class ExcelComCalculator {
    constructor() {
        this.isWindows = process.platform === 'win32';
        this.isWSL = this.detectWSL();
        
        // If we're in WSL, we can still use Windows Excel via PowerShell
        this.canUseExcel = this.isWindows || this.isWSL;
    }
    
    /**
     * Detect if running in WSL
     */
    detectWSL() {
        try {
            const release = require('fs').readFileSync('/proc/version', 'utf8').toLowerCase();
            return release.includes('microsoft') || release.includes('wsl');
        } catch {
            return false;
        }
    }

    /**
     * Check if Excel COM is available
     */
    async checkAvailability() {
        if (!this.canUseExcel) {
            console.log('Excel COM is only available on Windows or WSL with Windows Excel');
            return false;
        }

        return new Promise((resolve) => {
            // Try to create Excel COM object via PowerShell
            const testScript = `
                try {
                    $excel = New-Object -ComObject Excel.Application
                    $excel.Quit()
                    Write-Output "OK"
                } catch {
                    Write-Output "FAIL"
                }
            `;

            // Use powershell.exe for WSL
            const psCommand = this.isWSL ? 'powershell.exe' : 'powershell';
            
            exec(`${psCommand} -Command "${testScript}"`, (error, stdout) => {
                if (error) {
                    console.log('PowerShell test error:', error.message);
                    resolve(false);
                } else {
                    const result = stdout.trim() === 'OK';
                    console.log('Excel COM availability:', result ? 'Available' : 'Not available');
                    resolve(result);
                }
            });
        });
    }

    /**
     * Calculate formulas using Excel COM
     * @param {Buffer} excelBuffer - Excel file buffer with populated data
     * @param {Object} cellMapping - Cell mappings (for logging)
     * @returns {Promise<Buffer>} - Excel file buffer with calculated formulas
     */
    async calculateFormulas(excelBuffer, cellMapping = {}) {
        if (!this.canUseExcel) {
            throw new Error('Excel COM is only available on Windows or WSL with Windows Excel');
        }

        console.log('Using Excel COM automation for formula calculation...');
        console.log('Running in WSL:', this.isWSL);

        // Create temp file
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-'));
        const inputPath = path.join(tempDir, 'input.xlsx');
        const outputPath = path.join(tempDir, 'output.xlsx');

        try {
            // Write buffer to temp file
            await fs.writeFile(inputPath, excelBuffer);

            // Convert paths for WSL if needed
            let psInputPath = inputPath;
            let psOutputPath = outputPath;
            
            if (this.isWSL) {
                // Convert WSL paths to Windows paths
                psInputPath = inputPath.replace('/mnt/c/', 'C:\\').replace(/\//g, '\\');
                psOutputPath = outputPath.replace('/mnt/c/', 'C:\\').replace(/\//g, '\\');
            }

            // PowerShell script to calculate formulas
            const powershellScript = `
                $ErrorActionPreference = "Stop"
                try {
                    # Create Excel COM object
                    $excel = New-Object -ComObject Excel.Application
                    $excel.Visible = $false
                    $excel.DisplayAlerts = $false
                    
                    # Open workbook
                    $workbook = $excel.Workbooks.Open("${psInputPath.replace(/\\/g, '\\\\')}")
                    
                    # Force full calculation
                    $excel.Calculate()
                    $excel.CalculateFull()
                    
                    # Log some values for debugging
                    $sheet = $workbook.Worksheets.Item("submission_data")
                    if ($sheet) {
                        Write-Host "Submission data sheet found"
                        # Check a few cells
                        for ($i = 1; $i -le 20; $i++) {
                            $cellA = $sheet.Cells.Item($i, 1).Text
                            $cellB = $sheet.Cells.Item($i, 2).Value2
                            if ($cellA -or $cellB) {
                                Write-Host "Row $i : A='$cellA' B='$cellB'"
                            }
                        }
                    }
                    
                    # Check IMS_TAGS sheet for premium
                    try {
                        $imsSheet = $workbook.Worksheets.Item("IMS_TAGS")
                        if ($imsSheet) {
                            $b6 = $imsSheet.Range("B6").Value2
                            $b7 = $imsSheet.Range("B7").Value2
                            $b8 = $imsSheet.Range("B8").Value2
                            Write-Host "IMS_TAGS B6=$b6, B7=$b7, B8=$b8"
                        }
                    } catch { }
                    
                    # Save calculated workbook
                    $workbook.SaveAs("${psOutputPath.replace(/\\/g, '\\\\')}")
                    $workbook.Close()
                    $excel.Quit()
                    
                    # Release COM objects
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sheet) | Out-Null
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
                    [GC]::Collect()
                    [GC]::WaitForPendingFinalizers()
                    
                    Write-Output "SUCCESS"
                } catch {
                    Write-Error $_.Exception.Message
                    exit 1
                }
            `;

            // Use powershell.exe for WSL
            const psCommand = this.isWSL ? 'powershell.exe' : 'powershell';

            // Execute PowerShell script
            return new Promise((resolve, reject) => {
                exec(`${psCommand} -ExecutionPolicy Bypass -Command "${powershellScript}"`, 
                    { maxBuffer: 10 * 1024 * 1024 }, // 10MB buffer
                    async (error, stdout, stderr) => {
                        console.log('PowerShell output:', stdout);
                        if (stderr) console.error('PowerShell stderr:', stderr);

                        if (error) {
                            reject(new Error(`Excel COM calculation failed: ${error.message}`));
                            return;
                        }

                        try {
                            // Read the calculated file
                            const resultBuffer = await fs.readFile(outputPath);
                            
                            // Cleanup
                            await fs.unlink(inputPath).catch(() => {});
                            await fs.unlink(outputPath).catch(() => {});
                            await fs.rmdir(tempDir).catch(() => {});

                            console.log('Excel COM calculation completed successfully');
                            resolve(resultBuffer);
                        } catch (readError) {
                            reject(new Error(`Failed to read calculated file: ${readError.message}`));
                        }
                    }
                );
            });

        } catch (error) {
            // Cleanup on error
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
            
            throw error;
        }
    }
}

module.exports = ExcelComCalculator;