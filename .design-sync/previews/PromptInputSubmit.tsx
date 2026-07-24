import { PromptInputSubmit } from 'hop'

export function Ready() {
  return <PromptInputSubmit />
}

export function Streaming() {
  return <PromptInputSubmit status="streaming" />
}

export function ErrorRetry() {
  return <PromptInputSubmit status="error" />
}

export function Disabled() {
  return <PromptInputSubmit disabled />
}
