import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** 全站錯誤邊界：render 期例外不再白畫面，給人話文案與重載出口 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('未攔截的渲染錯誤', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>發生未預期的錯誤</p>
          <p style={{ color: '#5b6472', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
            請重新載入；若持續發生，可到設定頁清除快取。
          </p>
          <button
            onClick={() => location.reload()}
            style={{
              padding: '0.6rem 1.4rem',
              border: 0,
              borderRadius: 12,
              background: '#1a56db',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            重新載入
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
