# Slack Frontend Integration Documentation

## Overview

This document explains how the Slack integration works on the frontend, including the React components, OAuth flow handling, and user interface for workspace and message selection.

## Table of Contents

1. [Frontend Architecture](#frontend-architecture)
2. [Component Overview](#component-overview)
3. [OAuth Flow Implementation](#oauth-flow-implementation)
4. [Workspace Selection UI](#workspace-selection-ui)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Styling and UX](#styling-and-ux)
8. [Error Handling](#error-handling)

---

## Frontend Architecture

### Tech Stack

- **React** - UI framework
- **React Router** - Navigation and routing
- **Vite** - Build tool and dev server
- **CSS** - Custom styling (no UI library)

### File Structure

```
frontend/src/
├── main.jsx                      # App entry point, routes
├── App.jsx                       # Main app component
├── components/
│   ├── DataCard.jsx              # Channel card component
│   └── slack/
│       ├── SlackAuth.jsx         # OAuth initiation page
│       ├── SlackAuth.css         # OAuth page styling
│       ├── SlackCallback.jsx     # OAuth callback handler
│       ├── SlackCallback.css     # Callback page styling
│       ├── SlackWorkspaces.jsx   # Workspace selection UI
│       └── SlackWorkspaces.css   # Workspace UI styling
```

### Routing

```javascript
// main.jsx
<Routes>
  <Route path="/" element={<Login />} />
  <Route path="/home" element={<App />} />
  <Route path="/slack/auth" element={<SlackAuth />} />
  <Route path="/slack/callback" element={<SlackCallback />} />
  {/* ... other routes */}
</Routes>
```

---

## Component Overview

### 1. SlackAuth Component

**Purpose:** Initiate Slack OAuth flow

**File:** `components/slack/SlackAuth.jsx`

**Key Features:**
- Displays Slack branding and logo
- "Connect with Slack" button
- Fetches OAuth URL from backend
- Redirects user to Slack authorization page
- Shows loading states
- Handles errors gracefully

**Component Structure:**
```jsx
const SlackAuth = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSlackAuth = async () => {
        // 1. Fetch OAuth URL from backend
        const response = await fetch(`${apiUrl}/auth/slack`);
        const data = await response.json();
        
        // 2. Redirect to Slack
        window.location.href = data.oauth_url;
    };

    return (
        <div className="slack-auth-container">
            <div className="slack-auth-card">
                {/* Slack Logo SVG */}
                <h1>Connect Your Slack Workspace</h1>
                <button onClick={handleSlackAuth}>
                    Connect with Slack
                </button>
                {/* Info box with permissions */}
            </div>
        </div>
    );
};
```

**User Flow:**
1. User navigates to `/slack/auth`
2. Sees branded Slack connection page
3. Clicks "Connect with Slack"
4. Backend returns OAuth URL
5. User redirected to Slack authorization

---

### 2. SlackCallback Component

**Purpose:** Handle OAuth callback and exchange code for token

**File:** `components/slack/SlackCallback.jsx`

**Key Features:**
- Extracts OAuth code from URL parameters
- Exchanges code for access token via backend
- Stores token in localStorage
- Renders SlackWorkspaces on success
- Shows loading spinner during exchange
- Displays errors if authentication fails

**Component Structure:**
```jsx
const SlackCallback = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const hasRun = useRef(false);

    useEffect(() => {
        // Prevent double execution (React StrictMode)
        if (hasRun.current) return;
        hasRun.current = true;
        
        const handleOAuthCallback = async () => {
            // 1. Get code from URL
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            
            // 2. Exchange code for token
            const response = await fetch(
                `${apiUrl}/auth/slack/callback?code=${code}`
            );
            const data = await response.json();
            
            // 3. Store token
            localStorage.setItem('slack_access_token', data.access_token);
            localStorage.setItem('slack_team_id', data.team_id);
            localStorage.setItem('slack_team_name', data.team_name);
            
            setAccessToken(data.access_token);
            setLoading(false);
        };
        
        handleOAuthCallback();
    }, []);

    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay />;

    return <SlackWorkspaces accessToken={accessToken} />;
};
```

**User Flow:**
1. Slack redirects to `/slack/callback?code=XXXXX`
2. Component extracts code from URL
3. Calls backend to exchange code for token
4. Stores token in localStorage
5. Renders workspace selection UI

**Critical Implementation Detail:**

```jsx
const hasRun = useRef(false);

useEffect(() => {
    if (hasRun.current) return;  // Prevent double-run
    hasRun.current = true;
    // ... OAuth logic
}, []);
```

This prevents the OAuth exchange from running twice in React StrictMode (development), which would cause the code to be invalid on the second attempt.

---

### 3. SlackWorkspaces Component

**Purpose:** Display workspace data and allow channel/user selection

**File:** `components/slack/SlackWorkspaces.jsx`

**Key Features:**
- Fetches and displays workspace information
- Shows all channels (public and private)
- Shows all active users
- Interactive selection with checkboxes
- Filter controls (All, None, Public Only, Private Only)
- Extract button to fetch messages
- Real-time selection count

**Component Structure:**
```jsx
const SlackWorkspaces = ({ accessToken, onExtractComplete }) => {
    const [loading, setLoading] = useState(true);
    const [workspaceData, setWorkspaceData] = useState(null);
    const [selectedChannels, setSelectedChannels] = useState(new Set());
    const [selectedUsers, setSelectedUsers] = useState(new Set());

    useEffect(() => {
        loadWorkspaceData();
    }, [accessToken]);

    const loadWorkspaceData = async () => {
        const response = await fetch(
            `${apiUrl}/slack/workspaces?access_token=${accessToken}`
        );
        const data = await response.json();
        setWorkspaceData(data);
        
        // Auto-select all channels and users by default
        setSelectedChannels(new Set(data.channels.map(c => c.id)));
        setSelectedUsers(new Set(data.users.filter(u => !u.deleted && !u.is_bot).map(u => u.id)));
    };

    const handleExtract = async () => {
        const response = await fetch(`${apiUrl}/slack/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: accessToken,
                channel_ids: Array.from(selectedChannels),
                user_ids: Array.from(selectedUsers)
            })
        });
        const result = await response.json();
        onExtractComplete(result);
    };

    return (
        <div className="slack-workspaces">
            <WorkspaceHeader />
            <Stats />
            <WorkspaceCard />
            <ChannelSelection />
            <UserSelection />
            <ExtractButton />
        </div>
    );
};
```

**UI Sections:**

1. **Header**
   - Workspace name
   - Subtitle

2. **Stats Bar**
   - Public channels count
   - Private channels count
   - Total channels
   - Active users count

3. **Workspace Card**
   - Workspace icon/logo
   - Workspace name
   - Team ID
   - Domain
   - Connection status badge

4. **Channel Selection**
   - Filter buttons (All, None, Public Only, Private Only)
   - Scrollable channel list
   - Each channel shows:
     - Checkbox for selection
     - Icon (# for public, 🔒 for private)
     - Channel name
     - Member count
   - Selected channels highlighted

5. **User Selection**
   - Select All / Select None buttons
   - Grid of user cards
   - Each user shows:
     - Checkbox for selection
     - Avatar image
     - Real name
     - Status text (if available)
   - Selected users highlighted

6. **Extract Button**
   - Disabled if no selections
   - Shows count: "Extract from X Channels × Y Users"
   - Calls message extraction API

---

## OAuth Flow Implementation

### Complete Frontend Flow

```
1. User clicks "Connect Slack Workspace" in App.jsx
   └─ Navigates to /slack/auth
   
