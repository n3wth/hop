import { Message, MessageContent } from 'hop'

export function UserBubble() {
  return (
    <Message from="user">
      <MessageContent>Tokyo, business class, sometime in April.</MessageContent>
    </Message>
  )
}

export function AssistantProse() {
  return (
    <Message from="assistant">
      <MessageContent>70,000 miles one-way — availability opens up on Tuesdays and Wednesdays.</MessageContent>
    </Message>
  )
}
