interface CodeSnippetProps {
  code: string
  startLine: number
  filePath: string
}

export function CodeSnippet({ code, startLine, filePath }: CodeSnippetProps) {
  const lines = code.split('\n')

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="bg-muted px-4 py-2 font-mono text-xs text-muted-foreground">
        {filePath}:{startLine}
      </div>
      <pre className="overflow-x-auto bg-background p-4 text-sm">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground">
                {startLine + i}
              </span>
              <span>{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}
