import { Conversation, ConversationContent, ConversationScrollButton, Message, MessageContent } from 'hop'

export function ThreadWithScroll() {
  return (
    <div style={{ position: 'relative', height: 220, border: '1px solid var(--color-border)', borderRadius: 12 }}>
      <Conversation>
        <ConversationContent>
          <Message from="user">
            <MessageContent>How many United miles do I need for SFO to NRT in business?</MessageContent>
          </Message>
          <Message from="assistant">
            <MessageContent>Around 140,000 miles round-trip on ANA via United MileagePlus — that&rsquo;s a 5.4¢/pt value, well above cash.</MessageContent>
          </Message>
          <Message from="user">
            <MessageContent>What about one-way in April?</MessageContent>
          </Message>
          <Message from="assistant">
            <MessageContent>70,000 miles one-way, same route — availability opens up on Tuesdays and Wednesdays.</MessageContent>
          </Message>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  )
}
