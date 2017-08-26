'use strict'

const test = require('tap').test
const _compile = require('../lib/index').compile
const model = require('../lib/model')

function compile(str) {
  return _compile(str, {
    filename: __filename,
    error: (str) => console.log(str)
  })
}

test('simple value', t => {
  t.match(compile('1').test(1), true)
  t.match(compile('1').test(2), false)
  t.match(compile('"abc"').test("abc"), true)
  t.match(compile('"abc"').test("d"), false)
  t.match(compile('null').test(null), true)
  t.match(compile('true').test(true), true)
  t.match(compile('false').test(false), true)
  t.done()
})

test('regex', t => {
  t.match(compile('/a/').test('a'), true)
  t.match(compile('/a/').test('b'), false)
  t.match(compile('/ abc/').test('1 abc2'), true)
  t.match(compile('/ abc/').test('1 abd2'), false)
  t.match(compile('/ab/i').test('abc'), true)
  t.match(compile('/ab/i').test('ABC'), true)
  t.match(compile('/\\//i').test('/'), true)
  t.match(compile('/\t/').test('\t'), true)
  t.match(compile('/\\t/').test('\t'), true)
  t.done()
})

test('built-in pattern', t => {
  t.match(compile('string').test(1), false)
  t.match(compile('number').test(1), true)
  t.match(compile('integer').test(1), true)
  t.done()
})

test('built-in function', t => {
  t.match(compile('lt(1)').test(0), true)
  t.match(compile('lt(1)').test(1), false)
  t.match(compile('le(1)').test(1), true)
  t.match(compile('le(1)').test(2), false)
  t.match(compile('gt(1)').test(2), true)
  t.match(compile('gt(1)').test(1), false)
  t.match(compile('ge(1)').test(1), true)
  t.match(compile('ge(1)').test(0), false)
  t.done()
})

test('or', t => {
  t.match(compile('1|2|3').test(1), true)
  t.match(compile('1|2|3').test(2), true)
  t.match(compile('1|2|3').test(3), true)
  t.match(compile('1|2|3').test(4), false)
  t.match(compile('number|string').test(1), true)
  t.match(compile('number|string').test('a'), true)
  t.match(compile('number|string').test(null), false)
  t.match(compile('/a/|/b/').test('a'), true)
  t.match(compile('/a/|/b/').test('b'), true)
  t.match(compile('/a/|/b/').test('c'), false)
  t.done()
})

test('and', t => {
  t.match(compile('1&2').test(1), false)
  t.match(compile('1&2').test(2), false)
  t.match(compile('1&2').test(3), false)
  t.match(compile('2&2').test(2), true)
  t.match(compile('gt(1) & lt(3)').test(1), false)
  t.match(compile('gt(1) & lt(3)').test(2), true)
  t.match(compile('gt(1) & lt(3)').test(3), false)
  t.match(compile('/a/&/b/').test('abc'), true)
  t.match(compile('/a/&/b/').test('ca'), false)
  t.match(compile('/a/&/b/').test('cb'), false)
  t.done()
})

test('not', t => {
  t.match(compile('!1').test(1), false)
  t.match(compile('!1').test(2), true)
  t.done()
})
