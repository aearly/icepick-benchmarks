const benchmark = require('benchmark')
const _ = require('lodash')
const async = require('async')

const icepick = require('icepick')

const libs = {
  vanilla: null,
  icepick
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
    fn: (vanilla) => {
      return input
    }
  },
  {
    library: 'icepick',
    type: 'create',
    fn: (icepick) => {
      return icepick.freeze(input)
    }
  }
]

function createSuites () {
  const tests = testDefs
    .map(testDef => {
      testDef.setup = testDef.setup || defaultSetup
      testDef.inputs = testDef.inputs ? testDef.inputs.split() : defaultInputs
      return testDef
    })
    .reduce((list, testDef) => {
      const {
        library,
        type,
        setup,
        fn,
        inputs
      } = testDef
      return list.concat(inputs.map(inputName => {
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
  const suite = new benchmark.Suite()

  tests.forEach(addBench)

  return suite.on('cycle', event => {
    var mean = event.target.stats.mean * 1000
    console.log(`${event.target}, ${mean.toPrecision(3)}ms per run`)
  })

  function addBench (testDef) {
    const {
      name, fn, setup
    } = testDef
    suite.add(name, fn, {
      setup,
      onError: ({message}) => console.log(message),
      maxTime: 2
    })
  }
}

function runSuite (suite, callback) {
  suite.on('complete', function () {
    callback()
  }).run()
}

const suites = createSuites()
async.eachSeries(suites, runSuite, () => {
  console.log('done')
})
