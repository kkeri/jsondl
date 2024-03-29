import { importModule, importValue } from './import'
import * as builtin from './builtin'
import * as model from './model'
import { Diagnostics } from './diag'

const builtins = compileBuiltins(builtin)

function compileBuiltins (builtin) {
  const diag = new Diagnostics()
  let decls = Object.create(null)
  for (let b in builtin) {
    decls[b] = importValue(builtin[b])
  }
  if (diag.hasError) throw new Error('Error loading builtins')
  return decls
}

class BindContext {
  constructor (loader, modul, {
      diag,
      baseDir = ''
  } = {}) {
    this.loader = loader
    this.modul = modul
    this.diag = diag
    this.baseDir = baseDir
    this.exportCount = 0
    this.dynamicDepth = 0
    this.env = builtins
  }

  createEnv () {
    this.env = Object.create(this.env)
    return this.env
  }

  enterEnv (env) {
    this.env = env
  }

  leaveEnv () {
    this.env = Object.getPrototypeOf(this.env)
  }

  bind (id, node) {
    if (Object.prototype.hasOwnProperty.call(this.env, id)) {
      this.diag.error(`${id}: duplicate identifier`, node)
    } else {
      this.env[id] = node
    }
  }

  export (id, node) {
    if (this.modul.exports[id]) {
      this.diag.error(`duplicate export '${id}'`, node)
    } else {
      this.modul.exports[id] = node
      this.exportCount++
    }
  }
}

function bind (node, bc) {
  let f = bindVisitor[node.constructor.name]
  if (f) f(node, bc)
}
const bindVisitor = {

  Module (node, bc) {
    node.env = bc.createEnv()
    for (let decl of node.declList) {
      bind(decl, bc)
    }
    bc.leaveEnv()
    if (!bc.exportCount) {
      bc.diag.error(`a module should export something`, node)
    }
  },

  ImportDeclaration (node, bc) {
    const exports = importModule(bc.loader, node, {
      diag: bc.diag,
      baseDir: bc.baseDir
    })
    if (!exports) return
    for (let item of node.importList) {
      if (item.exportId === '*') {
        bc.bind(item.localId, new model.Literal(exports))
      } else {
        bc.bind(item.localId,
          new model.ImportExpression(exports, item.exportId, node.moduleSpec))
      }
    }
  },

  ExportDeclaration (node, bc) {
    bind(node.body, bc)
    bc.export(node.body.id, node.body.expr)
  },

  ConstDeclaration (node, bc) {
    bind(node.body, bc)
    const env = bc.dynamicDepth ? undefined : bc.env
    node.expr = new model.DeclarationExpression(node.id, node.body, env)
    if (node.id !== 'default') bc.bind(node.id, node.expr)
  },

  LocalEnvironment (node, bc) {
    node.staticEnv = bc.createEnv()
    if (bc.dynamicDepth === 0) node.env = node.staticEnv
    for (let decl of node.declList) {
      bind(decl, bc)
    }
    bind(node.body, bc)
    bc.leaveEnv()
  },

  OrPattern (node, bc) {
    node.items.forEach(i => bind(i, bc))
  },

  AndPattern (node, bc) {
    node.items.forEach(i => bind(i, bc))
  },

  Member (node, bc) {
    bind(node.expr, bc)
  },

  Call (node, bc) {
    bind(node.expr, bc)
    node.args.forEach(i => bind(i, bc))
  },

  ObjectPattern (node, bc) {
    bind(node.expr, bc)
  },

  PropertyPattern (node, bc) {
    bind(node.name, bc)
    bind(node.value, bc)
  },

  ArrayPattern (node, bc) {
    bind(node.expr, bc)
  },

  RepetitionPattern (node, bc) {
    bind(node.expr, bc)
  },

  ArrayItemPattern (node, bc) {
    bind(node.expr, bc)
  },

  RegExp_ (node, bc) {
    if (node.flags && node.flags !== 'i') {
      bc.diag.error(`'${node.flags}': illegal regexp flag (only 'i' is allowed)`, node)
      return
    }
    try {
      node.regexp = new RegExp(node.body, node.flags)
    } catch (e) {
      bc.diag.error(e.message, node)
    }
  }
}

export function bindModule (modul, loader, {
  diag,
  baseDir = ''
} = {}) {
  const bc = new BindContext(loader, modul, { diag, baseDir })
  bind(modul, bc)
}
