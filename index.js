const _ = require('lodash')
const async = require('async')
const createBenchmark = require('./benchmark')
const {table, getBorderCharacters} = require('table')

const args = require('yargs')
  .options({
    type: {
      alias: 't',
      description: 'filter by type of test',
      default: '.*',
      coerce: val => new RegExp(val)
    },
    library: {
      alias: 'l',
      description: 'filter by library',
      default: '.*',
      coerce: val => new RegExp(val)
    }
  })
  .help()
  .argv

const inputs = {}

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

const defaultInputs = _.keys(inputs)
const nestedInputs = defaultInputs.filter(name => name.match(/Nested$/))

const ops = [
  'create',
  'access',
  'assoc',
  'dissoc',
  'accessNested',
  'assocNested',
  'thaw'
].filter(op => op.match(args.type))

const {libSuites, defaultSetup} = require('./tests')

const testDefs = _.flatten(
  _.map(libSuites, (suite, library) => {
    if (!library.match(args.library)) return []
    return ops.map(op => ({
      library,
      type: op,
      setup: defaultSetup(suite, op),
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
const libs = _.keys(libSuites).filter(lib => lib.match(args.library))

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
