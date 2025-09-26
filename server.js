const express = require('express');
const cors = require('cors');
const emailRoutes = require('./routes/emailRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/email', emailRoutes);

// Make.com integration documentation
app.get('/make-integration', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'make-integration.html'));
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bulk Email Validator API', 
    version: '1.0.0',
    make_integration: '/make-integration',
    endpoints: {
      validate: '/api/email/validate',
      bulkValidate: '/api/email/validate-bulk',
      bulkValidateWithProgress: '/api/email/validate-bulk-progress',
      uploadCSV: '/api/email/upload-csv',
      makeIntegration: '/api/email/make/integration'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Get port from environment variable or use default
const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});