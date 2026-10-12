interface SelectedFilesProps {
  files: File[]
}

export default function SelectedFiles({ files }: SelectedFilesProps) {
  if (files.length === 0) {
    return <p className="selected-files selected-files--empty">尚未選擇檔案</p>
  }

  return (
    <ul className="selected-files" aria-label="已選擇的檔案">
      {files.map((file, index) => (
        <li key={`${file.name}-${file.lastModified}-${index}`}>{file.name}</li>
      ))}
    </ul>
  )
}
