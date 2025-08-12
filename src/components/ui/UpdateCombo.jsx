
import React, { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'


export default function UpdateCombo() {
  const [update, setUpdate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await check()
        if (res?.available) setUpdate({ version: res.version })
      } catch {}
    })()
  }, [])

  const doUpdate = async () => {
    try {
      setBusy(true)
      const res = await check()
      if (!res?.available) { setUpdate(null); return }
      await res.downloadAndInstall(ev => {
        if (ev.event === 'DOWNLOAD_PROGRESS') {
          const { currentBytes, totalBytes } = ev.data
          if (totalBytes > 0) setPct(Math.round((currentBytes/totalBytes)*100))
        }
      })
      setUpdate(null)
    } catch {
      setBusy(false)
    }
  }

  if (!update) return null

  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-400/40">
      <span className="text-xs text-blue-200">
        Update {update.version} available
      </span>
      <button
        onClick={doUpdate}
        disabled={busy}
        className="px-2 py-0.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-xs disabled:opacity-60"
      >
        {busy ? (pct !== null ? `Updating… ${pct}%` : 'Updating…') : 'Update'}
      </button>
    </div>
  )
}
