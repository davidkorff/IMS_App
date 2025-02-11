let currentPage = 0;
let formValues = {};  // Store all form values

function updateValue(fieldId, value) {
    formValues[fieldId] = value;
    console.log('Updated form values:', formValues);  // For debugging
}

function renderForm(data) {
    const formContainer = document.getElementById('formContainer');
    const form = data.form;
    
    // Clear existing content
    formContainer.innerHTML = '';
    
    // Create form header
    const header = document.createElement('div');
    header.innerHTML = `
        <h1>${form.title}</h1>
        <p>${form.description}</p>
    `;
    formContainer.appendChild(header);
    
    // Create tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'sheet-tabs';
    form.tabs.forEach((tab, index) => {
        const tabButton = document.createElement('div');
        tabButton.className = `tab ${index === currentPage ? 'active' : ''}`;
        tabButton.textContent = tab.title;
        tabButton.onclick = () => {
            currentPage = index;
            renderForm(window.formData);
        };
        tabsContainer.appendChild(tabButton);
    });
    formContainer.appendChild(tabsContainer);
    
    // Render current tab's sections
    const currentTab = form.tabs[currentPage];
    currentTab.sections.forEach(section => renderSection(section, formContainer));
    
    // Add save button
    addSaveButton(formContainer);
}

function renderSection(section, container) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'page';
    sectionDiv.innerHTML = `<h2>${section.title}</h2>`;
    
    section.fields.forEach(field => {
        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
            case 'select':
            case 'textarea':
                sectionDiv.appendChild(renderBasicField(field));
                break;
            case 'checkbox':
                sectionDiv.appendChild(renderCheckbox(field));
                break;
            case 'radio':
                sectionDiv.appendChild(renderRadio(field));
                break;
            case 'object':
                sectionDiv.appendChild(renderObjectField(field));
                break;
            case 'dynamicList':
                sectionDiv.appendChild(renderDynamicList(field));
                break;
            case 'signature':
                sectionDiv.appendChild(renderSignature(field));
                break;
        }
    });
    
    container.appendChild(sectionDiv);
}

function renderBasicField(field) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'question';
    
    let input;
    if (field.type === 'select') {
        input = `<select id="${field.id}" ${field.readonly ? 'readonly' : ''}>
            ${field.options.map(opt => `
                <option value="${opt}" ${field.value === opt ? 'selected' : ''}>${opt}</option>
            `).join('')}
        </select>`;
    } else if (field.type === 'textarea') {
        input = `<textarea id="${field.id}" ${field.readonly ? 'readonly' : ''}>${field.value || ''}</textarea>`;
    } else {
        input = `<input type="${field.type}" id="${field.id}" 
            value="${field.value || ''}" 
            ${field.readonly ? 'readonly' : ''}
            ${field.validation?.min ? `min="${field.validation.min}"` : ''}
            ${field.validation?.max ? `max="${field.validation.max}"` : ''}
            ${field.validation?.pattern ? `pattern="${field.validation.pattern}"` : ''}
            ${field.validation?.required ? 'required' : ''}>`;
    }
    
    fieldDiv.innerHTML = `
        <label for="${field.id}">${field.label}</label>
        ${input}
    `;

    const inputElement = fieldDiv.querySelector('input, select, textarea');
    inputElement.addEventListener('change', (e) => {
        updateValue(field.id, e.target.value);
        handleDependencies(field.id, e.target.value);
    });

    return fieldDiv;
}

function renderCheckbox(field) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'question';
    fieldDiv.innerHTML = `
        <label>
            <input type="checkbox" id="${field.id}" 
                ${field.value ? 'checked' : ''}>
            ${field.label}
        </label>
    `;

    const checkbox = fieldDiv.querySelector('input');
    checkbox.addEventListener('change', (e) => {
        updateValue(field.id, e.target.checked);
        handleDependencies(field.id, e.target.checked);
    });

    return fieldDiv;
}

function renderRadio(field) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'question';
    fieldDiv.innerHTML = `
        <label>${field.label}</label>
        ${field.options.map(opt => `
            <label>
                <input type="radio" name="${field.id}" value="${opt}" 
                    ${field.value === opt ? 'checked' : ''}>
                ${opt}
            </label>
        `).join('')}
    `;

    const radios = fieldDiv.querySelectorAll('input');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateValue(field.id, e.target.value);
            handleDependencies(field.id, e.target.value);
        });
    });

    return fieldDiv;
}

