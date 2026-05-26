import { useState, useEffect } from 'react'
import { EVIDENCE, CORRECT_EVIDENCE_IDS } from './data/evidence'

// ── Scenario ──────────────────────────────────────────────────
type Target = { id: string; service: string; version: string; tag: string }

const SCENARIO = {
  incidentId: 'INCIDENT-2247',
  summary: 'POST /auth/validate → 403 since 03:14 UTC. All sessions invalidated.',
  correctTargetId: 'tgt-02',
  targets: [
    { id: 'tgt-01', service: 'auth-service',     version: 'v2.3.2', tag: 'current deploy'  },
    { id: 'tgt-02', service: 'auth-service',     version: 'v2.3.1', tag: 'last stable'     },
    { id: 'tgt-03', service: 'auth-service',     version: 'v2.2.9', tag: 'prev stable'     },
    { id: 'tgt-04', service: 'redis-cluster',    version: 'v7.0.8', tag: 'infra'           },
    { id: 'tgt-05', service: 'api-gateway',      version: 'v1.5.0', tag: 'upstream'        },
    { id: 'tgt-06', service: 'session-manager',  version: 'v3.1.0', tag: 'session layer'   },
    { id: 'tgt-07', service: 'oauth-proxy',      version: 'v2.0.4', tag: 'auth layer'      },
    { id: 'tgt-08', service: 'user-service',     version: 'v4.2.1', tag: 'dependent svc'   },
    { id: 'tgt-09', service: 'notification-svc', version: 'v1.0.9', tag: 'downstream'      },
    { id: 'tgt-10', service: 'audit-logger',     version: 'v2.1.3', tag: 'infra'           },
  ] as Target[],
}

// ── Bob terminal lines ─────────────────────────────────────────
const BOB_LINES = [
  '$ status --all',
  '',
  'AUTH_SERVICE    [DEGRADED]',
  'REDIS_CLUSTER   [3/5 nodes]',
  'SESSION_STORE   [readonly]',
  'OAUTH_PROXY     [healthy]',
  'API_GATEWAY     [healthy]',
  'AUDIT_LOG       [writing]',
  '',
  '─────────────────────────',
  '',
  'last deploy',
  '  svc: auth-service',
  '  tag: v2.3.2',
  '  sha: a3f8d12',
  '  by:  svc-deploy-bot',
  '  ago: 7 min',
  '',
  '─────────────────────────',
  '',
  'rollback-lock: NONE',
  'approvals-needed: 1',
  'your-clearance: SRE-L2',
]

const BOB_LINES_S2 = [
  '$ correlate --window 02:55-03:14',
  '',
  'scanning git log...',
  'scanning fw rules...',
  'scanning auth config...',
  '',
  '─────────────────────────',
  '',
  'anomaly clusters:',
  '  window: 03:05–03:14 UTC',
  '  actors: multiple',
  '  surfaces: auth, net,',
  '             data-store',
  '',
  '─────────────────────────',
  '',
  'pivot on actor + service',
  '+ timestamp clusters.',
  '',
  'not all noise is random.',
  'look for a sequence.',
  '',
  '$ [cursor]',
]

const BOB_LINES_S3 = [
  '$ deploy --remediate',
  '',
  'three patches queued:',
  '  1. ssh authorized_keys',
  '  2. redis config',
  '  3. firewall rules',
  '',
  '─────────────────────────',
  '',
  'apply in order.',
  'no retries.',
  'wrong fix =',
  '  cascade failure.',
  '',
  '─────────────────────────',
  '',
  'you have 1:30.',
  '',
  'do not miss.',
  '',
  '$ [cursor]',
]

const BOB_LINES_WIN = [
  '$ bob --debrief final',
  '─────────────────────────',
  '',
  'Incident closed.',
  'Auth restored.',
  'Breach contained.',
  'Remediation deployed.',
  '',
  'What we know:',
  '  SSH key injected via',
  '  garth push at 03:08.',
  '  Redis config altered —',
  '  token replay enabled.',
  '  Port 8448 opened for',
  '  exfil — now closed.',
  '',
  "What we don't know:",
  '  Whether data left before',
  '  containment. Logs are',
  '  inconclusive.',
  '',
  'Good run.',
  '',
  '$ [cursor]',
]

