-- Sample Workers' Compensation Insurance Form Schema
-- This form demonstrates all field types and typical insurance scenarios

-- First, let's create the form schema
INSERT INTO form_schemas (
    form_id,
    instance_id,
    lob_id,
    schema_version,
    title,
    description,
    form_schema,
    is_active,
    is_template,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    4,  -- Your instance ID
    4,  -- Your LOB ID for test1
    '1.0',
    'Workers Compensation Application',
    'Comprehensive application form for Workers Compensation insurance',
    '{
        "id": "wc_form_001",
        "version": "1.0",
        "metadata": {
            "title": "Workers Compensation Application",
            "description": "Complete application for Workers Compensation insurance coverage",
            "lineOfBusiness": "test1",
            "createdAt": "2025-01-07T10:00:00Z",
            "updatedAt": "2025-01-07T10:00:00Z"
        },
        "pages": [
            {
                "id": "page1",
                "title": "Business Information",
                "description": "Basic information about your business",
                "order": 1,
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
                            {"type": "field", "fieldId": "business_address"}
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
                "title": "Employee Information",
                "description": "Details about your employees and payroll",
                "order": 2,
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
                        "type": "repeater",
                        "title": "Job Classifications",
                        "description": "Add each job classification in your business",
                        "repeatable": true,
                        "minRepeat": 1,
                        "maxRepeat": 20,
                        "items": [
                            {"type": "field", "fieldId": "class_code"},
                            {"type": "field", "fieldId": "class_description"},
                            {"type": "field", "fieldId": "num_employees"},
                            {"type": "field", "fieldId": "annual_payroll_class"},
                            {"type": "field", "fieldId": "hourly_rate_range"}
                        ]
                    }
                ]
            },
            {
                "id": "page3",
                "title": "Safety & Risk Management",
                "description": "Information about your safety programs and procedures",
                "order": 3,
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
                            {"type": "field", "fieldId": "machinery_types"},
                            {"type": "field", "fieldId": "driver_requirements"},
                            {"type": "field", "fieldId": "fleet_size"}
                        ]
                    }
                ]
            },
            {
                "id": "page4",
                "title": "Claims History",
                "description": "Previous workers compensation claims",
                "order": 4,
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
                        "type": "conditional",
                        "title": "Claims Details",
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
                            {"type": "field", "fieldId": "claims_details_table"}
                        ]
                    }
                ]
            },
            {
                "id": "page5",
                "title": "Additional Information",
                "description": "Final details and document uploads",
                "order": 5,
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
                            {"type": "field", "fieldId": "authorization_text"},
                            {"type": "field", "fieldId": "authorized_person"},
                            {"type": "field", "fieldId": "authorized_title"},
                            {"type": "field", "fieldId": "signature"},
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
                    "pattern": "^\\d{2}-\\d{7}$",
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
                "type": "url",
                "name": "website",
                "label": "Website",
                "placeholder": "https://www.yourbusiness.com",
                "required": false
            },
            "business_address": {
                "id": "business_address",
                "type": "address",
                "name": "business_address",
                "label": "Primary Business Address",
                "required": true,
                "includeFields": ["street", "street2", "city", "state", "zip"]
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
                "type": "toggle",
                "name": "contractors_1099",
                "label": "Do you use 1099 contractors?",
                "required": true
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
            "class_code": {
                "id": "class_code",
                "type": "text",
                "name": "class_code",
                "label": "Class Code",
                "placeholder": "e.g., 5403",
                "helpText": "Enter the workers comp class code if known"
            },
            "class_description": {
                "id": "class_description",
                "type": "text",
                "name": "class_description",
                "label": "Job Description",
                "placeholder": "e.g., Carpentry",
                "required": true
            },
            "num_employees": {
                "id": "num_employees",
                "type": "number",
                "name": "num_employees",
                "label": "Number of Employees",
                "required": true,
                "validation": {
                    "min": 1
                }
            },
            "annual_payroll_class": {
                "id": "annual_payroll_class",
                "type": "number",
                "name": "annual_payroll_class",
                "label": "Annual Payroll for this Class",
                "required": true,
                "display": {
                    "prefix": "$"
                }
            },
            "hourly_rate_range": {
                "id": "hourly_rate_range",
                "type": "text",
                "name": "hourly_rate_range",
                "label": "Hourly Rate Range",
                "placeholder": "e.g., $15-$25/hour"
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
                "type": "toggle",
                "name": "work_at_heights",
                "label": "Do employees work at heights above 6 feet?",
                "required": true
            },
            "height_details": {
                "id": "height_details",
                "type": "text",
                "name": "height_details",
                "label": "Maximum working height",
                "placeholder": "e.g., 20 feet",
                "display": {
                    "condition": {
                        "field": "work_at_heights",
                        "value": true
                    }
                }
            },
            "hazardous_materials": {
                "id": "hazardous_materials",
                "type": "toggle",
                "name": "hazardous_materials",
                "label": "Do you handle hazardous materials?",
                "required": true
            },
            "hazmat_details": {
                "id": "hazmat_details",
                "type": "textarea",
                "name": "hazmat_details",
                "label": "List hazardous materials",
                "display": {
                    "condition": {
                        "field": "hazardous_materials",
                        "value": true
                    }
                }
            },
            "heavy_machinery": {
                "id": "heavy_machinery",
                "type": "toggle",
                "name": "heavy_machinery",
                "label": "Do employees operate heavy machinery?",
                "required": true
            },
            "machinery_types": {
                "id": "machinery_types",
                "type": "textarea",
                "name": "machinery_types",
                "label": "Types of machinery operated",
                "display": {
                    "condition": {
                        "field": "heavy_machinery",
                        "value": true
                    }
                }
            },
            "driver_requirements": {
                "id": "driver_requirements",
                "type": "toggle",
                "name": "driver_requirements",
                "label": "Do employees drive as part of their job?",
                "required": true
            },
            "fleet_size": {
                "id": "fleet_size",
                "type": "number",
                "name": "fleet_size",
                "label": "Number of company vehicles",
                "validation": {
                    "min": 0
                },
                "display": {
                    "condition": {
                        "field": "driver_requirements",
                        "value": true
                    }
                }
            },
            "prior_coverage": {
                "id": "prior_coverage",
                "type": "toggle",
                "name": "prior_coverage",
                "label": "Have you had workers comp coverage before?",
                "required": true
            },
            "prior_carrier": {
                "id": "prior_carrier",
                "type": "text",
                "name": "prior_carrier",
                "label": "Previous Insurance Carrier",
                "display": {
                    "condition": {
                        "field": "prior_coverage",
                        "value": true
                    }
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
                    "prefix": "$",
                    "condition": {
                        "field": "claims_past_5_years",
                        "operator": "greaterThan",
                        "value": 0
                    }
                }
            },
            "claims_details_table": {
                "id": "claims_details_table",
                "type": "repeater",
                "name": "claims_details",
                "label": "Claim Details",
                "helpText": "Please provide details for each claim",
                "repeatable": true,
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
                        "display": {
                            "prefix": "$"
                        }
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
                "type": "slider",
                "name": "deductible_preference",
                "label": "Deductible Preference",
                "required": true,
                "validation": {
                    "min": 0,
                    "max": 25000,
                    "step": 1000
                },
                "display": {
                    "prefix": "$",
                    "showValue": true
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
            "authorization_text": {
                "id": "authorization_text",
                "type": "html",
                "name": "authorization_text",
                "content": "<div style=\"border: 1px solid #ddd; padding: 15px; background: #f5f5f5; margin-bottom: 15px;\"><p><strong>Authorization and Agreement</strong></p><p>I hereby certify that the information provided in this application is true and complete to the best of my knowledge. I understand that any misrepresentation or omission of facts may result in denial of coverage or cancellation of any policy issued based on this application.</p><p>I authorize the insurance company and its representatives to verify all information provided and to obtain additional information as necessary for underwriting purposes.</p></div>"
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
            "signature": {
                "id": "signature",
                "type": "signature",
                "name": "signature",
                "label": "Digital Signature",
                "required": true,
                "helpText": "Please sign using your mouse or touchscreen"
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
                    "conditions": [{
                        "field": "work_at_heights",
                        "operator": "equals",
                        "value": true
                    }]
                },
                "actions": [{
                    "type": "visibility",
                    "action": "show",
                    "target": "height_details"
                }]
            },
            {
                "id": "rule2",
                "name": "Show claims table when claims > 0",
                "trigger": {
                    "type": "field",
                    "conditions": [{
                        "field": "claims_past_5_years",
                        "operator": "greaterThan",
                        "value": 0
                    }]
                },
                "actions": [{
                    "type": "visibility",
                    "action": "show",
                    "target": "section_claims_details"
                }]
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
    true,  -- is_active
    false, -- is_template
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) RETURNING form_id;

-- Now update the LOB to link to this form
UPDATE portal_lines_of_business 
SET form_schema_id = (
    SELECT form_id 
    FROM form_schemas 
    WHERE lob_id = 4 
    AND instance_id = 4 
    ORDER BY created_at DESC 
    LIMIT 1
)
WHERE lob_id = 4;