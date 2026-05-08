#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { argv, exit, stderr, stdout } from 'node:process'

const ALGORITHM = 'pbkdf2-sha256'
const ITERATIONS = 310000
const SALT_BYTES = 16
const HASH_BYTES = 32

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

const password = argv[2]
if (!password) {
  stderr.write('Usage: npm run password:hash -- "your-admin-password"\n')
  exit(1)
}

const salt = randomBytes(SALT_BYTES)
const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, 'sha256')
stdout.write(`${ALGORITHM}$${ITERATIONS}$${base64Url(salt)}$${base64Url(hash)}\n`)
