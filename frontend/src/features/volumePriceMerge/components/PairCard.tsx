import type { PairingPair } from '../types'

function PairFileNames({ files, emptyText }: { files: string[]; emptyText: string }) {
  if (files.length === 0) {
    return <span className="pair-card__missing">{emptyText}</span>
  }

  return (
    <ul>
      {files.map((fileName, index) => <li key={`${fileName}-${index}`}>{fileName}</li>)}
    </ul>
  )
}

interface PairCardProps {
  pair: PairingPair
}

export default function PairCard({ pair }: PairCardProps) {
  return (
    <li className="pair-card">
      <div className="pair-card__heading">
        <h3>{pair.major_category}</h3>
        <strong className={`pair-card__status pair-card__status--${pair.complete ? 'complete' : 'incomplete'}`}>
          {pair.complete ? '配對完整' : '配對不完整'}
        </strong>
      </div>
      <dl>
        <div>
          <dt>產量及產值</dt>
          <dd><PairFileNames files={pair.production_files} emptyText="缺少檔案" /></dd>
        </div>
        <div>
          <dt>種植及收穫面積</dt>
          <dd><PairFileNames files={pair.area_files} emptyText="缺少檔案" /></dd>
        </div>
      </dl>
    </li>
  )
}
