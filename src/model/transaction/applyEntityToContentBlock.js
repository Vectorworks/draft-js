/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall draft_js
 */

'use strict';

import type {BlockNodeRecord} from 'BlockNodeRecord';

const CharacterMetadata = require('CharacterMetadata');
const invariant = require('invariant');

function applyEntityToContentBlock(
  contentBlock: BlockNodeRecord,
  startArg: number,
  end: number,
  entityKey: ?string,
): BlockNodeRecord {
  let start = startArg;
  let characterList = contentBlock.getCharacterList();
  while (start < end) {
    const character = characterList.get(start);
    invariant(
      character != null,
      'Expected character metadata at selection offset %s.',
      start,
    );
    characterList = characterList.set(
      start,
      CharacterMetadata.applyEntity(character, entityKey),
    );
    start++;
  }
  return contentBlock.set('characterList', characterList);
}

module.exports = applyEntityToContentBlock;
