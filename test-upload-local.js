// Test the upload endpoint locally
import formidable from 'formidable';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

try {
  // Test if we can load the XLSXParser module
  const XLSXParser = require('./services/xlsxParser.js');
  console.log('✅ XLSXParser loaded successfully');

  // Test if we can create an instance
  const parser = new XLSXParser();
  console.log('✅ XLSXParser instance created successfully');

  // Test if formidable works
  const form = formidable({
    maxFileSize: 10 * 1024 * 1024,
    keepExtensions: true,
  });
  console.log('✅ Formidable form created successfully');

  console.log('\nAll dependencies loaded correctly!');

} catch (error) {
  console.error('❌ Error loading dependencies:', error);
  console.error('Stack trace:', error.stack);
}