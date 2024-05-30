const os = require('os');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');
const express = require('express');
const jwt = require('jsonwebtoken');

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

let child;

if (operatingSystem === 'darwin' || operatingSystem === 'linux') {
    // Run the resource as sudo
    console.log("Running the resource...")
    child = spawn('sudo', [
        path.join(resourcesPath, resource_name),
        'client',
        '-server', process.env.BORING_PROXY_SERVER,
        '-user', process.env.BORING_PROXY_USER,
        '-token', process.env.BORING_PROXY_TOKEN,
        '-client-name', process.env.BORING_PROXY_CLIENT_NAME
    ]);
}

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
    
    console.log("[HOME_CLOUD] : Processing webhook...");
    const app_name = req.query.app;
    const token = req.query.token;

    // Verify the token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.client_name !== process.env.BORING_PROXY_CLIENT_NAME) {
            console.log(`[HOME_CLOUD] : Authorization Failed`);
            return;
        }
    } catch (err) {
        console.log(`[HOME_CLOUD] : Invalid token`);
        return;
    }


    const webhooksPath = path.join(__dirname, 'webhooks.json');
    if (fs.existsSync(webhooksPath)) {
        const webhooks = JSON.parse(fs.readFileSync(webhooksPath, 'utf8'));
        if (webhooks[app_name]) {
            console.log(`[HOME_CLOUD -> ${app_name}] : Webhook for app '${app_name}' found`);
            // Go to the app directory webhooks[app_name].path - if exists
            if (fs.existsSync(webhooks[app_name].path)) {
                console.log(`[HOME_CLOUD -> ${app_name}] : Changing directory to '${webhooks[app_name].path}'...`);
                process.chdir(webhooks[app_name].path);
            } else {
                console.log(`[HOME_CLOUD -> ${app_name}] : App directory not found`);
                return;
            }

            console.log(`[HOME_CLOUD -> ${app_name}] : Executing commands for app '${app_name}'...`);
            const commands = webhooks[app_name]?.commands || [];
            executeCommands(app_name, commands).then(() => {
                console.log(`[HOME_CLOUD -> ${app_name}] : Commands executed successfully`);
            }).catch((error) => {
                console.log(`[HOME_CLOUD -> ${app_name}] : Error executing commands: ${error}`);
            });

        } else {
            console.log(`[HOME_CLOUD] : Webhook for app '${app_name}' not found`);
        }
    } else {
        console.log(`[HOME_CLOUD] : Webhooks file not found`);
    }

});

app.listen(port, () => {
    console.log(`Port forwarding server running on port ${port}. Ready to receive webhooks.`);


    // Instructions
    console.log("\n\n================================================")
    console.log(`Setup Instructions:`)
    console.log("------------------------------------------------")
    // One time setup
    console.log(`One time setup:`)
    console.log("------------------------------------------------")
    console.log(`1. Go to https://${process.env.BORING_PROXY_SERVER}`)
    console.log(`2. Login with your credentials`)
    console.log(`3. Click on the 'Add Tunnel'`)
    console.log(`4. Enter the following details:`)
    console.log(`   - Domain: '${process.env.BORING_PROXY_CLIENT_NAME}.${process.env.BORING_PROXY_SERVER}'`)
    console.log(`   - Tunnel Port: 'Random' ( Keep it default )`)
    console.log(`   - Client Name: '${process.env.BORING_PROXY_CLIENT_NAME}'`)
    console.log(`   - Client Address: '127.0.0.1' ( Keep it default )`)
    console.log(`   - Client Port: '${port}'`)
    console.log(`   - TLS Termination: 'Client HTTPS'`)
    console.log(`   - Allow External TCP: 'Checked'`)
    console.log(`5. Click on 'Submit' or 'Add Tunnel'`)
    console.log(`6. You will see a new tunnel created in Tunnels section`)
    console.log("================================================")

    // Webhook setups
    console.log("\n\n===============================================")
    console.log("Webhooks:")
    console.log("----------------------------------------------")
    // check if webhooks.json file exists
    const webhooksPath = path.join(__dirname, 'webhooks.json');
    if (fs.existsSync(webhooksPath)) {
        // read the file
        const webhooks = JSON.parse(fs.readFileSync(webhooksPath, 'utf8'));
        const apps = Object.keys(webhooks);
        if (apps.length > 0) {
            console.log(`Webhooks found in 'webhooks.json' file:`)
            console.log("----------------------------------------------")
            apps.forEach(app => {
                console.log(`App: ${app}`);
                console.log(`Webhook URL: ${generateWebhookUrl(app)}`);
                console.log("----------------------------------------------")
            });
        } else {
            console.log("No webhooks found in 'webhooks.json' file. Create a new one if needed.")
        }
    } else {
        console.log("No webhooks found in 'webhooks.json' file. Create a new one if needed.")
    }
    console.log("===============================================")

});

async function executeCommands(app_name, commands) {
    for (const command of commands) {
        console.log(`[HOME_CLOUD -> ${app_name}] : Executing command '${command}'...`);
        const child = spawn(command, { shell: true });
        child.stdout.on('data', (data) => {
            console.log(`[HOME_CLOUD -> ${app_name}] : ${data}`);
        });
        child.stderr.on('data', (data) => {
            console.log(`[HOME_CLOUD -> ${app_name}] : ${data}`);
        });
        const promise = new Promise((resolve, reject) => {
            child.on('close', (code) => {
                console.log(`[HOME_CLOUD -> ${app_name}] : child process exited with code ${code}`);
                resolve();
            });
            child.on('error', (error) => {
                reject(error);
            });
        });
        await promise;
    }
}

const generateJwtToken = () => {
    const token = jwt.sign({ 
        client_name: process.env.BORING_PROXY_CLIENT_NAME
    }, process.env.JWT_SECRET);
    return token;
}

const generateWebhookUrl = (app_name) => {
    let token = generateJwtToken();
    return `https://${process.env.BORING_PROXY_CLIENT_NAME}.${process.env.BORING_PROXY_SERVER}/webhook?app=${app_name}&token=${token}`
}
