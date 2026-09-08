/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const majorVersion = Number.parseInt(process.versions.node, 10);

if (majorVersion !== 24) {
  throw new Error(
    `Node.js 24 is required for development; found ${process.versions.node}.`,
  );
}
