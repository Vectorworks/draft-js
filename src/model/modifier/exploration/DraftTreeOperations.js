/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * This is unstable and not part of the public API and should not be used by
 * production systems. This file may be update/removed without notice.
 *
 * @flow strict-local
 * @format
 * @oncall draft_js
 */
import type {BlockMap} from 'BlockMap';
import type {BlockNodeKey} from 'BlockNode';
import type ContentBlockNodeType from 'ContentBlockNode';

const ContentBlockNode = require('ContentBlockNode');
const DraftTreeInvariants = require('DraftTreeInvariants');

const generateRandomKey = require('generateRandomKey');
const Immutable = require('immutable');
const invariant = require('invariant');

type SiblingInsertPosition = 'previous' | 'next';

const getBlockNode = (
  blockMap: BlockMap,
  key: string,
): ContentBlockNodeType => {
  const block = blockMap.get(key);
  invariant(block != null, 'Expected tree block with key %s to exist.', key);
  invariant(
    block instanceof ContentBlockNode,
    'Tree block map must contain only ContentBlockNodes.',
  );
  return (block: ContentBlockNodeType);
};

const verifyTree = (tree: BlockMap): void => {
  if (__DEV__) {
    invariant(DraftTreeInvariants.isValidTree(tree), 'The tree is not valid');
  }
};

/**
 * This is a utility method for setting B as a child of A, ensuring
 * that parent <-> child operations are correctly mirrored
 *
 * The child is inserted at 'position' index in the list
 *
 * The block map returned by this method may not be a valid tree (siblings are
 * unaffected)
 */
const updateParentChild = (
  blockMap: BlockMap,
  parentKey: string,
  childKey: string,
  position: number,
): BlockMap => {
  const parent = getBlockNode(blockMap, parentKey);
  const child = getBlockNode(blockMap, childKey);
  const newBlocks: {[string | BlockNodeKey]: ContentBlockNodeType} = {};
  const existingChildren = parent.getChildKeys();
  invariant(
    existingChildren != null &&
      position >= 0 &&
      position <= existingChildren.count(),
    'position is not valid for the number of children',
  );

  // add as parent's child
  newBlocks[parentKey] = parent.merge({
    children: existingChildren.splice(position, 0, childKey),
  });

  let nextSiblingKey: ?BlockNodeKey = null;
  let prevSiblingKey: ?BlockNodeKey = null;
  // link new child as next sibling to the correct existing child
  if (position > 0) {
    prevSiblingKey = existingChildren.get(position - 1);
    invariant(
      prevSiblingKey != null,
      'Expected previous sibling at child position %s.',
      position - 1,
    );
    newBlocks[prevSiblingKey] = getBlockNode(blockMap, prevSiblingKey).merge({
      nextSibling: childKey,
    });
  }
  // link new child as previous sibling to the correct existing child
  if (position < existingChildren.count()) {
    nextSiblingKey = existingChildren.get(position);
    invariant(
      nextSiblingKey != null,
      'Expected next sibling at child position %s.',
      position,
    );
    newBlocks[nextSiblingKey] = getBlockNode(blockMap, nextSiblingKey).merge({
      prevSibling: childKey,
    });
  }
  // add parent & siblings to the child
  newBlocks[childKey] = child.merge({
    parent: parentKey,
    prevSibling: prevSiblingKey,
    nextSibling: nextSiblingKey,
  });
  return blockMap.merge(newBlocks);
};

/**
 * This is a utility method for setting B as the next sibling of A, ensuring
 * that sibling operations are correctly mirrored
 *
 * The block map returned by this method may not be a valid tree (parent/child/
 * other siblings are unaffected)
 */
const updateSibling = (
  blockMap: BlockMap,
  prevKey: string,
  nextKey: string,
): BlockMap => {
  const prevSibling = getBlockNode(blockMap, prevKey);
  const nextSibling = getBlockNode(blockMap, nextKey);
  const newBlocks: {[string]: ContentBlockNodeType} = {};
  newBlocks[prevKey] = prevSibling.merge({
    nextSibling: nextKey,
  });
  newBlocks[nextKey] = nextSibling.merge({
    prevSibling: prevKey,
  });
  return blockMap.merge(newBlocks);
};

/**
 * This is a utility method for replacing B by C as a child of A, ensuring
 * that parent <-> child connections between A & C are correctly mirrored
 *
 * The block map returned by this method may not be a valid tree (siblings are
 * unaffected)
 */
