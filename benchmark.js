const now = require('performance-now')
const _ = require('lodash')

module.exports = function createBenchmark (opts) {
  const {name, fn, setup} = opts
  const samples = []

  return {
    run
  }

  function run () {
    console.log(`running: '${name}'`)
    setup()
    // call 10 times to warm up
    _.times(10, fn)
    const start = now()
    for (let i = 0; i < 1000; i++) {
      const sampleStart = now()
      fn()
      const sampleEnd = now()
      samples.push((sampleEnd - sampleStart) * 1000)
      if (sampleEnd - start > 2000) break
    }
    return calcStats()
  }

  function calcStats () {
    const mean = computeAverage(samples)
    const devSquared = samples.map(time => {
      const dev = Math.abs(time - mean)
      return Math.pow(dev, 2)
    })
    const stdDev = Math.sqrt(computeAverage(devSquared))
    return {mean, stdDev}
  }
}

function computeAverage (arr) {
  const sum = arr.reduce((a, b) => a + b, 0)
  return sum / arr.length
}
