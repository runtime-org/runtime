import { useEffect, useRef } from 'react'
import { emit } from '@tauri-apps/api/event'
import { getCurrent } from '@tauri-apps/api/window'

export default function CommandBar() {
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = async () => {
    const value = inputRef.current?.value?.trim()
    if (!value) return
    await emit('runtime:submit', { text: value })   // main UI will listen
    inputRef.current.value = ''
    const win = getCurrent()
    ;(await win).hide()
  }

  const onKey = async (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') { (await getCurrent()).hide() }
  }

  return (
    <div
      style={{
        margin: 8, height: 44, borderRadius: 16, padding: '0 12px',
        background: '#3b3b3b', display: 'flex', alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,.35)'
      }}
    >
      ok
      <input
        ref={inputRef}
        placeholder="Ask anything"
        onKeyDown={onKey}
        style={{
          flex: 1, border: 0, outline: 0, background: 'transparent',
          color: '#fff', fontSize: 14
        }}
      />
    </div>
  )
}
