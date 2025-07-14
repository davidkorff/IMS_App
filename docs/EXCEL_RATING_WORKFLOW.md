# Excel Rating Workflow

## Current Implementation Status

### Workflow Order
1. ✅ **Data Collection** - Producer submission form collects data
2. ✅ **Data Population** - submission_data sheet populated with form values
3. ✅ **Formula Calculation** - Excel formulas executed using xlsx-calc or Python
4. ✅ **Save to IMS** - Rating sheet saved via SaveRatingSheet
5. ✅ **Import & Rate** - ImportExcelRater calculates premium
6. ✅ **Premium Extraction** - Premium extracted from Excel or IMS response

### Formula Calculation Methods

#### Primary: xlsx-calc (JavaScript)
- Pure JavaScript solution
- No external dependencies
- Supports most common Excel formulas
- Enabled by default

#### Fallback: Python with openpyxl
- More comprehensive formula support
- Requires Python + openpyxl installed
- Better handling of complex Excel files
- Automatically used if xlsx-calc fails

#### Configuration per LOB
- `excel_formula_calculation` - Enable/disable formula calculation
- `formula_calc_method` - Choose method: 'xlsx-calc', 'python', or 'none'
- `excel_premium_mappings` - Configure where to find premium in Excel

### Premium Extraction

Premium is extracted from multiple sources in order:
1. Calculated Excel file (after formula execution)
2. IMS ImportExcelRater response
3. Manual extraction from known cells

### Common Premium Locations
Default locations checked (configurable per LOB):
- IMS_TAGS!B6 (IMS standard)
- Summary!B6
- Premium!B10
- Rating!E15
- submission_data!B50

### Troubleshooting

#### Formulas Not Calculating
1. Check if `excel_formula_calculation` is enabled for the LOB
2. Verify xlsx-calc is installed: `npm install xlsx xlsx-calc`
3. Check Python availability: `python -c "import openpyxl"`
4. Review console logs for formula calculation errors

#### Premium Not Found
1. Check Excel premium mappings for the LOB
2. Verify formulas are calculating correctly
3. Check IMS_TAGS sheet exists with correct structure
4. Review ImportExcelRater response for errors

#### Excel Template Requirements
- Must have submission_data sheet (or variant)
- Premium cell should be in a standard location
- Formulas should reference submission_data values
- IMS_TAGS sheet recommended for IMS integration

### Database Tables
- `portal_lines_of_business` - LOB configuration including formula settings
- `excel_premium_mappings` - Premium cell locations per LOB
- `custom_route_submissions` - Stores submission data and results

### API Flow
1. POST /api/producer/submissions/:id/process
2. ProducerSubmissionProcessor.processSubmission()
3. Create insured in IMS
4. Create submission & quote
5. Process Excel rater with formula calculation
6. Import to IMS and get premium
7. Update submission with results