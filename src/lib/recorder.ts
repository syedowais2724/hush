import { createWhistle, type Whistle, type TranscriptionResult } from 'cactus-needle/browser'
import type { ModelStatus, Settings } from './types'

const WORKLET_SOURCE = `
class HushPcmCollector extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(1024)
    this.offset = 0
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i]
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer.slice(0))
        this.offset = 0
      }
    }
    return true
  }
}
registerProcessor('hush-pcm-collector', HushPcmCollector)
`

function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples
  const ratio = from / to
  const length = Math.max(1, Math.floor(samples.length / ratio))
  const output = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const low = Math.floor(position)
    const high = Math.min(low + 1, samples.length - 1)
    const blend = position - low
    output[i] = samples[low] * (1 - blend) + samples[high] * blend
  }
  return output
}

function concat(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

export interface RecorderCallbacks {
  onPhase?: (phase: 'loading' | 'listening' | 'thinking') => void
  onModel?: (status: ModelStatus) => void
  onAutoStop?: () => void
}

export interface RecordedAudio {
  samples: Float32Array
  durationInSeconds: number
}

export class HushRecorder {
  private whistle: Whistle | null = null
  private loading: Promise<Whistle> | null = null
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private worklet: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Float32Array[] = []
  private sampleRate = 16000
  private frame = new Uint8Array(0)
  private maxTimer: number | null = null
  private recording = false
  private session = 0
  private settings: Settings | null = null
  private dictionary: string[] = []
  private callbacks: RecorderCallbacks

  constructor(callbacks: RecorderCallbacks = {}) {
    this.callbacks = callbacks
  }

  setCallbacks(callbacks: RecorderCallbacks) {
    this.callbacks = callbacks
  }

  get isRecording() {
    return this.recording
  }

  async preload() {
    if (this.whistle) return
    if (!this.loading) {
      this.loading = this.loadModel().then((model) => {
        this.whistle = model
        this.callbacks.onModel?.({ status: 'ready', progress: 100 })
        return model
      })
    }
    try {
      await this.loading
    } catch (error) {
      this.loading = null
      throw error
    }
  }

  private async loadModel(): Promise<Whistle> {
    this.callbacks.onModel?.({ status: 'loading', progress: 0, detail: 'Loading Whistle' })
    const options = {
      onDownloadProgress: (progress: { loaded: number; total?: number; percentage?: number }) => {
        const percentage =
          progress.percentage ?? (progress.total ? (progress.loaded / progress.total) * 100 : 0)
        this.callbacks.onModel?.({
          status: percentage >= 100 ? 'ready' : 'loading',
          progress: Math.round(percentage),
          detail: percentage >= 100 ? 'Warming up' : 'Loading Whistle',
        })
      },
    }

    try {
      const bundled = new URL('./models/whistle.cact', window.location.href).toString()
      return await createWhistle({ ...options, model: bundled })
    } catch (error) {
      console.warn('[hush] bundled model failed; falling back to the pinned download', error)
      return await createWhistle(options)
    }
  }

  async start(settings: Settings, dictionary: string[]) {
    if (this.recording) return
    const session = ++this.session
    this.settings = settings
    this.dictionary = dictionary

    if (!this.whistle && settings.engine === 'whistle') this.callbacks.onPhase?.('loading')

    // Start the microphone immediately. The model can finish loading while the
    // first words are already being buffered, so we never clip an opening phrase.
    const capture = this.startCapture(session)
    const needsModel = settings.engine === 'whistle' && !this.whistle
    try {
      await Promise.all([capture, needsModel ? this.preload() : Promise.resolve()])
    } catch (error) {
      this.cancel()
      throw error
    }
    if (session !== this.session) return

    this.callbacks.onPhase?.('listening')
    if (this.maxTimer) window.clearTimeout(this.maxTimer)
    this.maxTimer = window.setTimeout(() => this.callbacks.onAutoStop?.(), 180_000)
  }

  private async startCapture(session: number) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    if (session !== this.session) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    this.stream = stream

    const context = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' })
    this.context = context
    this.sampleRate = context.sampleRate

    const blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }))
    try {
      await context.audioWorklet.addModule(blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
    if (session !== this.session) {
      await context.close()
      return
    }

    this.source = context.createMediaStreamSource(stream)
    this.analyser = context.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.72
    this.frame = new Uint8Array(this.analyser.fftSize)

    this.worklet = new AudioWorkletNode(context, 'hush-pcm-collector')
    this.chunks = []
    this.worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (event.data instanceof Float32Array) this.chunks.push(event.data)
    }

    const mute = context.createGain()
    mute.gain.value = 0
    this.source.connect(this.analyser)
    this.source.connect(this.worklet)
    this.worklet.connect(mute)
    mute.connect(context.destination)
    await context.resume()
    this.recording = true
  }

  getWaveform(): Uint8Array | null {
    if (!this.analyser) return null
    this.analyser.getByteTimeDomainData(this.frame)
    return this.frame
  }

  private teardown() {
    this.recording = false
    if (this.maxTimer !== null) {
      window.clearTimeout(this.maxTimer)
      this.maxTimer = null
    }
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
    this.worklet?.port.close()
    this.worklet = null
    this.source?.disconnect()
    this.source = null
    this.analyser = null
    void this.context?.close()
    this.context = null
  }

  async stop(): Promise<RecordedAudio | null> {
    this.session++
    if (!this.recording && !this.context) return null
    this.recording = false
    this.callbacks.onPhase?.('thinking')
    if (this.maxTimer !== null) {
      window.clearTimeout(this.maxTimer)
      this.maxTimer = null
    }

    // Let the worklet deliver its final partial buffer before tearing down.
    await new Promise((resolve) => window.setTimeout(resolve, 120))
    const raw = concat(this.chunks)
    const sampleRate = this.sampleRate
    this.teardown()

    if (raw.length < sampleRate * 0.35) return null
    const pcm = resample(raw, sampleRate, 16000)
    return { samples: pcm, durationInSeconds: pcm.length / 16000 }
  }

  async transcribe(
    samples: Float32Array,
    settings: Settings,
    dictionary: string[],
  ): Promise<TranscriptionResult> {
    if (!this.whistle) await this.preload()
    if (!this.whistle) throw new Error('Whistle is not available.')
    return this.whistle.transcribe(samples, {
      language: settings.language !== 'auto' ? settings.language : undefined,
      keywords: dictionary,
    })
  }

  cancel() {
    this.session++
    this.teardown()
    this.chunks = []
  }

  async dispose() {
    this.cancel()
    if (this.whistle) {
      await this.whistle.close()
      this.whistle = null
    }
    this.loading = null
  }
}
