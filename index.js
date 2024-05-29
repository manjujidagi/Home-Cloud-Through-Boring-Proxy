const os = require('os');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');
const express = require('express');

// Load environment variables
dotenv.config();

// Get the operating system
const operatingSystem = (os.type()).toLowerCase();

// Get the architecture
const architecture = (os.arch()).toLowerCase();

// Get boring proxy resources version
const boringProxyVersion = fs.readFileSync(path.join(__dirname, 'resources', 'version.txt'), 'utf8');

console.log(`Operating System: ${operatingSystem}`);
console.log(`Architecture: ${architecture}`);
console.log(`Boring Proxy: ${boringProxyVersion}`);

console.log("Finding resources...")
// Find the resources directory
const resourcesPath = path.join(__dirname, 'resources');
const resources = fs.readdirSync(resourcesPath);

// Find the resource based on the operating system & architecture
let file_prefix = 'boringproxy';
let file_extension = '';
if (operatingSystem === 'windows_nt') {
    file_extension = '.exe';
}

let resource_name = `${file_prefix}-${operatingSystem}-${architecture}${file_extension}`;
console.log(`Required Resource Name: ${resource_name}`);

// Check if the resource exists
if (resources.includes(resource_name)) {
    console.log(`Resource Found: ${resource_name}`);
}

// make the resource executable
fs.chmodSync(path.join(resourcesPath, resource_name), 0o755);
console.log(`Resource Executable: ${resource_name}`);

// If operating system is linux, then cap_net_bind_service capability is required
if (operatingSystem === 'linux') {
    console.log("Setting capabilities for linux...")
    const { execSync } = require('child_process');
    execSync(`sudo setcap cap_net_bind_service=+ep ${path.join(resourcesPath, resource_name)}`);
    console.log("Capabilities set for linux")
}


// Run the resource as sudo
console.log("Running the resource...")
const child = spawn("sudo", [
    path.join(resourcesPath, resource_name),
    'client',
    '-server', process.env.BORING_PROXY_SERVER,
    '-user', process.env.BORING_PROXY_USER,
    '-token', process.env.BORING_PROXY_TOKEN,
    '-client-name', process.env.BORING_PROXY_CLIENT_NAME
]);

child.stdout.on('data', (data) => {
    console.log(`[BORING_PROXY] : ${data}`);
});

child.stderr.on('data', (data) => {
    console.log(`[BORING_PROXY] : ${data}`);
});

child.on('close', (code) => {
    console.log(`[BORING_PROXY] : child process exited with code ${code}`);
});

// start an express server

const app = express();
const port = process.env.PORT || 3333;

app.get('/webhook', (req, res) => {
    console.log("[HOME_CLOUD] : Webhook received");
    res.status(200).json({ message: `Webhook received @ ${Date.now()}` });
    child.stdin.write('reload\n');
});

app.listen(port, () => {
    console.log(`Port forwarding server running on port ${port}. Ready to receive webhooks.`);
});