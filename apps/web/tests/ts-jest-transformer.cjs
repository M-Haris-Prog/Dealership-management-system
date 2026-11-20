const Module = require('module')
const originalResolve = Module._resolveFilename
const apiTypescript = require.resolve('../../api/node_modules/typescript')
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'typescript') return apiTypescript
  return originalResolve.call(this, request, parent, isMain, options)
}
module.exports = require('../../api/node_modules/ts-jest')
