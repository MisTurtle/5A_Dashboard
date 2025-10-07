const express = require('express');
const ping = require('ping');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { group } = require('console');

const app = express();

// TODO : Change these to .env settings
const PORT = 3000;
const HOSTS_FILE = path.join(__dirname, 'resources', 'hosts.json');
const PLAYBOOKS_ROOT = path.join(__dirname, '..', 'playbooks');
const ANSIBLE_PRIVATE_KEY_PATH = "/home/kali/.ssh/ansible_key";

async function getHosts() {
  const data = await fs.readFile(HOSTS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function getPlaybooks() {
  const files = await fs.readdir(PLAYBOOKS_ROOT);
  const regex = /.*\.ya?ml/i;
  return files.filter(f => regex.test(f));
}

app.get('/api/hosts', async (req, res) => {
  try {
    res.status(200).json(await getHosts());
  }catch(err){
    res.status(500).json({ 'error': err });
  }
});

app.get('/api/status', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  try{
    const groupedHosts = await getHosts();
    for(const hostGroup of groupedHosts) {
      for(const host of hostGroup.hosts) {
        const reachable = await ping.promise.probe(host.ip, { timeout: 2, extra: [ '-c', '1' ] });
        res.write(`data: ${JSON.stringify({
          'group': hostGroup.name,
          'host': host.ip,
          'hostname': host.name,
          'alive': reachable.alive,
          'msAvg': reachable.avg
        })}\n\n`);
      }
    }
    res.end();
  }catch(err) {
    res.status(500).json({ 'error': err });
  }
});

app.get('/api/playbooks', async (req, res) => {
  try{
    res.json({ playbooks: await getPlaybooks() });
  }catch(err){
    res.status(500).json({ 'error': 'Unable to list playbooks.' });
  }
});

app.get('/api/play', async (req, res) => {
  try {
    const validPlaybooks = await getPlaybooks();
    const { ip, playbook } = req.query;

    console.log(playbook, validPlaybooks);
    if (!playbook || typeof playbook !== "string" || !validPlaybooks.includes(playbook)) return res.status(400).json({ error: `Invalid playbook '${playbook}'`});
    if (!ip) return res.status(400).json({ error: 'IP address is required to play a playbook.' });

    const ipRegex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
    if (!ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address' });

    const playbookPath = path.join(PLAYBOOKS_ROOT, playbook);
    const cmd = `ANSIBLE_HOST_KEY_CHECKING=FALSE ansible-playbook ${playbookPath} -i ${ip}, --private-key=${ANSIBLE_PRIVATE_KEY_PATH}`;

    exec(cmd, { maxBuffer: 1024 * 1024}, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing playbook: ${error.message}`);
        return res.status(500).json({ error: `Error when running playbook ${playbook}: ${error.message}` });
      }
      res.json({ stdout, stderr });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