function renderObjectField(field) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'question';
    fieldDiv.innerHTML = `<h3>${field.label}</h3>`;
    
    field.fields.forEach(subField => {
        fieldDiv.appendChild(renderBasicField(subField));
    });
    
    return fieldDiv;
}

function renderDynamicList(field) {
    const listDiv = document.createElement('div');
    listDiv.className = 'schedule-container';
    listDiv.innerHTML = `<h3>${field.label}</h3>`;
    
    const itemsContainer = document.createElement('div');
    field.value = field.value || [];
    
    function addListItem(values = {}) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        
        field.template.fields.forEach(templateField => {
            const fieldCopy = { ...templateField, value: values[templateField.id] || '' };
            itemDiv.appendChild(renderBasicField(fieldCopy));
        });
        
        itemsContainer.appendChild(itemDiv);
    }
    
    // Render existing items
    field.value.forEach(itemValues => addListItem(itemValues));
    
    const addButton = document.createElement('button');
    addButton.className = 'add-button';
    addButton.textContent = 'Add Item';
    addButton.onclick = () => {
        addListItem();
        field.value.push({});
        updateValue(field.id, field.value);
    };
    
    listDiv.appendChild(itemsContainer);
    listDiv.appendChild(addButton);
    return listDiv;
}

function renderSignature(field) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'question';
    fieldDiv.innerHTML = `
        <label>${field.label}</label>
        <canvas id="${field.id}_canvas" width="400" height="200" style="border:1px solid #000;"></canvas>
        <button type="button" onclick="clearSignature('${field.id}_canvas')">Clear</button>
    `;
    
    const canvas = fieldDiv.querySelector('canvas');
    setupSignaturePad(canvas, field.id);
    
    return fieldDiv;
}

function setupSignaturePad(canvas, fieldId) {
    let isDrawing = false;
    const ctx = canvas.getContext('2d');
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        updateValue(fieldId, canvas.toDataURL());
    }
    
    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }
}

function clearSignature(canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function handleDependencies(fieldId, value) {
    const form = window.formData.form;
    if (!form.logic?.dependencies) return;
    
    const dependency = form.logic.dependencies.find(d => d.trigger === fieldId);
    if (!dependency) return;
    
    const condition = dependency.conditions.find(c => c.value === value);
    if (!condition) return;
    
    condition.actions.forEach(action => {
        switch (action.action) {
            case 'show':
                action.fields.forEach(field => showField(field));
                break;
            case 'hide':
                action.fields.forEach(field => hideField(field));
                break;
            case 'enable':
                action.fields.forEach(field => enableField(field));
                break;
            case 'disable':
                action.fields.forEach(field => disableField(field));
                break;
            case 'require':
                action.fields.forEach(field => requireField(field));
                break;
            case 'setValue':
                action.fields.forEach(field => {
                    updateValue(field.field, field.value);
                    const element = document.getElementById(field.field);
                    if (element) element.value = field.value;
                });
                break;
        }
    });
}

// Helper functions for field manipulation
function showField(fieldId) {
    const element = document.getElementById(fieldId)?.closest('.question');
    if (element) element.style.display = '';
}

function hideField(fieldId) {
    const element = document.getElementById(fieldId)?.closest('.question');
    if (element) element.style.display = 'none';
}

function enableField(fieldId) {
    const element = document.getElementById(fieldId);
    if (element) element.removeAttribute('disabled');
}

function disableField(fieldId) {
    const element = document.getElementById(fieldId);
    if (element) element.setAttribute('disabled', 'disabled');
}

function requireField(fieldId) {
    const element = document.getElementById(fieldId);
    if (element) element.setAttribute('required', 'required');
}

// Add a function to get all form values
function getFormValues() {
    return formValues;
}

// Add a save button to the form
function addSaveButton(container) {
    const saveButton = document.createElement('button');
    saveButton.className = 'next-button';
    saveButton.textContent = 'Save Form';
    saveButton.onclick = () => {
        console.log('Form Values:', getFormValues());
        // Here you could send the values to a server or download them
        const dataStr = JSON.stringify(getFormValues(), null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'form-values.json';
        a.click();
    };
    container.appendChild(saveButton);
}

// Initialize form
fetch('testjson.json')
    .then(response => response.json())
    .then(data => {
        window.formData = data;
        renderForm(data);
    })
    .catch(error => {
        console.error('Error loading form:', error);
        document.getElementById('formContainer').innerHTML = 'Error loading form: ' + error;
    }); 