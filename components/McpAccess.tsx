'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Icon from './Icon'
import type { ApiTokenInfo } from '@/lib/api-tokens'

// "Use hop from your LLM (MCP)" — mint/rename/revoke a hop API token, pick your
// MCP client, and copy the exact connect instructions for THAT client. The token
// links this hop account to the MCP server so its tools (price_trip, verdict,
// sweet_spots, transfer_paths) can read THIS user's real balances. Flat, on-brand,
// no emojis. Server endpoints: /api/mcp-token (GET/POST/PATCH/DELETE).

type Props = { initialTokens: ApiTokenInfo[] }

// The selectable MCP-capable clients. Each renders its OWN connect snippet from
// the live server URL + the user's token (or a placeholder until one is minted).
type ClientId = 'claude-desktop' | 'claude-code' | 'cursor' | 'chatgpt' | 'generic'

const CLIENTS: { id: ClientId; label: string }[] = [
  { id: 'claude-desktop', label: 'Claude Desktop' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'generic', label: 'Any MCP client' },
]

function CopyButton({
  value,
  label,
  onCopied,
}: {
  value: string
  label: string
  // Fired on a successful copy — lets the fresh-token panel record that the
  // one-time secret has been captured.
  onCopied?: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          onCopied?.()
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard can fail (permissions); no-op, the value is still visible.
        }
      }}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text"
    >
      <Icon name={copied ? 'check' : 'content_copy'} size={16} />
      {copied ? 'Copied' : label}
    </button>
  )
}

// A labelled, copyable config block. `kind` switches the eyebrow label between a
// filename (JSON), a shell command, or a plain hint.
function ConfigBlock({
  label,
  body,
  copyValue,
  copyLabel,
}: {
  label: string
  body: string
  copyValue: string
  copyLabel: string
}) {
  return (
    <div className="mt-3 rounded-[12px] border border-border bg-sunk px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text2">
          {label}
        </div>
        <CopyButton value={copyValue} label={copyLabel} />
      </div>
      <pre className="mt-2 overflow-x-auto font-mono text-[12.5px] leading-[1.5] text-text">{body}</pre>
    </div>
  )
}

// Two-step inline confirm for destructive actions — no modal (flat design). First
// click arms ("Confirm?"), second click within the window runs it; auto-disarms.
function useConfirm(timeoutMs = 4000) {
  const [armedId, setArmedId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  function arm(id: string) {
    setArmedId(id)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setArmedId(null), timeoutMs)
  }
  function disarm() {
    if (timer.current) clearTimeout(timer.current)
    setArmedId(null)
  }
  return { armedId, arm, disarm }
}

