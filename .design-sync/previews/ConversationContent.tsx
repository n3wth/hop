import { Conversation, ConversationContent, Message, MessageContent } from 'hop'

export function Thread() {
  return (
    <div style={{ height: 220, border: '1px solid var(--color-border)', borderRadius: 12 }}>
      <Conversation>
        <ConversationContent>
          <Message from="assistant">
            <MessageContent>Ready when you are — where are you headed?</MessageContent>
          </Message>
          <Message from="user">
            <MessageContent>Tokyo, business class, sometime in April.</MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>
    </div>
  )
}
