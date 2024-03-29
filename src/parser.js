import { readFileSync } from 'fs'
import { join } from 'path'
import { makeRecipe } from 'ohm-js'
import * as model from './model'

var parser
var semantics

export function parse (str, {
  diag
}) {
  if (!parser) {
    initParser()
  }
  let mr = parser.match(str)
  if (mr.failed()) {
    diag.error(mr.message)
    return null
  } else {
    return semantics(mr).model()
  }
}

/**
 * Loads parser definition and initilizes parser semantics.
 */
function initParser () {
  let recipePath = join(__dirname, '../ohm/recipe.js')
  let recipe = readFileSync(recipePath, 'utf-8')
  // this is the recommended way of loading a parser
  parser = makeRecipe(eval(recipe)) // eslint-disable-line

  semantics = parser.createSemantics()
  semantics.addOperation('model', modelActions)
}

const modelActions = {

  // module

  Module (decls) {
    return new model.Module(decls.model())
  },

  // import

  ImportDeclaration (_imp_, items, _from_, moduleSpec, term) {
    return new model.ImportDeclaration(moduleSpec.model(), items.model())
  },
  NamedImports_empty (_lbr_, _rbr_) {
    return []
  },
  NamedImports_list (_lbr_, items, _commaOpt_, _rbr_) {
    return items.asIteration().model()
  },
  ImportSpecifier_simple (id) {
    return new model.ImportSpecifier(id.model(), id.model())
  },
  ImportSpecifier_rename (origId, _as_, localId) {
    return new model.ImportSpecifier(origId.model(), localId.model())
  },
  ImportedDefaultBinding (id) {
    return [new model.ImportSpecifier('default', id.model())]
  },
  NameSpaceImport (_star_, _as_, id) {
    return [new model.ImportSpecifier('*', id.model())]
  },

  // export

  ExportDeclaration_const (_exp_, _const_) {
    return new model.ExportDeclaration(_const_.model())
  },
  ExportDeclaration_default (_exp_, _def_, expr, term) {
    return new model.ExportDeclaration(new model.ConstDeclaration('default', expr.model()))
  },
  ExportDeclaration_bare (expr, term) {
    return new model.ExportDeclaration(new model.ConstDeclaration('default', expr.model()))
  },

  // const

  ConstDeclaration (_const_, list, term) {
    return list.model()
  },
  DeclarationList (list) {
    return list.asIteration().model()
  },
  DeclarationListItem (id, _eq_, expr) {
    return new model.ConstDeclaration(id.model(), expr.model())
  },

  // expression

  LetIn (_let_, decls, _in_, body) {
    return new model.LocalEnvironment(decls.asIteration().model(), body.model())
  },
  OrPattern (list) {
    let items = list.asIteration().model()
    if (items.length === 1) {
      return items[0]
    } else {
      return new model.OrPattern(items)
    }
  },
  AndPattern (list) {
    let items = list.asIteration().model()
    if (items.length === 1) {
      return items[0]
    } else {
      return new model.AndPattern(items)
    }
  },
  LogicalNot (list, expr) {
    if (list.model().length % 2 === 1) {
      return new model.LogicalNot(expr.model())
    } else {
      return expr.model()
    }
  },
  Grouping (_lp_, expr, _rp_) {
    return expr.model()
  },
  SetConstructor (_set_) {
    return new model.SetConstructor()
  },
  Member (expr, _dot_, id) {
    return new model.Member(expr.model(), id.model())
  },
  Call (expr, _lp_, args, _rp_) {
    return new model.Call(expr.model(), args.asIteration().model())
  },
  Ref (id) {
    return new model.Reference(id.model())
  },

  ObjectPattern (_lb_, props, _rb_) {
    const all = new model.AndPattern(props.asIteration().model())
    return new model.ObjectPattern(all)
  },
  PropertyPattern_value_card (name, card, _colon_, value) {
    const c = card.model()
    return new model.PropertyPattern(name.model(), value.model(), c.low, c.high)
  },
  PropertyPattern_value (name, _colon_, value) {
    return new model.PropertyPattern(name.model(), value.model())
  },
  PropertyPattern_any_card (name, card) {
    const c = card.model()
    return new model.PropertyPattern(name.model(), new model.Reference('any'), c.low, c.high)
  },
  PropertyPattern_any (name) {
    return new model.PropertyPattern(name.model(), new model.Reference('any'))
  },

  ArrayPattern_cardinality (_lb_, items, _rb_, card) {
    const c = card.model()
    const all = new model.AndPattern(items.asIteration().model())
    const rep = new model.RepetitionPattern(all, c.low, c.high)
    return new model.ArrayPattern(rep)
  },
  ArrayPattern_default (_lb_, items, _rb_) {
    const all = new model.AndPattern(items.asIteration().model())
    return new model.ArrayPattern(all)
  },
  ArrayItemPattern_cardinality (value, card) {
    const c = card.model()
    const item = new model.ArrayItemPattern(value.model())
    return new model.RepetitionPattern(item, c.low, c.high)
  },
  ArrayItemPattern_default (value) {
    return new model.ArrayItemPattern(value.model())
  },
  String (str) {
    return new model.Literal(str.model())
  },

  Cardinality (card) {
    let c = card.model()
    switch (c) {
      case '-': return { low: 0, high: 0 }
      case '?': return { low: 0, high: 1 }
      case '+': return { low: 1, high: Infinity }
      case '*': return { low: 0, high: Infinity }
      default: return c
    }
  },
  NumericCardinality_single (_lbr_, int, _rbr_) {
    return { low: int.model(), high: int.model() }
  },
  NumericCardinality_min (_lbr_, low, _comma_, _rbr_) {
    return { low: low.model(), high: Infinity }
  },
  NumericCardinality_range (_lbr_, low, _dotdot_, high, _rbr_) {
    return { low: low.model(), high: high.model() }
  },

  // lexical rules

  identifier (start, rest) {
    return this.source.contents
  },
  number (sign, int, _point_, frac, exp) {
    return new model.Literal(parseFloat(this.source.contents))
  },
  natural (chars) {
    return parseInt(this.source.contents)
  },
  string (quote1, chars, quote2) {
    return chars.source.contents
  },
  regexp (slash1, body, slash2, flags) {
    return new model.RegExp_(body.source.contents, flags.model())
  },
  regexpFlags (chars) {
    return this.source.contents
  },
  constant_null (_null_) {
    return new model.Literal(null)
  },
  constant_true (_true_) {
    return new model.Literal(true)
  },
  constant_false (_false_) {
    return new model.Literal(false)
  },
  _terminal () {
    return this.source.contents
  }
}
