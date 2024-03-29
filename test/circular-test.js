'use strict'

const test = require('tap').test
const _compile = require('../lib/index').compile
const jsondl = require('../lib/index')
const RuntimeError = require('../lib/diag').RuntimeError

function compile (str) {
  const messages = []
  return jsondl.compile(str, {
    messages
  })
}

test('on-demand', t => {
  t.match(compile('const a = b; const b = a; 1').match(1), true)
  t.done()
})

test('single global', t => {
  let messages = []
  t.throws(() => compile('const a = a; a').match(1, { messages }), RuntimeError)
  t.match(messages.length, 1)
  t.ok(/'a'/.test(messages[0].message))
  t.done()
})

test('two globals', t => {
  let messages = []
  t.throws(() => compile('const a = b; const b = a; a').match(1, { messages }), RuntimeError)
  t.match(messages.length, 2)
  t.ok(/'b'/.test(messages[0].message))
  t.ok(/'a'/.test(messages[1].message))
  t.done()
})

test('single local', t => {
  let messages = []
  t.throws(() => compile('let a = a in a').match(1, { messages }), RuntimeError)
  t.match(messages.length, 1)
  t.ok(/'a'/.test(messages[0].message))
  t.done()
})

test('two locals', t => {
  let messages = []
  t.throws(() => compile('let a = b, b = a in a').match(1, { messages }), RuntimeError)
  t.match(messages.length, 2)
  t.ok(/'b'/.test(messages[0].message))
  t.ok(/'a'/.test(messages[1].message))
  t.done()
})
