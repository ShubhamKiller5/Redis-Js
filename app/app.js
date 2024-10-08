import net from 'node:net';
import { redisParser, redisResponse } from './redisHandler.js';
import { config } from './config.js';
import { RedisReplica } from './replica.js';

if (config.get('isReplica')) {
    console.log("here for replica",config.get('masterHost'),config.get('masterPort'))
    const masterRedis = new RedisReplica(config.get('masterHost'),config.get('masterPort'));
    masterRedis.connect();
}

const server = net.createServer((connection) => {
     console.log('client connected');
     connection.on('end', () => {
          console.log('Client disconnected now');
     });
     connection.on('data', (data) => {
          const message = Buffer.from(data).toString().trim();
          const parsedObject = redisParser(message);
          const result = redisResponse(
               parsedObject.command,
               parsedObject.commandArg
          );
          connection.write(result);
     });
});

server.on('error', (error) => {
     throw error;
});

server.listen(config.get('port'), '127.0.0.1');
