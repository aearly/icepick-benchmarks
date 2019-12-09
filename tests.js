
const icepick = require('icepick')
const mori = require('mori')
const Immutable = require('immutable')
const seamless = require('seamless-immutable')
const immer = require('immer')

let input

const randomInt = (max = 10) => (Math.random() * max) | 0
function randomKey (max = 10) {
  return `key${randomInt(max)}`
}

const simpleClone = (val) => { input = JSON.parse(JSON.stringify(val)) }
exports.defaultSetup = (suite, op) => {
  if (op === 'create') {
    return simpleClone
  }
  return (val) => {
    simpleClone(val)
    input = suite.create()
  }
}

exports.libSuites = {
  vanilla: {
    create: () => input,
    access: () => input[randomKey()],
    assoc: () => { input[randomKey()] = Math.random() },
    dissoc: () => { delete input[randomKey()] },
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => { input[randomKey()][randomInt()][randomKey()] = Math.random() },
    thaw: () => input
  },
  icepick: {
    create: () => icepick.freeze(input),
    access: () => input[randomKey()],
    assoc: () => icepick.assoc(input, randomKey(), Math.random()),
    dissoc: () => icepick.dissoc(input, randomKey()),
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => icepick.assocIn(input, [randomKey(), randomInt(), randomKey()], Math.random()),
    thaw: () => icepick.thaw(input)
  },
  seamless: {
    create: () => seamless(input),
    access: () => input[randomKey()],
    assoc: () => seamless.set(input, randomKey(), Math.random()),
    dissoc: () => seamless.without(input, randomKey()),
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => seamless.setIn(input, [randomKey(), randomInt(), randomKey()], Math.random()),
    thaw: () => seamless.asMutable(input, {deep: true})
  },
  immer: {
    create: () => immer.produce(input, draft => {}),
    access: () => input[randomKey()],
    assoc: () => immer.produce(input, draft => { draft[randomKey()] = Math.random() }),
    dissoc: () => immer.produce(input, draft => { delete draft[randomKey()] }),
    accessNested: () => input[randomKey()][randomInt()][randomKey()],
    assocNested: () => immer.produce(input, draft => { draft[randomKey()][randomInt()][randomKey()] = Math.random() }),
    thaw: () => input
  },
  Immutable: {
    create: () => Immutable.fromJS(input),
    access: () => input.get(randomKey()),
    assoc: () => input.set(randomKey(), Math.random()),
    dissoc: () => input.delete(randomKey()),
    accessNested: () => input.getIn([randomKey(), randomInt(), randomKey()]),
    assocNested: () => input.setIn([randomKey(), randomInt(), randomKey()], Math.random()),
    thaw: () => input.toJS()
  },
  mori: {
    create: () => mori.toClj(input),
    access: () => mori.get(input, randomKey()),
    assoc: () => mori.assoc(input, randomKey(), Math.random()),
    dissoc: () => mori.dissoc(input, randomKey()),
    accessNested: () => mori.getIn(input, [randomKey(), randomInt(), randomKey()]),
    assocNested: () => mori.assocIn(input, [randomKey(), randomInt(), randomKey()], Math.random()),
    thaw: () => mori.toJs(input)
  }
}
