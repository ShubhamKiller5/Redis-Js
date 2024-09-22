import net from 'node:net';
import fs from 'fs';
const config = new Map();
const [file, dbFileName] = [process.argv[3] ?? null, process.argv[5] ?? null];
console.log('filearg', file, dbFileName);
if (file || dbFileName) {
     config.set('dir', file);
     config.set('dbfilename', dbFileName);
}
const map = {};
const server = net.createServer((connection) => {
     console.log('client connected');
     connection.on('end', () => {
          console.log('Client disconnected now');
     });
     connection.on('data', (data) => {
          console.log('process.argv', process.argv);
          const message = Buffer.from(data).toString().trim();
          console.log('messge', message);
          const parsedObject = redisParser(message);

          console.log('parsedObj', parsedObject);
          const result = redisResponse(
               parsedObject.command,
               parsedObject.commandArg
          );
          console.log('result', result);
          connection.write(result);
     });
     //  connection.pipe(connection);
});
server.on('error', (error) => {
     throw error;
});

// *2\r\n$4\r\nECHO\r\n$3\r\nhey\r\n
const redisParser = (str = '') => {
     const parsedObject = {
          command: '',
          commandArg: [],
     };
     const strArray = str.split('\r\n');
     // const strArray = ['*2', 'CONFIG GET', 'dbfilename'];
     console.log('array', JSON.stringify(strArray));
     for (const k in strArray) {
          const element = strArray[k];
          if (element[0] == '$') strArray.splice(k, 1);
     }
     console.log('array2', JSON.stringify(strArray));
     const totalArgs = strArray[0][1];
     parsedObject['command'] = strArray[1];
     if (totalArgs == '*1') {
          parsedObject['commandArg'] = null;
          return parsedObject;
     }
     for (let i = 2; i < strArray.length; i++) {
          console.log('strlen', strArray.length, i);
          parsedObject['commandArg'] = [
               ...parsedObject['commandArg'],
               strArray[i],
          ];
     }
     return parsedObject;
};

const redisResponse = (command, commandArg) => {
     console.log(command, commandArg);
     if (!command || command == undefined) return '-ERR unknown command\r\n';
     command = command.toLowerCase();
     if (command == 'echo') {
          const result = commandArg.join(' ');
          return respPattern(result);
     } else if (command == 'ping') {
          return '+PONG\r\n';
     } else if (command == 'set') {
          const val = commandArg[1];
          const key = commandArg[0];
          map[key] = {
               val: val,
               time: new Date().getTime(),
               expire: (commandArg[3] && parseInt(commandArg[3])) || null,
          };
          console.log(map[key]);
          return `+OK\r\n`;
     } else if (command == 'get') {
          let val;
          // map['fruit'] = { val: 'banana', time: 1725539233674, expire: 1000000 };
          if (file || dbFileName) {
               const filePath = `${config.get('dir')}/${config.get(
                    'dbfilename'
               )}`;
               console.log('commandarg', commandArg);
               val = parseRdbFile(filePath, true, commandArg[0]);
          } else {
               val = map[commandArg[0]];
          }
          console.log('val after setting', val);
          // console.log(new Date().getTime() - val.time)
          if (
               val &&
               (!val.expire ||
                    (val.expire &&
                         val.expire > new Date().getTime() - val.time))
          ) {
               return respPattern(val.val);
          } else {
               return respPattern(-1);
          }
     } else if (command === 'config') {
          if (commandArg[0].toLowerCase() === 'get') {
               if (commandArg[1].toLowerCase() == 'dir') {
                    //Return an array
                    console.log('file', config.get('dir'));
                    const ans = ['dir', config.get('dir')];
                    return respPattern(ans);
               } else if (commandArg[1].toLowerCase() == 'dbfilename') {
                    console.log('filename', config.get('dbfilename'));
                    const ans = ['dbFileName', config.get('dbfilename')];
                    return respPattern(ans);
               }
          }
     } else if (command === 'keys') {
          if (commandArg[0] == '*') {
               const filePath = `${config.get('dir')}/${config.get(
                    'dbfilename'
               )}`;
               let keys = parseRdbFile(filePath);
               return respPattern(keys);
          }
     } else {
          return '-ERR unknown command\r\n';
     }
};

const respPattern = (val) => {
     const type = typeof val;
     let ans = null;
     switch (type) {
          case 'string':
               ans = `$${val.length}\r\n${val}\r\n`;
               break;
          case 'number':
               ans = `$${val}\r\n`;
               break;
          case 'object':
               if (
                    Array.isArray(val) &&
                    val.every((item) => typeof item === 'string')
               ) {
                    let res = '';
                    for (const v of val) {
                         res += `$${v.length}\r\n${v}\r\n`;
                    }
                    ans = `*${val.length}\r\n${res}`;
               }
               break;
     }
     return ans;
};

