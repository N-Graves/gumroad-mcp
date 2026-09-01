/**
 * Joel is a fully isolated personal-companion agent (Nathan's daughter's
 * agent) - never business fleet, never these tools. Confirmed live
 * 2026-08-31: `agents.list[].tools.deny` does NOT reach the claude-cli
 * backend - the code that builds that subprocess's MCP config
 * (`loadMergedBundleMcpConfig`) takes no agentId/denylist parameter at all,
 * so a denied server's tools remain directly callable there (proven:
 * `devto_list_my_articles` succeeded from Joel's own session despite a
 * config-level deny).
 *
 * Read tools deliberately have no `agent_id` argument in their schema (the
 * "open to any caller" design), so an argument-based check is structurally
 * impossible for them - there is nothing to check. The one identity signal
 * that is NOT self-reported by the model is the environment: OpenClaw sets
 * OPENCLAW_MCP_AGENT_ID on the spawned claude-cli process, inherited down
 * to this server's own process env (the same way FLEET_BOARD_URL/
 * COMFYUI_URL already are on other servers with no explicit passthrough
 * declared) - the same way it reaches muse-image-tools' equivalent module.
 *
 * CORRECTION 2026-08-31, same day: the claim above that "every agent here
 * runs on the claude-cli backend" was wrong. Measured from the gateway's
 * own journal: this fleet's real default path is the EMBEDDED runtime
 * calling the Anthropic API directly (provider=anthropic,
 * model=claude-sonnet-5) - ~374 requests to 14 claude-cli execs over one 3h
 * sample. claude-cli is the minority path (heartbeat ticks and some user
 * turns), not the norm.
 *
 * Checked empirically, not re-reasoned from the same code: fired a genuine
 * embedded-path turn, caught the freshly-spawned MCP server process at
 * process age 0, and read its real /proc/<pid>/environ. Result: USER, HOME,
 * LOGNAME, TERM, PATH, SHELL, PWD - nothing else. NO OPENCLAW_MCP_*
 * variable of any kind reaches a server's process on the embedded path.
 * The inheritance this module relies on is real but claude-cli-specific -
 * OpenClaw's own embedded spawner uses the MCP SDK's getDefaultEnvironment()
 * plus only the server's own configured env, no OpenClaw context at all.
 *
 * So assertNotIsolatedAgent() genuinely protects the claude-cli minority
 * and silently, permanently no-ops on the embedded majority (envAgentId is
 * always undefined there - the check just never fires, no error, no
 * warning). That is not a flaw in this module - the signal it depends on
 * does not exist on that path and cannot be added at Level 1/2 config.
 * What covers the embedded path is `agents.list[].tools.deny` on joel's OWN
 * agent entry - a DIFFERENT, gateway-side mechanism this file cannot reach
 * and does not duplicate. Verified live the same day on the identical code
 * path against a real business-agent deny list on a genuine embedded turn
 * (the gateway's own tool-policy log naming the exact tools removed) - not
 * tested against joel specifically, since joel is out of scope for the
 * session that found this.
 *
 * Net: this module and joel's tools.deny are complementary, not redundant -
 * each covers exactly the path the other structurally cannot reach.
 */
const ISOLATED_AGENT_IDS = new Set(["joel"]);

export class IsolatedAgentError extends Error {}

export class IdentityMismatchError extends Error {}

/**
 * Verify that the `agent_id` a caller CLAIMS in its tool arguments matches the
 * real, OpenClaw-set identity of the process this call arrived on.
 *
 * Every capability gate in this fleet (`requireCapability`/`checkCapability`)
 * is explicitly documented as a CLAIMED-identity check: it trusts the
 * `agent_id` argument, because that was historically the only signal
 * available. On the claude-cli path that is no longer true -
 * OPENCLAW_MCP_AGENT_ID is present in this process's own environment and
 * cannot be set or overridden by anything the calling model passes as a tool
 * argument. So where that signal exists, a lie is now detectable, and the
 * capability gate downstream gets to trust an identity that has actually been
 * checked rather than merely asserted.
 *
 * Deliberately no-ops in two cases rather than raising:
 *   - No OPENCLAW_MCP_AGENT_ID (the embedded Anthropic-API path, which is this
 *     fleet's DOMINANT path - see this file's header correction). There is no
 *     signal there to compare against; raising on an absence that was never a
 *     lie would break every embedded turn. That path is covered by
 *     `agents.list[].tools.deny` at the gateway instead.
 *   - The tool takes no `agent_id` at all (this fleet's deliberately-public
 *     read tools). Nothing was claimed, so nothing can be a lie.
 *
 * This is NOT a capability check and does not replace one - those still run
 * exactly as before, on top. This only establishes that the identity they are
 * about to trust is genuine.
 */
export function assertClaimedIdentityIsReal(claimed: unknown): void {
  const realAgentId = process.env.OPENCLAW_MCP_AGENT_ID;
  if (!realAgentId) return;
  if (typeof claimed !== "string" || !claimed) return;
  if (claimed !== realAgentId) {
    throw new IdentityMismatchError(
      `This call claims agent_id="${claimed}" but the real, OpenClaw-verified ` +
        `caller is "${realAgentId}" - refused before any capability check or ` +
        `side effect ran.`,
    );
  }
}

/** Refuse every call from an isolated agent, regardless of which tool. */
export function assertNotIsolatedAgent(): void {
  const envAgentId = process.env.OPENCLAW_MCP_AGENT_ID;
  if (envAgentId && ISOLATED_AGENT_IDS.has(envAgentId)) {
    throw new IsolatedAgentError(
      `This process is running for agent "${envAgentId}", which is fully isolated ` +
        `from the business fleet and may not call any tool on this server - read or write.`,
    );
  }
}
