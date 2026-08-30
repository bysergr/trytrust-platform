import * as React from "react"

const QUERY = "(max-width: 767px)"
const subscribe = (callback: () => void) => { const media = window.matchMedia(QUERY); media.addEventListener("change", callback); return () => media.removeEventListener("change", callback) }
const getSnapshot = () => window.matchMedia(QUERY).matches
const getServerSnapshot = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
