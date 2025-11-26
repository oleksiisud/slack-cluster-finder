import http.server
import socketserver
import json
import urllib.request
import os
from urllib.parse import parse_qs, urlparse

PORT = 8080

class SlackProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/workspaces':
            self.handle_workspaces()
        else:
            # Serve static files
            super().do_GET()
    
    def handle_workspaces(self):
        # Read token from .env
        token = None
        try:
            with open('../.env', 'r') as f:
                for line in f:
                    if line.startswith('USER_TOKEN='):
                        token = line.split('=', 1)[1].strip()
                        break
        except:
            self.send_error(500, "Could not read .env file")
            return
        
        if not token:
            self.send_error(500, "USER_TOKEN not found in .env")
            return
        
        try:
            # Auth test
            auth_req = urllib.request.Request(
                'https://slack.com/api/auth.test',
                headers={'Authorization': f'Bearer {token}'}
            )
            with urllib.request.urlopen(auth_req) as response:
                auth_data = json.loads(response.read())
            
            if not auth_data.get('ok'):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'ok': False,
                    'error': auth_data.get('error', 'Authentication failed')
                }).encode())
                return
            
            # Team info
            team_req = urllib.request.Request(
                'https://slack.com/api/team.info',
                headers={'Authorization': f'Bearer {token}'}
            )
            with urllib.request.urlopen(team_req) as response:
                team_data = json.loads(response.read())
            
            # Get workspace icon
            team_obj = team_data.get('team', {})
            
            # Debug: Print what we got from team.info
            print(f"Team object from API: {json.dumps(team_obj, indent=2)}")
            
            if team_obj.get('icon'):
                # Icon is already in the team object
                workspace_icon = team_obj['icon']
                print(f"Icon found in team object: {workspace_icon}")
            else:
                # Try to get it from the auth data team_id
                team_id = auth_data.get('team_id')
                print(f"No icon in team object, using team_id: {team_id}")
                # Default Slack workspace icon URL pattern
                workspace_icon = {
                    'image_34': f'https://a.slack-edge.com/{team_id}/img/avatars-teams/ava_0001-34.png',
                    'image_44': f'https://a.slack-edge.com/{team_id}/img/avatars-teams/ava_0001-44.png',
                    'image_68': f'https://a.slack-edge.com/{team_id}/img/avatars-teams/ava_0001-68.png',
                    'image_88': f'https://a.slack-edge.com/{team_id}/img/avatars-teams/ava_0001-88.png',
                    'image_102': f'https://a.slack-edge.com/{team_id}/img/avatars-teams/ava_0001-102.png',
                    'image_132': f'https://a.slack-edge.com/{team_id}/img/avatars-teams/ava_0001-132.png',
                }
                team_obj['icon'] = workspace_icon
                print(f"Generated icon URLs: {workspace_icon}")
            
            # Add team name from auth if not in team object
            if not team_obj.get('name') and auth_data.get('team'):
                team_obj['name'] = auth_data['team']
            
            # Channels
            channels_req = urllib.request.Request(
                'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000',
                headers={'Authorization': f'Bearer {token}'}
            )
            with urllib.request.urlopen(channels_req) as response:
                channels_data = json.loads(response.read())
            
            # Users/Members
            users_req = urllib.request.Request(
                'https://slack.com/api/users.list?limit=1000',
                headers={'Authorization': f'Bearer {token}'}
            )
            with urllib.request.urlopen(users_req) as response:
                users_data = json.loads(response.read())
            
            # Send combined response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            result = {
                'ok': True,
                'auth': auth_data,
                'team': team_obj,
                'channels': channels_data.get('channels', []),
                'users': users_data.get('members', [])
            }
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'ok': False,
                'error': str(e)
            }).encode())

with socketserver.TCPServer(("", PORT), SlackProxyHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}")
    print(f"Open http://localhost:{PORT}/workspaces.html in your browser")
    httpd.serve_forever()
