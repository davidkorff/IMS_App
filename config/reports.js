const reports = [
    {
        id: 'submissions',
        name: 'Submissions Report',
        description: 'View all submissions in the system',
        procedure: 'GetSubmissions',
        parameters: [], // This report takes no parameters
        columns: [
            { field: 'ControlNo', header: 'Control #' },
            { field: 'PolicyNumber', header: 'Policy #' },
            { field: 'InsuredPolicyName', header: 'Insured Name' },
            { field: 'InsuredDBA', header: 'DBA' },
            { field: 'DisplayStatus', header: 'Status' },
            { field: 'EffectiveDate', header: 'Effective Date', type: 'date' },
            { field: 'ProducerName', header: 'Producer' },
            { field: 'StateID', header: 'State' }
        ]
    }
    // Add more reports here as needed
];

module.exports = reports; 