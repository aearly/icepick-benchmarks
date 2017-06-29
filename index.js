const _ = require('lodash')
const async = require('async')
const createBenchmark = require('./benchmark')
const {table, getBorderCharacters} = require('table')

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
const nestedInputs = defaultInputs.filter(name => name.match(/Nested$/))
const randomInt = (max = 10) => (Math.random() * max) | 0
function randomKey (max = 10) {
  return `key${randomInt(max)}`
}

const ops = [
  'create',
  'access',
  'assoc',
  'dissoc',
  'accessNested',
  'assocNested'
]

const libSuites = {
  vanilla: {
    create: () => input,
    access: () => input[randomKey()],
    assoc: () => { input[randomKey()] = Math.random() },
    dissoc: () => { delete input[randomKey()] },
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => { input[randomKey()][randomInt()][randomKey()] = Math.random() }
  },
  icepick: {
    create: () => icepick.freeze(input),
    access: () => input[randomKey()],
    assoc: () => icepick.assoc(input, randomKey(), Math.random()),
    dissoc: () => icepick.dissoc(input, randomKey()),
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => icepick.assocIn(input, [randomKey(), randomInt(), randomKey()], Math.random())
  },
  seamless: {
    create: () => seamless(input),
    access: () => input[randomKey()],
    assoc: () => seamless.set(input, randomKey(), Math.random()),
    dissoc: () => seamless.without(input, randomKey()),
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => seamless.setIn(input, [randomKey(), randomInt(), randomKey()], Math.random())
  },
  Immutable: {
    create: () => Immutable.fromJS(input),
    access: () => input.get(randomKey()),
    assoc: () => input.set(randomKey(), Math.random()),
    dissoc: () => input.delete(randomKey()),
    accessNested: () => input.getIn([randomKey(), randomInt(), randomKey()]),
    assocNested: () => input.setIn([randomKey(), randomInt(), randomKey()], Math.random())
  },
  mori: {
    create: () => mori.toClj(input),
    access: () => mori.get(input, randomKey()),
    assoc: () => mori.assoc(input, randomKey(), Math.random()),
    dissoc: () => mori.dissoc(input, randomKey()),
    accessNested: () => mori.getIn(input, [randomKey(), randomInt(), randomKey()]),
    assocNested: () => mori.assocIn(input, [randomKey(), randomInt(), randomKey()], Math.random())

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
      testInputs: op.match(/Nested$/)
        ? nestedInputs
        : defaultInputs,
      fn: suite[op] || (() => {})
    }))
  })
)

function createSuites () {
  const tests = testDefs
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
    console.log(`${type} (µs)`)
    async.mapSeries(tests, (test, next) => {
      const bench = createBenchmark(test)
      const {mean, stdDev} = bench.run()
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
      const result = _.find(results, {inputName, library})
      if (!result) return 'N/A'
      return result.mean.toFixed(3)
    })
    return [library, ...means]
  })
  console.log(table([tableHeader, ...rows], {
    border: getBorderCharacters(`norc`),
    drawHorizontalLine: (index, size) => index === 1 || index === 0 || index === size
  }))
}
