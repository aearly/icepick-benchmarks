const _ = require('lodash')
const async = require('async')
const createBenchmark = require('./benchmark')

const icepick = require('icepick')
const mori = require('mori')
const Immutable = require('immutable')
const seamlessImmutable = require('seamless-immutable')
const Baobab = require('baobab')

const libs = {
  vanilla: null,
  icepick,
  mori,
  Immutable,
  seamlessImmutable,
  Baobab
}

const inputs = {}
let input

const objify = (createVal = () => Math.random()) => (obj, i) => {
  obj[`key${i}`] = createVal()
  return obj
}
const objRange = (n) => _.range(n).reduce(objify(), {})

function setupObjs () {
  inputs.small = objRange(10)
  inputs.large = objRange(100)
  inputs.huge = objRange(1000)
  inputs.smallNested = _.range(10).reduce(objify(() => {
    return _.range(10).map(() => objRange(10))
  }), {})
  inputs.hugeNested = _.range(10).reduce(objify(() => {
    return _.range(100).map(() => objRange(100))
  }), {})
}

setupObjs()

const defaultSetup = (val) => { input = JSON.parse(JSON.stringify(val)) }
const defaultInputs = Object.keys(inputs)

const testDefs = [
  {
    library: 'vanilla',
    type: 'create',
    fn: vanilla => input
  },
  {
    library: 'icepick',
    type: 'create',
    fn: icepick => icepick.freeze(input)
  },
  {
    library: 'seamlessImmutable',
    type: 'create',
    fn: seamlessImmutable => seamlessImmutable(input)
  },
  {
    library: 'Immutable',
    type: 'create',
    fn: Immutable => Immutable.fromJS(input)
  },
  {
    library: 'mori',
    type: 'create',
    fn: mori => mori.toClj(input)
  },
  {
    library: 'Baobab',
    type: 'create',
    fn: Baobab => new Baobab(input)
  }
]

function createSuites () {
  const tests = testDefs
    .map(testDef => {
      testDef.setup = testDef.setup || defaultSetup
      testDef.testInputs = testDef.inputs ? testDef.inputs.split() : defaultInputs
      return testDef
    })
    .reduce((list, testDef) => {
      const {
        library,
        type,
        setup,
        fn,
        testInputs
      } = testDef
      return list.concat(testInputs.map(inputName => {
        return _.assign({}, testDef, {
          name: `${library} ${type}(${inputName})`,
          setup: () => setup(inputs[inputName]),
          fn: () => fn(libs[library])
        })
      }))
    }, [])

  // console.dir(tests)

  const types = _.uniq(_.map(tests, 'type'))
  const suites = types.map(type => {
    const matchingTests = tests.filter(test => test.type === type)
    return createSuite(type, matchingTests)
  })
  return suites
}

function createSuite (type, tests) {
  console.log(`
${type}
------------------------------------------------------------------
    `)
  return function run (cb) {
    async.eachSeries(tests, (test, next) => {
      const bench = createBenchmark(test)
      const {mean, stdDev} = bench.run()
      console.log(`${mean.toFixed(3)}µs per run (±${stdDev.toFixed(3)})`)
      async.setImmediate(next)
    }, cb)
  }
}

const suites = createSuites()
async.series(suites, () => {
  console.log('done')
})
