const fs = require('fs');
const https = require('https');

// Read the drawio file
const drawioContent = fs.readFileSync('architecture.drawio', 'utf-8');

// Prepare the data for the export API
const data = JSON.stringify({
  drawioXml: drawioContent,
  format: 'png',
  scale: 2
});

// Use draw.io export API (local service approach)
// Alternative: use https://convert.diagrams.net API
const options = {
  hostname: 'convert.diagrams.net',
  port: 443,
  path: '/png',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync('architecture.png', buffer);
    console.log('✓ Converted architecture.drawio to architecture.png');
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
