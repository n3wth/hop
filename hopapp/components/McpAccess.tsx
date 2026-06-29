'use client'

import { useState, useTransition } from 'react'
import Icon from './Icon'
import type { ApiTokenInfo } from '@/lib/api-tokens'

// "Add to Claude" — mint/revoke a hop API token and copy the MCP server URL +
// setup instructions. The token links this hop account to the MCP server so its
// tools (price_trip, verdict, sweet_spots, transfer_paths) can read THIS user's
// real balances. Flat, on-brand, no emojis. Server endpoints: /api/mcp-token.

type Props = { initialTokens: ApiTokenInfo[] }

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard can fail (permissions); no-op, the value is still visible.
        }
      }}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text"
    >
      <Icon name={copied ? 'check' : 'content_copy'} size={15} />
      {copied ? 'Copied' : label}
    </button>
  )
}

export default function McpAccess({ initialTokens }: Props) {
  const [tokens, setTokens] = useState<ApiTokenInfo[]>(initialTokens)
  const [fresh, setFresh] = useState<string | null>(null) // plaintext shown once
  const [pending, startTransition] = useTransition()

  // The MCP server URL is the streamable-HTTP endpoint on THIS origin. Computed
  // client-side so it's correct in dev, preview, and prod without env wiring.
  const mcpUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'

  function mint() {
    startTransition(async () => {
      const res = await fetch('/api/mcp-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Claude' }),
      })
      const data = await res.json().catch(() => null)
      if (data?.ok && data.token) {
        setFresh(data.token as string)
        setTokens((t) => [data.info as ApiTokenInfo, ...t])
      }
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/mcp-token?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) setTokens((t) => t.filter((x) => x.id !== id))
    })
  }

  return (
    <div className="mt-4 rounded-[16px] border border-border bg-surface px-6 py-6">
      {/* server URL + add-to-claude config */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text2">
            MCP server URL
          </div>
          <code className="mt-1 block truncate font-mono text-[13.5px] text-text">{mcpUrl}</code>
        </div>
        <CopyButton value={mcpUrl} label="Copy URL" />
      </div>

      <p className="mt-4 text-[13.5px] leading-[1.55] text-text2">
        Add hop&apos;s verdict engine to Claude (or any MCP client). Mint a token below,
        then add the server. Without a token the tools still work — they just
        won&apos;t know your balances.
      </p>

      {/* Add-to-Claude config block */}
      <div className="mt-3 rounded-[12px] border border-border bg-sunk px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text2">
            claude_desktop_config.json
          </div>
          <CopyButton
            value={JSON.stringify(
              {
                mcpServers: {
                  hop: {
                    url: mcpUrl,
                    headers: { Authorization: `Bearer ${fresh ?? '<your-hop-token>'}` },
                  },
                },
              },
              null,
              2,
            )}
            label="Copy config"
          />
        </div>
        <pre className="mt-2 overflow-x-auto font-mono text-[12.5px] leading-[1.5] text-text">{`{
  "mcpServers": {
    "hop": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ${fresh ?? '<your-hop-token>'}" }
    }
  }
}`}</pre>
      </div>

      {/* freshly minted plaintext — shown once */}
      {fresh ? (
        <div className="mt-4 rounded-[12px] border border-brand-light bg-brand-light px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-semibold text-brand-deep">
              Copy your token now — it won&apos;t be shown again.
            </div>
            <CopyButton value={fresh} label="Copy token" />
          </div>
          <code className="mt-2 block break-all font-mono text-[12.5px] text-brand-deep">
            {fresh}
          </code>
        </div>
      ) : null}

      {/* mint */}
      <div className="mt-4">
        <button
          type="button"
          onClick={mint}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[12px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          <Icon name="add" size={17} />
          Mint a token
        </button>
      </div>

      {/* existing tokens */}
      {tokens.length > 0 ? (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-text">
                  {t.name || 'Token'}{' '}
                  <span className="font-mono text-[12.5px] font-normal text-text2">
                    ••••{t.lastFour}
                  </span>
                </div>
                <div className="text-[12px] text-text2">
                  {t.lastUsedAt
                    ? `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                    : 'Never used'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke(t.id)}
                disabled={pending}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text disabled:opacity-60"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