//RDB Parser
const parseRdbFile = (path, getData = false, reqKey = null) => {
     console.log('path', path);
     const bufferData = fs.readFileSync(path);
     if (!bufferData) throw new Error('No data exist on given path');
     console.log('buffer', bufferData.toString());
     let index = 0;
     const keys = [];
     //Pass header section
     const header = bufferData.toString('ascii', 0, 9);
     if (header !== 'REDIS0011') throw new Error('Incorrect redis version');
     index += 9;

     //Pass Metadata section
     // while (bufferData[index] === 0xfa) {
     //      index++;
     //      const nameMetadata = stringEncoding(index, bufferData);
     //      index += nameMetadata.byteRead + nameMetadata.lengthOfString;
     //      const valueMetadata = stringEncoding(index, bufferData);
     //      index += valueMetadata.byteRead + valueMetadata.lengthOfString;
     // }
     while (index < bufferData.length && bufferData[index] !== 0xfe) {
          index++;
     }

     //Database section
     while (index < bufferData.length && bufferData[index] !== 0xff) {
          console.log('Inside db');
          if (bufferData[index] === 0xfe) {
               index++; //Start of DB section
               console.log('Database index start');
               index += stringEncoding(index, bufferData).byteRead; //Database index
               console.log('Db index finish');
          }

          if (bufferData[index] === 0xfb) {
               index++;
               console.log('hash table size start');
               index += stringEncoding(index, bufferData).byteRead; // pass hash table size
               console.log('hash table size finish');
               console.log('expiry size start');
               index += stringEncoding(index, bufferData).byteRead; //pass expiry size
               console.log('expiry size finish');
          }

          // Key-Value pair
          let expiry = null;
          if (bufferData[index] === 0xfc) {
               console.log('ms expiry');
               index++;
               expiry = bufferData.readBigUInt64LE(index);
               index += 8;
          } else if (bufferData[index] === 0xfd) {
               console.log('s expiry');
               index++;
               expiry = bufferData.readUInt32LE(index);
               index += 4;
          }
          let flag = bufferData[index];
          console.log('flag', flag);
          index++; //flag

          console.log('keys fetch start');
          let encodedKeyData = stringEncoding(index, bufferData);
          console.log('encodedKeyData', encodedKeyData);
          index += encodedKeyData.byteRead;
          let key = bufferData.toString(
               'utf8',
               index,
               index + encodedKeyData.lengthOfString
          );
          index += encodedKeyData.lengthOfString;
          keys.push(key);
          console.log('keys fetch finish', { key });

          console.log('values fetch start');
          let encodedValueData = stringEncoding(index, bufferData);
          console.log('encodedValueData', encodedValueData);
          index += encodedValueData.byteRead;
          let value = bufferData.toString(
               'utf8',
               index,
               index + encodedValueData.lengthOfString
          );
          index += encodedValueData.lengthOfString;
          console.log('values fetch finish', { value });

          console.log('Checking the value requirement', getData, expiry, {
               key,
               reqKey,
          });
          if (getData && key === reqKey) {
               const currentTime = new Date().getTime();
               console.log('timesatamps', currentTime, expiry);
               if (!expiry || expiry > currentTime) {
                    return { val: value, time: currentTime, expire: expiry };
               } else {
                    return null; // Key has expired
               }
          }
     }

     if (getData) return null;
     console.log('keys final', JSON.stringify(keys));
     return keys;
};

/* If the first two bits are 0b00:
   The size is the remaining 6 bits of the byte. */

/* If the first two bits are 0b01:
   The size is the next 14 bits
   (remaining 6 bits in the first byte, combined with the next byte),
   in big-endian (read left-to-right).*/

/* If the first two bits are 0b10:
   Ignore the remaining 6 bits of the first byte.
   The size is the next 4 bytes, in big-endian (read left-to-right).*/

const stringEncoding = (offset, Buffer) => {
     // console.log('byte', Buffer.toString('utf8', offset));
     const firstByte = Buffer[offset];
     console.log('firstByte', firstByte);
     const twoMostSignificantBits = firstByte >> 6;
     let result;
     console.log(
          'twoMostSignificantBits',
          twoMostSignificantBits,
          twoMostSignificantBits == 2
     );
     if (twoMostSignificantBits == 0) {
          return { lengthOfString: firstByte & 0x3f, byteRead: 1 };
     } else if (twoMostSignificantBits == 1) {
          let nextByte = Buffer[offset + 1];
          console.log(
               'nextByte',
               { nextByte },
               ((firstByte & 0b00111111) << 8) | nextByte
          );
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
          console.log('specialEncoding', specialEncoding);
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
     // switch (twoMostSignificantBits) {
     //      case 0:
     //           result = { lengthOfString: firstByte & 0x3f, byteRead: 1 };
     //           break;
     //      case 1:
     //           let nextByte = Buffer[offset + 1];
     //           result = {
     //                lengthOfString: ((firstByte & 0x3f) << 8) | nextByte,
     //                byteRead: 2,
     //           };
     //           break;
     //      case 2:
     //           result = {
     //                lengthOfString: Buffer.readUInt32LE(offset + 1),
     //                byteRead: 5,
     //           };
     //      case 3:
     //           // Handle special encoding
     //           const intersect = firstByte & 0x3f;
     //           console.log('intersect', intersect);
     //           if ((firstByte & 0x3f) === 0) {
     //                // 8-bit integer
     //                result = {
     //                     lengthOfString: Buffer[offset + 1],
     //                     byteRead: 2,
     //                };
     //           } else if ((firstByte & 0x3f) === 1) {
     //                // 16-bit integer
     //                result = {
     //                     lengthOfString: Buffer.readUInt16LE(offset + 1),
     //                     byteRead: 3,
     //                };
     //           } else if ((firstByte & 0x3f) === 2) {
     //                // 32-bit integer
     //                result = {
     //                     lengthOfString: Buffer.readUInt32LE(offset + 1),
     //                     byteRead: 5,
     //                };
     //           } else {
     //                throw new Error(
     //                     `Unhandled special encoding: ${firstByte & 0x3f}`
     //                );
     //           }
     //           break;
     //      default:
     //           throw new Error('Invalid string encoding');
     // }
     console.log('resukt', JSON.stringify(result));
     return result;
};
// const res = redisParser();
// console.log(res);
// console.log(redisResponse(res.command, res.commandArg));
server.listen(6379, '127.0.0.1');
