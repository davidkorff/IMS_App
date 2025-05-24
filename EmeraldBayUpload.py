import pandas as pd
import re
import os
from tabulate import tabulate
import time
import openpyxl
import sys
import zipfile
import xml.etree.ElementTree as ET
import pyodbc
import getpass

def clean_column_name(name):
    """Clean column names to be database-friendly"""
    if pd.isna(name):
        return "unnamed_column"
    # Replace spaces and special characters with underscores
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', str(name).strip())
    # Remove consecutive underscores
    clean_name = re.sub(r'_+', '_', clean_name)
    # Remove leading/trailing underscores
    clean_name = clean_name.strip('_')
    # Ensure it doesn't start with a number
    if clean_name and clean_name[0].isdigit():
        clean_name = 'col_' + clean_name
    # Handle empty names
    if not clean_name:
        return "unnamed_column"
    return clean_name.lower()

def clean_table_name(name):
    """Clean table names to be database-friendly"""
    if pd.isna(name) or not name:
        return "unnamed_table"
    # Replace spaces and special characters with underscores
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', str(name).strip())
    # Remove consecutive underscores
    clean_name = re.sub(r'_+', '_', clean_name)
    # Remove leading/trailing underscores
    clean_name = clean_name.strip('_')
    # Ensure it doesn't start with a number
    if clean_name and clean_name[0].isdigit():
        clean_name = 'table_' + clean_name
    # Handle empty names
    if not clean_name:
        return "unnamed_table"
    return clean_name

