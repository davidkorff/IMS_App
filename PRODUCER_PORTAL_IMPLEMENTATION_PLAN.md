# Producer Portal Implementation Plan for IMS Application

## Overview
This document outlines the implementation plan for adding a Producer Portal feature to the IMS Application, allowing MGAs to create and manage broker portals for submission intake, rating, and policy binding.

## Architecture Overview
The Producer Portal will be built as an extension of the existing Custom Routes system, leveraging the current subdomain infrastructure (e.g., `mga.42ims.com`, `ascot.42ims.com`).

## Phase 1: Core Producer Portal Features (12 Weeks)

### 1. Extend Custom Routes System (Weeks 1-2)

#### Database Schema Extensions
```sql
-- Producer portal configuration (extends existing subdomain system)
CREATE TABLE producer_portal_config (
    config_id INT PRIMARY KEY IDENTITY,
    instance_id INT NOT NULL,
    portal_name VARCHAR(255),
    -- Uses existing subdomain from ims_instances table
    logo_url VARCHAR(500),
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    custom_css TEXT,
    welcome_message TEXT,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Producer management
CREATE TABLE producers (
    producer_id INT PRIMARY KEY IDENTITY,
    instance_id INT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    agency_name VARCHAR(255),
    phone VARCHAR(20),
    ims_producer_guid VARCHAR(36),
    ims_producer_contact_guid VARCHAR(36),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, suspended
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    last_login DATETIME,
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Producer sessions
CREATE TABLE producer_sessions (
    session_id INT PRIMARY KEY IDENTITY,
    producer_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
);

-- Link submissions to producers
CREATE TABLE producer_submissions (
    id INT PRIMARY KEY IDENTITY,
    submission_id INT NOT NULL,
    producer_id INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (submission_id) REFERENCES custom_route_submissions(submission_id),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
);

-- Lines of business configuration
CREATE TABLE portal_lines_of_business (
    lob_id INT PRIMARY KEY IDENTITY,
    instance_id INT NOT NULL,
    line_name VARCHAR(255),
    ims_line_guid VARCHAR(36),
    rater_template_path VARCHAR(500),
    rater_config TEXT, -- JSON stored as TEXT for SQL Server compatibility
    min_premium DECIMAL(10,2),
    max_premium DECIMAL(10,2),
    auto_bind_limit DECIMAL(10,2),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Enhance custom_routes table
ALTER TABLE custom_routes ADD route_category VARCHAR(50) DEFAULT 'general';
ALTER TABLE custom_routes ADD producer_access_level VARCHAR(50) DEFAULT 'all'; -- all, approved, specific
ALTER TABLE custom_routes ADD rater_config TEXT; -- JSON for rater field mappings
ALTER TABLE custom_routes ADD lob_id INT NULL;
ALTER TABLE custom_routes ADD FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);
```

#### Key Features
- Multi-step form support with progress tracking
- Conditional logic for dynamic form fields
- File upload capabilities
- Save & resume functionality
- Real-time premium calculation

### 2. Producer Authentication & Management (Weeks 3-4)

#### API Endpoints
```
/api/producer/
  POST   /register          - Producer self-registration
  POST   /login            - Producer login
  POST   /logout           - Producer logout  
  POST   /forgot-password  - Password reset request
  POST   /reset-password   - Password reset completion
  GET    /profile          - Get producer profile
  PUT    /profile          - Update producer profile
  
/api/producer/admin/
  GET    /producers        - List all producers (MGA admin)
  PUT    /producers/:id    - Update producer status
  POST   /producers/:id/approve - Approve producer
  POST   /producers/:id/suspend - Suspend producer
```

#### Features
- Self-registration with email verification
- MGA approval workflow
- Secure password management
- JWT-based authentication
- Producer dashboard with submission history

### 3. Enhanced Form Builder (Weeks 5-6)

#### Admin Interface Features
- Visual drag-and-drop form designer
- Field types:
  - Text, Number, Email, Phone
  - Dropdown, Radio, Checkbox
  - Date picker
  - File upload
  - Address autocomplete
  - Signature pad
- Field configuration:
  - Required/Optional
  - Validation rules
  - Conditional display logic
  - Help text
  - Default values
- IMS field mapping interface
- Preview mode for testing

#### Form Configuration Schema
```javascript
{
  "form_config": {
    "steps": [
      {
        "title": "Business Information",
        "fields": [
          {
            "name": "business_name",
            "type": "text",
            "label": "Business Name",
            "required": true,
            "ims_mapping": "insured.corporationName"
          },
          {
            "name": "business_type",
            "type": "select",
            "label": "Business Type",
            "options": ["LLC", "Corporation", "Partnership"],
            "required": true,
            "ims_mapping": "insured.businessTypeId",
            "value_mapping": {
              "LLC": 9,
              "Corporation": 13,
              "Partnership": 2
            }
          }
        ]
      },
      {
        "title": "Coverage Information",
        "fields": [
          {
            "name": "coverage_limit",
            "type": "select",
            "label": "Coverage Limit",
            "options": ["$1M/$2M", "$2M/$4M"],
            "required": true,
            "triggers_calculation": true
          }
        ]
      }
    ]
  }
}
```

