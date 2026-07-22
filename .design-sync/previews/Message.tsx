import { Message, MessageContent, AssistantByline } from 'hop'

export function UserTurn() {
  return (
    <Message from="user">
      <MessageContent>How many United miles do I need for SFO to NRT in business?</MessageContent>
    </Message>
  )
}

export function AssistantTurn() {
  return (
    <Message from="assistant">
      <AssistantByline />
      <MessageContent>Around 140,000 miles round-trip on ANA — a 5.4¢/pt value.</MessageContent>
    </Message>
  )
}
