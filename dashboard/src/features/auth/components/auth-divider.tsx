interface AuthDividerProps {
  text?: string
}

export function AuthDivider({ text = 'or continue with' }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-surface px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  )
}
