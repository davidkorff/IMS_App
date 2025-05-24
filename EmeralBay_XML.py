import zipfile
import os
import sys

def extract_excel_xml(excel_file, output_dir="excel_xml_files"):
    """Extract key XML files from Excel file for inspection"""
    
    print(f"Extracting XML files from {excel_file}...")
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")
    
    # Files to extract
    key_files = [
        "xl/workbook.xml",                # Contains sheet names and general workbook info
        "xl/_rels/workbook.xml.rels",     # Contains relationships to tables and other objects
        "[Content_Types].xml",            # Contains content type info
        "docProps/app.xml",               # Contains application info
        "docProps/core.xml",              # Contains core properties
    ]
    
    # Open the Excel file as a zip
    with zipfile.ZipFile(excel_file, 'r') as excel_zip:
        # List all files in zip
        all_files = excel_zip.namelist()
        print(f"Found {len(all_files)} files in the Excel file")
        
        # Extract sheet XML files
        sheet_files = [f for f in all_files if f.startswith('xl/worksheets/sheet')]
        key_files.extend(sheet_files)
        
        # Extract table XML files
        table_files = [f for f in all_files if f.startswith('xl/tables/table')]
        key_files.extend(table_files)
        
        # Extract the files
        extracted_files = []
        for file_path in key_files:
            if file_path in all_files:
                # Create subdirectories if needed
                output_path = os.path.join(output_dir, file_path)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Extract the file
                with excel_zip.open(file_path) as source, open(output_path, 'wb') as target:
                    target.write(source.read())
                
                extracted_files.append(file_path)
                print(f"Extracted: {file_path}")
            else:
                print(f"Warning: {file_path} not found in Excel file")
        
        # Extract sheet relationship files
        sheet_rel_files = [f for f in all_files if f.startswith('xl/worksheets/_rels')]
        for file_path in sheet_rel_files:
            output_path = os.path.join(output_dir, file_path)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            with excel_zip.open(file_path) as source, open(output_path, 'wb') as target:
                target.write(source.read())
            
            extracted_files.append(file_path)
            print(f"Extracted: {file_path}")
        
        print(f"\nExtracted {len(extracted_files)} XML files to {output_dir}")
        print(f"You can now send these files for analysis")

if __name__ == "__main__":
    file_path = "Emerald Bay Rate File.xlsx"
    extract_excel_xml(file_path)
    print("Extraction completed.")