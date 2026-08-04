import { PromptInput, PromptInputTextarea } from 'hop'

export function WithValue() {
  return (
    <PromptInput onSubmit={(e) => e.preventDefault()} style={{ maxWidth: 420 }}>
      <PromptInputTextarea defaultValue="What's the best way to use 100k Chase points?" />
    </PromptInput>
  )
}

export function Placeholder() {
  return (
    <PromptInput onSubmit={(e) => e.preventDefault()} style={{ maxWidth: 420 }}>
      <PromptInputTextarea placeholder="Ask hop anything about your points…" />
    </PromptInput>
  )
}