const BOB_LINES_LOSE = [
  '$ bob --debrief final',
  '─────────────────────────',
  '',
  'Run terminated.',
  '',
  'Auth is still dark.',
  'Data window is closing.',
  '',
  'What you had was real.',
  "Don't lose it.",
  '',
  'Scenario rerolls.',
  "Logic doesn't.",
  '',
  'The breach is still open.',
  '',
  '$ [cursor]',
]

// ── Stage 3 code blocks ────────────────────────────────────────
type CodeLine  = { text: string; kind: 'ctx' | 'bad' }
type FixOption = { id: string; label: string; correct: boolean }
type CodeBlock = { id: string; filename: string; service: string; lines: CodeLine[]; options: FixOption[] }

const BLOCKS: CodeBlock[] = [
  {
    id: 'blk-ssh',
    filename: 'authorized_keys',
    service: 'auth-service/.ssh/',
    lines: [
      { text: '# managed by auth-service deploy', kind: 'ctx' },
      { text: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILk8rQvZ ops-key-01', kind: 'ctx' },
      { text: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI9mP2ZkR ops-key-02', kind: 'ctx' },
      { text: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIX7qFhW garth@unknown-host', kind: 'bad' },
    ],
    options: [
      { id: 'ssh-a', label: 'Remove injected key — restore to ops-key-01 and ops-key-02 only', correct: true  },
      { id: 'ssh-b', label: 'Remove all authorized keys from this service',                    correct: false },
      { id: 'ssh-c', label: 'Rotate all keys to newly generated values',                       correct: false },
    ],
  },
  {
    id: 'blk-redis',
    filename: 'redis.conf',
    service: 'infrastructure/redis/',
    lines: [
      { text: 'bind 127.0.0.1',            kind: 'ctx' },
      { text: 'maxmemory 2gb',             kind: 'ctx' },
      { text: 'maxmemory-policy noeviction', kind: 'bad' },
      { text: 'requirepass ""',             kind: 'bad' },
      { text: 'loglevel notice',           kind: 'ctx' },
    ],
    options: [
      { id: 'redis-a', label: 'Restore maxmemory-policy volatile-lru and requirepass hash', correct: true  },
      { id: 'redis-b', label: 'Flush all Redis data and reset to factory defaults',         correct: false },
      { id: 'redis-c', label: 'Set maxmemory to 0 and purge all session tokens',            correct: false },
    ],
  },
  {
    id: 'blk-fw',
    filename: 'firewall.nix',
    service: 'infrastructure/firewall/',
    lines: [
      { text: 'networking.firewall = {',                              kind: 'ctx' },
      { text: '  allowedTCPPorts = [ 80 443 22 ];',                  kind: 'ctx' },
      { text: "  extraCommands = ''",                                 kind: 'ctx' },
      { text: '    iptables -A OUTPUT -p tcp --dport 8448 -j ACCEPT', kind: 'bad' },
      { text: "  '';",                                                kind: 'ctx' },
      { text: '};',                                                   kind: 'ctx' },
    ],
    options: [
      { id: 'fw-a', label: 'Remove the port 8448 outbound ACCEPT rule',                   correct: true  },
      { id: 'fw-b', label: 'Set OUTPUT policy to DROP — block all outbound traffic',       correct: false },
      { id: 'fw-c', label: 'Replace with rate-limited rule (10 conn/min on port 8448)',   correct: false },
    ],
  },
]

// ── Types ─────────────────────────────────────────────────────
type Screen = 'start' | 'menu' | 'playing' | 'stage2' | 'stage3' | 'win' | 'gameover'

type EndStats = {
  loopCount: number
  completionSecs: number | null
  evidenceAccuracy: number | null
  rollbackAttempts: number
}

const TIMER_START        = 300
const STAGE2_TIMER_START = 600
const STAGE3_TIMER_START = 90

// ── Helpers ───────────────────────────────────────────────────
function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const LETTERS = ['A', 'B', 'C']

// ── App ───────────────────────────────────────────────────────
export default function App() {
  // Stage 1
  const [screen, setScreen]               = useState<Screen>('start')
  const [selected, setSelected]           = useState<string | null>(null)
  const [timeLeft, setTimeLeft]           = useState(TIMER_START)
  const [penalty, setPenalty]             = useState<string | null>(null)
  const [rollbackAttempts, setRollbackAttempts] = useState(0)

  // Stage 2
  const [stage2TimeLeft, setStage2TimeLeft] = useState(STAGE2_TIMER_START)
  const [pinnedIds, setPinnedIds]           = useState<string[]>([])
  const [stage2Feedback, setStage2Feedback] = useState<string | null>(null)
  const [s2Accuracy, setS2Accuracy]         = useState<number | null>(null)

  // Stage 3
  const [stage3TimeLeft, setStage3TimeLeft]   = useState(STAGE3_TIMER_START)
  const [resolvedBlocks, setResolvedBlocks]   = useState<string[]>([])
  const [selectedFixes, setSelectedFixes]     = useState<Record<string, string>>({})

  // Meta
  const [loopCount, setLoopCount]     = useState(1)
  const [gameStartMs, setGameStartMs] = useState(0)
  const [stagesCompleted, setStagesCompleted] = useState(0)
  const [gameoverMsg, setGameoverMsg] = useState('time expired')
  const [endStats, setEndStats]       = useState<EndStats | null>(null)

  // ── Stage 1 countdown ────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [screen])

  useEffect(() => {
    if (screen === 'playing' && timeLeft === 0) {
      setEndStats({ loopCount, completionSecs: null, evidenceAccuracy: null, rollbackAttempts })
      setScreen('gameover')
    }
  }, [timeLeft, screen, loopCount, rollbackAttempts])

  // ── Stage 2 countdown ────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'stage2') return
    const id = setInterval(() => setStage2TimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [screen])

  useEffect(() => {
    if (screen === 'stage2' && stage2TimeLeft === 0) {
      setEndStats({ loopCount, completionSecs: null, evidenceAccuracy: null, rollbackAttempts })
      setGameoverMsg('investigation window expired — breach vector unconfirmed')
      setScreen('gameover')
    }
  }, [stage2TimeLeft, screen, loopCount, rollbackAttempts])

  // ── Stage 3 countdown ────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'stage3') return
    const id = setInterval(() => setStage3TimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [screen])

  useEffect(() => {
    if (screen === 'stage3' && stage3TimeLeft === 0) {
      setEndStats({ loopCount, completionSecs: null, evidenceAccuracy: s2Accuracy, rollbackAttempts })
      setGameoverMsg('remediation window expired — patch not deployed')
      setScreen('gameover')
    }
  }, [stage3TimeLeft, screen, loopCount, s2Accuracy, rollbackAttempts])

  // ── Start screen advance ─────────────────────────────────────
  useEffect(() => {
    if (screen !== 'start') return
    const advance = () => setScreen('menu')
    window.addEventListener('keydown', advance)
    window.addEventListener('click', advance)
    return () => {
      window.removeEventListener('keydown', advance)
      window.removeEventListener('click', advance)
    }
  }, [screen])

  // ── Functions ─────────────────────────────────────────────────
  function startStage1() {
    setSelected(null)
    setTimeLeft(TIMER_START)
    setPenalty(null)
    setGameStartMs(Date.now())
    setScreen('playing')
  }

  function restart() {
    setSelected(null)
    setTimeLeft(TIMER_START)
    setPenalty(null)
    setRollbackAttempts(0)
    setStage2TimeLeft(STAGE2_TIMER_START)
    setPinnedIds([])
    setStage2Feedback(null)
    setS2Accuracy(null)
    setStage3TimeLeft(STAGE3_TIMER_START)
    setResolvedBlocks([])
    setSelectedFixes({})
    setLoopCount(c => c + 1)
    setStagesCompleted(0)
    setGameoverMsg('time expired')
    setEndStats(null)
    setScreen('start')
  }

  function evaluateRollback() {
    if (!selected) return
    const target = SCENARIO.targets.find(t => t.id === selected)!
    if (selected === SCENARIO.correctTargetId) {
      setStagesCompleted(1)
      setScreen('stage2')
    } else if (Math.random() < 0.3) {
      const attempts = rollbackAttempts + 1
      setEndStats({ loopCount, completionSecs: null, evidenceAccuracy: null, rollbackAttempts: attempts })
      setGameoverMsg('rollback cascaded — all services offline')
      setScreen('gameover')
    } else {
      setRollbackAttempts(a => a + 1)
      setPenalty(`−45s  wrong target: ${target.service} ${target.version}`)
      setSelected(null)
      setTimeLeft(t => Math.max(0, t - 45))
    }
  }

  function togglePin(id: string) {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setStage2Feedback(null)
  }

  function evaluateEvidence() {
    const allFound = CORRECT_EVIDENCE_IDS.every(id => pinnedIds.includes(id))
    if (allFound) {
      const correctPinned = CORRECT_EVIDENCE_IDS.filter(id => pinnedIds.includes(id)).length
      const accuracy = pinnedIds.length > 0 ? Math.round((correctPinned / pinnedIds.length) * 100) : 100
      setS2Accuracy(accuracy)
      setStagesCompleted(2)
      setScreen('stage3')
    } else {
      const found = CORRECT_EVIDENCE_IDS.filter(id => pinnedIds.includes(id)).length
      setStage2Feedback(`${found}/3 breach indicators confirmed — keep looking`)
    }
  }

  function selectFix(blockId: string, fixId: string) {
    if (resolvedBlocks.includes(blockId)) return
    setSelectedFixes(prev => ({ ...prev, [blockId]: fixId }))
  }

  function applyFix(blockId: string) {
    const fixId = selectedFixes[blockId]
    if (!fixId || resolvedBlocks.includes(blockId)) return
    const block = BLOCKS.find(b => b.id === blockId)!
    const option = block.options.find(o => o.id === fixId)!
    if (!option.correct) {
      setEndStats({ loopCount, completionSecs: null, evidenceAccuracy: s2Accuracy, rollbackAttempts })
      setGameoverMsg('wrong fix applied — deployment cascade failed')
      setScreen('gameover')
      return
    }
    const newResolved = [...resolvedBlocks, blockId]
    setResolvedBlocks(newResolved)
    if (newResolved.length === BLOCKS.length) {
      const completionSecs = Math.round((Date.now() - gameStartMs) / 1000)
      setEndStats({ loopCount, completionSecs, evidenceAccuracy: s2Accuracy, rollbackAttempts })
      setScreen('win')
    }
  }

  // ── Derived ───────────────────────────────────────────────────
  const selectedTarget    = SCENARIO.targets.find(t => t.id === selected)
  const timerClass        = timeLeft < 60 ? 'critical' : timeLeft < 120 ? 'warn' : ''
  const stage2TimerClass  = stage2TimeLeft < 60 ? 'critical' : stage2TimeLeft < 120 ? 'warn' : ''
  const stage3TimerClass  = stage3TimeLeft < 16 ? 'critical' : stage3TimeLeft < 46 ? 'warn' : ''

  // ── WIN screen ────────────────────────────────────────────────
  if (screen === 'win') {
    const s = endStats!
    return (
      <div className="end-screen">
        <header className="end-topbar">
          <div className="stage-pills">
            <span className="stage-pill pill-done-amber">STAGE 1</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-done-blue">STAGE 2</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-done-purple">STAGE 3</span>
          </div>
        </header>
        <div className="end-columns">
          <aside className="end-terminal-panel">
            <div className="panel-label">BOB — debrief</div>
            <div className="terminal">
              {BOB_LINES_WIN.map((line, i) => (
                <div key={i} className={'tline' + (line.includes('[cursor]') ? ' green' : '')}>
                  {line || ' '}
                </div>
              ))}
            </div>
          </aside>
          <div className="end-stats-panel">
            <p className="end-label green">INCIDENT CLOSED</p>
            <h1 className="end-heading green">ALL SYSTEMS<br/>RESTORED</h1>
            <div className="end-stats">
              <div className="stat-row">
                <span>loop count</span>
                <span>{String(s.loopCount).padStart(2, '0')}</span>
              </div>
              <div className="stat-row">
                <span>completion time</span>
                <span className="amber">{fmt(s.completionSecs!)}</span>
              </div>
              <div className="stat-row">
                <span>evidence accuracy</span>
                <span className="stage2-text">{s.evidenceAccuracy}%</span>
              </div>
              <div className="stat-bar-wrap">
                <div className="stat-bar-fill stat-bar-blue" style={{ width: `${s.evidenceAccuracy}%` }} />
              </div>
              <div className="stat-row">
                <span>rollback attempts</span>
                <span>{String(s.rollbackAttempts).padStart(2, '0')}</span>
              </div>
            </div>
            <button className="btn-primary btn-end-green" onClick={restart}>RESTART</button>
            <p className="end-footer">loop rerolls on restart</p>
          </div>
        </div>
      </div>
    )
  }

  // ── GAMEOVER screen ───────────────────────────────────────────
  if (screen === 'gameover') {
    const s = endStats
    return (
      <div className="end-screen">
        <header className="end-topbar">
          <div className="stage-pills">
            <span className={`stage-pill ${stagesCompleted >= 1 ? 'pill-done-amber' : 'pill-dim'}`}>STAGE 1</span>
            <span className="stage-sep">·</span>
            <span className={`stage-pill ${stagesCompleted >= 2 ? 'pill-done-blue' : 'pill-dim'}`}>STAGE 2</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-dim">STAGE 3</span>
          </div>
        </header>
        <div className="end-columns">
          <aside className="end-terminal-panel">
            <div className="panel-label">BOB — debrief</div>
            <div className="terminal">
              {BOB_LINES_LOSE.map((line, i) => (
                <div key={i} className={'tline' + (line.includes('[cursor]') ? ' red-text' : '')}>
                  {line || ' '}
                </div>
              ))}
            </div>
          </aside>
          <div className="end-stats-panel">
            <p className="end-label red">RUN TERMINATED</p>
            <h1 className="end-heading red">INCIDENT<br/>UNRESOLVED</h1>
            {s && (
              <div className="end-stats">
                <div className="stat-row">
                  <span>loop count</span>
                  <span>{String(s.loopCount).padStart(2, '0')}</span>
                </div>
                <div className="stat-row">
                  <span>completion time</span>
                  <span className="dim">—</span>
                </div>
                {s.evidenceAccuracy !== null && (
                  <>
                    <div className="stat-row">
                      <span>evidence accuracy</span>
                      <span className="red">{s.evidenceAccuracy}%</span>
                    </div>
                    <div className="stat-bar-wrap">
                      <div className="stat-bar-fill stat-bar-red" style={{ width: `${s.evidenceAccuracy}%` }} />
                    </div>
                  </>
                )}
                <div className="stat-row">
                  <span>rollback attempts</span>
                  <span>{String(s.rollbackAttempts).padStart(2, '0')}</span>
                </div>
              </div>
            )}
            <p className="end-sub">{gameoverMsg}</p>
            <button className="btn-primary" onClick={restart}>RESTART</button>
            <p className="end-footer">knowledge carries. scenario rerolls.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Start screen ──────────────────────────────────────────────
  if (screen === 'start') {
    return (
      <div className="splash">
        <div className="splash-inner">
          <p className="splash-year">21XX</p>
          <h1 className="splash-title">ON-CALL</h1>
          <p className="splash-sub">a devsecops incident response simulation</p>
          <p className="splash-prompt">press any key to continue</p>
        </div>
      </div>
    )
  }

  // ── Menu ──────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className="splash">
        <div className="splash-inner">
          <p className="splash-year">STAGE 1</p>
          <h1 className="splash-title">AUTH ROLLBACK</h1>
          <p className="splash-sub">identify and roll back the broken service before time runs out</p>
          <ul className="menu-stats">
            <li>time limit<span>5:00</span></li>
            <li>rollback targets<span>10</span></li>
            <li>wrong guess<span>−45s or game over</span></li>
          </ul>
          <button className="btn-primary" onClick={startStage1}>START</button>
        </div>
      </div>
    )
  }

  // ── Stage 2 — Investigation ───────────────────────────────────
  if (screen === 'stage2') {
    return (
      <div className="game">
        <header className="topbar">
          <div className="topbar-left">
            <span className="badge-incident">INCIDENT-2247</span>
            <span className="incident-summary">breach investigation — identify the 3 indicators</span>
          </div>
          <div className="stage-pills">
            <span className="stage-pill pill-done-amber">STAGE 1</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-active-blue">STAGE 2</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-dim">STAGE 3</span>
          </div>
          <span className={`timer ${stage2TimerClass}`}>{fmt(stage2TimeLeft)}</span>
        </header>

        <div className="s2-columns">
          <section className="panel s2-evidence-panel">
            <div className="panel-label">
              RECENT CHANGES — {EVIDENCE.length} entries · pin breach indicators
            </div>
            <div className="s2-list">
              {EVIDENCE.map(e => (
                <div
                  key={e.id}
                  className={'s2-entry' + (pinnedIds.includes(e.id) ? ' pinned' : '')}
                >
                  <div className="s2-entry-header">
                    <span className="s2-entry-ts">{e.ts}</span>
                    <button
                      className={'s2-pin-btn' + (pinnedIds.includes(e.id) ? ' active' : '')}
                      onClick={() => togglePin(e.id)}
                    >
                      {pinnedIds.includes(e.id) ? 'UNPIN' : 'PIN'}
                    </button>
                  </div>
                  <div className="s2-entry-desc">{e.description}</div>
                  <div className="s2-entry-meta">{e.author} · {e.service}</div>
                </div>
              ))}
            </div>
          </section>

          <aside className="panel s2-right-panel">
            <div className="panel-label">EVIDENCE BOARD — {pinnedIds.length} pinned</div>
            <div className="s2-board">
              {pinnedIds.length === 0 ? (
                <div className="s2-board-empty">no items pinned</div>
              ) : (
                pinnedIds.map(id => {
                  const e = EVIDENCE.find(x => x.id === id)!
                  return (
                    <div key={id} className="s2-pinned-entry">
                      <span className="s2-entry-ts">{e.ts}</span>
                      <span className="s2-pinned-desc">{e.description}</span>
                      <button className="s2-unpin-x" onClick={() => togglePin(id)}>×</button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="panel-label">BOB — sysctl</div>
            <div className="terminal s2-terminal">
              {BOB_LINES_S2.map((line, i) => (
                <div key={i} className={'tline' + (line.includes('[cursor]') ? ' blue' : '')}>
                  {line || ' '}
                </div>
              ))}
            </div>

            <div className="s2-submit-area">
              {stage2Feedback && <div className="s2-feedback">{stage2Feedback}</div>}
              {pinnedIds.length >= 3 ? (
                <button className="btn-submit" onClick={evaluateEvidence}>SUBMIT EVIDENCE</button>
              ) : (
                <div className="s2-submit-hint">pin {3 - pinnedIds.length} more to submit</div>
              )}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ── Stage 3 — Remediation ─────────────────────────────────────
  if (screen === 'stage3') {
    return (
      <div className="game">
        <header className="topbar">
          <div className="topbar-left">
            <span className="badge-incident">INCIDENT-2247</span>
            <span className="incident-summary">
              breach remediation — {resolvedBlocks.length}/{BLOCKS.length} patched
            </span>
          </div>
          <div className="stage-pills">
            <span className="stage-pill pill-done-amber">STAGE 1</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-done-blue">STAGE 2</span>
            <span className="stage-sep">·</span>
            <span className="stage-pill pill-active-purple">STAGE 3</span>
          </div>
          <span className={`timer ${stage3TimerClass}`}>{fmt(stage3TimeLeft)}</span>
        </header>

        <div className="s3-columns">
          <section className="s3-blocks-panel">
            <div className="panel-label">
              VULNERABLE FILES — select a fix, then apply · wrong fix = immediate game over
            </div>
            <div className="s3-blocks">
              {BLOCKS.map(block => {
                const resolved  = resolvedBlocks.includes(block.id)
                const selFix    = selectedFixes[block.id] ?? null
                return (
                  <div key={block.id} className={'s3-block' + (resolved ? ' resolved' : '')}>
                    <div className="s3-block-header">
                      <div>
                        <span className="s3-block-file">{block.filename}</span>
                        <span className="s3-block-svc"> · {block.service}</span>
                      </div>
                      {resolved
                        ? <span className="s3-block-badge resolved-badge">PATCH APPLIED</span>
                        : <span className="s3-block-badge pending-badge">VULNERABLE</span>
                      }
                    </div>

                    <div className="s3-code">
                      {block.lines.map((line, i) => (
                        <div key={i} className={'s3-line' + (line.kind === 'bad' ? ' bad' : '')}>
                          {line.kind === 'bad' ? '!' : ' '} {line.text}
                        </div>
                      ))}
                    </div>

                    {!resolved && (
                      <>
                        <div className="s3-options">
                          {block.options.map((opt, idx) => (
                            <button
                              key={opt.id}
                              className={'s3-option' + (selFix === opt.id ? ' selected' : '')}
                              onClick={() => selectFix(block.id, opt.id)}
                            >
                              <span className="s3-option-letter">{LETTERS[idx]}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                        <div className="s3-apply-row">
                          <button
                            className="btn-apply"
                            disabled={selFix === null}
                            onClick={() => applyFix(block.id)}
                          >
                            APPLY FIX
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <aside className="panel s3-right-panel">
            <div className="panel-label">BOB — sysctl</div>
            <div className="terminal">
              {BOB_LINES_S3.map((line, i) => (
                <div key={i} className={'tline' + (line.includes('[cursor]') ? ' purple' : '')}>
                  {line || ' '}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ── Playing — Stage 1 Triage ──────────────────────────────────
  return (
    <div className="game">
      <header className="topbar">
        <div className="topbar-left">
          <span className="badge-incident">INCIDENT-2247</span>
          <span className="incident-summary">{SCENARIO.summary}</span>
        </div>
        <div className="stage-pills">
          <span className="stage-pill pill-active-amber">STAGE 1</span>
          <span className="stage-sep">·</span>
          <span className="stage-pill pill-dim">STAGE 2</span>
          <span className="stage-sep">·</span>
          <span className="stage-pill pill-dim">STAGE 3</span>
        </div>
        <span className={`timer ${timerClass}`}>{fmt(timeLeft)}</span>
      </header>

      <div className="columns">
        <aside className="panel">
          <div className="panel-label">BOB — sysctl</div>
          <div className="terminal">
            {BOB_LINES.map((line, i) => (
              <div
                key={i}
                className={
                  'tline' +
                  (line.includes('DEGRADED') || line.includes('readonly') ? ' amber' : '') +
                  (line.includes('healthy') || line.includes('writing') ? ' green' : '')
                }
              >
                {line || ' '}
              </div>
            ))}
          </div>
        </aside>

        <section className="panel panel-center">
          <div className="panel-label">ROLLBACK TARGETS — select one, then execute</div>
          {penalty && <div className="penalty-bar">{penalty}</div>}
          <div className="card-grid">
            {SCENARIO.targets.map(t => (
              <button
                key={t.id}
                className={'card' + (selected === t.id ? ' selected' : '')}
                onClick={() => setSelected(t.id)}
              >
                <span className="card-service">{t.service}</span>
                <span className="card-version">{t.version}</span>
                <span className="card-tag">{t.tag}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel panel-confirm">
          <div className="panel-label">EXECUTE</div>
          {selectedTarget ? (
            <div className="confirm-body">
              <div className="confirm-target">
                <span className="card-service">{selectedTarget.service}</span>
                <span className="confirm-version">{selectedTarget.version}</span>
                <span className="card-tag">{selectedTarget.tag}</span>
              </div>
              <button className="btn-execute" onClick={evaluateRollback}>EXECUTE ROLLBACK</button>
              <button className="btn-cancel" onClick={() => setSelected(null)}>cancel</button>
            </div>
          ) : (
            <div className="confirm-empty">no target selected</div>
          )}
        </aside>
      </div>
    </div>
  )
}
