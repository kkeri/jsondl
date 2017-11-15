'use strict'

const test = require('tap').test
const jsondl = require('../lib/index')
const model = require('../lib/model')

function compile (str) {
  const messages = []
  return jsondl.compile(str, {
    resolvePath: __dirname,
    messages
  })
}

test('package not found', t => {
  const messages = []
  t.match(jsondl.compile('import { a } from "jsondl-non-existing-module-for-test"; 1', {
    resolvePath: __dirname,
    messages
  }), null)
  t.match(messages.length, 1)
  t.match(messages[0].severity, 'error')
  t.ok(/jsondl-non-existing-module-for-test/.test(messages[0].message))
  t.done()
})

test('relative path not found', t => {
  const messages = []
  t.match(jsondl.compile('import { a } from "./module/nomodule.js"; 1', {
    resolvePath: __dirname,
    messages
  }), null)
  t.match(messages.length, 1)
  t.match(messages[0].severity, 'error')
  t.ok(/\.\/module\/nomodule\.js/.test(messages[0].message))
  t.done()
})

test('unix absolute path not found', t => {
  const messages = []
  t.match(jsondl.compile('import { a } from "/__no-such-topdir__/__no-such-subdir__/__no-such-file.js"; 1', {
    resolvePath: __dirname,
    messages
  }), null)
  t.match(messages.length, 1)
  t.match(messages[0].severity, 'error')
  t.ok(/\/__no-such-topdir__\/__no-such-subdir__\/__no-such-file\.js/.test(messages[0].message))
  t.done()
})

test('windows absolute path not found', t => {
  const messages = []
  t.match(jsondl.compile('import { a } from "X:\__no-such-topdir__\__no-such-subdir__\__no-such-file.js"; 1', {
    resolvePath: __dirname,
    messages
  }), null)
  t.match(messages.length, 1)
  t.match(messages[0].severity, 'error')
  t.ok(/X:\__no-such-topdir__\__no-such-subdir__\__no-such-file.js/.test(messages[0].message))
  t.done()
})

test('import js', t => {
  t.match(compile('import { a } from "./module/test.js"; a').test(3), true)
  t.match(compile('import { regex } from "./module/test.js"; regex').test('reg'), true)
  t.match(compile('import { a as x } from "./module/test.js"; x').test(3), true)
  t.done()
})

// todo: automatic extension