2. SlackAuth component renders
   └─ User clicks "Connect with Slack"
   └─ Fetches OAuth URL from backend
   └─ Redirects to Slack: window.location.href = oauth_url
   
3. User authorizes on Slack
   └─ Slack redirects to: /slack/callback?code=XXXXX
   
4. SlackCallback component renders
   └─ Extracts code from URL
   └─ Calls backend: /auth/slack/callback?code=XXXXX
   └─ Backend returns access_token
   └─ Stores token in localStorage
   └─ Renders SlackWorkspaces component
   
5. SlackWorkspaces component renders
   └─ Fetches workspace data using token
   └─ Displays channels and users
   └─ User makes selections
   └─ Clicks "Extract"
   └─ Messages sent to parent component
```

### Token Storage

**Current Implementation (Development):**

```javascript
// Store token
localStorage.setItem('slack_access_token', data.access_token);
localStorage.setItem('slack_team_id', data.team_id);
localStorage.setItem('slack_team_name', data.team_name);

// Retrieve token
const token = localStorage.getItem('slack_access_token');
```

**Production Requirements:**

⚠️ **DO NOT use localStorage for production!**

Recommended approach:
1. Backend stores token in database
2. Backend issues session token to frontend
3. Frontend sends session token with API requests
4. Backend retrieves Slack token from database

---

## Workspace Selection UI

### Channel Selection Logic

```jsx
// Toggle individual channel
const toggleChannel = (channelId) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channelId)) {
        newSelected.delete(channelId);
    } else {
        newSelected.add(channelId);
    }
    setSelectedChannels(newSelected);
};