### 4. Excel Rater Integration (Weeks 7-8)

#### Improvements from POC
- Server-side formula calculation before sending to IMS
- Template versioning and management
- Field mapping configuration UI
- Error handling and validation
- Premium display without page reload

#### Rater Service Enhancements
```javascript
// New service structure
class RaterService {
  // Calculate formulas before IMS submission
  async calculatePremium(templatePath, formData) {
    // 1. Load template
    // 2. Populate data
    // 3. Calculate formulas using ExcelJS or similar
    // 4. Extract premium value
    // 5. Return calculated workbook
  }
  
  // Cache calculated templates
  async getCachedTemplate(templateId, version) {
    // Return pre-calculated base template
  }
  
  // Version management
  async uploadNewTemplate(file, metadata) {
    // Store with version tracking
  }
}
```

### 5. White Labeling Support (Weeks 9-10)

#### Portal Customization
- Use existing subdomain system (instance.42ims.com)
- Customizable elements:
  - Logo upload
  - Color scheme (primary, secondary, accent)
  - Custom CSS injection
  - Email templates
  - Welcome/help text
  - Footer information

#### Implementation
```javascript
// Middleware to load portal config based on subdomain
app.use(async (req, res, next) => {
  const subdomain = req.hostname.split('.')[0];
  const portalConfig = await getPortalConfig(subdomain);
  req.portalConfig = portalConfig;
  res.locals.portalConfig = portalConfig; // For views
  next();
});
```

### 6. Testing & Deployment (Weeks 11-12)
- Unit testing for all new services
- Integration testing with IMS
- UAT with selected MGAs
- Performance testing
- Security audit
- Production deployment

## Phase 2: Advanced Features (Future)

### Document Management
- Policy document repository
- Endorsement requests
- Certificate generation
- Document versioning

### Communication Hub
- In-portal messaging system
- Email notifications
- SMS alerts
- Underwriter notes and feedback

### Analytics & Reporting
- Submission metrics dashboard
- Conversion funnel analysis
- Producer performance reports
- Premium volume tracking
- Custom report builder

### Advanced Integrations
- Payment gateway integration
- E-signature integration
- Third-party data sources (D&B, etc.)
- Accounting system sync

## Technical Implementation Notes

### Subdomain Routing
The application already supports subdomain-based routing. Producer portals will use:
- Pattern: `{instance-name}.42ims.com/producer/*`
- Example: `ascot.42ims.com/producer/login`

### Security Considerations
- Separate auth system for producers vs MGA users
- Rate limiting on API endpoints
- File upload scanning
- Input sanitization
- CORS configuration per subdomain

### Performance Optimizations
- Redis for session management
- CDN for static assets
- Database query optimization
- Lazy loading for large forms
- Premium calculation caching

### Integration Points with IMS
1. **Authentication**: Use IMS LoginIMSUser for MGA users only
2. **Producer Management**: Link to IMS producer records
3. **Submission Flow**:
   - ClearInsured
   - AddInsuredWithLocation
   - AddSubmission
   - AddQuoteWithAutoCalculateDetails
   - ImportExcelRater (with pre-calculated formulas)
   - BindQuote (if auto-bind conditions met)

## Migration from BrokerPortal3 POC

### Reusable Components
- IMS service integration layer
- Form validation logic
- Basic submission workflow

### Components to Rebuild
- Authentication system (integrate with IMS Application)
- Excel processing (fix formula calculation issues)
- UI/UX (match IMS Application design)

### Data Migration
- Producer accounts
- Historical submissions
- Rater templates

## Success Metrics
- Number of active producer portals
- Submissions per month
- Average time to quote
- Auto-bind rate
- Producer adoption rate
- System uptime

## Risks and Mitigation
1. **Excel Formula Calculation**: Use proven libraries, extensive testing
2. **Performance at Scale**: Implement caching, optimize queries
3. **Security**: Regular audits, penetration testing
4. **IMS API Changes**: Version checking, error handling
5. **Browser Compatibility**: Test across browsers, progressive enhancement

## End User Features Summary

### For Producers
- Self-service registration and login
- Access multiple products from one portal
- Smart forms with real-time validation
- Document upload capability
- Instant premium calculations
- Save and resume quotes
- Track submission status
- Download policy documents
- Communication with underwriters

### For MGAs
- Visual form builder
- Product configuration
- Producer management
- Automated workflows
- Custom branding
- Real-time analytics
- Excel rater management
- Approval workflows

### For Insureds (if enabled)
- Direct quote access
- Simple guided forms
- Immediate pricing
- Online binding
- Document delivery