const express = require('express');
const router = express.Router();
const dataAccess = require('../../services/dataAccess');
const pool = require('../../config/db');
const auth = require('../../middleware/auth');

// Get all system settings
router.get('/settings', auth, async (req, res) => {
    try {
        const instanceId = req.query.instance;
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID required' });
        }

        // Get instance configuration from database
        const instanceResult = await pool.query(
            'SELECT instance_id, name, url, username, password FROM ims_instances WHERE instance_id = $1',
            [instanceId]
        );

        if (instanceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const instance = instanceResult.rows[0];

        // Execute the stored procedure to get all settings
        const result = await dataAccess.executeProc({
            url: instance.url,
            username: instance.username,
            password: instance.password,
            procedure: 'DK_SystemSettings_GetAll_WS',
            parameters: {}
        });

        res.json(result || { Table: [] });

    } catch (error) {
        console.error('Error loading system settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update a system setting
router.post('/settings/update', auth, async (req, res) => {
    try {
        const instanceId = req.query.instance;
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID required' });
        }

        // Get instance configuration from database
        const instanceResult = await pool.query(
            'SELECT instance_id, name, url, username, password FROM ims_instances WHERE instance_id = $1',
            [instanceId]
        );

        if (instanceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const instance = instanceResult.rows[0];

        const { Setting, SettingValueString, SettingValueNumeric, SettingValueBool } = req.body;
        
        if (!Setting) {
            return res.status(400).json({ error: 'Setting name required' });
        }

        // Execute the stored procedure to update the setting
        const result = await dataAccess.executeProc({
            url: instance.url,
            username: instance.username,
            password: instance.password,
            procedure: 'DK_SystemSettings_Update_WS',
            parameters: {
                Setting: Setting,
                SettingValueString: SettingValueString,
                SettingValueNumeric: SettingValueNumeric,
                SettingValueBool: SettingValueBool
            }
        });

        res.json(result || { Table: [] });

    } catch (error) {
        console.error('Error updating system setting:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;