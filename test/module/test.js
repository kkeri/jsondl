'use strict'

exports.undef = undefined
exports.a = 3
exports.b = 99
exports.regex = /reg/
exports.str = 'abc'
exports.bool = true
exports.f = function (v) {
  return v > 0
}

exports.test_info = function (value) {
  this.diag.info('test_info')
  return true
}

exports.test_warning = function (value) {
  this.diag.warning('test_warning')
  return true
}

exports.test_error = function (value) {
  this.diag.error('test_error')
  return true
}
