import { TestContext } from './context'

export class Module {
  constructor (importList, declList) {
    this.importList = importList
    this.declList = declList
    this.decls = {}
    this.exports = {}
    this.defaultExport = undefined
  }

  test (value, id = '') {
    if (id === '') {
      if (!this.defaultExport) {
        throw new Error('attempt to test against the default declaration but it is not declared')
      }
      return this.defaultExport.test(value)
    } else {
      if (!(id in this.exports)) {
        throw new Error(`attempt to test against '${id}' but it is not declared`)
      }
      return this.exports[id].test(value)
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

export class Declaration {
  constructor (id, body, exported) {
    this.id = id
    this.body = body
    this.exported = exported
  }

  test (value) {
    const tc = new TestContext()
    return this.body.doTest(tc, value)
  }
}

// expression

export class Expression {
  constructor () {
    if (new.target === Expression) {
      throw new Error(`can't instantiate abstract class`)
    }
  }

  doEval (tc, value) {
    throw new Error(`the expression should be used as pattern`)
  }

  doTest (tc, value) {
    throw new Error(`the expression can't be used as pattern`)
  }
}

export class LogicalOr extends Expression {
  constructor (items) {
    super()
    this.items = items
  }

  doTest (tc, value) {
    for (let item of this.items) {
      if (item.doTest(tc, value)) {
        return true
      }
    }
    return false
  }
}

export class LogicalAnd extends Expression {
  constructor (items) {
    super()
    this.items = items
  }

  doTest (tc, value) {
    for (let item of this.items) {
      if (!item.doTest(tc, value)) {
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
    return !this.expr.doTest(tc, value)
  }
}

export class Chain extends Expression {
  constructor (items) {
    super()
    this.items = items
  }

  doEval (value) {
    for (let item of this.items) {
      value = item.doEval(value)
    }
    return value
  }

  doTest (tc, value) {
    let max = this.items.length - 1
    for (let i = 0; i < max; i++) {
      value = this.items[i].doEval(tc, value)
    }
    return this.items[max].validate(tc, value)
  }
}

export class Reference extends Expression {
  constructor (id) {
    super()
    this.id = id
  }

  doEval (tc) {
    return this.pattern.doEval(tc)
  }

  doTest (tc, value) {
    return this.pattern.doTest(tc, value)
  }
}

export class Call extends Expression {
  constructor (id, args = []) {
    super()
    this.id = id
    this.args = args
    this.func = undefined
  }

  doEval (tc) {
    return this.func.doEval(tc, this.args)
  }

  doTest (tc, value) {
    return this.func.doTest(tc, value, this.args)
  }
}

export class Function_ extends Expression {
  constructor (params, body) {
    super()
    this.params = params
    this.body = body
  }

  doEval (tc) {
    return this
  }

  doTest (tc, value, args) {
    this.source.doEval(tc, value)
  }
}

export class Custom extends Expression {
  constructor (doEval, doTest) {
    super()
    this.deEval = doEval
    this.doTest = doTest
  }
}

export class Object_ extends Expression {
  constructor (propertyList) {
    super()
    this.propertyList = propertyList
  }

  doTest (tc, value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }
    for (let prop of this.propertyList) {
      if (!prop.doTest(tc, value)) return false
    }
    return true
  }
}

export class Array_ extends Expression {
  constructor (items) {
    super()
    this.items = items
  }

  doTest (tc, value) {
    if (!Array.isArray(value)) {
      return false
    }
    let vidx = 0
    for (let item of this.items) {
      let o = 0
      while (o < item.maxCount &&
        vidx < value.length && item.doTest(tc, value[vidx++])
      ) {
        o++
      }
      if (o < item.minCount) {
        return false
      }
    }
    return true
  }
}

// helpers

export class Property extends Expression {
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
    for (let name in value) {
      if (this.name.doTest(tc, name)) {
        if (tc.matchMap) tc.matchMap.add(name)
        if (this.value.doTest(tc, value[name])) {
          occurs++
        } else {
          return false
        }
      }
    }
    if (occurs < this.minCount || occurs > this.maxCount) return false
    return true
  }
}

export class ListItem extends Expression {
  constructor (value) {
    super()
    this.value = value
  }
}

// leaf nodes

export class Literal extends Expression {
  constructor (value) {
    super()
    this.value = value
  }

  doEval (tc) {
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
  }

  static fromRegExp (rgx) {
    let obj = new RegExp_()
    obj.regexp = rgx
    return obj
  }

  doEval (tc) {
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
