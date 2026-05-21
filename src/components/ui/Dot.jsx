export default function Dot({ status }) {
  const c = { loading:'#f5a623', done:'#34c759', error:'#ff6b6b' }[status];
  if (!c) return null;
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:c, animation:status==='loading'?'pulse 1s infinite':'none', flexShrink:0 }} />;
}
