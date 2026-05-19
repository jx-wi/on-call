import { useState, useEffect } from 'react'

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

// ── Types ─────────────────────────────────────────────────────
type Screen = 'start' | 'menu' | 'playing' | 'win' | 'gameover'
const TIMER_START = 300

// ── Helpers ───────────────────────────────────────────────────
function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [selected, setSelected] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIMER_START)
  const [penalty, setPenalty] = useState<string | null>(null)

  // Countdown — runs only while playing
  useEffect(() => {
    if (screen !== 'playing') return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [screen])

  // Time-out → game over
  useEffect(() => {
    if (screen === 'playing' && timeLeft === 0) setScreen('gameover')
  }, [timeLeft, screen])

  // Any key / click on start screen → menu
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

  function startStage1() {
    setSelected(null)
    setTimeLeft(TIMER_START)
    setPenalty(null)
    setScreen('playing')
  }

  function restart() {
    setSelected(null)
    setTimeLeft(TIMER_START)
    setPenalty(null)
    setScreen('start')
  }

  function evaluateRollback() {
    if (!selected) return
    const target = SCENARIO.targets.find(t => t.id === selected)!
    if (selected === SCENARIO.correctTargetId) {
      setScreen('win')
    } else if (Math.random() < 0.3) {
      setScreen('gameover')
    } else {
      setPenalty(`−45s  wrong target: ${target.service} ${target.version}`)
      setSelected(null)
      setTimeLeft(t => Math.max(0, t - 45))
    }
  }

  const selectedTarget = SCENARIO.targets.find(t => t.id === selected)
  const timerClass = timeLeft < 60 ? 'critical' : timeLeft < 120 ? 'warn' : ''

  // ── Screens ───────────────────────────────────────────────
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

  if (screen === 'win') {
    return (
      <div className="splash">
        <div className="splash-inner">
          <p className="end-label green">ROLLBACK SUCCESSFUL</p>
          <h1 className="splash-title green">SYSTEMS RESTORED</h1>
          <p className="splash-sub">time remaining: {fmt(timeLeft)}</p>
          <button className="btn-primary" onClick={restart}>RESTART</button>
        </div>
      </div>
    )
  }

  if (screen === 'gameover') {
    return (
      <div className="splash">
        <div className="splash-inner">
          <p className="end-label red">CRITICAL FAILURE</p>
          <h1 className="splash-title red">GAME OVER</h1>
          <p className="splash-sub">
            {timeLeft === 0 ? 'time expired' : 'rollback cascaded — all services offline'}
          </p>
          <button className="btn-primary" onClick={restart}>RESTART</button>
        </div>
      </div>
    )
  }

  // ── Playing ───────────────────────────────────────────────
  return (
    <div className="game">
      <header className="topbar">
        <div className="topbar-left">
          <span className="badge-incident">INCIDENT-2247</span>
          <span className="incident-summary">{SCENARIO.summary}</span>
        </div>
        <span className={`timer ${timerClass}`}>{fmt(timeLeft)}</span>
      </header>

      <div className="columns">
        {/* Left — Bob terminal */}
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
                {line || ' '}
              </div>
            ))}
          </div>
        </aside>

        {/* Center — card grid */}
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

        {/* Right — confirm */}
        <aside className="panel panel-confirm">
          <div className="panel-label">EXECUTE</div>
          {selectedTarget ? (
            <div className="confirm-body">
              <div className="confirm-target">
                <span className="card-service">{selectedTarget.service}</span>
                <span className="confirm-version">{selectedTarget.version}</span>
                <span className="card-tag">{selectedTarget.tag}</span>
              </div>
              <button className="btn-execute" onClick={evaluateRollback}>
                EXECUTE ROLLBACK
              </button>
              <button className="btn-cancel" onClick={() => setSelected(null)}>
                cancel
              </button>
            </div>
          ) : (
            <div className="confirm-empty">no target selected</div>
          )}
        </aside>
      </div>
    </div>
  )
}
