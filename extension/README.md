# Slack Cluster Finder Extension

A Chrome extension that enables quick navigation on verified URLs using Ctrl+S.

## Features

- Listens for Ctrl+S (or Cmd+S on Mac) keyboard shortcut
- Works only on verified URLs (currently: slack.com)
- Prevents default browser save behavior
- Redirects to cluster finder location (currently set to `#` as placeholder)

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top right
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. The extension is now installed and active

## Usage

1. Navigate to any slack.com URL
2. Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)
3. You'll be redirected to the cluster finder location

## Configuration

### Adding More Verified URLs

To add more verified URL segments, edit `config.js`:

```javascript
const VERIFIED_URL_SEGMENTS = [
  'slack.com',
];
```

### Changing the Redirect URL

To change where Ctrl+S redirects to, edit `content.js` and update this line:

```javascript
window.location.href = '#';
```

## File Structure

- `manifest.json` - Extension configuration and permissions
- `content.js` - Main script that listens for keyboard events
- `config.js` - List of verified URL segments
- `README.md` - This file

## Development

The extension uses Manifest V3 and runs as a content script on matching URLs.

## License

MIT
