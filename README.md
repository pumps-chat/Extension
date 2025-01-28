# Pumps.chat Browser Extension

A Chrome extension that adds a chat interface to popular trading platforms, allowing users to communicate in real-time while trading.

## Supported Platforms
- pump.fun
- photon-sol.tinyastro.io
- bullx.io

## Features
- Real-time chat with WebSocket connection
- User profile customization with avatars
- Image sharing and drag-and-drop support
- User mentions and notifications
- Draggable and minimizable chat window
- Automatic token detection
- Message history
- Character limit counter
- Image spoiler protection
- Active user tracking
- Global user count

## Installation

### Manual Installation
1. Download the latest release from the [Releases](../../releases) page
2. Unzip the downloaded file
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked" and select the unzipped folder

## Usage
1. Visit any supported trading platform
2. Click Any token
3. Enter your username and optionally add a profile picture
4. Start chatting with other traders

## Technical Details
- Built with vanilla JavaScript
- Uses Chrome Extensions Manifest V3
- WebSocket-based real-time communication
- Supports PNG and JPG image uploads
- Responsive and draggable UI
- Automatic token detection from URL or DOM
- Service Worker for background processing

## Development Setup
1. Clone this repository
```bash
git clone https://github.com/pumps-chat/Extension
cd Extension
```

2. Load the extension in Chrome:
- Open Chrome
- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the extension directory

3. Make your changes
4. Reload the extension to test

## Contributing
1. Fork the repository
2. Create a new branch (`git checkout -b feature/improvement`)
3. Make your changes
4. Commit your changes (`git commit -am 'Add new feature'`)
5. Push to the branch (`git push origin feature/improvement`)
6. Create a Pull Request

## Bug Reports
If you find a bug, please create an issue with:
- Detailed description of the bug
- Steps to reproduce
- Expected behavior
- Screenshots (if applicable)
- Browser version and OS

## Socials
Twitter : https://x.com/pumpschat
Official website : pumps.chat
