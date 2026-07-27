import { PromptInput, PromptInputTextarea, PromptInputSubmit } from 'hop'

export function Ready() {
  return (
    <PromptInput onSubmit={(e) => e.preventDefault()} style={{ maxWidth: 420 }}>
      <PromptInputTextarea defaultValue="Find me business class to Tokyo in April" />
      <PromptInputSubmit />
    </PromptInput>
  )
}

export function Streaming() {
  return (
    <PromptInput onSubmit={(e) => e.preventDefault()} style={{ maxWidth: 420 }}>
      <PromptInputTextarea defaultValue="Find me business class to Tokyo in April" />
      <PromptInputSubmit status="streaming" />
    </PromptInput>
  )
}
