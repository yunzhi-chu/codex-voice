const http = require('http');
const fs = require('fs');
const path = require('path');

const commands = {};
let nextId = 1;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' };
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors }); res.end(JSON.stringify(data)); };
  
  if (req.method === 'OPTIONS') { res.writeHead(200, cors); res.end(); return; }

  // 提供最新的 HTML 页面
  if (url.pathname === '/') {
    const filePath = path.join(__dirname, 'docs', 'codex-voice-server.html');
    fs.readFile(filePath, (err, data) => {
      if (err) { json(404, { error: 'not found' }); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors });
      res.end(data);
    });
    return;
  }

  // iPhone 发送语音命令
  if (url.pathname === '/api/command' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        const id = nextId++;
        commands[id] = { text, status: 'pending', response: null, createdAt: Date.now(), completedAt: null };
        // 清理旧命令
        const keys = Object.keys(commands);
        if (keys.length > 100) delete commands[keys[0]];
        json(200, { id });
      } catch (e) { json(400, { error: e.message }); }
    });
    return;
  }

  // iPhone 轮询响应
  if (url.pathname === '/api/response' && req.method === 'GET') {
    const id = parseInt(url.searchParams.get('id'));
    if (commands[id]) { json(200, commands[id]); }
    else { json(404, { error: 'not found' }); }
    return;
  }

  // Codex 获取待处理命令
  if (url.pathname === '/api/pending' && req.method === 'GET') {
    const pending = Object.entries(commands)
      .filter(([_, v]) => v.status === 'pending')
      .map(([k, v]) => ({ id: parseInt(k), ...v }));
    json(200, pending);
    return;
  }

  // Codex 回复命令
  if (url.pathname === '/api/respond' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { id, response } = JSON.parse(body);
        if (commands[id]) {
          commands[id].status = 'completed';
          commands[id].response = response;
          commands[id].completedAt = Date.now();
          json(200, { ok: true });
        } else { json(404, { error: 'not found' }); }
      } catch (e) { json(400, { error: e.message }); }
    });
    return;
  }

  json(404, { error: 'not found' });
});

const PORT = 3456;
server.listen(PORT, () => {
  console.log(`CodeX Bridge Server running on http://localhost:${PORT}`);
});
