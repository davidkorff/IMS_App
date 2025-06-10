// Custom Routes Form Builder
class FormBuilder {
    constructor() {
        this.instanceId = this.getInstanceId();
        this.routeId = this.getRouteId();
        this.isNewRoute = !this.routeId;
        
        this.fields = [];
        this.currentStep = 1;
        this.totalSteps = 1;
        this.selectedField = null;
        this.fieldIdCounter = 1;
        
        this.route = {
            name: '',
            slug: '',
            description: '',
            is_active: true,
            form_config: {
                steps: 1,
                save_progress: false,
                show_step_indicator: true,
                require_confirmation: false,
                success_message: 'Thank you for your submission. We will review it and get back to you soon.',
                redirect_url: ''
            },
            workflow_config: {
                auto_process: false,
                require_approval: true,
                auto_bind: false,
                notify_emails: '',
                default_underwriter: ''
            },
            ims_config: {
                default_company_line: '',
                default_producer: '',
                default_billing_type: '1',
                default_policy_type: '1',
                default_term_length: '12'
            },
            rater_config: {
                rater_name: '',
                rater_file_path: '',
                auto_calculate: true,
                max_premium_auto_bind: null,
                exclude_class_codes: ''
            }
        };

        this.init();
    }

    getInstanceId() {
        const path = window.location.pathname;
        const matches = path.match(/\/instance\/(\d+)/);
        return matches ? parseInt(matches[1]) : null;
    }

    getRouteId() {
        const path = window.location.pathname;
        const matches = path.match(/\/custom-routes\/(\d+)/);
        return matches ? parseInt(matches[1]) : null;
    }

