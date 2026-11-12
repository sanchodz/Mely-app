import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      // Pantalla de error con el mismo lenguaje que el resto de la app (antes era
      // texto monospace crudo sobre fondo negro). El stack sigue disponible,
      // plegado, para diagnosticar.
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#0a1120',
            color: '#f5f1e8',
            fontFamily: "'Manrope', -apple-system, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                margin: '0 auto 16px',
                borderRadius: 999,
                background: 'rgba(255,107,158,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff6b9e',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 34 }}>
                heart_broken
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.015em', margin: 0 }}>Algo salió mal</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: '#a9b2c9', margin: '10px 0 0' }}>{this.state.error.message}</p>
            <details
              style={{
                marginTop: 20,
                textAlign: 'left',
                borderRadius: 16,
                border: '1px solid rgba(233,238,250,0.08)',
                background: 'rgba(255,255,255,0.04)',
                padding: '12px 14px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#a9b2c9' }}>Detalle técnico</summary>
              <pre
                style={{
                  marginTop: 10,
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#8a93a8',
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
