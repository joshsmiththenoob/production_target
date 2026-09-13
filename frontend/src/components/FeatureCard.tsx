import { Link } from 'react-router'

interface FeatureCardProps {
  title: string
  input: string
  process: string
  output: string
  cta: string
  to: string
  status?: string
}

export default function FeatureCard({ title, input, process, output, cta, to, status }: FeatureCardProps) {
  return (
    <article className="feature-card">
      <h2>{title}</h2>
      {status && <p className="feature-status">{status}</p>}
      <dl>
        <div><dt>輸入</dt><dd>{input}</dd></div>
        <div><dt>處理</dt><dd>{process}</dd></div>
        <div><dt>輸出</dt><dd>{output}</dd></div>
      </dl>
      <Link className="cta" to={to}>{cta}<span aria-hidden="true"> →</span></Link>
    </article>
  )
}
