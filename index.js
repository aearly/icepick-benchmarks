const _ = require('lodash')
const async = require('async')
const createBenchmark = require('./benchmark')
const {table} = require('table')

const icepick = require('icepick')
const mori = require('mori')
const Immutable = require('immutable')
const seamless = require('seamless-immutable')
const Baobab = require('baobab')

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

function randomKey (max = 10) {
  const randomInt = (Math.random() * max) | 0
  return `key${randomInt}`
}

const ops = [
  'create',
  'access',
  'assoc',
  'dissoc'
]

const libSuites = {
  vanilla: {
    create: () => input,
    access: () => input[randomKey()],
    assoc: () => { input[randomKey()] = Math.random() },
    dissoc: () => { delete input[randomKey()] }
  },
  icepick: {
    create: () => icepick.freeze(input),
    access: () => input[randomKey()],
    assoc: () => icepick.assoc(input, randomKey(), Math.random()),
    dissoc: () => icepick.dissoc(input, randomKey())
  },
  seamless: {
    create: () => seamless(input),
    access: () => input[randomKey()],
    assoc: () => seamless.set(input, randomKey(), Math.random()),
    dissoc: () => seamless.without(input, randomKey())
  },
  Immutable: {
    create: () => Immutable.fromJS(input),
    access: () => input.get(randomKey()),
    assoc: () => input.set(randomKey(), Math.random()),
    dissoc: () => input.delete(randomKey())
  },
  mori: {
    create: () => mori.toClj(input),
    access: () => mori.get(input, randomKey()),
    assoc: () => mori.assoc(input, randomKey(), Math.random()),
    dissoc: () => mori.dissoc(input, randomKey())

  }/*,
  Baobab: {
    create: () => new Baobab(input)
  }*/
}

const testDefs = _.flatten(
  _.map(libSuites, (suite, library) => {
    return ops.map(op => ({
      library,
      type: op,
      setup: op === 'create'
        ? defaultSetup
        : (val) => {
          defaultSetup(val)
          input = suite.create()
        },
      fn: suite[op] || (() => {})
    }))
  })
)

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
          inputName,
          name: `${library} ${type}(${inputName})`,
          setup: () => setup(inputs[inputName]),
          fn
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
  return function run (cb) {
    console.log(type)
    async.mapSeries(tests, (test, next) => {
      const bench = createBenchmark(test)
      const {mean, stdDev} = bench.run()
      //console.log(`${test.name}: ${mean.toFixed(3)}µs per run (±${stdDev.toFixed(3)})`)
      async.setImmediate(next, null, _.assign({mean, stdDev}, test))
    }, (err, results) => {
      if (err) throw err
      resultTable(results)
      cb(null, results)
    })
  }
}

const suites = createSuites()
async.series(suites, () => {
  console.log('done')
})

const tableHeader = ['', ..._.keys(inputs)]
const libs = _.keys(libSuites)

function resultTable (results) {
  const rows = libs.map(library => {
    const means = _.map(tableHeader.slice(1), inputName => {
      return _.find(results, {inputName, library}).mean.toFixed(3)
    })
    return [library, ...means]
  })
  console.log(table([tableHeader, ...rows]))
}
