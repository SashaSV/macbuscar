export default function Dot({ status }) {
  if (!status) return null;
  const c = { loading: '#f5a623', done: '#34c759', error: '#ff6b6b' }[status] || '#555';
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: c,
      animation: status === 'loading' ? 'pulse 1s infinite' : 'none',
      boxShadow: status === 'loading' ? `0 0 5px ${c}` : 'none',
      flexShrink: 0,
    }} />
  );
}
