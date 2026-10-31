import { readFile } from 'node:fs/promises'
import { Whistle } from 'cactus-needle'

function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a wav')
  }
  let offset = 12
  let fmt = null
  let data = null
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const body = buf.subarray(offset + 8, offset + 8 + size)
    if (id === 'fmt ') {
      fmt = {
        format: body.readUInt16LE(0),
        channels: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4),
        bits: body.readUInt16LE(14),
      }
    } else if (id === 'data') {
      data = body
    }
    offset += 8 + size + (size % 2)
  }
  if (!fmt || !data) throw new Error('missing fmt/data')
  const bytes = fmt.bits / 8
  const frames = data.length / (bytes * fmt.channels)
  const mono = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let c = 0; c < fmt.channels; c++) {
      const p = (i * fmt.channels + c) * bytes
      sum += fmt.bits === 16 ? data.readInt16LE(p) / 32768 : data.readFloatLE(p)
    }
    mono[i] = sum / fmt.channels
  }
  return { ...fmt, samples: mono }
}

function resample(samples, from, to) {
  if (from === to) return samples
  const ratio = from / to
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, samples.length - 1)
    const t = pos - i0
    out[i] = samples[i0] * (1 - t) + samples[i1] * t
  }
  return out
}

const wav = parseWav(await readFile('test-speech.wav'))
console.log(`input: ${wav.sampleRate} Hz, ${wav.channels} ch, ${wav.samples.length} frames`)

const pcm = resample(wav.samples, wav.sampleRate, 16000)
const chunkSize = 8000 // 0.5 s
const chunks = []
for (let i = 0; i < pcm.length; i += chunkSize) chunks.push(pcm.slice(i, i + chunkSize))

async function* audio() {
  for (const chunk of chunks) yield chunk
}

const speech = new Whistle()
const started = Date.now()
const committed = []
let last = null
for await (const part of speech.stream(audio(), { keywords: ['Hush', 'thermostat'] })) {
  if (part.text) committed.push(part.text)
  last = part
  console.log(
    `+${((Date.now() - started) / 1000).toFixed(2)}s recv=${part.received.toFixed(2)} ` +
      `commit="${part.text}" pending="${part.pending}" pass=${part.passMs}ms`,
  )
}
console.log('\nFINAL:', [...committed, last?.pending].filter(Boolean).join(' '))
await speech.close()
