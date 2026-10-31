import { useEffect, useRef } from 'react'

interface WaveformProps {
  getData?: () => Uint8Array | null
  mode: 'idle' | 'listening' | 'thinking' | 'done' | 'empty' | 'error'
  demo?: boolean
}

export function Waveform({ getData, mode, demo = false }: WaveformProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let raf = 0
    let time = 0
    const live = mode === 'listening'

    const draw = () => {
      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) {
        raf = requestAnimationFrame(draw)
        return
      }
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)

      time += live ? 0.055 : 0.018
      const mid = height / 2
      const data = live ? getData?.() : null
      const points = 90
      const amplitude = live ? height * 0.36 : mode === 'thinking' ? height * 0.07 : height * 0.09

      const gradient = context.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, 'rgba(31, 111, 92, 0)')
      gradient.addColorStop(0.12, 'rgba(31, 111, 92, 0.55)')
      gradient.addColorStop(0.36, '#2f8a71')
      gradient.addColorStop(0.52, '#b8f0d4')
      gradient.addColorStop(0.72, '#2f8a71')
      gradient.addColorStop(0.9, 'rgba(31, 111, 92, 0.45)')
      gradient.addColorStop(1, 'rgba(31, 111, 92, 0)')

      const values: number[] = []
      for (let i = 0; i <= points; i++) {
        let value = 0
        const x = i / points
        if (data) {
          const index = Math.min(data.length - 1, Math.floor(x * data.length))
          value = (data[index] - 128) / 128
          value = Math.max(-1, Math.min(1, value * 1.7))
        } else {
          const envelope = Math.sin(Math.PI * x)
          value =
            (Math.sin(x * 15 + time * 2.2) * 0.55 +
              Math.sin(x * 31 - time * 1.4) * 0.25 +
              Math.sin(x * 7 + time) * 0.2) *
            envelope *
            (demo || mode === 'listening' ? 1 : 0.45)
        }
        values.push(value)
      }

      const smooth = (positions: Array<[number, number]>) => {
        context.beginPath()
        context.moveTo(positions[0][0], positions[0][1])
        for (let i = 1; i < positions.length - 1; i++) {
          const [x1, y1] = positions[i]
          const [x2, y2] = positions[i + 1]
          context.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2)
        }
        const last = positions[positions.length - 1]
        context.lineTo(last[0], last[1])
      }

      const line = values.map((value, i) => {
        return [(i / points) * width, mid + value * amplitude] as [number, number]
      })

      context.save()
      context.lineWidth = 1.6
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.strokeStyle = gradient
      context.shadowColor = 'rgba(31, 111, 92, 0.55)'
      context.shadowBlur = live ? 18 : 10
      smooth(line)
      context.stroke()
      context.restore()

      context.save()
      context.globalAlpha = 0.22
      context.lineWidth = 1
      context.strokeStyle = gradient
      smooth(line.map(([x, y]) => [x, mid - (y - mid) * 0.75]))
      context.stroke()
      context.restore()

      if (mode === 'thinking') {
        const pulse = (Math.sin(time * 2.6) + 1) / 2
        context.save()
        context.beginPath()
        context.arc(width / 2, mid, 3 + pulse * 2.5, 0, Math.PI * 2)
        context.fillStyle = 'rgba(184, 240, 212, 0.9)'
        context.shadowColor = 'rgba(127, 217, 180, 0.9)'
        context.shadowBlur = 18
        context.fill()
        context.restore()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [getData, mode, demo])

  return <canvas ref={ref} className="waveform" aria-hidden="true" />
}
