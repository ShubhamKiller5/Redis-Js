import net from 'node:net';
import { Constants } from './utils/index.js';
const config = new Map();
const [file, dbFileName] = [process.argv[3] ?? null, process.argv[5] ?? null];
console.log("filearg",file,dbFileName);
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
          console.log('process.argv',process.argv);
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
                    console.log("file",config.get('dir'));
                    const ans = ['dir', config.get('dir')];
                    return respPattern(ans);
               } else if (commandArg[1].toLowerCase() == 'dbfilename') {
                    console.log('filename',config.get('dbfilename'))
                    const ans = ['dbFileName', config.get('dbfilename')];
                    return respPattern(ans);
               }
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
                    val.length === 2 &&
                    val.every((item) => typeof item === 'string')
               ) {
                    ans = `*2\r\n$${val[0].length}\r\n${val[0]}\r\n$${val[1].length}\r\n${val[1]}\r\n`;
               }
               break;
     }
     return ans;
};
// const res = redisParser();
// console.log(res);
// console.log(redisResponse(res.command, res.commandArg));
server.listen(6379, '127.0.0.1');
