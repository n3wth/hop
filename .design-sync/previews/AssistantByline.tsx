import { AssistantByline } from 'hop'

export function Default() {
  return <AssistantByline />
}

export function WithLabel() {
  return (
    <AssistantByline>
      <span style={{ fontSize: 12, color: 'var(--color-text2)' }}>hop</span>
    </AssistantByline>
  )
}