// Select all channels
const selectAllChannels = () => {
    setSelectedChannels(new Set(workspaceData.channels.map(c => c.id)));
};

// Select none
const selectNoneChannels = () => {
    setSelectedChannels(new Set());
};

// Select only public channels
const selectPublicOnly = () => {
    setSelectedChannels(
        new Set(workspaceData.channels.filter(c => !c.is_private).map(c => c.id))
    );
};

// Select only private channels
const selectPrivateOnly = () => {
    setSelectedChannels(
        new Set(workspaceData.channels.filter(c => c.is_private).map(c => c.id))
    );
};
```

### User Selection Logic

```jsx
// Toggle individual user
const toggleUser = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
        newSelected.delete(userId);
    } else {
        newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
};

// Select all active users (excluding bots and deleted)
const selectAllUsers = () => {
    setSelectedUsers(
        new Set(workspaceData.users.filter(u => !u.deleted && !u.is_bot).map(u => u.id))
    );
};

// Select none
const selectNoneUsers = () => {
    setSelectedUsers(new Set());
};
```

### Extract Button State

```jsx
// Disable button if no selections
const isDisabled = selectedChannels.size === 0 || selectedUsers.size === 0;

// Dynamic button text
const buttonText = isDisabled
    ? (selectedChannels.size === 0 ? 'Select at least one channel' : 'Select at least one user')
    : `Extract from ${selectedChannels.size} Channel${selectedChannels.size !== 1 ? 's' : ''} × ${selectedUsers.size} User${selectedUsers.size !== 1 ? 's' : ''}`;
```

---

## State Management

### Component State

**SlackAuth:**
- `loading` - OAuth URL fetch in progress
- `error` - Error message if OAuth initiation fails

**SlackCallback:**
- `loading` - Token exchange in progress
- `error` - Error message if callback fails
- `accessToken` - Slack access token received from backend
- `hasRun` - Ref to prevent double execution

**SlackWorkspaces:**
- `loading` - Workspace data loading
- `error` - Error message if workspace fetch fails
- `workspaceData` - Complete workspace data (workspace, channels, users)
- `selectedChannels` - Set of selected channel IDs
- `selectedUsers` - Set of selected user IDs

### Data Flow

```jsx
// Parent component (SlackCallback)
const [accessToken, setAccessToken] = useState(null);

