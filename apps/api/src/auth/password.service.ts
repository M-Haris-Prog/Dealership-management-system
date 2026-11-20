import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [, saltHex, hashHex] = encodedHash.split('$');
    if (!saltHex || !hashHex) return false;

    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = (await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer;
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
}
