import { config, map } from './config.js';
import { parseRdbFile } from './rdbParser.js';

export const redisParser = (str = '') => {
     const parsedObject = {
          command: [],
         commandArg: [],
     };
     const strArray = str.split('\r\n').filter((element) => element[0] !== '$');
     //  const totalArgs = strArray[0][1];
     console.log('strArray', strArray);
    //  if (strArray[1]?.includes('-')) {
    //       parsedObject['command'] = strArray[3];
    //       parsedObject['commandArg'] = strArray.slice(4);
    //       parsedObject['commandArg'].push(strArray[2]);
    //       return parsedObject;
    //  }

    let indexOfLengthOfCommand = 0,lenInd = 0;
    console.log('Going inside the while')
    while (lenInd < strArray.length)
    {
        let initial = lenInd;
        indexOfLengthOfCommand = Number(strArray[lenInd][1]);
        console.log("indexOfLengthOfCommand", indexOfLengthOfCommand, typeof indexOfLengthOfCommand);
        if (typeof indexOfLengthOfCommand != 'number') return parsedObject;

        let newArr = strArray.slice(initial + 1, lenInd + indexOfLengthOfCommand + 1);
        console.log('Initialise the new array', JSON.stringify(newArr));
        const commandArg = []
        for (let i = 0; i < indexOfLengthOfCommand; i++)
        {
            if (i == 0)
            {
                parsedObject['command'].push(newArr[i]);
                continue;
            }
            commandArg.push(newArr[i]);
        }
        parsedObject['commandArg'].push(commandArg)
        lenInd+=4;
        console.log("lenInd",lenInd)
    }
    //Uncomment the for loop
    //  for (let i = 0; i < strArray.length; i += 4) {
    //       const totalArgs = strArray[i];
    //       console.log('totalArgs', totalArgs);
    //       parsedObject['command'].push(strArray[i + 1]);
    //       if (totalArgs == '*1') {
    //            parsedObject['commandArg'] = null;
    //            return parsedObject;
    //       }
    //       parsedObject['commandArg'].push(strArray.slice(i + 2, i + 4));
    //  }

     //  parsedObject['command'] = strArray[1];
     //  if (totalArgs == '*1') {
     //       parsedObject['commandArg'] = null;
     //       return parsedObject;
     //  }
    //  parsedObject['commandArg'] = strArray.slice(2, 4);
    console.log(parsedObject)
     return parsedObject;
};

export const redisResponse = (command, commandArg) => {
     if (!command || command == undefined) return '-ERR unknown command\r\n';
     command = command.toLowerCase();
    console.log({commandArg})
     switch (command) {
          case 'echo':
               return respPattern(commandArg.join(' '));
          case 'ping':
               return '+PONG\r\n';
          case 'set':
               return handleSet(commandArg);
          case 'get':
               return handleGet(commandArg);
          case 'config':
               return handleConfig(commandArg);
          case 'keys':
               return handleKeys(commandArg);
          case 'info':
               return handleInfo(commandArg);
          case 'replconf':
               return handleReplicaConfig();
          case 'psync':
               return handlePsync();
          default:
               return '-ERR unknown command\r\n';
     }
};

const handlePsync = () => {
     return respPattern(
          'FULLRESYNC 8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb 0'
     );
};

const handleReplicaConfig = () => {
     return respPattern('OK');
};

const handleInfo = (commandArg) => {
     const port = commandArg[commandArg.length - 1];
     let info = '';
     if (config.get('isReplica')) {
          info = 'role:slave';
     } else info = 'role:master';

     info +=
          '\r\nmaster_replid:8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb\r\nmaster_repl_offset:0';
     return respPattern(info);
};

const handleSet = (commandArg) => {
     const [key, val, px, expire] = commandArg;
     map[key] = {
          val: val,
          time: new Date().getTime(),
          expire: expire ? parseInt(expire) : null,
     };

     if (!config.get('isReplica')) {
          let replicaConnections = config.get('replicaConnections');
          replicaConnections?.forEach((connection) => {
               let message = respPattern(['SET', ...commandArg]);
               connection.write(message);
          });
     }
     return '+OK\r\n';
};

const handleGet = (commandArg) => {
     let val;
     if (
          !config.get('isReplica') &&
          (config.get('dir') || config.get('dbfilename'))
     ) {
          const filePath = `${config.get('dir')}/${config.get('dbfilename')}`;
          val = parseRdbFile(filePath, true, commandArg[0]);
     } else {
          val = map[commandArg[0]];
     }
     console.log('value', val);
     if (val && (!val.expire || val.expire > new Date().getTime() - val.time)) {
          return respPattern(val.val);
     } else {
          return respPattern(-1);
     }
};

const handleConfig = (commandArg) => {
     if (commandArg[0].toLowerCase() === 'get') {
          if (commandArg[1].toLowerCase() == 'dir') {
               return respPattern(['dir', config.get('dir')]);
          } else if (commandArg[1].toLowerCase() == 'dbfilename') {
               return respPattern(['dbFileName', config.get('dbfilename')]);
          }
     }
};

const handleKeys = (commandArg) => {
     if (commandArg[0] == '*') {
          const filePath = `${config.get('dir')}/${config.get('dbfilename')}`;
          let keys = parseRdbFile(filePath);
          return respPattern(keys);
     }
};

export const respPattern = (val) => {
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
