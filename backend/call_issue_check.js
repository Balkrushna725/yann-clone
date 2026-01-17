const http = require('http');

const data = JSON.stringify({ email: 'issuecheck+1@example.com' });

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/request-otp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 5000
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => (body += chunk));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try {
      console.log('BODY', JSON.parse(body));
    } catch (e) {
      console.log('BODY', body);
    }
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('ERROR', err.message);
  process.exit(2);
});

req.on('timeout', () => {
  console.error('ERROR', 'timeout');
  req.destroy();
});

req.write(data);
req.end();
