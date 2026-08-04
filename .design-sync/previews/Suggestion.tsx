import { Suggestions, Suggestion } from 'hop'

export function Row() {
  return (
    <Suggestions>
      <Suggestion suggestion="Best use of 100k points" />
      <Suggestion suggestion="Business class to Europe" />
      <Suggestion suggestion="Cheapest way to Tokyo" />
    </Suggestions>
  )
}