const replaceParentChild = (
  blockMap: BlockMap,
  parentKey: string,
  existingChildKey: string,
  newChildKey: string,
): BlockMap => {
  const parent = getBlockNode(blockMap, parentKey);
  const newChild = getBlockNode(blockMap, newChildKey);
  const existingChildren = parent.getChildKeys();
  const newBlocks: {[string]: ContentBlockNodeType} = {};
  newBlocks[parentKey] = parent.merge({
    children: existingChildren.set(
      existingChildren.indexOf(existingChildKey),
      newChildKey,
    ),
  });
  newBlocks[newChildKey] = newChild.merge({
    parent: parentKey,
  });
  return blockMap.merge(newBlocks);
};

/**
 * This is a utility method that abstracts the operation of creating a new parent
 * for a particular node in the block map.
 *
 * This operation respects the tree data invariants - it expects and returns a
 * valid tree.
 */
const createNewParent = (blockMap: BlockMap, key: string): BlockMap => {
  verifyTree(blockMap);
  const block = getBlockNode(blockMap, key);
  const newParent = new ContentBlockNode({
    key: generateRandomKey(),
    text: '',
    depth: block.depth,
    type: block.type,
    children: Immutable.List([]),
  });
  // add the parent just before the child in the block map
  let newBlockMap = blockMap
    .takeUntil(block => block.getKey() === key)
    .concat(Immutable.OrderedMap([[newParent.getKey(), newParent]]))
    .concat(blockMap.skipUntil(block => block.getKey() === key));
  // set parent <-> child connection
  newBlockMap = updateParentChild(newBlockMap, newParent.getKey(), key, 0);
  // set siblings & parent for the new parent key to child's siblings & parent
  const prevSibling = block.getPrevSiblingKey();
  const nextSibling = block.getNextSiblingKey();
  const parent = block.getParentKey();
  if (prevSibling != null) {
    newBlockMap = updateSibling(newBlockMap, prevSibling, newParent.getKey());
  }
  if (nextSibling != null) {
    newBlockMap = updateSibling(newBlockMap, newParent.getKey(), nextSibling);
  }
  if (parent != null) {
    newBlockMap = replaceParentChild(
      newBlockMap,
      parent,
      key,
      newParent.getKey(),
    );
  }
  verifyTree(newBlockMap);
  return newBlockMap;
};

/**
 * This is a utility method that abstracts the operation of adding a node as the child
 * of its previous or next sibling.
 *
 * The previous (or next) sibling must be a valid parent node.
 *
 * This operation respects the tree data invariants - it expects and returns a
 * valid tree.
 */
const updateAsSiblingsChild = (
  blockMap: BlockMap,
  key: string,
  position: SiblingInsertPosition,
): BlockMap => {
  verifyTree(blockMap);
  const block = getBlockNode(blockMap, key);
  const newParentKey =
    position === 'previous'
      ? block.getPrevSiblingKey()
      : block.getNextSiblingKey();
  invariant(newParentKey != null, 'sibling is null');
  const newParent = getBlockNode(blockMap, newParentKey);
  invariant(newParent.getText() === '', 'parent must be a valid node');
  let newBlockMap = blockMap;
  switch (position) {
    case 'next':
      newBlockMap = updateParentChild(newBlockMap, newParentKey, key, 0);
      const prevSibling = block.getPrevSiblingKey();
      if (prevSibling != null) {
        newBlockMap = updateSibling(newBlockMap, prevSibling, newParentKey);
      } else {
        newBlockMap = newBlockMap.set(
          newParentKey,
          getBlockNode(newBlockMap, newParentKey).merge({prevSibling: null}),
        );
      }
      // we also need to flip the order of the sibling & block in the ordered map
      // for this case
      newBlockMap = newBlockMap
        .takeUntil(block => block.getKey() === key)
        .concat(
          Immutable.OrderedMap([
            [newParentKey, getBlockNode(newBlockMap, newParentKey)],
            [key, getBlockNode(newBlockMap, key)],
          ]),
        )
        .concat(
          newBlockMap
            .skipUntil(block => block.getKey() === newParentKey)
            .slice(1),
        );
      break;
    case 'previous':
      newBlockMap = updateParentChild(
        newBlockMap,
        newParentKey,
        key,
        newParent.getChildKeys().count(),
      );
      const nextSibling = block.getNextSiblingKey();
      if (nextSibling != null) {
        newBlockMap = updateSibling(newBlockMap, newParentKey, nextSibling);
      } else {
        newBlockMap = newBlockMap.set(
          newParentKey,
          getBlockNode(newBlockMap, newParentKey).merge({nextSibling: null}),
        );
      }
      break;
  }
  // remove the node as a child of its current parent
  const parentKey = block.getParentKey();
  if (parentKey != null) {
    const parent = getBlockNode(newBlockMap, parentKey);
    newBlockMap = newBlockMap.set(
      parentKey,
      parent.merge({
        children: parent
          .getChildKeys()
          .delete(parent.getChildKeys().indexOf(key)),
      }),
    );
  }
  verifyTree(newBlockMap);
  return newBlockMap;
};

