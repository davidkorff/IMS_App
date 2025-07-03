-- Update the Workers Compensation form to fix field types and add vehicle section
-- This query updates the form_schema JSON to fix rendering issues and add conditional vehicle section

UPDATE form_schemas 
SET form_schema = '{
    "id": "wc_form_001",
    "version": "1.1",
    "metadata": {
        "title": "Workers Compensation Application",
        "description": "Complete application for Workers Compensation insurance coverage",
        "lineOfBusiness": "test1",
        "createdAt": "2025-01-07T10:00:00Z",
        "updatedAt": "2025-01-07T15:00:00Z"
    },
    "pages": [
        {
            "id": "page1",
            "order": 1,
            "title": "Business Information",
            "description": "Basic information about your business",
            "sections": [
                {
                    "id": "section_business_info",
                    "type": "fieldset",
                    "title": "Business Details",
                    "layout": "2-column",
                    "items": [
                        {"type": "field", "fieldId": "business_name"},
                        {"type": "field", "fieldId": "dba_name"},
                        {"type": "field", "fieldId": "business_type"},
                        {"type": "field", "fieldId": "years_in_business"},
                        {"type": "field", "fieldId": "federal_tax_id"},
                        {"type": "field", "fieldId": "business_phone"},
                        {"type": "field", "fieldId": "business_email"},
                        {"type": "field", "fieldId": "website"}
                    ]
                },
                {
                    "id": "section_business_address",
                    "type": "fieldset",
                    "title": "Business Address",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "business_street"},
                        {"type": "field", "fieldId": "business_street2"},
                        {"type": "field", "fieldId": "business_city"},
                        {"type": "field", "fieldId": "business_state"},
                        {"type": "field", "fieldId": "business_zip"}
                    ]
                },
                {
                    "id": "section_business_structure",
                    "type": "fieldset",
                    "title": "Business Structure",
                    "layout": "2-column",
                    "items": [
                        {"type": "field", "fieldId": "entity_type"},
                        {"type": "field", "fieldId": "ownership_structure"},
                        {"type": "field", "fieldId": "description_of_operations"}
                    ]
                }
            ]
        },
        {
            "id": "page2",
            "order": 2,
            "title": "Employee Information",
            "description": "Details about your employees and payroll",
            "sections": [
                {
                    "id": "section_employee_count",
                    "type": "fieldset",
                    "title": "Employee Overview",
                    "layout": "2-column",
                    "items": [
                        {"type": "field", "fieldId": "total_employees"},
                        {"type": "field", "fieldId": "full_time_employees"},
                        {"type": "field", "fieldId": "part_time_employees"},
                        {"type": "field", "fieldId": "seasonal_employees"},
                        {"type": "field", "fieldId": "contractors_1099"},
                        {"type": "field", "fieldId": "annual_payroll"}
                    ]
                },
                {
                    "id": "section_job_classifications",
                    "type": "fieldset",
                    "title": "Job Classifications",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "job_classifications"}
                    ]
                }
            ]
        },
        {
            "id": "page3",
            "order": 3,
            "title": "Vehicles & Equipment",
            "description": "Information about vehicles and equipment",
            "sections": [
                {
                    "id": "section_vehicle_question",
                    "type": "fieldset",
                    "title": "Vehicle Information",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "has_vehicles"},
                        {"type": "field", "fieldId": "vehicle_add_button"}
                    ]
                },
                {
                    "id": "section_vehicles",
                    "type": "fieldset",
                    "title": "Vehicle Details",
                    "layout": "1-column",
                    "visibility": {
                        "condition": "all",
                        "rules": [
                            {
                                "field": "has_vehicles",
                                "operator": "equals",
                                "value": "yes"
                            }
                        ]
                    },
                    "items": [
                        {"type": "field", "fieldId": "vehicles"}
                    ]
                }
            ]
        },
        {
            "id": "page4",
            "order": 4,
            "title": "Safety & Risk Management",
            "description": "Information about your safety programs and procedures",
            "sections": [
                {
                    "id": "section_safety_programs",
                    "type": "fieldset",
                    "title": "Safety Programs",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "has_safety_program"},
                        {"type": "field", "fieldId": "safety_program_details"},
                        {"type": "field", "fieldId": "safety_meetings_frequency"},
                        {"type": "field", "fieldId": "safety_certifications"}
                    ]
                },
                {
                    "id": "section_workplace_hazards",
                    "type": "fieldset",
                    "title": "Workplace Conditions",
                    "layout": "2-column",
                    "items": [
                        {"type": "field", "fieldId": "work_at_heights"},
                        {"type": "field", "fieldId": "height_details"},
                        {"type": "field", "fieldId": "hazardous_materials"},
                        {"type": "field", "fieldId": "hazmat_details"},
                        {"type": "field", "fieldId": "heavy_machinery"},
                        {"type": "field", "fieldId": "machinery_types"}
                    ]
                }
            ]
        },
        {
            "id": "page5",
            "order": 5,
            "title": "Claims History",
            "description": "Previous workers compensation claims",
            "sections": [
                {
                    "id": "section_claims_summary",
                    "type": "fieldset",
                    "title": "Claims Summary",
                    "layout": "2-column",
                    "items": [
                        {"type": "field", "fieldId": "prior_coverage"},
                        {"type": "field", "fieldId": "prior_carrier"},
                        {"type": "field", "fieldId": "claims_past_5_years"},
                        {"type": "field", "fieldId": "total_claims_amount"}
                    ]
                },
                {
                    "id": "section_claims_details",
                    "type": "fieldset",
                    "title": "Claims Details",
                    "layout": "1-column",
                    "visibility": {
                        "condition": "any",
                        "rules": [
                            {
                                "field": "claims_past_5_years",
                                "operator": "greaterThan",
                                "value": 0
                            }
                        ]
                    },
                    "items": [
                        {"type": "field", "fieldId": "claims_details"}
                    ]
                }
            ]
        },
        {
            "id": "page6",
            "order": 6,
            "title": "Additional Information",
            "description": "Final details and document uploads",
            "sections": [
                {
                    "id": "section_additional_coverage",
                    "type": "fieldset",
                    "title": "Coverage Preferences",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "requested_effective_date"},
                        {"type": "field", "fieldId": "coverage_limit_preference"},
                        {"type": "field", "fieldId": "deductible_preference"},
                        {"type": "field", "fieldId": "additional_coverages"},
                        {"type": "field", "fieldId": "special_requirements"}
                    ]
                },
                {
                    "id": "section_documents",
                    "type": "fieldset",
                    "title": "Supporting Documents",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "financial_statements"},
                        {"type": "field", "fieldId": "safety_manual"},
                        {"type": "field", "fieldId": "loss_runs"},
                        {"type": "field", "fieldId": "other_documents"}
                    ]
                },
                {
                    "id": "section_signature",
                    "type": "fieldset",
                    "title": "Authorization",
                    "layout": "1-column",
                    "items": [
                        {"type": "field", "fieldId": "authorization_info"},
                        {"type": "field", "fieldId": "authorized_person"},
                        {"type": "field", "fieldId": "authorized_title"},
                        {"type": "field", "fieldId": "signature_pad"},
                        {"type": "field", "fieldId": "signature_date"}
                    ]
                }
            ]
        }
    ],
    "fields": {
        "business_name": {
            "id": "business_name",
            "type": "text",
            "name": "business_name",
            "label": "Legal Business Name",
            "placeholder": "Enter your legal business name",
            "required": true,
            "validation": {
                "minLength": 2,
                "maxLength": 100
            }
        },
        "dba_name": {
            "id": "dba_name",
            "type": "text",
            "name": "dba_name",
            "label": "DBA Name (if applicable)",
            "placeholder": "Doing Business As name",
            "required": false
        },
        "business_type": {
            "id": "business_type",
            "type": "select",
            "name": "business_type",
            "label": "Type of Business",
            "required": true,
            "options": [
                {"value": "", "label": "Select business type"},
                {"value": "construction", "label": "Construction"},
                {"value": "manufacturing", "label": "Manufacturing"},
                {"value": "retail", "label": "Retail"},
                {"value": "restaurant", "label": "Restaurant/Food Service"},
                {"value": "healthcare", "label": "Healthcare"},
                {"value": "professional", "label": "Professional Services"},
                {"value": "transportation", "label": "Transportation/Logistics"},
                {"value": "other", "label": "Other"}
            ]
        },
        "years_in_business": {
            "id": "years_in_business",
            "type": "number",
            "name": "years_in_business",
            "label": "Years in Business",
            "required": true,
            "validation": {
                "min": 0,
                "max": 200
            }
        },
        "federal_tax_id": {
            "id": "federal_tax_id",
            "type": "text",
            "name": "federal_tax_id",
            "label": "Federal Tax ID (EIN)",
            "placeholder": "XX-XXXXXXX",
            "required": true,
            "validation": {
                "pattern": "^\\\\d{2}-\\\\d{7}$",
                "messages": {
                    "pattern": "Please enter a valid EIN format (XX-XXXXXXX)"
                }
            }
        },
        "business_phone": {
            "id": "business_phone",
            "type": "phone",
            "name": "business_phone",
            "label": "Business Phone",
            "placeholder": "(555) 555-5555",
            "required": true
        },
        "business_email": {
            "id": "business_email",
            "type": "email",
            "name": "business_email",
            "label": "Business Email",
            "placeholder": "contact@business.com",
            "required": true
        },
        "website": {
            "id": "website",
            "type": "text",
            "name": "website",
            "label": "Website",
            "placeholder": "https://www.yourbusiness.com",
            "required": false
        },
        "business_street": {
            "id": "business_street",
            "type": "text",
            "name": "business_street",
            "label": "Street Address",
            "placeholder": "123 Main Street",
            "required": true
        },
        "business_street2": {
            "id": "business_street2",
            "type": "text",
            "name": "business_street2",
            "label": "Suite/Unit (Optional)",
            "placeholder": "Suite 100",
            "required": false
        },
        "business_city": {
            "id": "business_city",
            "type": "text",
            "name": "business_city",
            "label": "City",
            "required": true
        },
        "business_state": {
            "id": "business_state",
            "type": "select",
            "name": "business_state",
            "label": "State",
            "required": true,
            "options": [
                {"value": "", "label": "Select State"},
                {"value": "AL", "label": "Alabama"},
                {"value": "AK", "label": "Alaska"},
                {"value": "AZ", "label": "Arizona"},
                {"value": "AR", "label": "Arkansas"},
                {"value": "CA", "label": "California"},
                {"value": "CO", "label": "Colorado"},
                {"value": "CT", "label": "Connecticut"},
                {"value": "DE", "label": "Delaware"},
                {"value": "FL", "label": "Florida"},
                {"value": "GA", "label": "Georgia"},
                {"value": "HI", "label": "Hawaii"},
                {"value": "ID", "label": "Idaho"},
                {"value": "IL", "label": "Illinois"},
                {"value": "IN", "label": "Indiana"},
                {"value": "IA", "label": "Iowa"},
                {"value": "KS", "label": "Kansas"},
                {"value": "KY", "label": "Kentucky"},
                {"value": "LA", "label": "Louisiana"},
                {"value": "ME", "label": "Maine"},
                {"value": "MD", "label": "Maryland"},
                {"value": "MA", "label": "Massachusetts"},
                {"value": "MI", "label": "Michigan"},
                {"value": "MN", "label": "Minnesota"},
                {"value": "MS", "label": "Mississippi"},
                {"value": "MO", "label": "Missouri"},
                {"value": "MT", "label": "Montana"},
                {"value": "NE", "label": "Nebraska"},
                {"value": "NV", "label": "Nevada"},
                {"value": "NH", "label": "New Hampshire"},
                {"value": "NJ", "label": "New Jersey"},
                {"value": "NM", "label": "New Mexico"},
                {"value": "NY", "label": "New York"},
                {"value": "NC", "label": "North Carolina"},
                {"value": "ND", "label": "North Dakota"},
                {"value": "OH", "label": "Ohio"},
                {"value": "OK", "label": "Oklahoma"},
                {"value": "OR", "label": "Oregon"},
                {"value": "PA", "label": "Pennsylvania"},
                {"value": "RI", "label": "Rhode Island"},
                {"value": "SC", "label": "South Carolina"},
                {"value": "SD", "label": "South Dakota"},
                {"value": "TN", "label": "Tennessee"},
                {"value": "TX", "label": "Texas"},
                {"value": "UT", "label": "Utah"},
                {"value": "VT", "label": "Vermont"},
                {"value": "VA", "label": "Virginia"},
                {"value": "WA", "label": "Washington"},
                {"value": "WV", "label": "West Virginia"},
                {"value": "WI", "label": "Wisconsin"},
                {"value": "WY", "label": "Wyoming"}
            ]
        },
        "business_zip": {
            "id": "business_zip",
            "type": "text",
            "name": "business_zip",
            "label": "ZIP Code",
            "placeholder": "12345",
            "required": true,
            "validation": {
                "pattern": "^\\\\d{5}(-\\\\d{4})?$",
                "messages": {
                    "pattern": "Please enter a valid ZIP code"
                }
            }
        },
        "entity_type": {
            "id": "entity_type",
            "type": "radio",
            "name": "entity_type",
            "label": "Entity Type",
            "required": true,
            "options": [
                {"value": "sole_prop", "label": "Sole Proprietorship"},
                {"value": "partnership", "label": "Partnership"},
                {"value": "llc", "label": "LLC"},
                {"value": "corporation", "label": "Corporation"},
                {"value": "non_profit", "label": "Non-Profit"}
            ]
        },
        "ownership_structure": {
            "id": "ownership_structure",
            "type": "textarea",
            "name": "ownership_structure",
            "label": "Describe Ownership Structure",
            "placeholder": "List all owners and their percentage of ownership",
            "required": true,
            "validation": {
                "maxLength": 500
            }
        },
        "description_of_operations": {
            "id": "description_of_operations",
            "type": "textarea",
            "name": "description_of_operations",
            "label": "Detailed Description of Operations",
            "placeholder": "Describe what your business does in detail",
            "required": true,
            "validation": {
                "minLength": 50,
                "maxLength": 1000
            },
            "display": {
                "rows": 4
            }
        },
        "total_employees": {
            "id": "total_employees",
            "type": "number",
            "name": "total_employees",
            "label": "Total Number of Employees",
            "required": true,
            "validation": {
                "min": 1,
                "max": 10000
            }
        },
        "full_time_employees": {
            "id": "full_time_employees",
            "type": "number",
            "name": "full_time_employees",
            "label": "Full-Time Employees",
            "required": true,
            "validation": {
                "min": 0
            }
        },
        "part_time_employees": {
            "id": "part_time_employees",
            "type": "number",
            "name": "part_time_employees",
            "label": "Part-Time Employees",
            "required": true,
            "validation": {
                "min": 0
            }
        },
        "seasonal_employees": {
            "id": "seasonal_employees",
            "type": "number",
            "name": "seasonal_employees",
            "label": "Seasonal Employees",
            "required": false,
            "validation": {
                "min": 0
            }
        },
        "contractors_1099": {
            "id": "contractors_1099",
            "type": "radio",
            "name": "contractors_1099",
            "label": "Do you use 1099 contractors?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "annual_payroll": {
            "id": "annual_payroll",
            "type": "number",
            "name": "annual_payroll",
            "label": "Total Annual Payroll",
            "placeholder": "0.00",
            "required": true,
            "validation": {
                "min": 0
            },
            "display": {
                "prefix": "$",
                "thousandsSeparator": ","
            }
        },
        "job_classifications": {
            "id": "job_classifications",
            "type": "repeater",
            "name": "job_classifications",
            "label": "Job Classifications",
            "helpText": "Add each job classification in your business",
            "minItems": 1,
            "maxItems": 20,
            "buttonText": "Add Job Classification",
            "fields": [
                {
                    "id": "class_code",
                    "type": "text",
                    "name": "class_code",
                    "label": "Class Code",
                    "placeholder": "e.g., 5403"
                },
                {
                    "id": "class_description",
                    "type": "text",
                    "name": "class_description",
                    "label": "Job Description",
                    "placeholder": "e.g., Carpentry",
                    "required": true
                },
                {
                    "id": "num_employees",
                    "type": "number",
                    "name": "num_employees",
                    "label": "Number of Employees",
                    "required": true,
                    "validation": {"min": 1}
                },
                {
                    "id": "annual_payroll_class",
                    "type": "number",
                    "name": "annual_payroll_class",
                    "label": "Annual Payroll for this Class",
                    "required": true,
                    "display": {"prefix": "$"}
                }
            ]
        },
        "has_vehicles": {
            "id": "has_vehicles",
            "type": "radio",
            "name": "has_vehicles",
            "label": "Does this location have any vehicles?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "vehicle_add_button": {
            "id": "vehicle_add_button",
            "type": "html",
            "content": "<div id=\"vehicle-add-container\" style=\"display: none;\"><button type=\"button\" class=\"btn btn-primary\" onclick=\"addVehicle()\">Add Vehicle</button></div>",
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "has_vehicles",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            }
        },
        "vehicles": {
            "id": "vehicles",
            "type": "repeater",
            "name": "vehicles",
            "label": "Vehicle Information",
            "minItems": 0,
            "maxItems": 50,
            "buttonText": "Add Another Vehicle",
            "fields": [
                {
                    "id": "vehicle_year",
                    "type": "number",
                    "name": "vehicle_year",
                    "label": "Year",
                    "required": true,
                    "validation": {
                        "min": 1900,
                        "max": 2025
                    }
                },
                {
                    "id": "vehicle_make",
                    "type": "text",
                    "name": "vehicle_make",
                    "label": "Make",
                    "placeholder": "e.g., Ford",
                    "required": true
                },
                {
                    "id": "vehicle_model",
                    "type": "text",
                    "name": "vehicle_model",
                    "label": "Model",
                    "placeholder": "e.g., F-150",
                    "required": true
                },
                {
                    "id": "vehicle_vin",
                    "type": "text",
                    "name": "vehicle_vin",
                    "label": "VIN",
                    "placeholder": "Vehicle Identification Number",
                    "required": true
                },
                {
                    "id": "vehicle_use",
                    "type": "select",
                    "name": "vehicle_use",
                    "label": "Primary Use",
                    "required": true,
                    "options": [
                        {"value": "", "label": "Select Use"},
                        {"value": "business", "label": "Business Use Only"},
                        {"value": "personal", "label": "Personal Use"},
                        {"value": "mixed", "label": "Mixed Business/Personal"},
                        {"value": "delivery", "label": "Delivery"},
                        {"value": "transport", "label": "Employee Transport"}
                    ]
                },
                {
                    "id": "vehicle_radius",
                    "type": "select",
                    "name": "vehicle_radius",
                    "label": "Radius of Operation",
                    "required": true,
                    "options": [
                        {"value": "local", "label": "Local (< 50 miles)"},
                        {"value": "intermediate", "label": "Intermediate (50-200 miles)"},
                        {"value": "long", "label": "Long Distance (> 200 miles)"}
                    ]
                }
            ]
        },
        "has_safety_program": {
            "id": "has_safety_program",
            "type": "radio",
            "name": "has_safety_program",
            "label": "Do you have a written safety program?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"},
                {"value": "developing", "label": "Currently Developing"}
            ]
        },
        "safety_program_details": {
            "id": "safety_program_details",
            "type": "textarea",
            "name": "safety_program_details",
            "label": "Describe Your Safety Program",
            "placeholder": "Include details about training, procedures, and enforcement",
            "display": {
                "rows": 3
            }
        },
        "safety_meetings_frequency": {
            "id": "safety_meetings_frequency",
            "type": "select",
            "name": "safety_meetings_frequency",
            "label": "How often do you hold safety meetings?",
            "options": [
                {"value": "", "label": "Select frequency"},
                {"value": "weekly", "label": "Weekly"},
                {"value": "biweekly", "label": "Bi-Weekly"},
                {"value": "monthly", "label": "Monthly"},
                {"value": "quarterly", "label": "Quarterly"},
                {"value": "never", "label": "No Regular Meetings"}
            ]
        },
        "safety_certifications": {
            "id": "safety_certifications",
            "type": "checkbox",
            "name": "safety_certifications",
            "label": "Safety Certifications (check all that apply)",
            "options": [
                {"value": "osha_10", "label": "OSHA 10-Hour"},
                {"value": "osha_30", "label": "OSHA 30-Hour"},
                {"value": "first_aid", "label": "First Aid/CPR"},
                {"value": "forklift", "label": "Forklift Certification"},
                {"value": "hazmat", "label": "HAZMAT"},
                {"value": "other", "label": "Other Certifications"}
            ]
        },
        "work_at_heights": {
            "id": "work_at_heights",
            "type": "radio",
            "name": "work_at_heights",
            "label": "Do employees work at heights above 6 feet?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "height_details": {
            "id": "height_details",
            "type": "text",
            "name": "height_details",
            "label": "Maximum working height",
            "placeholder": "e.g., 20 feet",
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "work_at_heights",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            }
        },
        "hazardous_materials": {
            "id": "hazardous_materials",
            "type": "radio",
            "name": "hazardous_materials",
            "label": "Do you handle hazardous materials?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "hazmat_details": {
            "id": "hazmat_details",
            "type": "textarea",
            "name": "hazmat_details",
            "label": "List hazardous materials",
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "hazardous_materials",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            }
        },
        "heavy_machinery": {
            "id": "heavy_machinery",
            "type": "radio",
            "name": "heavy_machinery",
            "label": "Do employees operate heavy machinery?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "machinery_types": {
            "id": "machinery_types",
            "type": "textarea",
            "name": "machinery_types",
            "label": "Types of machinery operated",
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "heavy_machinery",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            }
        },
        "prior_coverage": {
            "id": "prior_coverage",
            "type": "radio",
            "name": "prior_coverage",
            "label": "Have you had workers comp coverage before?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "prior_carrier": {
            "id": "prior_carrier",
            "type": "text",
            "name": "prior_carrier",
            "label": "Previous Insurance Carrier",
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "prior_coverage",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            }
        },
        "claims_past_5_years": {
            "id": "claims_past_5_years",
            "type": "number",
            "name": "claims_past_5_years",
            "label": "Number of claims in past 5 years",
            "required": true,
            "validation": {
                "min": 0
            }
        },
        "total_claims_amount": {
            "id": "total_claims_amount",
            "type": "number",
            "name": "total_claims_amount",
            "label": "Total amount of all claims",
            "display": {
                "prefix": "$"
            },
            "visibility": {
                "condition": "all",
                "rules": [
                    {
                        "field": "claims_past_5_years",
                        "operator": "greaterThan",
                        "value": 0
                    }
                ]
            }
        },
        "claims_details": {
            "id": "claims_details",
            "type": "repeater",
            "name": "claims_details",
            "label": "Claim Details",
            "helpText": "Please provide details for each claim",
            "minItems": 1,
            "buttonText": "Add Claim",
            "fields": [
                {
                    "id": "claim_date",
                    "type": "date",
                    "name": "claim_date",
                    "label": "Date of Claim"
                },
                {
                    "id": "claim_description",
                    "type": "textarea",
                    "name": "claim_description",
                    "label": "Description of Claim"
                },
                {
                    "id": "claim_amount",
                    "type": "number",
                    "name": "claim_amount",
                    "label": "Claim Amount",
                    "display": {"prefix": "$"}
                },
                {
                    "id": "claim_status",
                    "type": "select",
                    "name": "claim_status",
                    "label": "Status",
                    "options": [
                        {"value": "open", "label": "Open"},
                        {"value": "closed", "label": "Closed"},
                        {"value": "litigation", "label": "In Litigation"}
                    ]
                }
            ]
        },
        "requested_effective_date": {
            "id": "requested_effective_date",
            "type": "date",
            "name": "requested_effective_date",
            "label": "Requested Effective Date",
            "required": true,
            "validation": {
                "min": "today"
            }
        },
        "coverage_limit_preference": {
            "id": "coverage_limit_preference",
            "type": "select",
            "name": "coverage_limit_preference",
            "label": "Coverage Limit Preference",
            "required": true,
            "options": [
                {"value": "state_minimum", "label": "State Minimum"},
                {"value": "1000000", "label": "$1,000,000"},
                {"value": "2000000", "label": "$2,000,000"},
                {"value": "5000000", "label": "$5,000,000"},
                {"value": "other", "label": "Other Amount"}
            ]
        },
        "deductible_preference": {
            "id": "deductible_preference",
            "type": "number",
            "name": "deductible_preference",
            "label": "Deductible Preference",
            "required": true,
            "placeholder": "Enter amount",
            "display": {
                "prefix": "$"
            },
            "validation": {
                "min": 0,
                "max": 25000,
                "step": 1000
            }
        },
        "additional_coverages": {
            "id": "additional_coverages",
            "type": "checkbox",
            "name": "additional_coverages",
            "label": "Additional Coverages Requested",
            "options": [
                {"value": "employers_liability", "label": "Employers Liability"},
                {"value": "usl_h", "label": "USL&H Coverage"},
                {"value": "voluntary_comp", "label": "Voluntary Compensation"},
                {"value": "foreign_coverage", "label": "Foreign Coverage"},
                {"value": "stop_gap", "label": "Stop Gap Coverage"}
            ]
        },
        "special_requirements": {
            "id": "special_requirements",
            "type": "textarea",
            "name": "special_requirements",
            "label": "Special Requirements or Additional Information",
            "placeholder": "Please provide any additional information that might be relevant to your application",
            "display": {
                "rows": 4
            }
        },
        "financial_statements": {
            "id": "financial_statements",
            "type": "file",
            "name": "financial_statements",
            "label": "Financial Statements (Last 3 Years)",
            "accept": ".pdf,.doc,.docx,.xls,.xlsx",
            "multiple": true,
            "maxSize": 10485760,
            "helpText": "Upload PDF or Excel files, max 10MB each"
        },
        "safety_manual": {
            "id": "safety_manual",
            "type": "file",
            "name": "safety_manual",
            "label": "Safety Manual / Safety Program",
            "accept": ".pdf,.doc,.docx",
            "maxSize": 10485760
        },
        "loss_runs": {
            "id": "loss_runs",
            "type": "file",
            "name": "loss_runs",
            "label": "Loss Runs (5 Years)",
            "accept": ".pdf,.doc,.docx,.xls,.xlsx",
            "multiple": true,
            "maxSize": 10485760,
            "required": true
        },
        "other_documents": {
            "id": "other_documents",
            "type": "file",
            "name": "other_documents",
            "label": "Other Supporting Documents",
            "accept": ".pdf,.doc,.docx,.jpg,.jpeg,.png",
            "multiple": true,
            "maxSize": 10485760
        },
        "authorization_info": {
            "id": "authorization_info",
            "type": "paragraph",
            "content": "By signing below, I certify that the information provided in this application is true and complete to the best of my knowledge. I understand that any misrepresentation or omission of facts may result in denial of coverage or cancellation of any policy issued based on this application."
        },
        "authorized_person": {
            "id": "authorized_person",
            "type": "text",
            "name": "authorized_person",
            "label": "Authorized Representative Name",
            "required": true
        },
        "authorized_title": {
            "id": "authorized_title",
            "type": "text",
            "name": "authorized_title",
            "label": "Title",
            "required": true
        },
        "signature_pad": {
            "id": "signature_pad",
            "type": "text",
            "name": "signature",
            "label": "Digital Signature",
            "placeholder": "Type your full name as signature",
            "required": true,
            "helpText": "Please type your full name to serve as your digital signature"
        },
        "signature_date": {
            "id": "signature_date",
            "type": "date",
            "name": "signature_date",
            "label": "Date",
            "required": true,
            "defaultValue": "today",
            "readonly": true
        }
    },
    "logic": [
        {
            "id": "rule1",
            "name": "Show height details when working at heights",
            "trigger": {
                "type": "field",
                "conditions": [
                    {
                        "field": "work_at_heights",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            },
            "actions": [
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "height_details"
                }
            ]
        },
        {
            "id": "rule2",
            "name": "Show vehicle section when has vehicles",
            "trigger": {
                "type": "field",
                "conditions": [
                    {
                        "field": "has_vehicles",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            },
            "actions": [
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "section_vehicles"
                },
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "vehicle_add_button"
                }
            ]
        },
        {
            "id": "rule3",
            "name": "Show claims details when claims > 0",
            "trigger": {
                "type": "field",
                "conditions": [
                    {
                        "field": "claims_past_5_years",
                        "operator": "greaterThan",
                        "value": 0
                    }
                ]
            },
            "actions": [
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "section_claims_details"
                },
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "total_claims_amount"
                }
            ]
        },
        {
            "id": "rule4",
            "name": "Show prior carrier when had coverage",
            "trigger": {
                "type": "field",
                "conditions": [
                    {
                        "field": "prior_coverage",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            },
            "actions": [
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "prior_carrier"
                }
            ]
        },
        {
            "id": "rule5",
            "name": "Show hazmat details when handling hazardous materials",
            "trigger": {
                "type": "field",
                "conditions": [
                    {
                        "field": "hazardous_materials",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            },
            "actions": [
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "hazmat_details"
                }
            ]
        },
        {
            "id": "rule6",
            "name": "Show machinery types when using heavy machinery",
            "trigger": {
                "type": "field",
                "conditions": [
                    {
                        "field": "heavy_machinery",
                        "operator": "equals",
                        "value": "yes"
                    }
                ]
            },
            "actions": [
                {
                    "type": "visibility",
                    "action": "show",
                    "target": "machinery_types"
                }
            ]
        }
    ],
    "calculations": [
        {
            "id": "calc1",
            "name": "Validate employee counts",
            "target": "total_employees",
            "formula": "{full_time_employees} + {part_time_employees} + {seasonal_employees}",
            "trigger": "onChange",
            "dependencies": ["full_time_employees", "part_time_employees", "seasonal_employees"]
        }
    ],
    "settings": {
        "allowSaveDraft": true,
        "autoSave": true,
        "autoSaveInterval": 30000,
        "showProgressBar": true,
        "progressBarPosition": "top",
        "confirmOnExit": true,
        "submitButtonText": "Submit Application",
        "saveButtonText": "Save as Draft",
        "navigationMode": "tabs",
        "validationMode": "onBlur",
        "scrollToError": true,
        "requiredIndicator": "*",
        "helpTextPosition": "below"
    }
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Verify the update
SELECT 
    form_id,
    title,
    jsonb_array_length(form_schema -> 'pages') as page_count,
    jsonb_object_keys(form_schema -> 'fields') as field_names
FROM form_schemas 
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1'
LIMIT 5;