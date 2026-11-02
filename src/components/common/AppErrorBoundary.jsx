import { Component } from 'react'

/** Keep unexpected rendering failures recoverable without discarding stored drafts. */
export class AppErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Application rendering failed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="club-recovery" role="alert">
        <span className="club-eyebrow">LUKTO</span>
        <h1>Volvamos al partido.</h1>
        <p>Esta vista no pudo cargar. Recarga la página para intentarlo de nuevo.</p>
        <button className="club-primary" onClick={() => window.location.reload()}>
          Recargar página
        </button>
        <a href="/?view=home">Volver al club</a>
      </main>
    )
  }
}
