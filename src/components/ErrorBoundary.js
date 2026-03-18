import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('AeroManager error:', error, info);
    this.setState({ info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || 'Erro desconhecido';

    return (
      <div style={{
        padding: 40, maxWidth: 560, margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 20,
          fontWeight: 400, color: 'var(--text1)',
        }}>
          Algo deu errado nesta seção
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          Ocorreu um erro inesperado. Seus dados estão seguros — tente recarregar a página ou navegar para outra seção.
        </div>
        <div style={{
          padding: '8px 14px', background: 'var(--red-dim)',
          border: '1px solid var(--red-mid)', borderRadius: 8,
          fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)',
          maxWidth: '100%', wordBreak: 'break-all',
        }}>
          {msg}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="primary" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Tentar novamente
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 8 }}>
          Se o erro persistir, tente fazer logout e login novamente.
        </div>
      </div>
    );
  }
}