def get_excel_tables(file_path):
    """
    Extract Excel tables directly from the Excel file's XML structure.
    Returns a list of (table_name, sheet_name, range) tuples.
    """
    print("Extracting table information from Excel XML structure...")
    tables = []
    
    try:
        # First try to load the workbook to get sheet names
        workbook = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        sheet_name = workbook.sheetnames[0]  # All tables are on the first sheet
        print(f"Tables are on sheet: {sheet_name}")
        
        # Now extract table information directly from the ZIP structure
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            # Extract table definitions
            table_files = [f for f in zip_ref.namelist() if f.startswith('xl/tables/table')]
            
            if not table_files:
                print("No table definitions found in Excel file.")
                return [('USAddress', sheet_name, '$A$1:$G$33637')]
            
            print(f"Found {len(table_files)} table definitions.")
            
            for table_file in sorted(table_files):
                with zip_ref.open(table_file) as f:
                    # Parse the XML
                    tree = ET.parse(f)
                    root = tree.getroot()
                    
                    # Extract namespace
                    ns = {'': root.tag.split('}')[0].strip('{')}
                    
                    # Get table attributes
                    table_name = root.get('name')
                    table_ref = root.get('ref')
                    
                    # Convert Excel reference to $ format
                    table_range = '$' + table_ref.replace(':', '$:$')
                    
                    print(f"  Table: {table_name}, Range: {table_range}")
                    tables.append((table_name, sheet_name, table_range))
        
        return tables
        
    except Exception as e:
        print(f"Error extracting table information: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return fallback
        return [('USAddress', 'RATE_DATA', '$A$1:$G$33637')]

def extract_table_data(file_path, sheet_name, table_range):
    """Extract and process a table from the Excel file"""
    print(f"Extracting data from {sheet_name}, range {table_range}...")
    
    try:
        # Now we should have a proper range like "A1:G100"
        if table_range and ':' in table_range:
            start_cell, end_cell = table_range.split(':')
            
            # Extract row numbers and column letters
            start_col_match = re.match(r'[$]?([A-Z]+)', start_cell)
            start_row_match = re.search(r'[$]?(\d+)', start_cell)
            end_col_match = re.match(r'[$]?([A-Z]+)', end_cell)
            end_row_match = re.search(r'[$]?(\d+)', end_cell)
            
            if start_col_match and start_row_match and end_col_match and end_row_match:
                start_col = start_col_match.group(1)
                start_row = int(start_row_match.group(1))
                end_col = end_col_match.group(1)
                end_row = int(end_row_match.group(1))
                
                print(f"  Extracting from cell {start_col}{start_row} to {end_col}{end_row}")
                
                # Convert column letters to indices
                start_col_idx = 0
                for char in start_col:
                    start_col_idx = start_col_idx * 26 + (ord(char) - ord('A') + 1)
                start_col_idx -= 1  # 0-based index
                
                end_col_idx = 0
                for char in end_col:
                    end_col_idx = end_col_idx * 26 + (ord(char) - ord('A') + 1)
                end_col_idx -= 1  # 0-based index
                
                # Read the specific range from the Excel file
                # Adjust for pandas 0-indexing (Excel is 1-indexed)
                data_df = pd.read_excel(
                    file_path, 
                    sheet_name=sheet_name,
                    header=0,                    # First row is header
                    skiprows=start_row-1,        # Skip rows before the start
                    nrows=end_row-start_row+1,   # Number of rows to read
                    usecols=range(start_col_idx, end_col_idx+1)  # Columns to read
                )
                
                print(f"  Successfully extracted {len(data_df)} rows and {len(data_df.columns)} columns")
            else:
                print(f"  Error: Could not parse range {table_range}")
                return pd.DataFrame()
        else:
            print(f"  Error: Invalid range format {table_range}")
            return pd.DataFrame()
        
        # Use the first row as headers if not already set
        if not data_df.empty:
            # Clean column names
            clean_headers = [clean_column_name(h) for h in data_df.columns]
            
            # Handle duplicate column names
            header_counts = {}
            for i, header in enumerate(clean_headers):
                if header in header_counts:
                    header_counts[header] += 1
                    clean_headers[i] = f"{header}_{header_counts[header]}"
                else:
                    header_counts[header] = 1
            
            # Apply the headers
            data_df.columns = clean_headers
            
            # Remove completely empty rows
            data_df = data_df.dropna(how='all')
        
        return data_df
    
    except Exception as e:
        print(f"Error extracting table data: {str(e)}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()  # Return empty dataframe on error

def get_sql_connection():
    """Get a connection to SQL Server"""
    print("\nConnecting to SQL Server...")
    
    server = input("Enter SQL Server name: ").strip()
    database = input("Enter database name: ").strip()
    
    # Ask for authentication method
    auth_type = input("Use Windows Authentication? (y/n): ").strip().lower()
    
    if auth_type == 'y':
        # Windows Authentication
        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
    else:
        # SQL Server Authentication
        username = input("Enter SQL username: ").strip()
        show_password = input("Show password as you type for copy/paste? (y/n): ").strip().lower()
        
        if show_password == 'y':
            password = input("Enter SQL password (VISIBLE): ")
        else:
            password = getpass.getpass("Enter SQL password: ")
            
        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
    
    print(f"Attempting to connect to {server}, database {database}...")
    try:
        conn = pyodbc.connect(connection_string)
        print("Successfully connected to SQL Server!")
        return conn
    except Exception as e:
        print(f"Error connecting to SQL Server: {str(e)}")
        return None

def create_sql_table(conn, table_name, df):
    """Create a SQL table from a pandas DataFrame"""
    print(f"Creating SQL table: {table_name}")
    
    if df.empty:
        print("  Error: Cannot create table from empty DataFrame")
        return False
    
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute(f"IF OBJECT_ID(N'{table_name}', N'U') IS NOT NULL SELECT 1 ELSE SELECT 0")
        table_exists = cursor.fetchone()[0]
        
        if table_exists:
            response = input(f"  Table {table_name} already exists. Drop and recreate? (y/n): ").strip().lower()
            if response == 'y':
                cursor.execute(f"DROP TABLE {table_name}")
                conn.commit()
                print(f"  Dropped existing table {table_name}")
            else:
                print(f"  Skipping table creation for {table_name}")
                return False
        
        # Generate column definitions
        column_defs = []
        for col_name, dtype in zip(df.columns, df.dtypes):
            sql_type = "VARCHAR(255)"  # Default type
            
            # Map pandas dtypes to SQL types
            if pd.api.types.is_integer_dtype(dtype):
                sql_type = "INT"
            elif pd.api.types.is_float_dtype(dtype):
                sql_type = "FLOAT"
            elif pd.api.types.is_datetime64_dtype(dtype):
                sql_type = "DATETIME"
            elif pd.api.types.is_bool_dtype(dtype):
                sql_type = "BIT"
            
            column_defs.append(f"[{col_name}] {sql_type}")
        
        # Create the table
        create_sql = f"CREATE TABLE {table_name} (\n    " + ",\n    ".join(column_defs) + "\n)"
        print(f"  Executing SQL:\n{create_sql}")
        
        cursor.execute(create_sql)
        conn.commit()
        print(f"  Table {table_name} created successfully")
        
        # Insert data
        print(f"  Inserting {len(df)} rows of data...")
        
        # Generate the INSERT statement
        columns = df.columns
        placeholders = ", ".join(["?" for _ in columns])
        insert_sql = f"INSERT INTO {table_name} ([" + "], [".join(columns) + "]) VALUES (" + placeholders + ")"
        
        # Insert data in batches to improve performance
        batch_size = 1000
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i+batch_size]
            
            # Convert batch to list of tuples for fast insertion
            rows = [tuple(x) for x in batch.replace({pd.NA: None}).values]
            cursor.executemany(insert_sql, rows)
            conn.commit()
            print(f"  Inserted rows {i} to {min(i+batch_size, len(df))}")
        
        print(f"  Data insertion complete for table {table_name}")
        return True
        
    except Exception as e:
        print(f"  Error creating table: {str(e)}")
        conn.rollback()
        import traceback
        traceback.print_exc()
        return False

def process_excel_file_interactively(file_path):
    """Process the Excel file interactively, asking for confirmation for each table"""
    print(f"Processing file: {file_path}")
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return
    
    try:
        # Get SQL connection
        conn = get_sql_connection()
        if conn is None:
            print("Cannot proceed without database connection.")
            return
        
        # Get all Excel tables
        tables = get_excel_tables(file_path)
        
        if not tables:
            print("No tables found in the workbook.")
            return
        
        print(f"\nFound {len(tables)} Excel tables in the workbook.")
        
        # Process each table
        for i, (table_name, sheet_name, table_range) in enumerate(tables):
            clean_name = clean_table_name(table_name)
            db_table_name = f"Origin_EB_{clean_name}"
            
            print("\n" + "="*80)
            print(f"\nTable {i+1}: {table_name} found")
            print(f"Sheet: {sheet_name}")
            print(f"Range: {table_range}")
            
            # Extract and process the table
            data_df = extract_table_data(file_path, sheet_name, table_range)
            
            if data_df.empty:
                print("Warning: No data extracted from this table.")
                continue
            
            # Report on the table
            print(f"Columns ({len(data_df.columns)}):")
            for col in data_df.columns:
                print(f"  - {col}")
            
            print(f"Row count: {len(data_df)}")
            
            # Show a sample of the data
            if not data_df.empty:
                print("\nSample data (first 3 rows):")
                print(tabulate(data_df.head(3), headers=data_df.columns, tablefmt="grid"))
            
            # Ask for confirmation
            response = input("\nWould you like to create this table in SQL Server? (y/n): ").strip().lower()
            
            if response == 'y':
                print(f"Creating table {db_table_name} in SQL Server...")
                success = create_sql_table(conn, db_table_name, data_df)
                if success:
                    print(f"Table {db_table_name} created and populated successfully!")
                else:
                    print(f"Failed to create table {db_table_name}")
            else:
                print(f"Skipping table {db_table_name}")
        
        print("\n" + "="*80)
        print("\nAll tables processed!")
        
        # Close the connection
        conn.close()
        print("SQL Server connection closed.")
        
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    file_path = "Emerald Bay Rate File.xlsx"
    print(f"Starting script with Python {sys.version}")
    process_excel_file_interactively(file_path)
    print("Script completed.") 