export default function McpAccess({ initialTokens }: Props) {
  const [tokens, setTokens] = useState<ApiTokenInfo[]>(initialTokens)
  const [fresh, setFresh] = useState<string | null>(null) // plaintext shown once
  // Whether the freshly minted token has been captured (copied) or dismissed.
  // While a fresh token is uncopied, revoke/rename are locked so the user can't
  // lose the one-time secret by navigating away from the panel.
  const [freshCopied, setFreshCopied] = useState(false)
  const [client, setClient] = useState<ClientId>('claude-desktop')
  const [mintName, setMintName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()

  // A fresh token is "unsecured" until the user copies or dismisses it.
  const freshUnsecured = fresh !== null && !freshCopied

  // The MCP server URL is the streamable-HTTP endpoint on THIS origin. Computed
  // client-side so it's correct in dev, preview, and prod without env wiring.
  const mcpUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'

  // The token to thread through the snippets: the freshly minted plaintext if we
  // just made one, else a clear placeholder the user swaps for their own.
  const token = fresh ?? '<your-hop-token>'

  function mint() {
    const name = mintName.trim()
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/mcp-token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name || 'Token' }),
        })
        const data = await res.json().catch(() => null)
        if (data?.ok && data.token) {
          setFresh(data.token as string)
          setFreshCopied(false)
          setTokens((t) => [data.info as ApiTokenInfo, ...t])
          setMintName('')
        } else {
          setError(data?.error ?? 'Could not mint a token. Try again.')
        }
      } catch {
        setError('Could not reach the server. Try again.')
      }
    })
  }

  function revoke(id: string) {
    // Never revoke while an uncopied fresh token is on screen.
    if (freshUnsecured) return
    setError(null)
    confirm.disarm()
    startTransition(async () => {
      try {
        const res = await fetch(`/api/mcp-token?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        const data = await res.json().catch(() => null)
        if (data?.ok) setTokens((t) => t.filter((x) => x.id !== id))
        else setError(data?.error ?? 'Could not revoke that token. Try again.')
      } catch {
        setError('Could not reach the server. Try again.')
      }
    })
  }

  function startRename(t: ApiTokenInfo) {
    if (freshUnsecured) return
    setEditingId(t.id)
    setEditName(t.name || '')
  }

  function saveRename(id: string) {
    const name = editName
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/mcp-token', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, name }),
        })
        const data = await res.json().catch(() => null)
        if (data?.ok && data.info) {
          const info = data.info as ApiTokenInfo
          setTokens((t) => t.map((x) => (x.id === id ? info : x)))
          setEditingId(null)
          setEditName('')
        } else {
          setError(data?.error ?? 'Could not rename that token. Try again.')
        }
      } catch {
        setError('Could not reach the server. Try again.')
      }
    })
  }

  function dismissFresh() {
    setFresh(null)
    setFreshCopied(false)
  }

  // Per-client snippet + copy payload, recomputed when the client or token change.
  const snippet = useMemo(() => {
    const jsonConfig = JSON.stringify(
      {
        mcpServers: {
          hop: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } },
        },
      },
      null,
      2,
    )
    switch (client) {
      case 'claude-desktop':
        return {
          help:
            'Open Claude Desktop > Settings > Developer > Edit Config, then merge this into claude_desktop_config.json and restart Claude.',
          label: 'claude_desktop_config.json',
          body: jsonConfig,
          copyValue: jsonConfig,
          copyLabel: 'Copy config',
        }
      case 'claude-code': {
        const cmd = `claude mcp add --transport http hop ${mcpUrl} \\\n  --header "Authorization: Bearer ${token}"`
        return {
          help: 'Run this in your terminal. It registers hop as an HTTP MCP server for Claude Code.',
          label: 'terminal',
          body: cmd,
          copyValue: cmd,
          copyLabel: 'Copy command',
        }
      }
      case 'cursor':
        return {
          help:
            'Cursor > Settings > MCP > Add new server, or merge this into ~/.cursor/mcp.json, then reload.',
          label: '~/.cursor/mcp.json',
          body: jsonConfig,
          copyValue: jsonConfig,
          copyLabel: 'Copy config',
        }
      case 'chatgpt': {
        const body = `Server URL\n${mcpUrl}\n\nAuthentication\nBearer ${token}`
        return {
          help:
            'In ChatGPT (where MCP / connectors are enabled), add a custom connector with this URL and a Bearer token.',
          label: 'connector settings',
          body,
          copyValue: mcpUrl,
          copyLabel: 'Copy URL',
        }
      }
      case 'generic':
      default: {
        const body = `Server URL\n${mcpUrl}\n\nTransport\nstreamable HTTP\n\nAuth header\nAuthorization: Bearer ${token}`
        return {
          help:
            'Point any MCP client at the server URL over streamable HTTP and send your token in the Authorization header.',
          label: 'any MCP client',
          body,
          copyValue: mcpUrl,
          copyLabel: 'Copy URL',
        }
      }
    }
  }, [client, mcpUrl, token])

  return (
    <div>
      {/* server URL */}
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
        Add hop&apos;s verdict engine to your favourite LLM. Pick your client below for
        the exact setup, then mint a token. Without a token the tools still work —
        they just won&apos;t know your balances.
      </p>

      {/* client selector */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text2">
          Your MCP client
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLIENTS.map((c) => {
            const active = c.id === client
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setClient(c.id)}
                aria-pressed={active}
                className={
                  active
                    ? 'rounded-[10px] border border-brand bg-brand-light px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-deep'
                    : 'rounded-[10px] border border-border bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text'
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* per-client config */}
      <p className="mt-4 text-[12.5px] leading-[1.5] text-text2">{snippet.help}</p>
      <ConfigBlock
        label={snippet.label}
        body={snippet.body}
        copyValue={snippet.copyValue}
        copyLabel={snippet.copyLabel}
      />
      {/* No token yet — the snippet carries a placeholder, so say so plainly. */}
      {!fresh && tokens.length === 0 ? (
        <p className="mt-2 text-[12px] leading-[1.5] text-text2">
          This config uses a placeholder. Mint a token below and swap it in for{' '}
          <code className="font-mono">&lt;your-hop-token&gt;</code> — without one the tools
          run, but won&apos;t see your balances.
        </p>
      ) : null}

      {/* freshly minted plaintext — shown once. Sticky until copied or dismissed:
          while uncopied it stays put and locks revoke/rename so the one-time
          secret can't be lost. */}
      {fresh ? (
        <div className="mt-4 rounded-[12px] border border-brand-light bg-brand-light px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div role="status" className="text-[12px] font-semibold text-brand-deep">
              {freshCopied
                ? 'Token copied — store it now. It won’t be shown again.'
                : 'Copy your token now — it won’t be shown again.'}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <CopyButton value={fresh} label="Copy token" onCopied={() => setFreshCopied(true)} />
              <button
                type="button"
                onClick={dismissFresh}
                className="inline-flex flex-shrink-0 items-center rounded-[10px] border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text"
              >
                Dismiss
              </button>
            </div>
          </div>
          <code className="mt-2 block break-all font-mono text-[12.5px] text-brand-deep">
            {fresh}
          </code>
        </div>
      ) : null}

      {/* mint/revoke/rename failures — previously swallowed. */}
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-weak">
          {error}
        </p>
      ) : null}

      {/* mint — with a name */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={mintName}
          onChange={(e) => setMintName(e.target.value)}
          placeholder="Token name (e.g. Laptop)"
          maxLength={60}
          className="min-w-0 flex-1 rounded-[12px] border border-border bg-sunk px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text3 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={mint}
          disabled={pending}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-[12px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          <Icon name="add" size={16} />
          Mint a token
        </button>
      </div>

      {/* existing tokens — with inline rename */}
      {tokens.length > 0 ? (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                {editingId === t.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={60}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(t.id)
                        if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditName('')
                        }
                      }}
                      className="min-w-0 flex-1 rounded-[10px] border border-border bg-sunk px-3 py-1.5 text-[13.5px] text-text focus:border-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveRename(t.id)}
                      disabled={pending}
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[10px] bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
                    >
                      <Icon name="check" size={16} />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        setEditName('')
                      }}
                      className="inline-flex flex-shrink-0 items-center rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              {editingId === t.id ? null : (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startRename(t)}
                    disabled={pending || freshUnsecured}
                    title={freshUnsecured ? 'Copy your new token first' : undefined}
                    className="inline-flex items-center rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text disabled:opacity-50"
                  >
                    Rename
                  </button>
                  {confirm.armedId === t.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => revoke(t.id)}
                        disabled={pending}
                        className="inline-flex items-center rounded-[10px] border border-weak px-3 py-1.5 text-[12.5px] font-semibold text-weak transition-colors disabled:opacity-60"
                      >
                        Confirm?
                      </button>
                      <button
                        type="button"
                        onClick={confirm.disarm}
                        disabled={pending}
                        className="inline-flex items-center rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => confirm.arm(t.id)}
                      disabled={pending || freshUnsecured}
                      title={freshUnsecured ? 'Copy your new token first' : undefined}
                      className="inline-flex items-center rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:text-weak disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
