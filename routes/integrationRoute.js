const express = require('express');
const zapierIntegration = require('../integrations/zapier');
const hubspotIntegration = require('../integrations/hubspot');
const googleSheetsIntegration = require('../integrations/googleSheets');

const router = express.Router();

// Zapier integration
router.post('/zapier/validate', zapierIntegration.processZap);
router.get('/zapier/sample-data', (req, res) => {
  res.json(zapierIntegration.getZapierSampleData());
});

// HubSpot integration
router.post('/hubspot/validate-contact', async (req, res) => {
  try {
    const { email, contactId } = req.body;
    const result = await hubspotIntegration.validateAndUpdateContact(email, contactId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Google Sheets integration
router.post('/google-sheets/validate', async (req, res) => {
  try {
    const { spreadsheetId, range } = req.body;
    const result = await googleSheetsIntegration.validateSheet(spreadsheetId, range);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Integration status and capabilities
router.get('/integrations', (req, res) => {
  res.json({
    available_integrations: [
      {
        name: 'Make.com',
        status: 'active',
        endpoints: ['/api/email/make/integration'],
        documentation: '/docs/make-integration'
      },
      {
        name: 'Zapier',
        status: 'active', 
        endpoints: ['/api/integrations/zapier/validate'],
        documentation: '/docs/zapier-integration'
      },
      {
        name: 'HubSpot',
        status: 'beta',
        endpoints: ['/api/integrations/hubspot/validate-contact'],
        documentation: '/docs/hubspot-integration'
      },
      {
        name: 'Google Sheets',
        status: 'beta',
        endpoints: ['/api/integrations/google-sheets/validate'],
        documentation: '/docs/google-sheets-integration'
      }
    ]
  });
});

module.exports = router;