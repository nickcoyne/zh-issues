import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  choosePipeline,
  matchRepoFilter,
  normalizeWorkspaceId,
  parseGitHubRemote
} from '../core';

test('parseGitHubRemote handles ssh and https forms', () => {
  assert.deepEqual(parseGitHubRemote('git@github.com:acme/rocket.git'), {
    owner: 'acme',
    name: 'rocket'
  });
  assert.deepEqual(parseGitHubRemote('https://github.com/flutter/flutter.git'), {
    owner: 'flutter',
    name: 'flutter'
  });
  assert.deepEqual(parseGitHubRemote('https://github.com/acme/repo'), {
    owner: 'acme',
    name: 'repo'
  });
});

test('parseGitHubRemote keeps dots in repository names', () => {
  assert.deepEqual(parseGitHubRemote('git@github.com:acme/foo.js.git'), {
    owner: 'acme',
    name: 'foo.js'
  });
  assert.deepEqual(parseGitHubRemote('git@github.com:acme/my.dotted.name.git'), {
    owner: 'acme',
    name: 'my.dotted.name'
  });
});

test('parseGitHubRemote tolerates trailing slash and rejects non-GitHub URLs', () => {
  assert.deepEqual(parseGitHubRemote('https://github.com/acme/repo.git/'), {
    owner: 'acme',
    name: 'repo'
  });
  assert.equal(parseGitHubRemote('https://gitlab.com/acme/repo.git'), undefined);
  assert.equal(parseGitHubRemote(''), undefined);
});

test('normalizeWorkspaceId accepts bare id, slug, and full URL', () => {
  const id = '0123456789abcdef01234567';
  assert.equal(normalizeWorkspaceId(id), id);
  assert.equal(normalizeWorkspaceId(`my-team-${id}`), id);
  assert.equal(normalizeWorkspaceId(`https://app.zenhub.com/workspaces/my-team-${id}/board`), id);
  assert.equal(normalizeWorkspaceId(`  ${id}  `), id);
});

test('normalizeWorkspaceId passes through values without a 24-hex id', () => {
  assert.equal(normalizeWorkspaceId('not-an-id'), 'not-an-id');
  assert.equal(normalizeWorkspaceId(''), '');
});

const REPOS = [
  { id: 'r1', name: 'Rocket', ownerName: 'acme' },
  { id: 'r2', name: 'widgets', ownerName: 'acme' },
  { id: 'r3', name: 'Rocket', ownerName: 'other-org' }
];

test('matchRepoFilter with empty filter matches everything', () => {
  assert.deepEqual(matchRepoFilter('', REPOS), {});
});

test('matchRepoFilter by bare name matches across owners, case-insensitively', () => {
  assert.deepEqual(matchRepoFilter('rocket', REPOS).ids, ['r1', 'r3']);
});

test('matchRepoFilter by owner/name matches a single repository', () => {
  assert.deepEqual(matchRepoFilter('other-org/Rocket', REPOS).ids, ['r3']);
  assert.deepEqual(matchRepoFilter('ACME/rocket', REPOS).ids, ['r1']);
});

test('matchRepoFilter reports unknown filters with the available repositories', () => {
  const result = matchRepoFilter('acme/unknown', REPOS);
  assert.equal(result.ids, undefined);
  assert.match(result.error ?? '', /acme\/unknown/);
  assert.match(result.error ?? '', /acme\/Rocket/);
});

const PIPELINES = [
  { id: 'p1', name: 'New Issues' },
  { id: 'p2', name: ' Backlog ' },
  { id: 'p3', name: 'In Progress' }
];

test('choosePipeline prefers a still-valid saved selection', () => {
  assert.equal(choosePipeline(PIPELINES, 'p3', 'Backlog'), 'p3');
});

test('choosePipeline falls back to the default name, ignoring case and whitespace', () => {
  assert.equal(choosePipeline(PIPELINES, undefined, 'backlog'), 'p2');
  assert.equal(choosePipeline(PIPELINES, 'gone', 'Backlog'), 'p2');
});

test('choosePipeline falls back to the first pipeline when the default is missing', () => {
  assert.equal(choosePipeline(PIPELINES, undefined, 'Nonexistent'), 'p1');
});

test('choosePipeline returns undefined for an empty pipeline list', () => {
  assert.equal(choosePipeline([], undefined, 'Backlog'), undefined);
});
