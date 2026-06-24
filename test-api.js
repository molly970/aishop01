
const http = require('http');

console.log('Testing /api/health...');
http.get('http://localhost:3000/api/health', (res) =&gt; {
  console.log('/api/health status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) =&gt; data += chunk);
  res.on('end', () =&gt; {
    console.log('/api/health response:', data);
    console.log('\nTesting /api/tasks...');
    http.get('http://localhost:3000/api/tasks', (res2) =&gt; {
      console.log('/api/tasks status:', res2.statusCode);
      let data2 = '';
      res2.on('data', (chunk) =&gt; data2 += chunk);
      res2.on('end', () =&gt; {
        console.log('/api/tasks response:', data2);
        console.log('Headers:', res2.headers);
      });
    }).on('error', (e) =&gt; console.error('Error:', e));
  });
}).on('error', (e) =&gt; console.error('Error:', e));
