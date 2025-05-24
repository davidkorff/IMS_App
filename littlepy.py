import base64
from xml.etree import ElementTree as ET

def convert_response_to_pdf(response_file='response.txt', output_file='output.pdf'):
    try:
        # Read the response file
        with open(response_file, 'r') as f:
            soap_response = f.read()
        
        # Parse the XML
        root = ET.fromstring(soap_response)
        
        # Find the CreatePolicyDocumentResult element
        result = root.find('.//{http://tempuri.org/IMSWebServices/DocumentFunctions}CreatePolicyDocumentResult')
        
        if result is not None:
            # Get the base64 string
            base64_string = result.text
            
            # Decode the base64 string
            pdf_bytes = base64.b64decode(base64_string)
            
            # Write to a PDF file
            with open(output_file, 'wb') as f:
                f.write(pdf_bytes)
            print(f"PDF file created successfully as {output_file}!")
        else:
            print("Could not find PDF data in response")
            
    except FileNotFoundError:
        print(f"Could not find response file: {response_file}")
    except ET.ParseError:
        print("Invalid XML in response file")
    except Exception as e:
        print(f"Error creating PDF: {str(e)}")

if __name__ == "__main__":
    convert_response_to_pdf()
