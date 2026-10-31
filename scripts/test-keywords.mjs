import { transcribe, close } from 'cactus-needle'

const result = await transcribe('test-speech.wav', {
  keywords: ['Hush', 'thermostat'],
  wordTimestamps: true,
})
console.log(result.text)
console.log(result.words.map((w) => `${w.word} ${w.probability}`).join(' | '))
await close()
