import { TestContext } from './context'
import { TransactionalMap } from './map'
import { FatalError } from './util'

export class Module {
  constructor (declList) {
    this.declList = declList
    this.exports = {}
    this.defaultExport = undefined
  }

  test (value, {
    id,
    diag = function (msg) {}
  } = {}) {
    let expr
    if (typeof (id) !== 'string') {
      if (!this.defaultExport) {
        throw new Error('attempt to test against the default declaration but it is not declared')
      }
      expr = this.defaultExport
    } else {
      if (!(id in this.exports)) {
        throw new Error(`attempt to test against '${id}' but it is not declared`)
      }
      expr = this.exports[id]
    }
    try {
      const tc = new TestContext({ env: this.env, diag })
      return expr.doEval(tc).doTest(tc, value) && tc.errors === 0
    } catch (e) {
      if (e instanceof FatalError) {
        throw new Error('Fatal error: ' + e.message)
      } else {
        throw e
      }
    }
  }
}

export class Import {
  constructor (moduleSpec, importList) {
    this.moduleSpec = moduleSpec
    this.importList = importList
  }
}

export class ImportSpecifier {
  constructor (originalId, localId) {
    this.originalId = originalId
    this.localId = localId
  }
}

export class Export {
  constructor (body) {
    this.body = body
  }
}

export class Const {
  constructor (id, body) {
    this.id = id
    this.body = body
  }

  test (value, args) {
    if (!this.env) {
      throw new Error(`a declaration in a parametric environment can't ` +
      `be tested independently`)
    }
    const tc = new TestContext({
      env: this.env
    })
    return this.doTest(tc, value, args)
  }

  doEval (tc) {
    if (!('value' in this)) {
      if (this.busy) {
        throw new FatalError('circular', this, 'Circular reference detected')
      }
      this.busy = true
      try {
        this.value = this.body.doEval(tc)
      } catch (e) {
        if (e instanceof FatalError && e.type === 'circular') {
          tc.fatal(`circular reference detected while evaluating const '${this.id}'`)
          if (e.ref === this) e.type = 'quit'
        }
        throw e
      } finally {
        this.busy = false
      }
    }
    return this.value
  }

  doTest (tc, value, args) {
    return this.expr.doTest(tc, value, args)
  }
}

// expression

export class Expression {
  // constructor () {
  //   if (new.target === Expression) {
  //     throw new Error(`can't instantiate abstract class`)
  //   }
  // }

  doEval (tc) {
    return this
  }

  doTest (tc, value) {
    tc.error(`the expression can't be used as pattern`)
    return false
  }

  call (tc, args) {
    tc.error(`the expression can't be called`)
    return this
  }

  getChild (tc, id) {
    tc.error(`property ${id} is not found`)
    return this
  }

  getNativeValue (tc) {
    tc.error(`the expression can't be passed to a native pattern`)
    return null
  }
}

export class LocalEnvironment extends Expression {
  constructor (declList, body) {
    super()
    this.declList = declList
    this.body = body
  }

  doEval (tc) {
    let savedEnv = tc.env
    if (this.env) {
      tc.env = this.env
    } else {
      tc.env = Object.assign(Object.create(tc.env), this.staticEnv)
    }
    let result = this.body.doEval(tc)
    tc.env = savedEnv
    return result
  }
}

export class OrPattern extends Expression {
  constructor (items) {
    super()
    this.items = items
  }

  doTest (tc, value) {
    let result = false
    for (let item of this.items) {
      tc.begin()
      if (item.doEval(tc).doTest(tc, value)) {
        tc.commit()
        result = true
        // todo: continue iteration only if unique or closed is in effect
      } else {
        tc.rollback()
      }
    }
    return result
  }
}

export class AndPattern extends Expression {
  constructor (items) {
    super()
    this.items = items
  }

  doTest (tc, value) {
    for (let item of this.items) {
      if (!item.doEval(tc).doTest(tc, value)) {
        return false
      }
    }
    return true
  }
}

export class LogicalNot extends Expression {
  constructor (expr) {
    super()
    this.expr = expr
  }

  doTest (tc, value) {
    tc.begin()
    var result = !this.expr.doEval(tc).doTest(tc, value)
    tc.rollback()
    return result
  }
}

export class Member extends Expression {
  constructor (expr, id) {
    super()
    this.expr = expr
    this.id = id
  }

  doEval (tc) {
    return this.expr.doEval(tc).getChild(tc, this.id)
  }
}

export class Reference extends Expression {
  constructor (id) {
    super()
    this.id = id
  }

  doEval (tc) {
    return tc.env[this.id].doEval(tc)
  }
}

export class Call extends Expression {
  constructor (expr, args = []) {
    super()
    this.expr = expr
    this.args = args
  }

  doEval (tc) {
    let func = this.expr.doEval(tc)
    return func.call(tc, this.args)
  }
}

export class Function_ extends Expression {
  constructor (params, body) {
    super()
    this.params = params
    this.body = body
  }