const handleExtractComplete = (result) => {
    localStorage.setItem('extracted_messages', JSON.stringify(result.messages));
    alert(`Successfully extracted ${result.message_count} messages!`);
    navigate('/new-dashboard');
};

return (
    <SlackWorkspaces 
        accessToken={accessToken}
        onExtractComplete={handleExtractComplete}
    />
);

// Child component (SlackWorkspaces)
const SlackWorkspaces = ({ accessToken, onExtractComplete }) => {
    // Use accessToken for API calls
    // Call onExtractComplete when extraction succeeds
};
```

---

## API Integration

### API Client Setup

```javascript
// Get API URL from environment
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

### API Call Examples

#### 1. Fetch OAuth URL

```javascript
const response = await fetch(`${apiUrl}/auth/slack`);
const data = await response.json();
// data.oauth_url
```

#### 2. Exchange Code for Token

```javascript
const response = await fetch(
    `${apiUrl}/auth/slack/callback?code=${encodeURIComponent(code)}`
);
const data = await response.json();
// data.access_token, data.team_id, data.team_name
```

#### 3. Fetch Workspace Data

```javascript
const response = await fetch(
    `${apiUrl}/slack/workspaces?access_token=${encodeURIComponent(accessToken)}`
);
const data = await response.json();
// data.workspace, data.channels, data.users
```

#### 4. Extract Messages

```javascript
const response = await fetch(`${apiUrl}/slack/extract`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        access_token: accessToken,
        channel_ids: Array.from(selectedChannels),
        user_ids: Array.from(selectedUsers),
    }),
});
const result = await response.json();
// result.status, result.message_count, result.messages
```

### Error Handling

```javascript
try {
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    
    // Success
    
} catch (err) {
    console.error('API Error:', err);
    setError(err.message);
}
```

---

## Styling and UX

### Design Principles

1. **Slack Branding**
   - Purple gradient backgrounds
   - Slack logo and colors
   - Professional, clean design

2. **Visual Feedback**
   - Loading spinners during async operations
   - Selected items highlighted
   - Disabled states for buttons
   - Hover effects on interactive elements

3. **Responsive Design**
   - Mobile-friendly layouts
   - Flexible grids for channels and users
   - Scrollable lists for large datasets

### Key CSS Classes

**SlackAuth.css:**
```css
.slack-auth-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.slack-connect-button {
    background: #4A154B;  /* Slack purple */
    color: white;
    padding: 16px 24px;
    border-radius: 10px;
    font-weight: 600;
}

.slack-connect-button:hover {
    background: #611f69;
    transform: translateY(-2px);
}
```

**SlackWorkspaces.css:**
```css
.channel-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.channel-item.selected {
    background: #e7f3ff;
    border: 2px solid #4A154B;
}

.extract-button:disabled {
    background: #ccc;
    cursor: not-allowed;
}
```

### Animation Details

**Loading Spinner:**
```css
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-top: 4px solid #4A154B;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
}
```

**Hover Effects:**
```css
.workspace-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}
```

---

## Error Handling

### Error Display Pattern

```jsx
if (error) {
    return (
        <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>Authorization Failed</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/')}>
                Back to Home
            </button>
        </div>
    );
}
```

### Common Error Scenarios

#### 1. OAuth Cancellation

**User cancels on Slack authorization page**

URL: `/slack/callback?error=access_denied`

```jsx
const errorParam = urlParams.get('error');
if (errorParam) {
    setError(`OAuth error: ${errorParam}`);
    return;
}
```

#### 2. Invalid Code

**Code already used or expired**

```jsx
const response = await fetch(`${apiUrl}/auth/slack/callback?code=${code}`);
const data = await response.json();

if (!response.ok || data.error) {
    setError(data.error || 'Failed to exchange authorization code');
}
```

#### 3. Network Errors

```jsx
try {
    const response = await fetch(url);
} catch (err) {
    setError('Network error. Please check your connection.');
}
```

