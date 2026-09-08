/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const BLACKLISTED_PATTERNS/*: Array<RegExp>*/ = [
  /.*\/__(mocks|tests)__\/.*/,
];

const WHITELISTED_PREFIXES/*: Array<string>*/ = [
  'src'
];

const NAME_REDUCERS/*: Array<[RegExp, string]>*/ = [
  // extract basename
  [/^(?:.*\/)?([a-zA-Z0-9$_.-]+)$/, '$1'],
  // strip .js/.js.flow suffix
  [/^(.*)\.js(\.flow)?$/, '$1'],
  // strip .android/.ios/.native/.web suffix
  [/^(.*)\.(android|ios|native|web)$/, '$1'],
];

const haste = {
  /*
   * @return {string|void} hasteName for module at filePath; or undefined if
   *                       filePath is not a haste module
   */
  getHasteName(
    filePath/*: string*/,
    sourceCode/* : ?string*/
  )/*: (string | void)*/ {
    if (!isHastePath(filePath)) {
      return undefined;
    }

    const relativePath = toPosixPath(path.relative(ROOT, filePath));
    const hasteName = NAME_REDUCERS.reduce(
      (name, [pattern, replacement]) => name.replace(pattern, replacement),
      relativePath,
    );

    return hasteName;
  },
};

function isHastePath(filePath/*: string*/)/*: bool*/ {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.js.flow')) {
    return false;
  }

  const relativePath = toPosixPath(path.relative(ROOT, filePath));
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    return false;
  }

  if (BLACKLISTED_PATTERNS.some(pattern => pattern.test(relativePath))) {
    return false;
  }
  return WHITELISTED_PREFIXES.some(prefix =>
    relativePath.startsWith(`${prefix}/`),
  );
}

function toPosixPath(filePath/*: string*/)/*: string*/ {
  return filePath.replace(/\\/g, '/');
}

module.exports = haste;
