import { Conversation, ConversationContent, ConversationScrollButton, Message, MessageContent } from 'hop'

// use-stick-to-bottom auto-sticks the view to the latest message on mount, so
// this "scroll to latest" pill only appears once a user has scrolled up —
// an interaction this static preview can't reproduce. Composed in its real
// parent regardless, per hop's design-sync convention for context-bound leaves.
export function InConversation() {
  return (
    <div style={{ position: 'relative', height: 160, border: '1px solid var(--color-border)', borderRadius: 12 }}>
      <Conversation>
        <ConversationContent>
          <Message from="assistant">
            <MessageContent>Searching award space for SFO → NRT…</MessageContent>
          </Message>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  )
}
