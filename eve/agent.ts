// The hop travel agent. Eve loads instructions.md as the system role, tools/ as
// the callable tools, skills/ as contextual playbooks, channels/ as the I/O
// surfaces, and schedules/ as the proactive runners.
//
// WHY this model: 'anthropic/claude-sonnet-4-6' matches the in-app concierge
// (lib/concierge-*.ts), so the proactive agent and the reactive /ask surface
// reason and write in the same voice. The model id is resolved through Vercel's
// AI Gateway at call time (no provider SDK wiring here) — the same gateway the
// concierge already calls.

import { defineAgent } from 'eve'

export default defineAgent({
  // Resolved via AI Gateway. Keep in lockstep with the concierge's model.
  model: 'anthropic/claude-sonnet-4-6',
})
