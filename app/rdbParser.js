import fs from 'fs';

export const parseRdbFile = (path, getData = false, reqKey = null) => {
    const bufferData = fs.readFileSync(path);
    if (!bufferData) throw new Error('No data exist on given path');

    let index = 0;
    const keys = [];

    const header = bufferData.toString('ascii', 0, 9);
    if (header !== 'REDIS0011') throw new Error('Incorrect redis version');
    index += 9;

    while (index < bufferData.length && bufferData[index] !== 0xfe) {
        index++;
    }

    while (index < bufferData.length && bufferData[index] !== 0xff) {
        if (bufferData[index] === 0xfe) {
            index++;
            index += stringEncoding(index, bufferData).byteRead;
        }

        if (bufferData[index] === 0xfb) {
            index++;
            index += stringEncoding(index, bufferData).byteRead;
            index += stringEncoding(index, bufferData).byteRead;
        }

        let expiry = null;
        if (bufferData[index] === 0xfc) {
            index++;
            expiry = bufferData.readBigUInt64LE(index);
            index += 8;
        } else if (bufferData[index] === 0xfd) {
            index++;
            expiry = bufferData.readUInt32LE(index);
            index += 4;
        }
        index++;

        let encodedKeyData = stringEncoding(index, bufferData);
        index += encodedKeyData.byteRead;
        let key = bufferData.toString('utf8', index, index + encodedKeyData.lengthOfString);
        index += encodedKeyData.lengthOfString;
        keys.push(key);

        let encodedValueData = stringEncoding(index, bufferData);
        index += encodedValueData.byteRead;
        let value = bufferData.toString('utf8', index, index + encodedValueData.lengthOfString);
        index += encodedValueData.lengthOfString;

        if (getData && key === reqKey) {
            const currentTime = new Date().getTime();
            if (!expiry || expiry > currentTime) {
                return { val: value, time: currentTime, expire: expiry };
            } else {
                return null;
            }
        }
    }

    if (getData) return null;
    return keys;
};

const stringEncoding = (offset, Buffer) => {
    const firstByte = Buffer[offset];
    const twoMostSignificantBits = firstByte >> 6;

    if (twoMostSignificantBits == 0) {
        return { lengthOfString: firstByte & 0x3f, byteRead: 1 };
    } else if (twoMostSignificantBits == 1) {
        let nextByte = Buffer[offset + 1];
        return {
            lengthOfString: ((firstByte & 0x3f) << 8) | nextByte,
            byteRead: 2,
        };
    } else if (twoMostSignificantBits == 2) {
        return {
            lengthOfString: Buffer.readUInt32LE(offset + 1),
            byteRead: 5,
        };
    } else {
        const specialEncoding = firstByte & 0x3f;
        if (specialEncoding === 0) {
            return { lengthOfString: Buffer[offset + 1], byteRead: 2 };
        } else if (specialEncoding === 1) {
            return {
                lengthOfString: Buffer.readUInt16LE(offset + 1),
                byteRead: 3,
            };
        } else if (specialEncoding === 2) {
            return {
                lengthOfString: Buffer.readUInt32LE(offset + 1),
                byteRead: 5,
            };
        } else {
            return { lengthOfString: specialEncoding - 1, byteRead: 1 };
        }
    }
};