/**
 * This is a utility method that abstracts the operation of moving a node up to become
 * a sibling of its parent. If the operation results in a parent with no children,
 * also delete the parent node.
 *
 * Can only operate on the first or last child (this is an invariant)
 *
 * This operation respects the tree data invariants - it expects and returns a
 * valid tree.
 */
const moveChildUp = (blockMap: BlockMap, key: string): BlockMap => {
  verifyTree(blockMap);
  const block = getBlockNode(blockMap, key);

  // if there is no parent, do nothing
  const parentKey = block.getParentKey();
  if (parentKey == null) {
    return blockMap;
  }

  let parent = getBlockNode(blockMap, parentKey);
  let newBlockMap = blockMap;
  const childIndex = parent.getChildKeys().indexOf(key);
  invariant(
    childIndex === 0 || childIndex === parent.getChildKeys().count() - 1,
    'block is not first or last child of its parent',
  );

  // If it's the first child, move as previous sibling of parent
  if (childIndex === 0) {
    const parentPrevSibling = parent.getPrevSiblingKey();
    newBlockMap = updateSibling(newBlockMap, key, parentKey);
    // link to parent's previous sibling
    if (parentPrevSibling != null) {
      newBlockMap = updateSibling(newBlockMap, parentPrevSibling, key);
    }
    // remove as parent's child
    parent = getBlockNode(newBlockMap, parentKey);
    newBlockMap = newBlockMap.set(
      parentKey,
      parent.merge({
        children: parent.getChildKeys().slice(1),
      }),
    );
    parent = getBlockNode(newBlockMap, parentKey);
    // remove as previous sibling of parent's children
    if (parent.getChildKeys().count() > 0) {
      const firstChildKey = parent.getChildKeys().first();
      invariant(
        firstChildKey != null,
        'Expected parent to have a first child.',
      );
      const firstChild = getBlockNode(newBlockMap, firstChildKey);
      newBlockMap = newBlockMap.set(
        firstChildKey,
        firstChild.merge({prevSibling: null}),
      );
    }
    // add the node just before its former parent in the block map
    newBlockMap = newBlockMap
      .takeUntil(block => block.getKey() === parentKey)
      .concat(
        Immutable.OrderedMap([
          [key, getBlockNode(newBlockMap, key)],
          [parentKey, getBlockNode(newBlockMap, parentKey)],
        ]),
      )
      .concat(newBlockMap.skipUntil(block => block.getKey() === key).slice(1));

    // If it's the last child, move as next sibling of parent
  } else if (childIndex === parent.getChildKeys().count() - 1) {
    const parentNextSibling = parent.getNextSiblingKey();
    newBlockMap = updateSibling(newBlockMap, parentKey, key);
    // link to parent's next sibling
    if (parentNextSibling != null) {
      newBlockMap = updateSibling(newBlockMap, key, parentNextSibling);
    }
    // remove as parent's child
    parent = getBlockNode(newBlockMap, parentKey);
    newBlockMap = newBlockMap.set(
      parentKey,
      parent.merge({
        children: parent.getChildKeys().slice(0, -1),
      }),
    );
    parent = getBlockNode(newBlockMap, parentKey);
    // remove as next sibling of parent's children
    if (parent.getChildKeys().count() > 0) {
      const lastChildKey = parent.getChildKeys().last();
      invariant(lastChildKey != null, 'Expected parent to have a last child.');
      const lastChild = getBlockNode(newBlockMap, lastChildKey);
      newBlockMap = newBlockMap.set(
        lastChildKey,
        lastChild.merge({nextSibling: null}),
      );
    }
  }

  // For both cases, also link to parent's parent
  const grandparentKey = parent.getParentKey();
  if (grandparentKey != null) {
    const grandparentInsertPosition = getBlockNode(newBlockMap, grandparentKey)
      .getChildKeys()
      .findIndex(n => n === parentKey);
    newBlockMap = updateParentChild(
      newBlockMap,
      grandparentKey,
      key,
      childIndex === 0
        ? grandparentInsertPosition
        : grandparentInsertPosition + 1,
    );
  } else {
    newBlockMap = newBlockMap.set(
      key,
      getBlockNode(newBlockMap, key).merge({parent: null}),
    );
  }

  // Delete parent if it has no children
  parent = getBlockNode(newBlockMap, parentKey);
  if (parent.getChildKeys().count() === 0) {
    const prevSiblingKey = parent.getPrevSiblingKey();
    const nextSiblingKey = parent.getNextSiblingKey();
    if (prevSiblingKey != null && nextSiblingKey != null) {
      newBlockMap = updateSibling(newBlockMap, prevSiblingKey, nextSiblingKey);
    }
    if (prevSiblingKey == null && nextSiblingKey != null) {
      newBlockMap = newBlockMap.set(
        nextSiblingKey,
        getBlockNode(newBlockMap, nextSiblingKey).merge({prevSibling: null}),
      );
    }
    if (nextSiblingKey == null && prevSiblingKey != null) {
      newBlockMap = newBlockMap.set(
        prevSiblingKey,
        getBlockNode(newBlockMap, prevSiblingKey).merge({nextSibling: null}),
      );
    }
    if (grandparentKey != null) {
      const grandparent = getBlockNode(newBlockMap, grandparentKey);
      const oldChildren = grandparent.getChildKeys();
      newBlockMap = newBlockMap.set(
        grandparentKey,
        grandparent.merge({
          children: oldChildren.delete(oldChildren.indexOf(parentKey)),
        }),
      );
    }

    newBlockMap = newBlockMap.delete(parentKey);
  }

  verifyTree(newBlockMap);
  return newBlockMap;
};

