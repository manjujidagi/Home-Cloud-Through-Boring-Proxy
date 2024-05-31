# Home-Cloud-Through-Boring-Proxy
Easy client with minimal configurations to host applications through Boring Proxy


## Introduction
This is a simple client to host applications through Boring Proxy.

## Requirements
- Hosted Boring Proxy Server
- Node.js & npm

## Running in background in Mac with Automator
1. Duplicate StartupScript.example.app as StartupScript.app
2. Open the same in Automator
3. Change the path to the script in the Run Shell Script
4. Add your sudo password in the same script
5. Run the application in automator and give necessary permissions
6. Save the application
7. Schedule the application to run at startup ( General -> Login Items -> Add the application)