    async init() {
        // Check authentication
        if (!window.authUtils || !window.authUtils.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }

        this.setupEventListeners();
        this.setupDragAndDrop();
        
        if (!this.isNewRoute) {
            await this.loadRoute();
        } else {
            this.updateStepIndicator();
        }

        await this.loadIMSConfiguration();
        this.bindFormControls();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backToRoutes').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `/instance/${this.instanceId}/custom-routes`;
        });

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            window.authUtils.logout();
        });

        // Route actions
        document.getElementById('saveRouteBtn').addEventListener('click', () => {
            this.saveRoute();
        });

        document.getElementById('previewRouteBtn').addEventListener('click', () => {
            this.previewRoute();
        });

        // Step navigation
        document.getElementById('addStepBtn').addEventListener('click', () => {
            this.addStep();
        });

        document.getElementById('prevStepBtn').addEventListener('click', () => {
            this.navigateStep(-1);
        });

        document.getElementById('nextStepBtn').addEventListener('click', () => {
            this.navigateStep(1);
        });

        // Field properties
        document.getElementById('fieldLabel').addEventListener('input', () => {
            this.updateSelectedField();
        });

        document.getElementById('fieldName').addEventListener('input', () => {
            this.updateSelectedField();
        });

        document.getElementById('fieldPlaceholder').addEventListener('input', () => {
            this.updateSelectedField();
        });

        document.getElementById('fieldRequired').addEventListener('change', () => {
            this.updateSelectedField();
        });

        document.getElementById('imsMapping').addEventListener('change', () => {
            this.updateSelectedField();
        });

        document.getElementById('raterMapping').addEventListener('input', () => {
            this.updateSelectedField();
        });

        document.getElementById('deleteFieldBtn').addEventListener('click', () => {
            this.deleteSelectedField();
        });

        document.getElementById('addOptionBtn').addEventListener('click', () => {
            this.addOption();
        });

        // Route name to slug conversion
        document.getElementById('routeName').addEventListener('input', (e) => {
            const name = e.target.value;
            const slug = this.generateSlug(name);
            document.getElementById('routeSlug').value = slug;
            this.route.name = name;
            this.route.slug = slug;
        });

        document.getElementById('routeSlug').addEventListener('input', (e) => {
            this.route.slug = e.target.value;
        });

        document.getElementById('routeDescription').addEventListener('input', (e) => {
            this.route.description = e.target.value;
        });

        document.getElementById('routeStatus').addEventListener('change', (e) => {
            this.route.is_active = e.target.value === 'true';
        });
    }

    setupDragAndDrop() {
        const fieldTypes = document.querySelectorAll('.field-type-item');
        const fieldList = document.getElementById('fieldList');

        // Make field types draggable
        fieldTypes.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        // Make field list a drop zone
        fieldList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            fieldList.classList.add('dragover');
        });

        fieldList.addEventListener('dragleave', () => {
            fieldList.classList.remove('dragover');
        });

        fieldList.addEventListener('drop', (e) => {
            e.preventDefault();
            fieldList.classList.remove('dragover');
            
            const fieldType = e.dataTransfer.getData('text/plain');
            this.addField(fieldType);
        });
    }

    addField(type) {
        const field = {
            id: this.fieldIdCounter++,
            type: type,
            name: this.generateFieldName(type),
            label: this.generateFieldLabel(type),
            placeholder: '',
            required: false,
            step: this.currentStep,
            order: this.getFieldsInCurrentStep().length,
            options: [],
            ims_mapping: '',
            rater_mapping: '',
            validation: {},
            conditional_logic: null
        };

        // Add default options for select/radio/checkbox fields
        if (['select', 'radio', 'checkbox'].includes(type)) {
            field.options = [
                { label: 'Option 1', value: 'option1' },
                { label: 'Option 2', value: 'option2' }
            ];
        }

        this.fields.push(field);
        this.renderFields();
        this.selectField(field);
    }

    generateFieldName(type) {
        const baseName = type.replace('-', '_');
        const existing = this.fields.filter(f => f.name.startsWith(baseName));
        return existing.length > 0 ? `${baseName}_${existing.length + 1}` : baseName;
    }

    generateFieldLabel(type) {
        const labels = {
            'text': 'Text Input',
            'email': 'Email Address',
            'phone': 'Phone Number',
            'number': 'Number',
            'select': 'Dropdown',
            'radio': 'Radio Group',
            'checkbox': 'Checkboxes',
            'textarea': 'Text Area',
            'date': 'Date',
            'file': 'File Upload',
            'address': 'Address',
            'producer-lookup': 'Producer Lookup'
        };
        return labels[type] || 'Field';
    }

    generateSlug(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }

    renderFields() {
        const fieldList = document.getElementById('fieldList');
        const currentStepFields = this.getFieldsInCurrentStep();

        if (currentStepFields.length === 0) {
            fieldList.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-mouse-pointer fa-2x mb-3"></i>
                    <p>Drag field types from the left panel to build your form</p>
                </div>
            `;
            return;
        }

        fieldList.innerHTML = '';
        
        currentStepFields.forEach(field => {
            const fieldElement = this.createFieldElement(field);
            fieldList.appendChild(fieldElement);
        });
    }

    createFieldElement(field) {
        const template = document.getElementById('formFieldTemplate');
        const fieldElement = template.content.cloneNode(true);
        
        const container = fieldElement.querySelector('.form-field');
        container.dataset.fieldId = field.id;
        
        // Set field label
        const label = fieldElement.querySelector('.field-label');
        label.textContent = field.label;
        if (field.required) {
            label.innerHTML += ' <span class="text-danger">*</span>';
        }

        // Create field input based on type
        const inputContainer = fieldElement.querySelector('.field-input');
        inputContainer.appendChild(this.createFieldInput(field));

        // Event listeners
        container.addEventListener('click', () => {
            this.selectField(field);
        });

        fieldElement.querySelector('.edit-field').addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectField(field);
        });

        fieldElement.querySelector('.delete-field').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteField(field.id);
        });

        return fieldElement;
    }

    createFieldInput(field) {
        const input = document.createElement('div');
        
        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'number':
                input.innerHTML = `<input type="${field.type}" class="form-control" placeholder="${field.placeholder}" disabled>`;
                break;
                
            case 'textarea':
                input.innerHTML = `<textarea class="form-control" placeholder="${field.placeholder}" rows="3" disabled></textarea>`;
                break;
                
            case 'select':
                const options = field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
                input.innerHTML = `<select class="form-select" disabled>${options}</select>`;
                break;
                
            case 'radio':
                const radioOptions = field.options.map((opt, idx) => `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="radio_${field.id}" id="radio_${field.id}_${idx}" disabled>
                        <label class="form-check-label" for="radio_${field.id}_${idx}">${opt.label}</label>
                    </div>
                `).join('');
                input.innerHTML = radioOptions;
                break;
                
            case 'checkbox':
                const checkboxOptions = field.options.map((opt, idx) => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="checkbox_${field.id}_${idx}" disabled>
                        <label class="form-check-label" for="checkbox_${field.id}_${idx}">${opt.label}</label>
                    </div>
                `).join('');
                input.innerHTML = checkboxOptions;
                break;
                
            case 'date':
                input.innerHTML = `<input type="date" class="form-control" disabled>`;
                break;
                
            case 'file':
                input.innerHTML = `<input type="file" class="form-control" disabled>`;
                break;
                
            case 'address':
                input.innerHTML = `
                    <input type="text" class="form-control mb-2" placeholder="Address Line 1" disabled>
                    <input type="text" class="form-control mb-2" placeholder="Address Line 2" disabled>
                    <div class="row">
                        <div class="col-md-6">
                            <input type="text" class="form-control mb-2" placeholder="City" disabled>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select mb-2" disabled>
                                <option>State</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <input type="text" class="form-control mb-2" placeholder="ZIP" disabled>
                        </div>
                    </div>
                `;
                break;
                
            case 'producer-lookup':
                input.innerHTML = `
                    <div class="input-group">
                        <input type="text" class="form-control" placeholder="Search for producer..." disabled>
                        <button class="btn btn-outline-secondary" type="button" disabled>
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                `;
                break;
                
            default:
                input.innerHTML = `<input type="text" class="form-control" placeholder="${field.placeholder}" disabled>`;
        }
        
        return input;
    }

    selectField(field) {
        this.selectedField = field;
        
        // Update visual selection
        document.querySelectorAll('.form-field').forEach(el => {
            el.classList.remove('selected');
        });
        
        const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
        if (fieldElement) {
            fieldElement.classList.add('selected');
        }
        
        this.showFieldProperties(field);
    }

    showFieldProperties(field) {
        document.getElementById('noFieldSelected').style.display = 'none';
        document.getElementById('fieldProperties').style.display = 'block';
        
        // Populate property fields
        document.getElementById('fieldLabel').value = field.label;
        document.getElementById('fieldName').value = field.name;
        document.getElementById('fieldPlaceholder').value = field.placeholder;
        document.getElementById('fieldRequired').checked = field.required;
        document.getElementById('imsMapping').value = field.ims_mapping;
        document.getElementById('raterMapping').value = field.rater_mapping;
        
        // Show/hide options group
        const optionsGroup = document.getElementById('optionsGroup');
        if (['select', 'radio', 'checkbox'].includes(field.type)) {
            optionsGroup.style.display = 'block';
            this.renderOptions(field);
        } else {
            optionsGroup.style.display = 'none';
        }
    }

    renderOptions(field) {
        const optionsList = document.getElementById('optionsList');
        optionsList.innerHTML = '';
        
        field.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'input-group mb-2';
            optionDiv.innerHTML = `
                <input type="text" class="form-control option-label" value="${option.label}" data-index="${index}">
                <input type="text" class="form-control option-value" value="${option.value}" data-index="${index}" placeholder="Value">
                <button class="btn btn-outline-danger remove-option" type="button" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            optionsList.appendChild(optionDiv);
        });
        
        // Add event listeners
        optionsList.querySelectorAll('.option-label').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                field.options[index].label = e.target.value;
                this.renderFields();
            });
        });
        
        optionsList.querySelectorAll('.option-value').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                field.options[index].value = e.target.value;
            });
        });
        
        optionsList.querySelectorAll('.remove-option').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                field.options.splice(index, 1);
                this.renderOptions(field);
                this.renderFields();
            });
        });
    }

    addOption() {
        if (!this.selectedField) return;
        
        const optionNumber = this.selectedField.options.length + 1;
        this.selectedField.options.push({
            label: `Option ${optionNumber}`,
            value: `option${optionNumber}`
        });
        
        this.renderOptions(this.selectedField);
        this.renderFields();
    }

    updateSelectedField() {
        if (!this.selectedField) return;
        
        this.selectedField.label = document.getElementById('fieldLabel').value;
        this.selectedField.name = document.getElementById('fieldName').value;
        this.selectedField.placeholder = document.getElementById('fieldPlaceholder').value;
        this.selectedField.required = document.getElementById('fieldRequired').checked;
        this.selectedField.ims_mapping = document.getElementById('imsMapping').value;
        this.selectedField.rater_mapping = document.getElementById('raterMapping').value;
        
        this.renderFields();
    }

    deleteSelectedField() {
        if (!this.selectedField) return;
        
        this.deleteField(this.selectedField.id);
    }

    deleteField(fieldId) {
        this.fields = this.fields.filter(f => f.id !== fieldId);
        
        if (this.selectedField && this.selectedField.id === fieldId) {
            this.selectedField = null;
            document.getElementById('noFieldSelected').style.display = 'block';
            document.getElementById('fieldProperties').style.display = 'none';
        }
        
        this.renderFields();
    }

    getFieldsInCurrentStep() {
        return this.fields.filter(f => f.step === this.currentStep).sort((a, b) => a.order - b.order);
    }

    addStep() {
        this.totalSteps++;
        this.currentStep = this.totalSteps;
        this.updateStepIndicator();
        this.renderFields();
    }

    navigateStep(direction) {
        const newStep = this.currentStep + direction;
        if (newStep >= 1 && newStep <= this.totalSteps) {
            this.currentStep = newStep;
            this.updateStepIndicator();
            this.renderFields();
        }
    }

    updateStepIndicator() {
        const stepIndicator = document.getElementById('stepIndicator');
        const stepCounter = document.getElementById('stepCounter');
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        
        // Update step counter
        stepCounter.textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
        
        // Update navigation buttons
        prevBtn.disabled = this.currentStep === 1;
        nextBtn.disabled = this.currentStep === this.totalSteps;
        
        // Rebuild step indicator
        stepIndicator.innerHTML = '';
        for (let i = 1; i <= this.totalSteps; i++) {
            const stepItem = document.createElement('div');
            stepItem.className = `step-item ${i === this.currentStep ? 'active' : ''}`;
            stepItem.dataset.step = i;
            stepItem.innerHTML = `
                <div class="step-number">${i}</div>
                <div class="step-label">Step ${i}</div>
            `;
            
            stepItem.addEventListener('click', () => {
                this.currentStep = i;
                this.updateStepIndicator();
                this.renderFields();
            });
            
            stepIndicator.appendChild(stepItem);
        }
    }

    bindFormControls() {
        // Form configuration
        document.getElementById('saveProgress').addEventListener('change', (e) => {
            this.route.form_config.save_progress = e.target.checked;
        });
        
        document.getElementById('showStepIndicator').addEventListener('change', (e) => {
            this.route.form_config.show_step_indicator = e.target.checked;
        });
        
        document.getElementById('requireConfirmation').addEventListener('change', (e) => {
            this.route.form_config.require_confirmation = e.target.checked;
        });
        
        document.getElementById('successMessage').addEventListener('input', (e) => {
            this.route.form_config.success_message = e.target.value;
        });
        
        document.getElementById('redirectUrl').addEventListener('input', (e) => {
            this.route.form_config.redirect_url = e.target.value;
        });
        
        // Workflow configuration
        document.getElementById('autoProcess').addEventListener('change', (e) => {
            this.route.workflow_config.auto_process = e.target.checked;
        });
        
        document.getElementById('requireApproval').addEventListener('change', (e) => {
            this.route.workflow_config.require_approval = e.target.checked;
        });
        
        document.getElementById('autoBind').addEventListener('change', (e) => {
            this.route.workflow_config.auto_bind = e.target.checked;
        });
        
        document.getElementById('notifyEmails').addEventListener('input', (e) => {
            this.route.workflow_config.notify_emails = e.target.value;
        });
        
        // IMS configuration
        document.getElementById('defaultBillingType').addEventListener('change', (e) => {
            this.route.ims_config.default_billing_type = e.target.value;
        });
        
        document.getElementById('defaultPolicyType').addEventListener('change', (e) => {
            this.route.ims_config.default_policy_type = e.target.value;
        });
        
        document.getElementById('defaultTermLength').addEventListener('change', (e) => {
            this.route.ims_config.default_term_length = e.target.value;
        });
        
        // Rater configuration
        document.getElementById('raterName').addEventListener('input', (e) => {
            this.route.rater_config.rater_name = e.target.value;
        });
        
        document.getElementById('raterFilePath').addEventListener('input', (e) => {
            this.route.rater_config.rater_file_path = e.target.value;
        });
        
        document.getElementById('autoCalculate').addEventListener('change', (e) => {
            this.route.rater_config.auto_calculate = e.target.checked;
        });
        
        document.getElementById('maxPremium').addEventListener('input', (e) => {
            this.route.rater_config.max_premium_auto_bind = e.target.value ? parseFloat(e.target.value) : null;
        });
        
        document.getElementById('excludeClassCodes').addEventListener('input', (e) => {
            this.route.rater_config.exclude_class_codes = e.target.value;
        });
    }

    async loadRoute() {
        try {
            const response = await fetch(`/api/custom-routes/instance/${this.instanceId}/routes/${this.routeId}`, {
                headers: {
                    'Authorization': `Bearer ${window.authUtils.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load route');
            }

            const route = await response.json();
            this.populateRouteData(route);
            
        } catch (error) {
            console.error('Error loading route:', error);
            this.showError('Failed to load route');
        }
    }

    populateRouteData(route) {
        // Basic route info
        this.route = { ...this.route, ...route };
        document.getElementById('routeName').value = route.name;
        document.getElementById('routeSlug').value = route.slug;
        document.getElementById('routeDescription').value = route.description || '';
        document.getElementById('routeStatus').value = route.is_active.toString();

        // Load fields
        if (route.fields && route.fields.length > 0) {
            this.fields = route.fields.map(field => ({
                ...field,
                id: this.fieldIdCounter++
            }));
            
            // Determine total steps
            this.totalSteps = Math.max(...this.fields.map(f => f.step_number || 1));
            this.currentStep = 1;
        }

        // Populate configuration tabs
        this.populateFormConfig(route.form_config);
        this.populateWorkflowConfig(route.workflow_config);
        this.populateIMSConfig(route.ims_config);
        this.populateRaterConfig(route.rater_config);

        this.updateStepIndicator();
        this.renderFields();
    }

    populateFormConfig(config) {
        if (!config) return;
        
        document.getElementById('saveProgress').checked = config.save_progress || false;
        document.getElementById('showStepIndicator').checked = config.show_step_indicator !== false;
        document.getElementById('requireConfirmation').checked = config.require_confirmation || false;
        document.getElementById('successMessage').value = config.success_message || '';
        document.getElementById('redirectUrl').value = config.redirect_url || '';
    }

    populateWorkflowConfig(config) {
        if (!config) return;
        
        document.getElementById('autoProcess').checked = config.auto_process || false;
        document.getElementById('requireApproval').checked = config.require_approval !== false;
        document.getElementById('autoBind').checked = config.auto_bind || false;
        document.getElementById('notifyEmails').value = config.notify_emails || '';
    }

    populateIMSConfig(config) {
        if (!config) return;
        
        document.getElementById('defaultBillingType').value = config.default_billing_type || '1';
        document.getElementById('defaultPolicyType').value = config.default_policy_type || '1';
        document.getElementById('defaultTermLength').value = config.default_term_length || '12';
    }

    populateRaterConfig(config) {
        if (!config) return;
        
        document.getElementById('raterName').value = config.rater_name || '';
        document.getElementById('raterFilePath').value = config.rater_file_path || '';
        document.getElementById('autoCalculate').checked = config.auto_calculate !== false;
        document.getElementById('maxPremium').value = config.max_premium_auto_bind || '';
        document.getElementById('excludeClassCodes').value = config.exclude_class_codes || '';
    }

    async loadIMSConfiguration() {
        try {
            // Load company lines
            const companyLinesResponse = await fetch(`/api/custom-routes/instance/${this.instanceId}/ims-config/company_lines`, {
                headers: {
                    'Authorization': `Bearer ${window.authUtils.getToken()}`
                }
            });

            if (companyLinesResponse.ok) {
                const companyLines = await companyLinesResponse.json();
                this.populateCompanyLines(companyLines);
            }

        } catch (error) {
            console.error('Error loading IMS configuration:', error);
        }
    }

    populateCompanyLines(companyLines) {
        const select = document.getElementById('defaultCompanyLine');
        select.innerHTML = '<option value="">Select company/line...</option>';
        
        if (companyLines && companyLines.Table) {
            const lines = Array.isArray(companyLines.Table) ? companyLines.Table : [companyLines.Table];
            lines.forEach(line => {
                const option = document.createElement('option');
                option.value = line.CompanyLineGUID;
                option.textContent = `${line.CompanyName} - ${line.LineName}`;
                select.appendChild(option);
            });
        }
    }

    async saveRoute() {
        try {
            // Validate required fields
            if (!this.route.name || !this.route.slug) {
                this.showError('Route name and slug are required');
                return;
            }

            const saveBtn = document.getElementById('saveRouteBtn');
            saveBtn.classList.add('btn-loading');
            saveBtn.disabled = true;

            // Prepare route data
            const routeData = {
                ...this.route,
                form_config: {
                    ...this.route.form_config,
                    steps: this.totalSteps
                }
            };

            // Prepare fields data  
            const fieldsData = this.fields.map(field => ({
                field_name: field.name,
                field_type: field.type,
                field_label: field.label,
                field_config: {
                    placeholder: field.placeholder,
                    options: field.options,
                    validation: field.validation
                },
                step_number: field.step,
                field_order: field.order,
                ims_field_mapping: field.ims_mapping,
                rater_cell_mapping: field.rater_mapping,
                is_required: field.required,
                is_conditional: false,
                conditional_logic: field.conditional_logic
            }));

            let response;
            if (this.isNewRoute) {
                // Create new route
                response = await fetch(`/api/custom-routes/instance/${this.instanceId}/routes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.authUtils.getToken()}`
                    },
                    body: JSON.stringify({
                        name: routeData.name,
                        slug: routeData.slug,
                        description: routeData.description,
                        formConfig: routeData.form_config,
                        workflowConfig: routeData.workflow_config,
                        imsConfig: routeData.ims_config,
                        raterConfig: routeData.rater_config
                    })
                });

                if (response.ok) {
                    const newRoute = await response.json();
                    this.routeId = newRoute.route_id;
                    this.isNewRoute = false;
                    
                    // Now save fields
                    await this.saveFields(fieldsData);
                }
            } else {
                // Update existing route
                response = await fetch(`/api/custom-routes/instance/${this.instanceId}/routes/${this.routeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.authUtils.getToken()}`
                    },
                    body: JSON.stringify({
                        name: routeData.name,
                        slug: routeData.slug,
                        description: routeData.description,
                        formConfig: routeData.form_config,
                        workflowConfig: routeData.workflow_config,
                        imsConfig: routeData.ims_config,
                        raterConfig: routeData.rater_config,
                        isActive: routeData.is_active
                    })
                });

                if (response.ok) {
                    await this.saveFields(fieldsData);
                }
            }

            if (!response.ok) {
                throw new Error('Failed to save route');
            }

            this.showSuccess('Route saved successfully');

        } catch (error) {
            console.error('Error saving route:', error);
            this.showError('Failed to save route');
        } finally {
            const saveBtn = document.getElementById('saveRouteBtn');
            saveBtn.classList.remove('btn-loading');
            saveBtn.disabled = false;
        }
    }

    async saveFields(fieldsData) {
        // For now, we'll need to delete existing fields and recreate them
        // In a production environment, you'd want a more sophisticated approach
        // that handles updates and preserves IDs

        try {
            // Delete existing fields (if editing)
            if (!this.isNewRoute) {
                // This would require a delete endpoint
                // await this.deleteExistingFields();
            }

            // Create new fields
            for (const fieldData of fieldsData) {
                await fetch(`/api/custom-routes/routes/${this.routeId}/fields`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.authUtils.getToken()}`
                    },
                    body: JSON.stringify(fieldData)
                });
            }

        } catch (error) {
            console.error('Error saving fields:', error);
            throw error;
        }
    }

    previewRoute() {
        if (!this.route.slug) {
            this.showError('Please save the route first');
            return;
        }

        const publicUrl = `${window.location.origin}/form/${this.route.slug}`;
        window.open(publicUrl, '_blank');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-floating`;
        alertDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        document.body.appendChild(alertDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
}

// Initialize the Form Builder when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FormBuilder();
});