const net = require("node:net");
const map = {};
const server = net.createServer((connection) => {
     console.log("client connected");
     connection.on("end", () => {
          console.log("Client disconnected");
     });
     connection.on("data", (data) => {
          const message = Buffer.from(data).toString().trim();
          console.log("messge", message);
          const parsedObject = redisParser(message);
          console.log("parsedObj", parsedObject);
          const result = redisResponse(
               parsedObject.command,
               parsedObject.commandArg
          );
          console.log("result", result);
          connection.write(result);
     });
     //  connection.pipe(connection);
});
server.on("error", (error) => {
     throw error;
});

// *2\r\n$4\r\nECHO\r\n$3\r\nhey\r\n
const redisParser = (str = '') => {
     const parsedObject = {
          command: '',
          commandArg: [],
     };
     const strArray = str.split("\r\n");
     // const strArray = ['*2', 'get', 'fruit'];
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
          map[key] = val;
          console.log(map[key])
          return `+OK\r\n`;
     } else if (command == 'get') {
          const val = map[commandArg[0]];
          if(val) return respPattern(val);
          else return respPattern(-1);
     } else {
          return '-ERR unknown command\r\n';
     }
};

const respPattern = (val) => {
     const type = typeof val;
     let ans = null;
     switch(type)
     {
          case 'string':
               ans = `$${val.length}\r\n${val}\r\n`;
               break;
          case 'number':
               ans = `$${val}\r\n`;
               break;
     }
     return ans;
};
// const res = redisParser();
// console.log(res);
// console.log(redisResponse(res.command, res.commandArg));
server.listen(6379, "127.0.0.1");