#### 4. CORS Errors

Appears in browser console:
```
Access to fetch at 'http://localhost:8000/auth/slack' from origin 
'http://localhost:5173' has been blocked by CORS policy
```

**Solution:** Ensure backend CORS includes frontend URL

---

## Integration with Main App

### Navigation Flow

**App.jsx:**
```jsx
const channels = [
  { label: "Connect Slack Workspace", value: "/slack/auth", isSlack: true },
  // ... other channels
];
```

**DataCard.jsx:**
```jsx
const handleClick = () => {
    if (value === "/new-dashboard" || value === "/slack/auth") {
        navigate(value);  // Direct navigation for special cards
    } else {
        // Regular channel navigation
    }
};
```

### Message Flow to Clustering

```jsx
// SlackCallback.jsx
const handleExtractComplete = (result) => {
    // Store extracted messages
    localStorage.setItem('extracted_messages', JSON.stringify(result.messages));
    
    // Navigate to dashboard
    navigate('/new-dashboard');
};

// DataCollection.jsx (or wherever clustering happens)
useEffect(() => {
    const messages = localStorage.getItem('extracted_messages');
    if (messages) {
        const parsedMessages = JSON.parse(messages);
        // Send to clustering API
        clusterMessages(parsedMessages);
    }
}, []);
```

---

## Development Tips

### 1. Debugging OAuth Flow

```javascript
// Add console.logs at each step
console.log('1. Starting OAuth flow');
console.log('2. OAuth URL:', oauthUrl);
console.log('3. Callback received, code:', code);
console.log('4. Token received:', accessToken);
console.log('5. Workspace data:', workspaceData);
```

### 2. Testing Without Slack

Create mock data:
```javascript
const mockWorkspaceData = {
    workspace: {
        id: 'T123',
        name: 'Test Workspace',
        domain: 'test'
    },
    channels: [
        { id: 'C1', name: 'general', is_private: false, num_members: 10 },
        { id: 'C2', name: 'random', is_private: false, num_members: 5 }
    ],
    users: [
        { id: 'U1', name: 'alice', real_name: 'Alice' },
        { id: 'U2', name: 'bob', real_name: 'Bob' }
    ]
};
```

### 3. Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:8000

# Access in code
import.meta.env.VITE_API_URL
```

### 4. Hot Reload Issues

If changes don't appear:
```bash
# Kill and restart Vite
Ctrl+C
npm run dev
```

---

## Production Considerations

### 1. Remove Console Logs

```javascript
// Remove or disable in production
if (process.env.NODE_ENV === 'development') {
    console.log('Debug info:', data);
}
```

### 2. Error Boundaries

```jsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<div>Something went wrong</div>}>
    <SlackWorkspaces />
</ErrorBoundary>
```

### 3. Loading States

Always show feedback during async operations:
```jsx
{loading && <LoadingSpinner />}
{!loading && data && <DataDisplay />}
```

### 4. Accessibility

```jsx
// Add ARIA labels
<button aria-label="Connect with Slack">
<input type="checkbox" aria-label={`Select channel ${channel.name}`} />
```

---

## Summary

### Key Components
- **SlackAuth** - Initiates OAuth
- **SlackCallback** - Handles OAuth response
- **SlackWorkspaces** - Workspace and message selection

### Data Flow
1. User clicks connect
2. OAuth URL fetched from backend
3. User redirects to Slack
4. Callback receives code
5. Code exchanged for token
6. Token used to fetch workspace data
7. User selects channels/users
8. Messages extracted and sent to clustering

### Critical Points
- Token stored in localStorage (dev only)
- CORS must include frontend URL
- Redirect URI must match exactly
- Handle loading and error states
- Prevent double OAuth execution
- Use Sets for efficient selection tracking

### Next Steps
- Implement secure token storage
- Add real-time message updates
- Enhance error messages
- Add message preview
- Implement workspace switching