  call (tc, args) {

  }
}

export class NativePattern extends Expression {
  constructor (fn) {
    super()
    this.fn = fn
  }

  call (tc, args) {
    let fn = this.fn
    args = args.map(arg => arg.doEval(tc).getNativeValue(tc))
    return new (class extends Expression {
      doTest (tc, value) {
        return fn.call(tc, value, ...args)
      }
    })()
  }

  doTest (tc, value) {
    return this.fn.call(tc, value)
  }
}

export class ObjectPattern extends Expression {
  constructor (propertyList) {
    super()
    this.propertyList = propertyList
  }

  doTest (tc, value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }
    tc.pathStack.push('')
    for (let prop of this.propertyList) {
      if (!prop.doTest(tc, value)) return false
    }
    tc.pathStack.pop()
    return true
  }
}

export class ArrayPattern extends Expression {
  constructor (items, minCount = 1, maxCount = 1) {
    super()
    this.items = items
    this.minCount = minCount
    this.maxCount = maxCount
  }

  doTest (tc, value) {
    if (!Array.isArray(value)) {
      return false
    }
    let prevArrayMatchLimit = tc.tr.arrayMatchLimit
    let idx = 0
    let rep = 0
    tc.pathStack.push(0)
    while (rep < this.maxCount) {
      let baseIdx = idx
      let match
      [match, idx] = this.testItemsAtIndex(tc, value, idx)
      if (!match) break
      rep++
      if (idx === baseIdx) break
    }
    tc.pathStack.pop()
    if (rep < this.minCount) {
      return false
    }
    tc.tr.arrayMatchLimit = Math.max(prevArrayMatchLimit, idx)
    return true
  }

  testItemsAtIndex (tc, value, idx) {
    let baseIdx = idx
    for (let item of this.items) {
      let match
      [match, idx] = item.testAtIndex(tc, value, idx)
      if (!match) {
        tc.pathStack.pop()
        return [false, baseIdx]
      }
    }
    return [true, idx]
  }
}

// helpers

export class PropertyPattern extends Expression {
  constructor (name, value, minCount = 1, maxCount = Infinity) {
    super()
    this.name = name
    this.value = value
    this.minCount = minCount
    this.maxCount = maxCount
  }

  doTest (tc, value) {
    // this is checked in the object pattern
    // if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    //   return false
    // }
    let occurs = 0
    if (tc.tr.matchSet) {
      for (let name in value) {
        tc.pathStack[tc.pathStack.length - 1] = name
        if (this.name.doEval(tc).doTest(tc, name)) {
          tc.tr.matchSet[name] = true
          let savedMatchSet = tc.tr.matchSet
          tc.tr.matchSet = null
          const match = this.value.doEval(tc).doTest(tc, value[name])
          tc.tr.matchSet = savedMatchSet
          if (match) {
            occurs++
          } else {
            return false
          }
        }
      }
    } else {
      for (let name in value) {
        tc.pathStack[tc.pathStack.length - 1] = name
        if (this.name.doEval(tc).doTest(tc, name)) {
          if (this.value.doEval(tc).doTest(tc, value[name])) {
            occurs++
          } else {
            return false
          }
        }
      }
    }
    if (occurs < this.minCount || occurs > this.maxCount) return false
    return true
  }
}

export class ArrayItemPattern extends Expression {
  constructor (value, minCount = 1, maxCount = 1) {
    super()
    this.value = value
    this.minCount = minCount
    this.maxCount = maxCount
  }

  testAtIndex (tc, value, idx) {
    let occurs = 0
    while (occurs < this.maxCount &&
      idx < value.length && this.value.doEval(tc).doTest(tc, value[idx])
    ) {
      idx++
      occurs++
      tc.pathStack[tc.pathStack.size - 1] = idx
    }
    return [occurs >= this.minCount, idx]
  }
}

// leaf nodes

export class Literal extends Expression {
  constructor (value) {
    super()
    this.value = value
  }

  getNativeValue (tc) {
    return this.value
  }

  doTest (tc, value) {
    return this.value === value
  }
}

export class RegExp_ extends Expression {
  constructor (body, flags) {
    super()
    this.body = body
    this.flags = flags
    this.regexp = undefined
  }

  static fromRegExp (rgx) {
    let obj = new RegExp_()
    obj.regexp = rgx
    return obj
  }

  getNativeValue (tc) {
    return this.regexp
  }

  doTest (tc, value) {
    return this.regexp.test(value)
  }
}

export class This extends Expression {
  doEval (tc) {
    return tc.this
  }
}

export class SetConstructor extends Expression {
  getNativeValue (tc) {
    if (!this.map) {
      this.map = new TransactionalMap(tc)
    }
    return this.map
  }

  getChild (tc, id) {
    switch (id) {
      // case 'size': return new Literal(this.getNativeValue(tc).size())
      default: return super.getChild(tc, id)
    }
  }
}