/**
 * This is a utility method to merge two non-leaf blocks into one. The next block's
 * children are added to the provided block & the next block is deleted.
 *
 * This operation respects the tree data invariants - it expects and returns a
 * valid tree.
 */
const mergeBlocks = (blockMap: BlockMap, key: string): BlockMap => {
  verifyTree(blockMap);
  // current block must be a non-leaf
  const block = getBlockNode(blockMap, key);
  invariant(block.getChildKeys().count() > 0, 'block must be a non-leaf');
  // next block must exist & be a non-leaf
  const nextBlockKey = block.getNextSiblingKey();
  invariant(nextBlockKey != null, 'block must have a next block');
  const nextBlock = getBlockNode(blockMap, nextBlockKey);
  invariant(
    nextBlock.getChildKeys().count() > 0,
    'next block must be a non-leaf',
  );

  const childKeys = block.getChildKeys().concat(nextBlock.getChildKeys());
  let newBlockMap = blockMap.set(
    key,
    block.merge({
      nextSibling: nextBlock.getNextSiblingKey(),
      children: childKeys,
    }),
  );
  newBlockMap = newBlockMap.merge(
    Immutable.OrderedMap(
      childKeys.map((k, i) => [
        k,
        getBlockNode(blockMap, k).merge({
          parent: key,
          prevSibling: i - 1 < 0 ? null : childKeys.get(i - 1),
          nextSibling:
            i + 1 === childKeys.count() ? null : childKeys.get(i + 1),
        }),
      ]),
    ),
  );
  newBlockMap = newBlockMap.delete(nextBlockKey);

  const nextNextBlockKey = nextBlock.getNextSiblingKey();
  if (nextNextBlockKey != null) {
    newBlockMap = newBlockMap.set(
      nextNextBlockKey,
      getBlockNode(blockMap, nextNextBlockKey).merge({prevSibling: key}),
    );
  }
  verifyTree(newBlockMap);
  return newBlockMap;
};

module.exports = {
  updateParentChild,
  replaceParentChild,
  updateSibling,
  createNewParent,
  updateAsSiblingsChild,
  moveChildUp,
  mergeBlocks,
};
