'use strict';

const MCP_URL = 'https://mcp.notify-me.app/mcp';
const SERVER_NAME = 'notify-me';
const ENV = 'NOTIFYME_API_KEY';

// Each client gets a config that reads the key from the environment by default,
// so nothing secret ends up in a dotfile or a chat transcript.
// withKey=true inlines the actual key (only when the user explicitly asks).
function render(client, { withKey = false, key = '' } = {}) {
  const k = withKey ? key : null;
  switch (client) {
    case 'claude-code': {
      const header = k ? `Authorization: Bearer ${k}` : `Authorization: Bearer $${ENV}`;
      const json = {
        mcpServers: {
          [SERVER_NAME]: {
            type: 'http',
            url: MCP_URL,
            headers: { Authorization: k ? `Bearer ${k}` : `Bearer \${${ENV}}` },
          },
        },
      };
      return [
        '# Claude Code - one-liner (user scope):',
        `claude mcp add --transport http --scope user ${SERVER_NAME} ${MCP_URL} --header "${header}"`,
        '',
        '# ...or commit this as .mcp.json in a project (the key stays in your env):',
        JSON.stringify(json, null, 2),
      ].join('\n');
    }
    case 'cursor': {
      const json = {
        mcpServers: {
          [SERVER_NAME]: {
            url: MCP_URL,
            headers: { Authorization: k ? `Bearer ${k}` : `Bearer \${env:${ENV}}` },
          },
        },
      };
      return ['# Cursor - ~/.cursor/mcp.json (global) or .cursor/mcp.json (project):',
        JSON.stringify(json, null, 2)].join('\n');
    }
    case 'codex': {
      const lines = [
        '# Codex CLI - ~/.codex/config.toml:',
        `[mcp_servers.${SERVER_NAME.replace('-', '_')}]`,
        `url = "${MCP_URL}"`,
      ];
      if (k) lines.push(`http_headers = { "Authorization" = "Bearer ${k}" }`);
      else lines.push(`bearer_token_env_var = "${ENV}"`);
      return lines.join('\n');
    }
    default:
      throw new Error(`Unknown client "${client}". Use: claude-code, cursor, codex, all`);
  }
}

module.exports = { render, MCP_URL, ENV, CLIENTS: ['claude-code', 'cursor', 'codex'] };
