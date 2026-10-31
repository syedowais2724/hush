import { transcribe, close } from 'cactus-needle'

const started = Date.now()
const result = await transcribe('test-speech.wav', { wordTimestamps: true })
console.log(JSON.stringify(result, null, 2))
console.log(`wall: ${Date.now() - started} ms`)
await close()
