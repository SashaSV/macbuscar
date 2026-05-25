export default function Dot({ status }) {
  const c = { loading:'#f59e0b', done:'#10b981', error:'#ef4444' }[status];
  if (!c) return null;
  return (
    <span style={{
      display:'inline-block', width:7, height:7,
      borderRadius:'50%', background:c,
      animation: status === 'loading' ? 'pulse 1s infinite' : 'none',
      flexShrink: 0,
      boxShadow: `0 0 6px ${c}66`,
    }} />
  );
}
