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
          // map['fruit'] = { val: 'banana', time: 1725539233674, expire: 1000000 };
          const val = map[commandArg[0]];
          // console.log(new Date().getTime() - val.time)
          if (
               (val.expire && val.expire > new Date().getTime() - val.time) ||
               (!val.expire && val)
          )
               return respPattern(val.val);
          else return respPattern(-1);
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
const parseRdbFile = (path) => {
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
     //      console.log('0xFA 1');
     //      const nameMetadata = stringEncoding(index, bufferData); // name of meta data
     //      index += nameMetadata.byteRead + nameMetadata.lengthOfString;
     //      console.log('0xFA 2');
     //      const valueMetadata = stringEncoding(index, bufferData);
     //      index += valueMetadata.byteRead + valueMetadata.lengthOfString;
     // }
     console.log("outside fa", index, bufferData.length)
     while(bufferData[index] !== 0xFE && index<bufferData.length)
          index++;
     //Database section
     while (bufferData[index] === 0xfe) {
          console.log('inside db');
          index++; //Start of DB section
          index += stringEncoding(index, bufferData).byteRead; //Database index

          if (bufferData[index] === 0xfb) {
               index++;
               index += stringEncoding(index, bufferData).byteRead; // pass hash table size
               index += stringEncoding(index, bufferData).byteRead; //pass expiry size
          }
          console.log('after fb');
          while (bufferData[index] !== 0xff && index < bufferData.length) {
               index++; //1byte flag
               let encodedKeyData = stringEncoding(index, bufferData);
               index += encodedKeyData.byteRead; //As that will be to figure out the length of key

               let key = bufferData.toString(
                    'utf8',
                    index,
                    index + encodedKeyData.lengthOfString
               );
               keys.push(key);

               index += encodedKeyData.lengthOfString;

               let encodedValueData = stringEncoding(index, bufferData);
               index +=
                    encodedValueData.byteRead + encodedValueData.lengthOfString;

               if (bufferData[index] === 0xfc) {
                    index += 9; //timestamp in ms hence 8 bytes + 1 byte for FC
               } else if (bufferData[index] === 0xfd) {
                    index += 5; //timestamp in s hence 4 bytes + 1 byte for FC
               }
          }
     }
     console.log('keys', JSON.stringify(keys));
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
     const firstByte = Buffer[offset];
     const twoMostSignificantBits = firstByte >> 6;
     let result;
     console.log('twoMostSignificantBits', twoMostSignificantBits);
     switch (twoMostSignificantBits) {
          case 0:
               result = { lengthOfString: firstByte & 0x3f, byteRead: 1 };
               break;
          case 1:
               let nextByte = Buffer[offset + 1];
               result = {
                    lengthOfString: ((firstByte & 0x3f) << 8) | nextByte,
                    byteRead: 2,
               };
               break;
          case 2:
               result = {
                    lengthOfString: Buffer.readUInt32BE(offset + 1),
                    byteRead: 5,
               };
          case 3:
               // Handle special encoding
               if ((firstByte & 0x3f) === 0) {
                    // 8-bit integer
                    result = {
                         lengthOfString: Buffer[offset + 1],
                         byteRead: 2,
                    };
               } else if ((firstByte & 0x3f) === 1) {
                    // 16-bit integer
                    result = {
                         lengthOfString: Buffer.readUInt16BE(offset + 1),
                         byteRead: 3,
                    };
               } else if ((firstByte & 0x3f) === 2) {
                    // 32-bit integer
                    result = {
                         lengthOfString: Buffer.readUInt32BE(offset + 1),
                         byteRead: 5,
                    };
               } else {
                    throw new Error(
                         `Unhandled special encoding: ${firstByte & 0x3f}`
                    );
               }
               break;
          default:
               throw new Error('Invalid string encoding');
     }
     console.log("resukt",JSON.stringify(result));
     return result;
};
// const res = redisParser();
// console.log(res);
// console.log(redisResponse(res.command, res.commandArg));
server.listen(6379, '127.0.0.1');
